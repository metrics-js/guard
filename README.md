# @metrics/guard

Module to guard against excessive metric permutation creation in a metric stream.

[![Dependencies](https://img.shields.io/david/metrics-js/guard.svg?style=flat-square)](https://david-dm.org/metrics-js/guard)
[![Build Status](http://img.shields.io/travis/metrics-js/guard/master.svg?style=flat-square)](https://travis-ci.org/metrics-js/guard)
[![Greenkeeper badge](https://badges.greenkeeper.io/metrics-js/guard.svg?style=flat-square)](https://greenkeeper.io/)
[![Known Vulnerabilities](https://snyk.io/test/github/metrics-js/guard/badge.svg?targetFile=package.json&style=flat-square)](https://snyk.io/test/github/metrics-js/guard?targetFile=package.json)

## Installation

```bash
$ npm install @metrics/guard
```

## Example

Guard a metric stream.

```js
const Collector = require('someMetricCollector');
const Client = require('@metrics/client');
const Guard = require('@metrics/guard');

const collector = new Collector();
const client = new Client();
const guard = new Guard();

guard.on('warn', (info) => {
    console.log(`WARN: ${info} is creating a growing number of permutations`);
});

guard.on('drop', (metric) => {
    console.log(`CRITICAL: ${metric.name} has created to many permutations. Metric is dropped.`);
});

client.pipe(guard).pipe(collector);

const counter = client.counter({
    name: 'my_counter',
    description: 'Counter description',
});

for (let i = 0; i < 10000; i++) {
    counter.inc({ labels: { index: i } });
}
```

## Description

Metrics, in general, should be created and curated with care to make sure one
collects metrics which give value without causing system drainage. It is
effortless to produce excessive amounts of metrics from an application, which
in a worst-case scenario can bring both the application and the metric system
to a halt.

As an example; a widespread mistake when creating metrics in a web application
is to count the number of requests to a route which contains a user ID and
pass the URL on as a label to the metric.

```js
const client = new Client();
const app = express();

const counter = client.counter({
    name: 'http_requests',
    description: 'Number of HTTP requests',
});

app.get('/home/#id', (req, res) => {
    counter.inc({ labels: { url: req.originalUrl } });
    res.send(`Hello ${req.params.id}`)
});
```

The above will in some metric systems generate a new permutation of the metric
for each unique URL and since the URL contain users IDs one can potentially
generate a massive amount of permutations.

In other words; the above is something one should avoid. But it's a common
mistake to do.

This module guards against excessive metric and permutation creation in a metric
stream. If a mistake, such as the one above, is made, this module will guard
against a bad metric filling up the metric stream.

### Permutation threshold

Labels on a metric is the normal culprit to excessive metric permutation creation,
since labels are normally a permutation of the metric.

Due to this, the guard monitors the amount of permutations of a metric and if a
threshold of permutations is exceeded the guard will drop the metric from the
metric stream and emit a `drop` event.

Prior to a metric exceeding the threshold, the guard will start emitting
a `warn` event that the metric is growing close to the threshold. At this point
the metric is still pushed forward on the metric stream.

The above events can be used to log bad metrics or alert developers to take
action.

### Metrics threshold

It also might be that an application is just reporting too many different metrics.

This guard will also monitor the amount of unique metrics and will start emitting
a `warn` event when a threshold of allowed unique metrics is exceeded.

Metrics will not be dropped due to this.

## Constructor

Create a new Guard instance.

```js
const Guard = require('@metrics/guard');
const guard = new Guard(options);
```

### options (optional)

An Object containing misc configuration. The following values can be provided:

  * **permutationThreshold** - `Number` - Threshold of how many permutations of a metrics which should be allowed. Default: 1000.
  * **metricsThreshold** - `Number` - Threshold of how many unique metrics which should be allowed. Default: 60.
  * **enabled** - `Boolean` - If the guard should be enabled or not. Default: `true`.
  * **id** - `String` - Give the instanse a unique identifier. Default: `hash`

The Guard instance inherit from Transform Stream. Due to this the instance also
take all config parameters which the Transform Stream does.

Please see the [documentation of Transform Streams](https://nodejs.org/api/stream.html#stream_duplex_and_transform_streams) for further documentation.

## API

The Guard instance have the following API:

### .getMetrics()

Get a list off the names of all the metrics which has been registered by the
guard.

```js
const guard = new Guard();
guard.getMetrics();
```

Returns an `Array`.

### .getLabels(name)

Get a list off all the different labels on a metrics which has been registered
by the guard.

```js
const guard = new Guard();
guard.getLabels('foo');
```

This method take the following arguments:

 * **name** - The name of the metric to retrieve labels from. Required.

Returns an `Array` with label `Objects`.

### .reset()

Resets the guard. All collected info about the metric stream is dropped.

```js
const guard = new Guard();
guard.reset();
```

## Events

The Guard instance inherit from Transform Stream. Due to this the instance emits all
the events which Transform Stream does when the streaming feature is used.

Please see the [documentation of Transform Streams](https://nodejs.org/api/stream.html#stream_duplex_and_transform_streams) for further documentation.

In addition to this, the following events are emitted:

### warn

Emitted prior to when permutation threshold is exceeded or when the metrics
threshold is exceeded.

```js
const guard = new Guard();
guard.on('warn', (type, info) => {
    if (type === 'metrics') {
        console.log(`WARN: application has over ${info} unique metrics`);
    }

    if (type === 'permutation') {
        console.log(`WARN: ${info} is creating a growing number of permutations`);
    }
});
```

### drop

Emitted when a permutation threshold is exceeded or when a circular stream has
been detected.

```js
const guard = new Guard();
guard.on('drop', (metric) => {
    console.log(`CRITICAL: Metric with the name ${metric.name} is dropped.`);
});
```

## License

The MIT License (MIT)

Copyright (c) 2019 Trygve Lie

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
