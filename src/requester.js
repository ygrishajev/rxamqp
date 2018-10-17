const { Subject } = require('rxjs')
const { v4: uuid } = require('uuid')

const { toPromise } = require('./helpers')
const extend = require('./incoming-message')
const toOutgoing = require('./outgoing-message')

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

  function register(request) {
    const watcher = new Subject()
    requests.set(request.id, watcher)

    const timer = setTimeout(() => watcher.error(new Error(`Request <${request.shortId}> timeout `)), ctx.requestTimeout)

    const deregister = () => {
      clearTimeout(timer)
      requests.delete(request.id)
    }

    watcher.subscribe(null, deregister, deregister)

    return watcher
  }

  function assertReplyQueue(routingKey) {
    if (replyQueues[routingKey]) {
      return Promise.resolve(replyQueues[routingKey])
    }

    const replyTo = `${routingKey}.replyFor.${ctx.appId}.${channelId}`
    replyQueues[routingKey] = replyTo
    replyKeys.add(routingKey)

    return ctx.channel.assertQueue(replyTo, REPLY_QUEUE_OPTIONS)
      .then(() => ctx.channel.consume(replyTo, resolveReply, { noAck: true }))
      .then(() => {
        ctx.events.emit('queue.configured', replyTo)
        return replyTo
      })
  }

  function resolveReply(message) {
    const response = extend(message)

    if (!requests.has(response.id)) { return }

    const watcher = requests.get(response.id)
    response.parse()

    const resolve = response.hasError ? 'error' : 'next'
    watcher[resolve](response.payload)
    watcher.complete()

    ctx.events.emit(`response.${response.hasError ? 'error' : 'success'}.received`, response)
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
      const request = toOutgoing({
        exchange,
        routingKey,
        message,
        options: Object.assign({}, clientOptions, ctx.pubOptions)
      }, ctx)
      const watcher = register(request)

      return assertReplyQueue(routingKey)
        .then(replyTo => {
          request.options.replyTo = replyTo
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
