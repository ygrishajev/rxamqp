# [Reactive AMQP](https://github.com/ygrishajev/rxamqp) [![Build Status](https://api.travis-ci.org/ygrishajev/rxamqp.svg)](https://travis-ci.org/ygrishajev/rxamqp) [![rxamqp codecov](https://codecov.io/gh/ygrishajev/rxamqp/branch/master/graph/badge.svg)](https://codecov.io/gh/ygrishajev/rxamqp)

This library is aimed to ease [amqplib](https://github.com/squaremo/amqp.node) usage.


## Installation:
```
npm i rxamqp -S
```

## Following features are implemented:
* Client reconnection
* Failed channel reopening
* Express like middleware pipelines for subscriptions
* Promise based querying interface


## Usage example

```javascript

const createClient = require('rxamqp')

const client = createClient()

// prepare reply queues beforehand to save request time later
client.assertReplyQueue('foo.bar')
client.assertReplyQueue('foo.bar.error.sync')
client.assertReplyQueue('foo.bar.error.async')

client
  // middlewares bound to specific routing keys and exchange
  .use(
    { exchange: 'amq.topic', routingKey: 'foo.bar' }, (msg, ctx, next) => {
      ctx.value = 1
      return next()
    }, (msg, ctx, next) => {
      ctx.value++
      return next()
    }
  )
  .use(
    { exchange: 'amq.topic', routingKey: 'foo.bar.error.sync' }, (msg, ctx, next) => {
      ctx.value = 1
      throw new Error('Some sync Error')
      return next()
    }, (msg, ctx, next) => {
      ctx.value++
      return next()
    }
  )
  .use(
    { exchange: 'amq.topic', routingKey: 'foo.bar.error.async' }, (msg, ctx, next) => {
      ctx.value = 1
      setTimeout(() => {
        next(new Error('Some async Error'))
      }, 0)
    }, (msg, ctx, next) => {
      ctx.value++
      return next()
    }
  )
  // global middleware
  .use((msg, ctx, next) => {
    return ctx.respond({ foo: `${msg.bar} - ${ctx.value}`  })
  })
  // global error handler
  .use((error, msg, ctx, next) => {
    ctx.rejectAndRespond({ foo: `${msg.bar} - ${ctx.value}`, error: error.message })
    next()
  })

client.listen()

client.request('amq.topic', 'foo.bar', { bar: 'bar' })
  .then(result => console.log(result))
/*
  {
    "data": {
      "foo": "bar - 2"
    }
  }
*/
client.request('amq.topic', 'foo.bar.error.sync', { bar: 'bar' })
  .catch(result => console.log(result))
/*
{
  "data": {
    "foo": "bar - 1",
    "error": "Some sync Error"
  }
}
*/
client.request('amq.topic', 'foo.bar.error.async', { bar: 'bar' })
  .catch(result => console.log(result))
/*
{
  "data": {
    "foo": "bar - 1",
    "error": "Some async Error"
  }
}
*/

```

## Roadmap
* Improve documentation
