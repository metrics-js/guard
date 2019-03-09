'use strict';

const MetricsClient = require('@metrics/client');
const stream = require('readable-stream');
const Metric = require('@metrics/metric');
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

tap.test(
    '.pipe() - exceed the default, 10, number of max event listeners - should not cause the process to emit a MaxListenersExceededWarning',
    (t) => {
        const clientA = new MetricsClient();
        const clientB = new MetricsClient();
        const clientC = new MetricsClient();
        const clientD = new MetricsClient();
        const clientE = new MetricsClient();
        const clientF = new MetricsClient();
        const clientG = new MetricsClient();
        const clientH = new MetricsClient();
        const clientI = new MetricsClient();
        const clientJ = new MetricsClient();
        const clientK = new MetricsClient();
        const clientL = new MetricsClient();
        const clientM = new MetricsClient();
        const clientN = new MetricsClient();

        const guard = new Guard();

        process.on('warning', (warning) => {
            if (warning.name === 'MaxListenersExceededWarning') {
                t.fail();
            }
        });

        const dest = destObjectStream((result) => {
            t.equal(result.length, 14);
            t.end();
        });

        clientA.on('error', (error) => { console.log('a error', error); });
        clientB.on('error', (error) => { console.log('b error', error); });
        clientC.on('error', (error) => { console.log('c error', error); });
        clientD.on('error', (error) => { console.log('d error', error); });
        clientE.on('error', (error) => { console.log('e error', error); });
        clientF.on('error', (error) => { console.log('f error', error); });
        clientG.on('error', (error) => { console.log('g error', error); });
        clientH.on('error', (error) => { console.log('h error', error); });
        clientI.on('error', (error) => { console.log('i error', error); });
        clientJ.on('error', (error) => { console.log('j error', error); });
        clientK.on('error', (error) => { console.log('k error', error); });
        clientL.on('error', (error) => { console.log('l error', error); });
        clientM.on('error', (error) => { console.log('m error', error); });
        clientN.on('error', (error) => { console.log('n error', error); });
        guard.on('error', (error) => { console.log('x error', error); });

        clientA.pipe(guard);
        clientB.pipe(guard);
        clientC.pipe(guard);
        clientD.pipe(guard);
        clientE.pipe(guard);
        clientF.pipe(guard);
        clientG.pipe(clientH).pipe(clientI).pipe(clientJ).pipe(guard);
        clientK.pipe(guard);
        clientL.pipe(clientM).pipe(guard);
        clientN.pipe(guard);

        guard.pipe(dest);

        clientA.metric({ name: 'a_test', description: '.' });
        clientB.metric({ name: 'b_test', description: '.' });
        clientC.metric({ name: 'c_test', description: '.' });
        clientD.metric({ name: 'd_test', description: '.' });
        clientE.metric({ name: 'e_test', description: '.' });
        clientF.metric({ name: 'f_test', description: '.' });
        clientG.metric({ name: 'g_test', description: '.' });
        clientH.metric({ name: 'h_test', description: '.' });
        clientI.metric({ name: 'i_test', description: '.' });
        clientJ.metric({ name: 'j_test', description: '.' });
        clientK.metric({ name: 'k_test', description: '.' });
        clientL.metric({ name: 'l_test', description: '.' });
        clientM.metric({ name: 'm_test', description: '.' });
        clientN.metric({ name: 'n_test', description: '.' });

        setImmediate(() => {
            dest.end();
        });
    },
);
