require('rxjs/add/operator/filter')
require('rxjs/add/operator/first')

const URL = require('url')
const { grey } = require('chalk')

const withDefault = (value, defaultValue) => {
  if (typeof value !== 'undefined') {
    return value
  }

  if (typeof defaultValue === 'function') {
    return defaultValue()
  }

  return defaultValue
}

const toPromise = behaviourSubject => behaviourSubject
  .filter(value => value)
  .first()
  .toPromise()

const toVhost = url => {
  if (typeof url === 'string') {
    const { pathname } = URL.parse(url)

    return pathname || '/'
  }

  if (typeof url === 'object') {
    return url.vhost
  }

  return ''
}

const toBuffer = obj => Buffer.from(JSON.stringify(obj, null, '\t'))

const createMeta = source => `[${grey(new Date(0).toTimeString().split(' ')[0])}] [${source}]`

module.exports = {
  withDefault,
  createMeta,
  toPromise,
  toVhost,
  toBuffer
}
