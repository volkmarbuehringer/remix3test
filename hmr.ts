import * as http from 'node:http'

import { createFetchProxy } from 'remix/fetch-proxy'
import { run, type NodeHmrRunner } from 'remix/node-hmr'
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
    HOST: '127.0.0.1',
  },
  nodeArgs: ['--import', 'remix/node-tsx', '--import', 'remix/ui-hmr/node'],
  browserHmrChannel: { port: hmrEventPort },
})

function waitForReady(runner: NodeHmrRunner): Promise<boolean> {
  return Promise.race([
    runner.ready().then(() => true),
    new Promise<boolean>((resolve) => {
      setTimeout(() => resolve(false), readyTimeoutMs)
    }),
  ])
}

function createReadyFetch(
  runner: NodeHmrRunner,
  fetch: (request: Request) => Response | Promise<Response>,
): (request: Request) => Promise<Response> {
  return async (request) => {
    while (true) {
      let ready = await waitForReady(runner)
      if (!ready) {
        return new Response(
          'HMR server is starting or failed to start. Check the `npm run hmr` terminal output for errors.',
          { status: 503 },
        )
      }

      let generation = runner.generation
      try {
        let response = await fetch(request)
        let retryable =
          (request.method === 'GET' || request.method === 'HEAD') &&
          (response.status === 502 || response.status === 503 || response.status === 504)

        if (!retryable) return response

        let readyAfterRestart = await waitForReady(runner)
        if (!readyAfterRestart || runner.generation === generation) return response
      } catch (error) {
        let readyAfterRestart = await waitForReady(runner)
        if (runner.generation !== generation && readyAfterRestart) continue
        throw error
      }
    }
  }
}

const server = http.createServer(
  createRequestListener(
    createReadyFetch(
      hmrRunner,
      createFetchProxy(`http://127.0.0.1:${appPort}`, {
        xForwardedHeaders: true,
      }),
    ),
  ),
)

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
