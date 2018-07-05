const { v4: uuid } = require('uuid')
const { yellow } = require('chalk')

const validate = require('../schema-validator')
const messageSchema = require('./message-schema')
const logging = require('../logging')
const { withDefault } = require('../helpers')

const validateRouterOptions = options => {
  if (!options.channel) {
    throw new Error('"config.channel" is required')
  }

  if (!options.appId) {
    throw new Error('"config.appId" is required')
  }

  if (!options.routes) {
    throw new Error('"config.routes" is required')
  }
}

class Router {
  static create(...args) {
    return new Router(...args)
  }

  constructor(options) {
    validateRouterOptions(options)

    this.rxChannel = options.channel
    this.appId = options.appId
    this.routes = options.routes
    this.logger = withDefault(options.logger, console)
    this.connectionId = options.connectionId || options.channel.connectionId
    this.handleError = withDefault(options.handleError, error => { throw error })

    this.watchChannel()
  }

  watchChannel() {
    this.rxChannel
      .filter(channel => channel)
      .subscribe(channel => {
        this.channel = channel
        return this.listen()
      })
  }

  listen() {
    return this.channel.prefetch(1)
      .then(() => Promise.all(this.routes.map(route => this.bindChannel(route))))
  }

  bindChannel(route) {
    const queue = `${this.appId}.${route.routingKey}`
    return this.channel.assertQueue(queue, route.queueOptions)
      .then(() => this.channel.bindQueue(queue, route.exchange, route.routingKey))
      .then(() => {
        this.log(`Starts listening to '${yellow(queue)}'`)
        return this.channel.consume(queue, message => this.route(message, route), Object.assign({
          consumerTag: `${this.appId}-${uuid.v4()}`
        }, route.consumerOptions))
      })
      .catch(error => {
        this.log(`Failed to setup queue '${queue}', on exchange '${route.exchange}', routing key '${route.routingKey}'`)
        this.logger.log(error)
      })
  }

  route(message, route) {
    // TODO: think on better requeue logic (in case of replyWithData too)
    let requeueOnError = false
    const requeue = () => { requeueOnError = true }

    try {
      const request = this.getValidRequest(message, route)

      return Promise.resolve(route.resolver(request, message, this.channel, requeue))
        .catch(error => this.handleError(error))
        .then(response => this.replyWithData(message, response))
        .catch(error => this.replyWithError({ message, error, requeue: requeueOnError }))
    } catch (error) {
      try {
        return this.replyWithData(message, this.handleError(error))
      } catch (handledError) {
        return this.replyWithError({ message, error: handledError, requeue: requeueOnError })
      }
    }
  }

  getValidRequest(message, route) {
    validate(message.properties, messageSchema)

    const request = JSON.parse(message.content.toString())
    this.log(logging.formatIncomingMessage(message), request)

    if (route.requestSchema) {
      validate(request, route.requestSchema)
    }

    return request
  }

  replyWithData(message, data) {
    this.reply(message, { data })
    this.channel.ack(message)
  }

  replyWithError({ message, error, requeue = false }) {
    this.reply(message, { error: error.message })
    this.channel.reject(message, requeue)
  }

  reply(message, data) {
    if (!message || !message.properties || !message.properties.replyTo) {
      return
    }

    const bufferedMessage = Buffer.from(JSON.stringify(data, null, '\t'))

    this.channel.sendToQueue(message.properties.replyTo, bufferedMessage, {
      appId: this.appId,
      contentEncoding: 'application/json',
      contentType: 'utf-8',
      correlationId: message.properties.correlationId
    })

    this.log(logging.formatOutgoingResponse(message, data.error), data)
  }

  log(message, data) {
    if (!this.logger) {
      return
    }

    const prefix = this.connectionId ? `Router:${this.connectionId}` : 'Router'
    this.logger.log(logging.formatMeta(prefix, message))

    if (data) {
      this.logger.dir(data, { colors: true, depth: 10 })
    }
  }
}

module.exports = Router
