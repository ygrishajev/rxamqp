const { OutgoingMessage } = require('../src/outgoing-message')
const validate = require('uuid-validate')

const MESSAGE = {
  exchange: 'exchange',
  routingKey: 'routingKey',
  message: { foo: 'bar' },
  options: { appId: 'appId' }
}

describe('OutgoingMessage', () => {
  test('#payload has proper id', () => {
    expect(validate(new OutgoingMessage(MESSAGE).id)).toBeTruthy()
  })

  test('#appId is properly defined', () => {
    expect(new OutgoingMessage(MESSAGE).appId).toEqual(MESSAGE.options.appId)
  })

  test('#shortId consists of 8 first symbols if uuid', () => {
    const { payload, shortId } = new OutgoingMessage(MESSAGE)
    const expectedShortId = payload.options.correlationId.slice(0, 8)
    expect(validate(payload.options.correlationId) && shortId).toEqual(expectedShortId)
  })

  test('#replyTo setter updates message options', () => {
    const message = new OutgoingMessage(MESSAGE)
    const REPLY_TO = 'replyTo'
    message.replyTo = REPLY_TO

    expect(message.payload.options.replyTo).toEqual(REPLY_TO)
  })

  test('#routngKey is properly defined', () => {
    expect(new OutgoingMessage(MESSAGE).routingKey).toEqual(MESSAGE.routingKey)
  })

  test('#hasError is truthy if message has error key', () => {
    const messsage = Object.assign(MESSAGE, { message: { error: 'bad one' } })
    const { hasError } = new OutgoingMessage(messsage)
    expect(hasError).toBeTruthy()
  })

  test('#toArgs genearates array of arguments', () => {
    const args = new OutgoingMessage(MESSAGE).toArgs()
    const message = JSON.stringify(JSON.parse(args[2].toString()))
    expect(args[0] === MESSAGE.exchange
      && args[1] === MESSAGE.routingKey
      && message === JSON.stringify(MESSAGE.message)).toBeTruthy()
  })
})
