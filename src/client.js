const { v4: uuid } = require('uuid')
const { Subject } = require('rxjs/Subject')
require('rxjs/add/operator/first')
require('rxjs/add/operator/partition')

const connect = require('./connection')
const openChannel = require('./channel')
const Router = require('./router')
const logging = require('./logging')
const { withDefault } = require('./helpers')

const PUB_OPTIONS = { contentEncoding: 'utf-8', contentType: 'application/json' }

const toBuffer = obj => Buffer.from(JSON.stringify(obj, null, '\t'))

class ReactiveMQ {
  static create(options) {
    return new ReactiveMQ(options)
  }

  get channelAsPromised() {
    return this.rxChannel
      .filter(channel => channel)
      .first()
      .toPromise()
  }

  get commonOptions() {
    return { logger: this.logger, connectionId: this.connectionId }
  }

  constructor(options) {
    this.appId = withDefault(options.appId, 'rx-amqp-client')
    this.logger = withDefault(options.logger, console)
    this.connectionId = options.connectionId || (options.url && options.url.vhost)
    this.loggingPrefix = this.connectionId ? `Client:${this.connectionId}` : 'Client'

    this.rxConnection = connect(options.url, this.commonOptions)
    this.rxChannel = openChannel(this.rxConnection, this.commonOptions)

    this.replyQueues = new Set()
    this.requests = new Map()
    this.pubOptions = Object.assign({}, PUB_OPTIONS, { appId: this.appId })

    if (options.routerConfig) {
      this.connectRouter(options.routerConfig)
    }

    this.watchChannel()
  }

  watchChannel() {
    this.rxChannel
      .filter(channel => !channel)
      .subscribe(() => this.replyQueues.clear())
  }

  connectRouter(routerConfig) {
    if (this.router) { return }

    if (!routerConfig) {
      throw new Error(`[${this.loggingPrefix}]: "config.routerConfig" is required to start routing`)
    }

    if (routerConfig) {
      this.router = Router.create(Object.assign(
        {},
        routerConfig,
        this.commonOptions,
        {
          appId: this.appId,
          channel: this.rxChannel
        }
      ))
    }
  }

  request(exchange, routingKey, message, options) {
    const correlationId = uuid()
    const replyTo = `${routingKey}.replyFor.${this.appId}`
    this.requests.set(correlationId, new Subject())

    return this.channelAsPromised
      .then(channel => channel.assertQueue(replyTo, {
        exclusive: true,
        autoDelete: true,
        durable: false
      })
        .then(() => this.assertConsume(channel, replyTo, this.resolveReply))
        .then(() => {
          const pubOptions = Object.assign({}, this.pubOptions, { replyTo, correlationId }, options)
          this.log(logging.formatOutgoingRequest(correlationId, routingKey, this.appId), message)

          return channel.publish(exchange, routingKey, toBuffer(message), pubOptions)
        }))
      .then(() => this.requests.get(correlationId).first().toPromise().then(({ data }) => data))
  }

  assertConsume(channel, queue, handler) {
    if (!this.replyQueues.has(queue)) {
      this.replyQueues.add(queue)
      return channel.consume(queue, handler.bind(this), { noAck: true })
    }
    return Promise.resolve(channel)
  }

  resolveReply(message) {
    if (this.requests.has(message.properties.correlationId)) {
      const reply = JSON.parse(message.content.toString())
      const request = this.requests.get(message.properties.correlationId)

      if (reply.error) {
        request.error(reply.error)
      } else {
        request.next(reply)
      }

      this.log(logging.formatIncomingResponse(message, reply.error), reply)
    }
  }

  publish(exchange, routingKey, message, options) {
    return this.channelAsPromised
      .then(channel => {
        this.log(logging.formatEvent(routingKey, this.appId), message)
        return channel.publish(
          exchange,
          routingKey,
          toBuffer(message),
          Object.assign(this.pubOptions, options)
        )
      })
  }

  log(message, data) {
    if (!this.logger) { return }

    this.logger.log(logging.formatMeta(this.loggingPrefix, message))

    if (data) {
      this.logger.dir(data, { colors: true, depth: 10 })
    }
  }
}

module.exports = ReactiveMQ
