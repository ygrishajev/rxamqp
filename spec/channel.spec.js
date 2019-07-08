const connect = require('../src/connection')
const openChannel = require('../src/channel')
const { BehaviorSubject } = require('rxjs/BehaviorSubject')
const { Channel, ConfirmChannel } = require('amqplib/lib/channel_model')
const { combineLatest } = require('rxjs')
require('rxjs/add/operator/skip')
require('rxjs/add/operator/take')
require('rxjs/add/operator/partition')
require('rxjs/add/operator/last')

const config = require('./config')

let rxConnection
let rxChannel
let connected
let channelOpened
const DEFAULT_OPTIONS = { reconnectTimeout: 1 }

if (!config.logging) {
  DEFAULT_OPTIONS.logger = false
}

const start = (channelOptions = {}) => {
  rxConnection = connect(config.amqpUri, DEFAULT_OPTIONS)
  rxChannel = openChannel(rxConnection, Object.assign(channelOptions, DEFAULT_OPTIONS))
  connected = rxConnection.skip(1)
  channelOpened = rxChannel.skip(1)
}

const resetWith = channelOptions => rxConnection.close().then(() => start(channelOptions))

beforeEach(() => start())
afterEach(() => rxConnection.close())

describe('rxConnection', () => {
  test('is an instance of BehaviourSubject', () => {
    expect(rxChannel).toBeInstanceOf(BehaviorSubject)
  })

  test('value emitted on open is an instance of Channel', () => {
    expect.assertions(1)

    return rxChannel
      .filter(value => !!value)
      .first()
      .toPromise()
      .then(channel => expect(channel).toBeInstanceOf(Channel))
  })

  test('value emitted on open is an instance of ConfirmChannel', () => {
    expect.assertions(1)

    return resetWith({ confirmationMode: true })
      .then(() => rxChannel
        .filter(value => !!value)
        .first()
        .toPromise()
        .then(channel => expect(channel).toBeInstanceOf(ConfirmChannel)))
  })

  test('value emitted on close is null', () => {
    expect.assertions(1)

    combineLatest(connected, channelOpened)
      .first()
      .subscribe(([connection, channel]) => connection && channel && connection.close())

    return channelOpened
      .skip(1)
      .first()
      .toPromise()
      .then(value => expect(value).toBeNull())
  })

  test('emits Channel on reconnect', () => {
    expect.assertions(1)

    combineLatest(connected, channelOpened)
      .first()
      .subscribe(([connection, channel]) => channel && connection && connection.close())

    return channelOpened
      .skip(2)
      .first()
      .toPromise()
      .then(channel => expect(channel).toBeInstanceOf(Channel))
  })

  test('recreate Channel on close', () => {
    expect.assertions(1)

    channelOpened
      .first()
      .subscribe(channel => channel.close())

    return channelOpened
      .skip(2)
      .first()
      .toPromise()
      .then(channel => expect(channel).toBeInstanceOf(Channel))
  })
})
