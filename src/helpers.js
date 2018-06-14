const withDefault = (value, defaultValue) => (typeof value === 'undefined' ? defaultValue : value)

module.exports = { withDefault }
