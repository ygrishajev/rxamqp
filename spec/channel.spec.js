const connect = require('../src/connection')
const openChannel = require('../src/channel')
const { BehaviorSubject } = require('rxjs/BehaviorSubject')
const { Channel, ConfirmChannel } = require('amqplib/lib/channel_model')
const { combineLatest } = require('rxjs')
require('rxjs/add/operator/skip')
require('rxjs/add/operator/take')
require('rxjs/add/operator/partition')
require('rxjs/add/operator/last')

const start = (channelOptions = {}) => {
  const DEFAULT_OPTIONS = { logger: false }
  const rxConnection = connect('amqp://localhost:5672', DEFAULT_OPTIONS)
  const rxChannel = openChannel(rxConnection, Object.assign(DEFAULT_OPTIONS, channelOptions))

  return { rxConnection, rxChannel }
}

describe('rxConnection', () => {
  test('is an instance of BehaviourSubject', () => {
    const { rxConnection, rxChannel } = start()

    expect(rxChannel).toBeInstanceOf(BehaviorSubject)

    return rxConnection.close()
  })

  test('emits Channel on open', () => {
    const { rxConnection, rxChannel } = start()
    expect.assertions(1)

    return rxChannel
      .filter(value => !!value)
      .first()
      .toPromise()
      .then(channel => expect(channel).toBeInstanceOf(Channel))
      .then(() => rxConnection.close())
  })

  test('emits ConfirmChannel on open', () => {
    const { rxConnection, rxChannel } = start({ confirmationMode: true })
    expect.assertions(1)

    return rxChannel
      .filter(value => !!value)
      .first()
      .toPromise()
      .then(channel => expect(channel).toBeInstanceOf(ConfirmChannel))
      .then(() => rxConnection.close())
  })

  test('emits null on connection close', () => {
    const { rxConnection, rxChannel } = start({ confirmationMode: true })
    expect.assertions(1)

    const connected = rxConnection.skip(1)
    const channelOpened = rxChannel.skip(1)

    combineLatest(connected, channelOpened)
      .first()
      .subscribe(([connection, channel]) => connection && channel && connection.close())

    return channelOpened
      .skip(1)
      .first()
      .toPromise()
      .then(value => expect(value).toBeNull())
      .then(() => rxConnection.close())
  })

  test('emits Channel on reconnect', () => {
    const { rxConnection, rxChannel } = start({ confirmationMode: true })
    expect.assertions(1)

    const connected = rxConnection.skip(1)
    const channelOpened = rxChannel.skip(1)

    combineLatest(connected, channelOpened)
      .first()
      .subscribe(([connection, channel]) => channel && connection && connection.close())

    return channelOpened
      .skip(2)
      .first()
      .toPromise()
      .then(channel => expect(channel).toBeInstanceOf(Channel))
      .then(() => rxConnection.close())
  })

  test('recreate Channel on close', () => {
    const { rxConnection, rxChannel } = start({ confirmationMode: true })
    expect.assertions(1)

    const channelOpened = rxChannel.skip(1)

    channelOpened
      .first()
      .subscribe(channel => channel.close())

    return channelOpened
      .skip(2)
      .first()
      .toPromise()
      .then(channel => expect(channel).toBeInstanceOf(Channel))
      .then(() => rxConnection.close())
  })
})
