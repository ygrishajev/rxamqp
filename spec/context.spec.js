const EventEmitter = require('events')
const { BehaviorSubject } = require('rxjs/BehaviorSubject')
const { combineLatest } = require('rxjs')
require('rxjs/add/operator/skip')
const chalk = require('chalk')

const createContext = require('../src/context')
const config = require('./config')

chalk.enabled = false

let options = { logger: false }
let context

const start = (opts = options) => { context = createContext(Object.assign({}, config, opts)) }
const shutdown = () => {
  const connected = context.connection.skip(1)
  const channelOpened = context.channel.skip(1)
  const confirmChannelOpened = context.confirmChannel.skip(1)

  return combineLatest(connected, channelOpened, confirmChannelOpened)
    .first()
    .toPromise()
    .then(([connection, channel, confirmChannel]) =>
      channel
      && confirmChannel
      && connection
      && context.connection.close())
}

const resetWith = opts => shutdown().then(() => start(opts))

beforeEach(() => { start() })
afterEach(() => {
  options = { logger: false }
  return shutdown()
})

describe('#createContext', () => {
  test('#connections is an instance of BehaviorSubject', () => {
    expect(context.connection).toBeInstanceOf(BehaviorSubject)
  })

  test('#channel is an instance of BehaviorSubject', () => {
    expect(context.channel).toBeInstanceOf(BehaviorSubject)
  })

  test('#confirmChannel is an instance of BehaviorSubject', () => {
    expect(context.confirmChannel).toBeInstanceOf(BehaviorSubject)
  })

  test('#appId is properly defined', () => {
    expect.assertions(1)
    const APP_ID = 'appId'

    return resetWith({ appId: APP_ID, logger: false })
      .then(() => expect(context.appId).toEqual(APP_ID))
  })

  test('#pubs is an instance of Map', () => {
    expect(context.pubs).toBeInstanceOf(Map)
  })

  test('#events is an instance of EventEmitter', () => {
    expect(context.events).toBeInstanceOf(EventEmitter)
  })

  test('#requestTimeout is set to default if not defined', () => {
    expect(context.requestTimeout).toEqual(5000)
  })

  test('#requestTimeout is properly defined', () => {
    expect.assertions(1)
    const requestTimeout = 1000

    return resetWith({ requestTimeout, logger: false })
      .then(() => expect(context.requestTimeout).toEqual(requestTimeout))
  })

  test('#logger is set to default if not defined', () => {
    expect.assertions(1)

    return resetWith({})
      .then(() => expect(context.logger).toEqual(console))
  })

  test('#logger is properly defined', () => {
    expect.assertions(1)
    const loggerMock = { log() {}, warn() {} }

    return resetWith({ logger: loggerMock })
      .then(() => expect(context.logger).toEqual(loggerMock))
  })

  test('#connectionId is properly defined', () => {
    expect.assertions(1)
    const connectionId = 'connectionId'

    return resetWith({ connectionId, logger: false })
      .then(() => expect(context.connectionId).toEqual(connectionId))
  })

  test('#connectionId is set to vhost if not defined', () => resetWith({ logger: false })
    .then(() => expect(context.connectionId).toEqual('/')))

  test('#pubOptions.contentEncoding is set to default', () => {
    expect(context.pubOptions.contentEncoding).toEqual('utf-8')
  })

  test('#pubOptions.contentType is set to default', () => {
    expect(context.pubOptions.contentType).toEqual('application/json')
  })
})
