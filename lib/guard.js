'use strict';

/* eslint prefer-rest-params: "off" */

const stream = require('readable-stream');
const crypto = require('crypto');

const SEPARATOR = '~';
const push = Symbol('push');

const MetricsGuard = class MetricsGuard extends stream.Transform {
    constructor({
        permutationThreshold = 1000,
        metricsThreshold = 60,
        enabled = true,
        id,
    } = {}) {
        super(
            Object.assign(
                {
                    objectMode: true,
                },
                ...arguments,
            ),
        );

        if (typeof enabled !== 'boolean') throw new Error('Provided value to argument "enabled" must be a Boolean');
        if (!Number.isFinite(permutationThreshold)) throw new Error('Provided value to argument "permutationThreshold" must be a Number');
        if (!Number.isFinite(metricsThreshold)) throw new Error('Provided value to argument "metricsThreshold" must be a Number');

        Object.defineProperty(this, 'id', {
            value: id || crypto.randomBytes(3 * 4).toString('base64'),
            enumerable: true,
        });

        Object.defineProperty(this, 'metricsThreshold', {
            value: metricsThreshold,
        });

        Object.defineProperty(this, 'permutationWarnThreshold', {
            value: Math.floor((permutationThreshold / 100) * 80),
        });

        Object.defineProperty(this, 'permutationThreshold', {
            value: permutationThreshold,
        });

        Object.defineProperty(this, 'enabled', {
            value: enabled,
        });

        Object.defineProperty(this, 'registry', {
            value: new Map(),
        });

        // Avoid hitting the max listeners limit when multiple
        // streams is piped into the same stream.
        this.on('pipe', () => {
            this.setMaxListeners(this.getMaxListeners() + 1);
        });

        this.on('unpipe', () => {
            this.setMaxListeners(this.getMaxListeners() - 1);
        });
    }

    get [Symbol.toStringTag]() {
        return 'MetricsGuard';
    }

    [push](metric) {
        const met = metric;
        met.source = this.id;
        // eslint-disable-next-line no-underscore-dangle
        if (this._readableState.flowing) {
            this.push(met);
            return;
        }
        this.emit('drop', met);
    }

    getMetrics() {
        return Array.from(this.registry.keys());
    }

    getLabels(metric) {
        const labels = this.registry.get(metric);
        if (labels) {
            return Array.from(labels.keys()).map((label) => {
                const [name, value] = label.split(SEPARATOR);
                return { name, value };
            });
        }
        return [];
    }

    reset() {
        this.registry.clear();
    }

    _transform(metric, enc, next) {
        // guarding is disabeled, pass metrich through
        if (!this.enabled) {
            next(null, metric);
            return;
        }

        // number of metrics registered exceeds the threshold
        // emit warning
        if (this.registry.size >= this.metricsThreshold) {
            this.emit('warn', 'metrics', this.registry.size);
        }

        let entry = this.registry.get(metric.name);

        if (entry) {
            // too many label permutations is registered on
            // the metric so drop the metric
            if (entry.size >= this.permutationThreshold) {
                this.emit('drop', metric);
                next(null);
                return;
            }

            // getting close to the threshold of too many label
            // permutations registered on the metric so warn
            if (entry.size >= this.permutationWarnThreshold) {
                this.emit('warn', 'permutation', metric.name);
            }
        } else {
            // metric was not in registry, greate a new entry
            // in the registry
            entry = new Set();
            this.registry.set(metric.name, entry);
        }

        // push all label permutations on the metric into the
        // Set for the metric in the registry. the size of
        // this Set is compared with the threshold
        metric.labels.forEach((label) => {
            entry.add(`${label.name}${SEPARATOR}${label.value}`);
        });

        if (metric.source === this.id) {
            this.emit('drop', metric);
            next(null);
            return;
        }

        next(null, metric);
    }
};

module.exports = MetricsGuard;
