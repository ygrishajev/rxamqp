const EventEmitter = require('events')
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

    this.pendingRequests = new Set()
    this.events = new EventEmitter()

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

        const routeMessage = message => this.route(message, route)
          .catch(error => {
            this.log(`Failed to process message '${queue}', on exchange '${route.exchange}', routing key '${route.routingKey}'`, message)
            this.logger.log(error)
          })

        const consumerTag = `${this.appId}-${uuid.v4()}`
        this.events.on('terminate', () => this.channel.cancel(consumerTag))

        return this.channel.consume(queue, routeMessage, Object.assign({
          consumerTag
        }, route.consumerOptions))
      })
      .catch(error => {
        this.log(`Failed to setup queue '${queue}', on exchange '${route.exchange}', routing key '${route.routingKey}'`)
        this.logger.log(error)
      })
  }

  route(message, route) {
    this.addRequestId(message.properties.correlationId)
    // TODO: find out validation step errors cause UnhandledPromiseRejectionWarning
    return this.validateAndParse(message, route)
      .then(request => route.resolver(request, message, this.channel))
      .catch(error => this.handleError(error))
      .then(response => this.replyWithData(message, response))
      .catch(error => this.replyWithError(message, error))
      .then(() => this.removeRequestId(message.properties.correlationId))
  }

  validateAndParse(message, { requestSchema } = {}) {
    return validate(message.properties, messageSchema)
      .then(() => {
        let content

        try {
          content = JSON.parse((message.content).toString())
        } catch (error) {
          this.log(logging.formatIncomingMessage(message), {
            error: 'Failed to parse'
          })

          throw error
        }

        this.log(logging.formatIncomingMessage(message), content)

        return requestSchema ?
          validate(content, requestSchema) :
          content
      })
  }

  replyWithData(message, data) {
    this.channel.ack(message)
    this.reply(message, { data })
  }

  replyWithError(message, error) {
    this.channel.reject(message, false)
    this.reply(message, { error: error.message })
  }

  reply(message, data) {
    const buffer = Buffer.from(JSON.stringify(data, null, '\t'))

    this.channel.sendToQueue(message.properties.replyTo, buffer, {
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

  addRequestId(id) {
    this.pendingRequests.add(id)
    this.events.emit('request.start', id)
  }

  removeRequestId(id) {
    this.pendingRequests.delete(id)
    this.events.emit('request.end', id)
  }

  shutDown() {
    this.events.emit('terminate')
    this.log('Shutdown gracefully...')

    if (!this.pendingRequests.size) {
      return Promise.resolve(1)
    }

    return new Promise(resolve => {
      this.events.on('request.end', () => {
        if (!this.pendingRequests.size) {
          resolve(1)
        }
      })
    })
  }
}

module.exports = Router
