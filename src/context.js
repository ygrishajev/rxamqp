const EventEmitter = require('events')

const connect = require('./connection')
const openChannel = require('./channel')
const {
  withDefault,
  toVhost
} = require('./helpers')

const PUB_OPTIONS = { contentEncoding: 'utf-8', contentType: 'application/json' }

module.exports = (extend = {}) => {
  const config = {
    appId: withDefault(extend.appId, 'amqp-client'),
    pubs: new Map(),
    events: new EventEmitter(),
    requestTimeout: withDefault(extend.requestTimeout, 5000)
  }

  const logger = withDefault(extend.logger, console)
  config.logger = logger
  const connectionId = withDefault(extend.connectionId, () => toVhost(extend.url))
  const commonOpts = { logger, connectionId }

  config.connection = connect(extend.url, commonOpts)
  config.channel = openChannel(config.connection, commonOpts)
  config.confirmChannel = openChannel(
    config.connection,
    Object.assign({ confirmationMode: true }, commonOpts)
  )

  config.pubOptions = Object.assign({}, PUB_OPTIONS, { appId: config.appId })

  Object.assign(config, commonOpts)

  return config
}
