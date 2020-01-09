const { Subject } = require('rxjs')
const { v4: uuid } = require('uuid')

const { toPromise } = require('./helpers')
const { IncomingMessage } = require('./incoming-message')
const { OutgoingMessage } = require('./outgoing-message')

const REPLY_QUEUE_OPTIONS = {
  exclusive: true,
  autoDelete: true,
  durable: false
}

module.exports = ctx => {
  const requests = new Map()
  const replyKeys = new Set()
  let replyQueues = {}
  let channelId = uuid()

  function register(request, options) {
    const watcher = new Subject()
    requests.set(request.id, watcher)

    let timer

    if (!options || !options.asObservable) {
      timer = setTimeout(() => watcher.error(new Error(`Request <${request.shortId}> timeout `)), ctx.requestTimeout)
    }

    const deregister = () => {
      clearTimeout(timer)
      requests.delete(request.id)
    }

    watcher.subscribe(null, deregister, deregister)

    return watcher
  }

  function assertReplyQueue(routingKey, options) {
    if (replyQueues[routingKey]) {
      return Promise.resolve(replyQueues[routingKey])
    }

    const replyTo = `${routingKey}.replyFor.${ctx.appId}.${channelId}`
    replyQueues[routingKey] = replyTo
    replyKeys.add(routingKey)

    return ctx.channel.assertQueue(replyTo, REPLY_QUEUE_OPTIONS)
      .then(() => ctx.channel.consume(replyTo, resolveReply(options), { noAck: true }))
      .then(() => {
        ctx.events.emit('queue.configured', replyTo)
        return replyTo
      })
  }

  function resolveReply(options) {
    return message => {
      const response = new IncomingMessage(message)
      if (!requests.has(response.id)) {
        return
      }

      const watcher = requests.get(response.id)
      response.parse()

      const resolve = response.hasError ? 'error' : 'next'
      watcher[resolve](response.payload)

      if (!options.asObservable) {
        watcher.complete()
      }

      ctx.events.emit(`response.${response.hasError ? 'error' : 'success'}.received`, response)
    }
  }

  const shutdown = new Subject()

  const listen = () => {
    ctx.channel
      .takeUntil(shutdown)
      .subscribe(channel => {
        if (!channel) {
          channelId = uuid()
          replyQueues = {}
        } else {
          replyKeys.forEach(key => assertReplyQueue(key))
        }
      })
  }

  return {
    request: (exchange, routingKey, message, clientOptions) => {
      const request = new OutgoingMessage({
        exchange,
        routingKey,
        message,
        options: Object.assign({}, clientOptions, ctx.pubOptions)
      }, ctx)
      const watcher = register(request, clientOptions)
      const obtainObserver = assertReplyQueue(routingKey, clientOptions)
        .then(replyTo => {
          request.replyTo = replyTo
          return ctx.channel.publish(...request.toArgs({ withExchange: true }))
        })
        .then(() => ctx.events.emit('request.sent', request))

      if (clientOptions && clientOptions.asObservable) {
        return watcher
      }

      return obtainObserver.then(() => toPromise(watcher))
    },
    requestByQueue: (queue, message, clientOptions) => {
      const request = new OutgoingMessage({
        routingKey: queue,
        message,
        options: Object.assign({}, clientOptions, ctx.pubOptions)
      }, ctx)
      const watcher = register(request)

      return assertReplyQueue(queue)
        .then(replyTo => {
          request.replyTo = replyTo
          return ctx.channel.publish(...request.toArgs({ withExchange: true }))
        })
        .then(() => ctx.events.emit('request.sent', request))
        .then(() => toPromise(watcher))
    },
    assertReplyQueue: keys => (Array.isArray(keys) ?
      Promise.all(keys.map(assertReplyQueue)) :
      assertReplyQueue(keys)),
    listen,
    shutdown: () => {
      shutdown.next(true)
      shutdown.complete()
    }
  }
}
