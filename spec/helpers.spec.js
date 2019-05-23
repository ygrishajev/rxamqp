const { BehaviorSubject } = require('rxjs/BehaviorSubject')
const chalk = require('chalk')

chalk.enabled = false

const {
  withDefault,
  createMeta,
  toPromise,
  toVhost,
  toBuffer
} = require('../src/helpers')

const DEFAULT = 'default'
const VALUE = 'value'
const UNDEFINED = undefined

describe('helpers', () => {
  test('#withDefault resolves to a defined value', () => {
    expect(withDefault(VALUE, DEFAULT)).toEqual(VALUE)
  })

  test('#withDefault falls back to a default function value', () => {
    expect(withDefault(UNDEFINED, () => DEFAULT)).toEqual(DEFAULT)
  })

  test('#withDefault falls back to a default value', () => {
    expect(withDefault(UNDEFINED, DEFAULT)).toEqual(DEFAULT)
  })

  test('#toPromise resolves Subjects value', () => {
    const subject = new BehaviorSubject(VALUE)
    expect.assertions(1)

    return toPromise(subject).then(value => expect(value).toEqual(VALUE))
  })

  test('#toVhost extracts root vhost from amqp url string', () => {
    const url = 'amqp://user:pass@localhost?heartbeat=30'

    expect(toVhost(url)).toEqual('/')
  })

  test('#toVhost extracts vhost from amqp url string', () => {
    const vhost = 'vhost'
    const url = `amqp://user:pass@localhost/${vhost}?heartbeat=30`

    expect(toVhost(url)).toEqual(`/${vhost}`)
  })

  test('#toVhost extracts vhost from amqp url object', () => {
    const vhost = 'vhost'
    const url = { vhost }

    expect(toVhost(url)).toEqual(`${vhost}`)
  })

  test('#toBuffer stringifies and bufferieses object', () => {
    const obj = { foo: 'bar' }

    expect(JSON.stringify(JSON.parse(toBuffer(obj).toString()))).toEqual(JSON.stringify(obj))
  })

  test('#createMeta concatenates source string with meta', () => {
    const regex = new RegExp(`^\\[(\\d{4})-(\\d{2})-(\\d{2})T(\\d{2})\\:(\\d{2})\\:(\\d{2}).([0-9]{2,3})Z\\] (\\[${VALUE}\\])$`)

    expect(regex.test(createMeta(VALUE))).toBeTruthy()
  })
})
