const { Subject } = require('rxjs')
require('rxjs/add/operator/takeUntil')

const { toBuffer, castArray } = require('./helpers')
const { IncomingMessage } = require('./incoming-message')

const REPLY_OPTIONS = {
  contentEncoding: 'application/json',
  contentType: 'utf-8'
}

module.exports = context => {
  const shutdown = new Subject()
  const resubscribe = new Subject()

  const exports = {
    use,
    listen,
    resubscribe,
    deleteQueue,
    shutdown: () => {
      shutdown.next(true)
      shutdown.complete()
    }
  }

  let isListening = false
  const uses = {}
  const common = []
  let errorHandler = error => defaultErrorHandler(error)

  function listen() {
    return context.channel
      .takeUntil(shutdown)
      .subscribe(subscribeToChannel)
  }

  function subscribeToChannel(channel) {
    if (channel && typeof use === 'function' && !isListening) {
      Promise.all(Object.keys(uses).map(key => uses[key](channel)))
        .then(() => resubscribe.next())
      isListening = true
    }

    if (!channel) {
      isListening = false
    }
  }

  // TODO: implement global middlewares
  // TODO: ensure proper handling of multiple message ack error to avoid reconnection
  function use(...args) {
    if (typeof args[0] === 'function') {
      args.forEach(middleware => {
        if (middleware.length === 4) {
          errorHandler = middleware
        } else {
          common.push(middleware)
        }
      })
      return
    }

    const [params, ...middlewares] = args

    const routingKeys = castArray(params.routingKey)
    const queue = toQueueName(params)

    const doUse = channel => channel.assertQueue(queue, params.queueOptions)
      .then(() => routingKeys.length && Promise.all(routingKeys
        .map(routingKey => channel
          .bindQueue(queue, params.exchange, routingKey))))
      .then(() => context.events.emit('request.queue.configured', queue))
      .then(() => channel.consume(queue, toConsumer(params, middlewares, channel), params.consumer))

    uses[queue] = doUse

    if (isListening) {
      context.channel
        .first()
        .subscribe(doUse)
    }
  }

  function toQueueName(params) {
    return params.queue || [context.appId, params.handlerId, castArray(params.routingKey).join('.')]
      .filter(value => value)
      .join('.')
  }

  function defaultErrorHandler(error) {
    if (error) {
      console.warn('Error: unhandled error passed to \'next\'') // eslint-disable-line no-console
      console.warn(error) // eslint-disable-line no-console
    }
  }

  function toConsumer(params, middlewares, channel) {
    return message => {
      if (!message) { return null }

      const incomingMessage = prepareOrReject(message, params.handlerId, channel)
      const handlerContext = createContext(incomingMessage, channel)
      const handleError = error => errorHandler(
        error,
        handlerContext.message.payload,
        handlerContext,
        defaultErrorHandler
      )
      const pipeline = middlewares.concat(common).reduceRight(
        (next, current) => error => (error
          ? handleError(error)
          : wrap(current)(handlerContext.message.payload, handlerContext, next)),
        error => (error ? handleError(error) : () => {})
      )

      return pipeline()
    }
  }

  function prepareOrReject(message, handlerId, channel) {
    const incoming = new IncomingMessage(Object.assign(message, { handlerId }))
    const emit = () => context.events.emit(`${incoming.replyTo ? 'request' : 'event'}.received`, incoming)

    try {
      incoming.parse()
      emit()
    } catch (error) {
      emit()
      return toChannelCtxBase(channel).reject(channel)({ error }, false, channel)
    }

    return incoming
  }

  function createContext(message, channel) {
    const { respond, reject, ack } = toChannelCtxBase(channel)

    return {
      message,
      channel: context.channel,
      respond: (payload, options) => (message.replyTo
        ? respond({
          data: payload,
          status: (options && options.status) || 200
        }, message, options)
        : ack(message)),
      rejectAndRespond: (payload, status) => message.replyTo && reject({
        error: payload,
        status: status || payload.status || 500
      }, message),
      ackAndRespond: (payload, status) => message.replyTo && respond({
        data: payload,
        status: status || 200
      }, message, { ack: true }),
      ack: () => ack(message),
      reject: (requeue = false) => {
        context.events.emit('event.nack', message)
        return Promise.resolve(channel.reject(message, requeue))
      }
    }
  }

  function toChannelCtxBase(channel) {
    return {
      respond: (payload, message, options = { ack: true }) => {
        context.events.emit('response.success.sent', message.setResponse(payload))

        if (options.ack) {
          channel.ack(message)
        }

        return sendToQueue(payload, message)
      },
      reject: (payload, message) => {
        context.events.emit('response.error.sent', message.setResponse(payload))
        channel.reject(message, false)

        return sendToQueue(payload, message)
      },
      ack: message => {
        context.events.emit('event.ack', message)
        return Promise.resolve(channel.ack(message))
      }
    }
  }

  function sendToQueue(payload, message) {
    return context.confirmChannel
      .sendToQueue(message.replyTo, toBuffer(payload), Object.assign({
        appId: context.appId,
        correlationId: message.id
      }, REPLY_OPTIONS))
  }

  function wrap(middleware) {
    return (...args) => {
      try {
        return middleware(...args)
      } catch (error) {
        const [payload, ctx] = args
        return errorHandler(error, payload, ctx, defaultErrorHandler)
      }
    }
  }

  function deleteQueue(params) {
    const queue = toQueueName(params)
    return context.channel
      .first()
      .toPromise()
      .then(channel => channel.deleteQueue(queue))
      .then(() => { delete uses[queue] })
      .then(() => context.events.emit('request.queue.deleted', queue))
  }

  return exports
}
