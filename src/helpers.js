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

const toVhost = url => url && url.vhost

const toBuffer = obj => Buffer.from(JSON.stringify(obj, null, '\t'))

const createMeta = source => `[${grey(new Date().toTimeString().split(' ')[0])}] [${source}]`

module.exports = {
  withDefault,
  createMeta,
  toPromise,
  toVhost,
  toBuffer
}
