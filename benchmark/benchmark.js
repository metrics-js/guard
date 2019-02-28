'use strict';

/* eslint no-unused-vars: "off", import/no-extraneous-dependencies: "off", no-console: "off" */

const benchmark = require('fastbench');
const stream = require('readable-stream');
const Metric = require('@metrics/metric');
const Guard = require('../');

const srcObjectStream = () => {
    return new stream.Readable({
        objectMode: true,
        read() {

        }
    });
};

const destObjectStream = (done) => {
    const dStream = new stream.Writable({
        objectMode: true,
        write(chunk, encoding, callback) {
            callback();
        },
    });
    dStream.on('finish', done);
    return dStream;
};

const iterations = 10;
const max = 100000;

const run = benchmark([
    function NonGuardedMetricStream (done) {
        const guard = new Guard({enabled: false, permutationThreshold: (max + 1)});
        const dest = destObjectStream(done);
        const src = srcObjectStream();

        src.pipe(guard).pipe(dest);

        for (var i = 0; i < max; i++) {
            const metric = new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'foo', value: i }] });
            src.push(metric);
        }

        process.nextTick(() => {
            src.push(null);
        });
    },

    function GuardedMetricStreamNoDrop (done) {
        const guard = new Guard({enabled: true, permutationThreshold: (max * 2)});
        const dest = destObjectStream(done);
        const src = srcObjectStream();

        src.pipe(guard).pipe(dest);

        for (var i = 0; i < max; i++) {
            const metric = new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'foo', value: i }] });
            src.push(metric);
        }

        process.nextTick(() => {
            src.push(null);
        });
    },

    function GuardedMetricStreamDropping (done) {
        const guard = new Guard({enabled: true, permutationThreshold: 10000});
        const dest = destObjectStream(done);
        const src = srcObjectStream();

        src.pipe(guard).pipe(dest);

        for (var i = 0; i < max; i++) {
            const metric = new Metric({ name: 'foo', description: 'foo', labels: [{ name: 'foo', value: i }] });
            src.push(metric);
        }

        process.nextTick(() => {
            src.push(null);
        });
    },
], iterations)

// run them two times
console.log(`Push ${max*iterations} metric objects through metric stream:`);
run(run);
