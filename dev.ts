import * as http from 'node:http'
import { createFetchProxy } from 'remix/fetch-proxy'
import { createHmrReadyFetch, run } from 'remix/node-hmr'
import { createRequestListener } from 'remix/node-fetch-server'

const originPort = parseInt(process.env.PORT || '44100', 10)
const childPort = originPort + 1

const hmrRunner = run('server.ts', {
  env: { ...process.env, PORT: String(childPort) },
  nodeArgs: ['--import', 'remix/node-tsx', '--import', 'remix/ui-hmr/node'],
  browserHmrChannel: true,
})

const server = http.createServer(
  createRequestListener(
    createHmrReadyFetch(hmrRunner, createFetchProxy(`http://127.0.0.1:${childPort}`, {
      xForwardedHeaders: true,
    })),
    {
      onError(error) {
        console.error(error)
        return new Response('Server error', { status: 500 })
      },
    },
  ),
)

server.listen(originPort, '127.0.0.1')

let shuttingDown = false

function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  server.close(() => hmrRunner.close().finally(() => process.exit(0)))
  server.closeAllConnections()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
