'use strict';

/* eslint prefer-rest-params: "off" */

const stream = require('readable-stream');
const crypto = require('crypto');

const push = Symbol('push');

const MetricsGuard = class MetricsGuard extends stream.Transform {
    constructor({
        permutationThreshold = 1000,
        metricsThreshold = 60,
        enabled = true,
        id = undefined,
    } = {}) {
        super(
            Object.assign(
                {
                    objectMode: true,
                },
                ...arguments,
            ),
        );

        if (!Number.isFinite(metricsThreshold)) throw new Error('Provided value to argument "metricsThreshold" must be a Number');
        if (!Number.isFinite(permutationThreshold)) throw new Error('Provided value to argument "permutationThreshold" must be a Number');

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
            return Array.from(labels.keys());
        }
        return [];
    }

    reset() {
        this.registry.clear();
    }

    _transform(metric, enc, next) {
        if (!this.enabled) {
            next(null, metric);
            return;
        }

        // to many metrics - emit warning
        if (this.registry.size >= this.metricsThreshold) {
            this.emit('warn', 'metrics', this.registry.size);
        }

        let entry = this.registry.get(metric.name);

        if (entry) {
            if (entry.size >= this.permutationThreshold) {
                // to many labels on the metric - drop the metric
                this.emit('drop', metric);
                next(null);
                return;
            }

            if (entry.size >= this.permutationWarnThreshold) {
                this.emit('warn', 'permutation', metric.name);
            }
        } else {
            entry = new Set();
            this.registry.set(metric.name, entry);
        }

        metric.labels.forEach((label) => {
            entry.add(label.value);
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
