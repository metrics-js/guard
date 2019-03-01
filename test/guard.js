'use strict';

const Metric = require('@metrics/metric');
const stream = require('readable-stream');
const tap = require('tap');
const MetricsGuard = require('../lib/guard');

const srcObjectStream = (arr) => {
    return new stream.Readable({
        objectMode: true,
        read() {
            arr.forEach((item) => {
                this.push(item);
            });
            this.push(null);
        }
    });
};

const destObjectStream = (done) => {
    const arr = [];

    const dStream = new stream.Writable({
        objectMode: true,
        write(chunk, encoding, callback) {
            arr.push(chunk);
            callback();
        },
    });

    dStream.on('finish', () => {
        done(arr);
    });

    return dStream;
};

tap.test('Guard() - object type - should be MetricsGuard', (t) => {
    const guard = new MetricsGuard();
    t.equal(Object.prototype.toString.call(guard), '[object MetricsGuard]');
    t.end();
});

tap.test('Guard() - "metricsThreshold" argument is not valid - should throw', (t) => {
    t.plan(1);
    t.throws(() => {
        const guard = new MetricsGuard({ metricsThreshold: 'foo' }); // eslint-disable-line no-unused-vars
    }, /Provided value to argument "metricsThreshold" must be a Number/);
    t.end();
});

tap.test('Guard() - "permutationThreshold" argument is not valid - should throw', (t) => {
    t.plan(1);
    t.throws(() => {
        const guard = new MetricsGuard({ permutationThreshold: 'foo' }); // eslint-disable-line no-unused-vars
    }, /Provided value to argument "permutationThreshold" must be a Number/);
    t.end();
});

tap.test('Guard() - "enabled" argument is not valid - should throw', (t) => {
    t.plan(1);
    t.throws(() => {
        const guard = new MetricsGuard({ enabled: 'foo' }); // eslint-disable-line no-unused-vars
    }, /Provided value to argument "enabled" must be a Boolean/);
    t.end();
});

tap.test('Guard() - "permutationThreshold" is at 6 - one metric exceed this - should drop the metric from the stream when exceeding the threshold', (t) => {
    const guard = new MetricsGuard({
        permutationThreshold: 6, // warns at 4
        metricsThreshold: 10,
    });
    const metrics = [
        new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'foo', value: 1 }] }),
        new Metric({ name: 'bar', description: 'bar' }),
        new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'foo', value: 2 }] }),
        new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'foo', value: 3 }] }),
        new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'foo', value: 4 }] }),
        new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'foo', value: 5 }] }),
        new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'foo', value: 6 }] }),
        new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'foo', value: 7 }] }),
        new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'foo', value: 8 }] }),
        new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'foo', value: 9 }] }),
        new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'foo', value: 10 }] }),
        new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'foo', value: 11 }] }),
        new Metric({ name: 'xyz', description: 'xyz' }),
    ];

    const src = srcObjectStream(metrics);
    const dest = destObjectStream((arr) => {
        // there is total 3 metrics in the stream
        const mets = guard.getMetrics();
        t.equal(mets.length, 3);

        // the "foo" metric has been capped at the threshold
        const labels = guard.getLabels('foo');
        t.equal(labels.length, 6);

        // since "foo" metrics where capped only 8 metrics got through the stream
        t.equal(arr.length, 8);
        t.end();
    });

    src.pipe(guard).pipe(dest);

    setImmediate(() => {
        dest.end();
    });
});



