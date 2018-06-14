const { Subject } = require('rxjs/Subject')

const tickReconnection = ({ rxConnection, watcher, tickOnConnected }) => {
  const reconnected = new Subject()
  let isReconnecting = false
  let disconnectionResult

  const subscription = rxConnection.subscribe(connection => {
    if (typeof disconnectionResult !== 'undefined') {
      watcher.next(tickOnConnected ? connection : disconnectionResult)
      subscription.unsubscribe()
    }

    if (isReconnecting && !disconnectionResult) {
      disconnectionResult = connection
    }

    if (connection && !isReconnecting) {
      isReconnecting = true
      connection.close()
    }
  })

  return reconnected.first().toPromise().then(connection => expect(connection).toBeNull())
}

module.exports = {
  tickReconnection
}
