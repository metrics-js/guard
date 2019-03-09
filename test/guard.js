'use strict';

const Metric = require('@metrics/metric');
const stream = require('readable-stream');
const tap = require('tap');
const Guard = require('../lib/guard');

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
        if (done) {
            done(arr);
        }
    });

    return dStream;
};

tap.test('Guard() - object type - should be MetricsGuard', (t) => {
    const guard = new Guard();
    t.equal(Object.prototype.toString.call(guard), '[object MetricsGuard]');
    t.end();
});

tap.test('Guard() - "metricsThreshold" argument is not valid - should throw', (t) => {
    t.plan(1);
    t.throws(() => {
        const guard = new Guard({ metricsThreshold: 'foo' }); // eslint-disable-line no-unused-vars
    }, /Provided value to argument "metricsThreshold" must be a Number/);
    t.end();
});

tap.test('Guard() - "permutationThreshold" argument is not valid - should throw', (t) => {
    t.plan(1);
    t.throws(() => {
        const guard = new Guard({ permutationThreshold: 'foo' }); // eslint-disable-line no-unused-vars
    }, /Provided value to argument "permutationThreshold" must be a Number/);
    t.end();
});

tap.test('Guard() - "enabled" argument is not valid - should throw', (t) => {
    t.plan(1);
    t.throws(() => {
        const guard = new Guard({ enabled: 'foo' }); // eslint-disable-line no-unused-vars
    }, /Provided value to argument "enabled" must be a Boolean/);
    t.end();
});

tap.test('Guard() - "permutationThreshold" is at 6 - one metric exceed this - should drop the metric from the stream when exceeding the threshold', (t) => {
    const guard = new Guard({
        permutationThreshold: 6, // warns at 4
        metricsThreshold: 10,
    });
    const metrics = [
        new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'a', value: 1 }] }),
        new Metric({ name: 'bar', description: 'bar' }),
        new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'a', value: 2 }, { name: 'b', value: 1 }, { name: 'c', value: 2 }] }),
        new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'a', value: 3 }] }),
        new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'a', value: 4 }] }),
        new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'a', value: 5 }] }),
        new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'a', value: 6 }] }),
        new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'a', value: 7 }] }),
        new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'a', value: 8 }] }),
        new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'a', value: 9 }] }),
        new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'a', value: 10 }] }),
        new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'a', value: 11 }] }),
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

        // since "foo" metrics where capped at 6 label permutations,
        // only 4 "foo" metrics plus the "bar" and "xyz" metrics got
        // through the stream
        t.equal(arr.length, 6);
        t.equal(arr.filter(obj => obj.name === 'foo').length, 4);
        t.equal(arr.filter(obj => obj.name === 'bar').length, 1);
        t.equal(arr.filter(obj => obj.name === 'xyz').length, 1);
        t.end();
    });

    src.pipe(guard).pipe(dest);

    setImmediate(() => {
        dest.end();
    });
});

tap.test('Guard() - "metricsThreshold" is at 4 - one metric exceed this - should emit warn event', (t) => {
    const guard = new Guard({
        metricsThreshold: 4,
    });
    const metrics = [
        new Metric({ name: 'foo', description: 'foo' }),
        new Metric({ name: 'bar', description: 'bar' }),
        new Metric({ name: 'xyz', description: 'xyz' }),
        new Metric({ name: 'foobar', description: 'foobar' }),
        new Metric({ name: 'barfoo', description: 'barfoo' }),
    ];

    const src = srcObjectStream(metrics);
    const dest = destObjectStream();

    guard.on('warn', (type, size) => {
        t.equal(type, 'metrics');
        t.equal(size, 4);
        t.end();
    });

    src.pipe(guard).pipe(dest);

    setImmediate(() => {
        dest.end();
    });
});

tap.test('Guard() - "enabled" is "false" - metrics exceeds limits - should not interfere and should not store internal metrics', (t) => {
    const guard = new Guard({
        permutationThreshold: 6, // warns at 4
        metricsThreshold: 4,
        enabled: false,
    });
    const metrics = [
        new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'a', value: 1 }] }),
        new Metric({ name: 'bar', description: 'bar' }),
        new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'a', value: 2 }, { name: 'b', value: 1 }, { name: 'c', value: 2 }] }),
        new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'a', value: 3 }] }),
        new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'a', value: 4 }] }),
        new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'a', value: 5 }] }),
        new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'a', value: 6 }] }),
        new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'a', value: 7 }] }),
        new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'a', value: 8 }] }),
        new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'a', value: 9 }] }),
        new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'a', value: 10 }] }),
        new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'a', value: 11 }] }),
        new Metric({ name: 'xyz', description: 'xyz' }),
    ];

    const src = srcObjectStream(metrics);
    const dest = destObjectStream((arr) => {
        const m = guard.getMetrics();
        const l = guard.getLabels();
        t.equal(m.length, 0);
        t.equal(l.length, 0);

        t.equal(arr.length, 13);
        t.end();
    });

    src.pipe(guard).pipe(dest);

    setImmediate(() => {
        dest.end();
    });
});

tap.test('.getMetrics() - set metrics - call method - should return an Array with metric names without duplicates', (t) => {
    const guard = new Guard();
    const metrics = [
        new Metric({ name: 'bar', description: 'bar' }),
        new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'foo', value: 1 }] }),
        new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'foo', value: 2 }] }),
        new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'foo', value: 3 }] }),
        new Metric({ name: 'xyz', description: 'xyz' }),
        new Metric({ name: 'foobar', description: 'foobar' }),
        new Metric({ name: 'barfoo', description: 'barfoo' }),
    ];

    const src = srcObjectStream(metrics);
    const dest = destObjectStream((arr) => {
        const m = guard.getMetrics();
        t.equal(m.length, 5);
        t.equal(m.filter(name => name === 'foo').length, 1);

        t.equal(arr.length, 7);
        t.end();
    });

    src.pipe(guard).pipe(dest);

    setImmediate(() => {
        dest.end();
    });
});

tap.test('.getLabels() - set metrics - call method - should return an Array with metric names without duplicates', (t) => {
    const guard = new Guard();
    const metrics = [
        new Metric({ name: 'bar', description: 'bar' }),
        new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'foo', value: 1 }] }),
        new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'foo', value: 2 }] }),
        new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'foo', value: 3 }] }),
        new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'foo', value: 2 }] }),
        new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'foo', value: 2 }] }),
        new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'bar', value: 2 }] }),

        new Metric({ name: 'xyz', description: 'xyz', labels: [{ name: 'foo', value: 2 }] }),
    ];

    const src = srcObjectStream(metrics);
    const dest = destObjectStream((arr) => {
        const labels = guard.getLabels('foo');
        t.equal(labels.length, 4);
        t.equal(labels.filter(label => label.name === 'foo' && label.value === '1').length, 1);
        t.equal(labels.filter(label => label.name === 'foo' && label.value === '2').length, 1);
        t.equal(labels.filter(label => label.name === 'foo' && label.value === '3').length, 1);
        t.equal(labels.filter(label => label.name === 'bar' && label.value === '2').length, 1);
        t.equal(arr.length, 8);
        t.end();
    });

    src.pipe(guard).pipe(dest);

    setImmediate(() => {
        dest.end();
    });
});

tap.test('.reset() - set metrics - call method - should empty the guard registry', (t) => {
    const guard = new Guard();
    const metrics = [
        new Metric({ name: 'bar', description: 'bar' }),
        new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'foo', value: 1 }] }),
        new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'foo', value: 2 }] }),
        new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'foo', value: 3 }] }),
        new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'foo', value: 2 }] }),
        new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'foo', value: 2 }] }),
        new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'bar', value: 2 }] }),

        new Metric({ name: 'xyz', description: 'xyz', labels: [{ name: 'foo', value: 2 }] }),
    ];

    const src = srcObjectStream(metrics);
    const dest = destObjectStream((arr) => {
        const metricsA = guard.getMetrics();
        t.equal(metricsA.length, 3);

        const labelsA = guard.getLabels('foo');
        t.equal(labelsA.length, 4);

        guard.reset();

        const metricsB = guard.getMetrics();
        t.equal(metricsB.length, 0);

        const labelsB = guard.getLabels('foo');
        t.equal(labelsB.length, 0);


        t.equal(arr.length, 8);
        t.end();
    });

    src.pipe(guard).pipe(dest);

    setImmediate(() => {
        dest.end();
    });
});
