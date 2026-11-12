import * as http from 'node:http'

import { createFetchProxy } from 'remix/fetch-proxy'
import { createHmrReadyFetch, run, type NodeHmrRunner } from 'remix/node-hmr'
import { createRequestListener } from 'remix/node-fetch-server'

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

class HmrReadyTimeoutError extends Error {
  constructor() {
    super('HMR server did not become ready in time')
    this.name = 'HmrReadyTimeoutError'
  }
}

function readyWithTimeout(runner: NodeHmrRunner): Promise<void> {
  return new Promise((resolve, reject) => {
    let timer = setTimeout(() => reject(new HmrReadyTimeoutError()), readyTimeoutMs)
    runner.ready().then(
      () => {
        clearTimeout(timer)
        resolve()
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

// `createHmrReadyFetch()` waits for `runner.ready()` without a bound. Proxy the
// handle so a restart that never becomes ready still yields the 503 below.
const timedRunner: NodeHmrRunner = {
  get generation() {
    return hmrRunner.generation
  },
  ready: () => readyWithTimeout(hmrRunner),
  close: () => hmrRunner.close(),
}

const proxyFetch = createFetchProxy(`http://127.0.0.1:${appPort}`, {
  xForwardedHeaders: true,
})
const fetchWhenReady = createHmrReadyFetch(timedRunner, proxyFetch)

async function fetchWithReadyTimeout(request: Request): Promise<Response> {
  try {
    return await fetchWhenReady(request)
  } catch (error) {
    if (!(error instanceof HmrReadyTimeoutError)) throw error
    return new Response(
      'HMR server is starting or failed to start. Check the `npm run hmr` terminal output for errors.',
      { status: 503 },
    )
  }
}

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
