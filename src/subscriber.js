const { Subject } = require('rxjs')
require('rxjs/add/operator/takeUntil')

const { toBuffer } = require('./helpers')
const extend = require('./incoming-message')

const REPLY_OPTIONS = {
  contentEncoding: 'application/json',
  contentType: 'utf-8'
}

module.exports = ctx => {
  const sendToQueue = (payload, message) => ctx.channel
    .sendToQueue(message.replyTo, toBuffer(payload), Object.assign({
      appId: ctx.appId,
      correlationId: message.id
    }, REPLY_OPTIONS))

  const respond = (payload, message) => {
    ctx.events.emit('response.success.sent', { message, payload })
    ctx.channel.ack(message)

    return sendToQueue(payload, message)
  }

  const reject = (payload, message) => {
    ctx.events.emit('response.error.sent', { message, payload })
    ctx.channel.reject(message, false)

    return sendToQueue(payload, message)
  }

  const createContext = message => ({
    message,
    channel: ctx.channel,
    respond: payload => message.replyTo && respond({ data: payload }, message),
    rejectAndRespond: payload => message.replyTo && reject({ error: payload }, message),
    ack: () => {
      ctx.events.emit('event.ack', message)
      ctx.channel.ack(message)
    },
    reject: (requeue = false) => {
      ctx.events.emit('event.nack', message)
      ctx.channel.reject(message, requeue)
    }
  })

  const prepareOrReject = message => {
    const incoming = extend(message)
    const emit = () => ctx.events.emit(`${incoming.replyTo ? 'request' : 'event'}.received`, incoming)

    try {
      incoming.parse()
      emit()
    } catch (error) {
      emit()
      return reject({ error }, incoming)
    }

    return incoming
  }

  const uses = []

  // TODO: implement global middlewares and error handlers
  // TODO: ensure proper handling of multiple message ack error to avoid reconnection
  const use = (params, ...middlewares) => {
    const consume = message => {
      const handlerContext = createContext(prepareOrReject(message))
      const pipeline = middlewares.reduceRight(
        (next, current) => () => current(handlerContext.message.payload, handlerContext, next),
        () => {}
      )

      return pipeline()
    }

    const queue = `${ctx.appId}.${params.routingKey}`

    const doUse = channel => channel.assertQueue(queue, params.queue)
      .then(() => channel.bindQueue(queue, params.exchange, params.routingKey))
      .then(() => ctx.events.emit('requestQueue.configured', queue))
      .then(() => channel.consume(queue, consume, params.consumer))

    uses.push(doUse)
  }

  const shutdown = new Subject()

  const listen = () => {
    let isDisconnected = false

    ctx.channel
      .takeUntil(shutdown)
      .subscribe(channel => {
        if (channel && typeof use === 'function' && isDisconnected) {
          uses.forEach(doUse => doUse(channel))
          isDisconnected = false
        }

        if (!channel) {
          isDisconnected = true
        }
      })
  }

  return {
    use,
    listen,
    shutdown: () => {
      shutdown.next(true)
      shutdown.complete()
    }
  }
}
