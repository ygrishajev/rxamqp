# Reactive AMQP

This library is aimed to ease [amqplib](https://github.com/squaremo/amqp.node) usage.

[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)

## Installation:
```
npm i rxamqp -S
```

## Following features are implemented:
* Client reconnection
* Failed channel reopening
* Routing and message validation via [jsonschema](https://github.com/tdegrunt/jsonschema)
* Promise based querying interface that is curried by default

## Usage

The library allow you to easily handle amqp routing and request/publish routines. The simpliest usage is:
```
const client = ReactiveMQ.create({
  url,
  appId,
  routerConfig: {
    routes: [
      {
        exchange: 'amq.topic',
        routingKey: 'hardware.v1.created',
        resolver: () => {}
      }
    ]
  }
})

client.publish('amq.topic', 'routing.key', { foo: 'bar' })
client.request('amq.topic', 'routing.key', { foo: 'bar' })
  .then(response => {})
```

## Reference

### RxConnection 

`connect(url, options)`

**returns** rxConnection (see below)

**Params**

*url* (string | object): amqp url string or object, same as described in [amqplib](https://www.squaremobius.net/amqp.node/channel_api.html#connect)

*options.logger* ({ log, warn } | null | false): logger to output connection state changes. Default is `console`. Set falsy value to disable logging

```
import { connect } from 'rxamqp'

const rxConnection = connect(url, options)
```

`rxConnection` - patched Rx.BehaviorSubject instance emitting amqp.connection or `null` in case of no connection/connection close

**Instance methods**

`rxConnection.close()`

**returns** Promise

Closes amqplib connection, completes Rx.BehaviorSubject instance and cleans up

### RxChannel

`openChannel(rxConnection, options)`

**returns** Rx.BehaviorSubject instance emitting amqp.channel or `null` in case of no connection/connection close

**Params**

*rxConnection* (Rx.BehaviorSubject): Rx.BehaviorSubject instance emitting amqp.connection or `null` in case of no connection/connection close

*options.logger* ({ log, warn } | null | false): logger to output connection state changes. Default is `console`. Set falsy value to disable logging

```
import { openChannel } from 'rxamqp'

const rxChannel = openChannel(rxConnection, options)
```

### class ReactiveMQ

`constructor(options)`

**Constructor params**

*options.url* (string | object): amqp url string or object, same as described in [amqplib](https://www.squaremobius.net/amqp.node/channel_api.html#connect)

*options.appId* (string): application identifier used in publishing/request logic. [read more...](https://www.squaremobius.net/amqp.node/channel_api.html#channelpublish)

*options.connectionId* (string): application identifier used as a prefix in logging. Consists of logging scope and vhost if available

*options.logger* ({ log, warn } | null | false): logger to output connection state changes. Default is `console`. Set falsy value to disable logging

*options.routerConfig* ({ routes: object }): see Router doc below

```
const client = ReactiveMQ.create({
  url: 'rabbitMQUrl',
  appId: 'appId'
})
```

**Instance methods**

`publish(exchange, routingKey, message)`

**returns** Promise

*exchange* (string): amqp exchange
*routingKey* (string): amqp routingKey to publish to
*message* (any): data to buplish

method is curried by default

`request(exchange, replyTo, routingKey, message)`

**returns** Promise

*exchange* (string): amqp exchange
*replyTo* (string): queue to receive a reply
*routingKey* (string): amqp routingKey to publish to
*message* (any): data to publish

method is curried by default

`connectRouter(routerConfig)`

**returns** void

*options.routerConfig* ({ routes: object }): see Router doc below

This is useful if you need to provide routes after client initialization. Starts up router and does all the logic related to listening to events.

### class Router

`constructor(options)`

**Constructor params**

*options.appId* (string): application identifier used in publishing/request logic. [read more...](https://www.squaremobius.net/amqp.node/channel_api.html#channelpublish)

*options.connectionId* (string): application identifier used as a prefix in logging. Consists of logging scope and vhost if available

*options.logger* ({ log, warn } | null | false): logger to output connection state changes. Default is `console`. Set falsy value to disable logging

*options.routes* ([object]): actual router config representing queue and consumer options, validation and handling

*options.routes.exchange* (string): exchange to bind queue to

*options.routes.routingKey* (string): routingKey to bind queue to

*options.routes.resolver* (function): event handler that is passed a message payload and expected to return any output that may be received by initial emitter

*options.routes.requestSchema* (json): json schema object to validate a message. [read more...](http://json-schema.org/specification.html)

*options.routes.queueOptions* (object): options passed to channel.bindQueue. [read more...](https://www.squaremobius.net/amqp.node/channel_api.html#channel_bindQueue)

*options.routes.consumerOptions* (object): options passed to channel.consume. [read more...](https://www.squaremobius.net/amqp.node/channel_api.html#channel_consume)

## Roadmap
* Implement more flexible amqp configurations
* Cover with tests
* Improve documentation
