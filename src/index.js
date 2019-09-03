const flow = require('lodash.flow')

const createPublisher = require('./publisher')
const createRequester = require('./requester')
const createSubscriber = require('./subscriber')
const configureContext = require('./context')
const configureLogger = require('./logger')

const validateConfig = config => config

const createClient = ctx => {
  const {
    publish,
    sendToQueue,
    shutdown: shutdownPublisher
  } = createPublisher(ctx)
  const {
    request,
    assertReplyQueue,
    listen: startRequesterRoutines,
    shutdown: shutdownRequester
  } = createRequester(ctx)
  const {
    use,
    listen: startSubscriberRoutines,
    resubscribe,
    shutdown: shutdownSubscriber,
    deleteQueue
  } = createSubscriber(ctx)

  const client = {
    connection: ctx.connection,
    channel: ctx.channel,
    confirmChannel: ctx.confirmChannel,

    publish,
    sendToQueue,
    use: (...args) => {
      use(...args)
      return client
    },
    deleteQueue,
    listen: () => {
      startRequesterRoutines()
      startSubscriberRoutines()
    },
    resubscribe,
    request,
    assertReplyQueue,
    events: ctx.events,
    shutdown: () => {
      shutdownSubscriber()
      shutdownRequester()
      ctx.events.removeAllListeners()

      return shutdownPublisher()
        .then(() => ctx.connection.close())
    }
  }

  return client
}

module.exports = flow([
  validateConfig,
  configureContext,
  configureLogger,
  createClient
])
