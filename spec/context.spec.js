const EventEmitter = require('events')
const { BehaviorSubject } = require('rxjs/BehaviorSubject')
const { combineLatest } = require('rxjs')
require('rxjs/add/operator/skip')
const chalk = require('chalk')

const createContext = require('../src/context')

chalk.enabled = false

const logger = false
const createAndTest = (fn, options) => {
  const context = createContext(options)

  fn(context)

  const connected = context.connection.skip(1)
  const channelOpened = context.channel.skip(1)
  const confirmChannelOpened = context.confirmChannel.skip(1)

  combineLatest(connected, channelOpened, confirmChannelOpened)
    .first()
    .subscribe(([connection, channel, confirmChannel]) =>
      channel
      && confirmChannel
      && connection
      && context.connection.close())
}

describe('#createContext', () => {
  test('starts connection', () => createAndTest(context => {
    expect(context.connection).toBeInstanceOf(BehaviorSubject)
  }, { logger }))

  test('opens Channel', () => createAndTest(context => {
    expect(context.channel).toBeInstanceOf(BehaviorSubject)
  }, { logger }))

  test('opens ConfirmChannel', () => createAndTest(context => {
    expect(context.confirmChannel).toBeInstanceOf(BehaviorSubject)
  }, { logger }))

  test('has defined appId', () => {
    const APP_ID = 'appId'

    createAndTest(context => {
      expect(context.confirmChannel).toBeInstanceOf(BehaviorSubject)
    }, { appId: APP_ID, logger: false })
  })

  test('has pubs map', () => createAndTest(context => {
    expect(context.pubs).toBeInstanceOf(Map)
  }, { logger }))

  test('has event emitter', () => createAndTest(context => {
    expect(context.events).toBeInstanceOf(EventEmitter)
  }, { logger }))

  test('has default timeout', () => createAndTest(context => {
    expect(context.requestTimeout).toEqual(5000)
  }, { logger }))

  test('has defined timeout', () => {
    const requestTimeout = 1000

    createAndTest(context => {
      expect(context.requestTimeout).toEqual(requestTimeout)
    }, { requestTimeout, logger: false })
  })

  test('has default logger', () => createAndTest(context => {
    expect(context.logger).toEqual(console)
  }))

  test('has defined logger', () => {
    const loggerMock = { log() {}, warn() {} }

    createAndTest(context => {
      expect(context.logger).toEqual(loggerMock)
    }, { logger: loggerMock })
  })

  test('has defined connectionId', () => {
    const connectionId = 'connectionId'

    createAndTest(context => {
      expect(context.connectionId).toEqual(connectionId)
    }, { connectionId, logger: false })
  })

  test('defaults connectionId to vhost', () => {
    createAndTest(context => {
      expect(context.connectionId).toEqual('')
    }, { logger })
  })

  test('has publisher contentEncoding set', () => createAndTest(context => {
    expect(context.pubOptions.contentEncoding).toEqual('utf-8')
  }, { logger }))

  test('has publisher contentType set', () => createAndTest(context => {
    expect(context.pubOptions.contentType).toEqual('application/json')
  }, { logger }))
})
