const flow = require('lodash.flow')

const createPublisher = require('./publisher')
const createRequester = require('./requester')
const createSubscriber = require('./subscriber')
const configureContext = require('./context')
const configureLogger = require('./logger')

const validateConfig = config => config

const createClient = ctx => {
  const { publish, registry } = createPublisher(ctx)
  const { use, listen, shutdown: shutdownSubscribers } = createSubscriber(ctx)

  const client = {
    connection: ctx.connection,
    channel: ctx.channel,
    confirmChannel: ctx.confirmChannel,

    publish,
    use: (...args) => {
      use(...args)
      return client
    },
    listen,
    events: ctx.events,
    shutdown: () => ctx.connection.close()
      .then(() => {
        shutdownSubscribers()

        return { pubRegistry: registry }
      })
  }

  return Object.assign(client, createRequester(ctx))
}

module.exports = flow([
  validateConfig,
  configureContext,
  configureLogger,
  createClient
])
