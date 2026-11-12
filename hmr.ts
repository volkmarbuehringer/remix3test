import * as http from 'node:http'

import { createFetchProxy } from 'remix/fetch-proxy'
import { run } from 'remix/node-hmr'
import { createRequestListener } from 'remix/node-fetch-server'

import { createHmrFetch } from './hmr-ready.ts'

const readyTimeoutMs = 30_000

function configuredPort(name: string, value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback
  let port = Number.parseInt(value, 10)
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new TypeError(`Invalid ${name} port: ${value}`)
  }
  return port
}

const hmrProxyPort = configuredPort('PORT', process.env.PORT, 44100)
const hmrEventPort = configuredPort('HMR_PORT', process.env.HMR_PORT, hmrProxyPort + 1)
const appPort = configuredPort('APP_PORT', process.env.APP_PORT, hmrEventPort + 1)

const hmrRunner = run('server.ts', {
  env: {
    ...process.env,
    PORT: String(appPort),
    HMR_PROXY_PORT: String(hmrProxyPort),
    HMR_EVENT_PORT: String(hmrEventPort),
    HOST: '127.0.0.1',
  },
  nodeArgs: [
    '--import',
    'remix/node-tsx',
    '--import',
    new URL('./component-hmr-server.ts', import.meta.url).href,
  ],
  browserHmrChannel: { port: hmrEventPort },
})

// `createHmrReadyFetch()` waits for `runner.ready()` without a bound. The
// wrapper bounds that wait so a restart that never becomes ready still yields
// the 503 below.
const proxyFetch = createFetchProxy(`http://127.0.0.1:${appPort}`, {
  xForwardedHeaders: true,
})
const fetchWithReadyTimeout = createHmrFetch(hmrRunner, proxyFetch, { readyTimeoutMs })

const server = http.createServer(createRequestListener(fetchWithReadyTimeout))

server.listen(hmrProxyPort, '127.0.0.1')

let shuttingDown = false

function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  server.close(() => hmrRunner.close().finally(() => process.exit(0)))
  server.closeAllConnections()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
