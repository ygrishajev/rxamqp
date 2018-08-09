const { v4: uuid } = require('uuid')
const { Subject } = require('rxjs/Subject')
const { yellow } = require('chalk')
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

    this.replyQueues = {}
    this.requests = new Map()
    this.pubOptions = Object.assign({}, PUB_OPTIONS, { appId: this.appId })
    this.clientId = uuid()

    this.isDebugMode = !!options.debug

    if (options.routerConfig) {
      this.connectRouter(options.routerConfig)
    }

    this.watchChannel()
  }

  watchChannel() {
    this.rxChannel
      .filter(channel => !channel)
      .subscribe(() => {
        const restartKeys = Object.keys(this.replyQueues)
        this.replyQueues = {}
        restartKeys.forEach(key => this.assertReplyQueue(key))
      })
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

  assertReplyQueue(routingKey) {
    if (this.replyQueues[routingKey]) {
      return Promise.resolve(this.replyQueues[routingKey])
    }

    const replyTo = `${routingKey}.replyFor.${this.appId}.${this.clientId}`
    this.replyQueues[routingKey] = replyTo

    return this.channelAsPromised
      .then(channel => channel.assertQueue(replyTo, {
        exclusive: true,
        autoDelete: true,
        durable: false
      })
        .then(() => channel.consume(replyTo, this.resolveReply.bind(this), { noAck: true })))
      .then(() => {
        this.log(`Queue '${yellow(replyTo)}' is listening for replies`)
        return replyTo
      })
  }

  request(exchange, routingKey, message, options) {
    let debugging
    if (this.isDebugMode) {
      debugging = { type: 'request', start: new Date().getTime() }
    }

    const correlationId = uuid()
    this.requests.set(correlationId, new Subject())

    return this.channelAsPromised
      .then(channel => this.assertReplyQueue(routingKey)
        .then(replyTo => {
          const pubOptions = Object.assign({}, this.pubOptions, { replyTo, correlationId }, options)

          if (this.isDebugMode) {
            const request = new Date().getTime()
            debugging.request = `${request} (+${(request - debugging.start).toFixed(3)})`
          }

          this.log(logging.formatOutgoingRequest(correlationId, routingKey, this.appId), message)

          return channel.publish(exchange, routingKey, toBuffer(message), pubOptions)
        }))
      .then(() => this.requests.get(correlationId).first().toPromise().then(({ data }) => {
        if (this.isDebugMode) {
          const messageMock = {
            properties: { correlationId, appId: this.appId },
            fields: { routingKey }
          }
          const end = new Date().getTime()
          debugging.end = `${end} (+${(end - debugging.start).toFixed(3)})`
          this.log(logging.formatDebugId(messageMock), debugging)
        }

        return data
      }))
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
