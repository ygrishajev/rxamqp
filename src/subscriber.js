const { Subject } = require('rxjs')
require('rxjs/add/operator/takeUntil')

const { toBuffer, castArray } = require('./helpers')
const { IncomingMessage } = require('./incoming-message')

const REPLY_OPTIONS = {
  contentEncoding: 'application/json',
  contentType: 'utf-8'
}

module.exports = context => {
  const sendToQueue = (payload, message) => context.channel
    .sendToQueue(message.replyTo, toBuffer(payload), Object.assign({
      appId: context.appId,
      correlationId: message.id
    }, REPLY_OPTIONS))

  const respond = (payload, message) => {
    context.events.emit('response.success.sent', { message, payload })
    context.channel.ack(message)

    return sendToQueue(payload, message)
  }

  const reject = (payload, message) => {
    context.events.emit('response.error.sent', { message, payload })
    context.channel.reject(message, false)

    return sendToQueue(payload, message)
  }

  const createContext = message => ({
    message,
    channel: context.channel,
    respond: (payload, status) => message.replyTo && respond({
      data: payload,
      status: status || 200
    }, message),
    rejectAndRespond: (payload, status) => message.replyTo && reject({
      error: payload,
      status: status || payload.status || 500
    }, message),
    ack: () => {
      context.events.emit('event.ack', message)
      return context.channel.ack(message)
    },
    reject: (requeue = false) => {
      context.events.emit('event.nack', message)
      return context.channel.reject(message, requeue)
    }
  })

  const prepareOrReject = (message, handlerId) => {
    const incoming = new IncomingMessage(Object.assign(message, { handlerId }))
    const emit = () => context.events.emit(`${incoming.replyTo ? 'request' : 'event'}.received`, incoming)

    try {
      incoming.parse()
      emit()
    } catch (error) {
      emit()
      return reject({ error }, incoming)
    }

    return incoming
  }

  const uses = {}

  const defaultErrorHandler = error => {
    if (error) {
      console.warn('Error: unhandled error passed to \'next\'') // eslint-disable-line no-console
      console.warn(error) // eslint-disable-line no-console
    }
  }
  let errorHandler = error => defaultErrorHandler(error)
  const common = []
  let isListening = false

  const wrap = middleware => (...args) => {
    try {
      return middleware(...args)
    } catch (error) {
      const [payload, ctx] = args
      return errorHandler(error, payload, ctx, defaultErrorHandler)
    }
  }

  const toQueueName = params => params.queue || [context.appId, params.handlerId, castArray(params.routingKey).join('.')]
    .filter(value => value)
    .join('.')

  // TODO: implement global middlewares
  // TODO: ensure proper handling of multiple message ack error to avoid reconnection
  const use = (...args) => {
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

    const consume = message => {
      if (!message) { return null }

      const handlerContext = createContext(prepareOrReject(message, params.handlerId))
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

    const routingKeys = castArray(params.routingKey)
    const queue = toQueueName(params)

    const doUse = channel => channel.assertQueue(queue, params.queueOptions)
      .then(() => routingKeys.length && Promise.all(routingKeys
        .map(routingKey => channel
          .bindQueue(queue, params.exchange, routingKey))))
      .then(() => context.events.emit('requestQueue.configured', queue))
      .then(() => channel.consume(queue, consume, params.consumer))

    uses[queue] = doUse

    if (isListening) {
      context.channel
        .first()
        .subscribe(doUse)
    }
  }

  const shutdown = new Subject()
  const resubscribe = new Subject()

  const listen = () => {
    isListening = true

    context.channel
      .takeUntil(shutdown)
      .subscribe(channel => {
        if (channel && typeof use === 'function' && !isListening) {
          Promise.all(Object.keys(uses).map(key => uses[key](channel)))
            .then(() => resubscribe.next())
          isListening = true
        }

        if (!channel) {
          isListening = false
        }
      })
  }

  const deleteQueue = params => {
    const queue = toQueueName(params)
    return context.channel
      .first()
      .toPromise()
      .then(channel => channel.deleteQueue(queue))
      .then(() => { delete uses[queue] })
      .then(() => context.events.emit('requestQueue.deleted', queue))
  }

  return {
    use,
    listen,
    resubscribe,
    deleteQueue,
    shutdown: () => {
      shutdown.next(true)
      shutdown.complete()
    }
  }
}
