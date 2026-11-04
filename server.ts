import * as http from 'node:http'
import * as https from 'node:https'
import * as fs from 'node:fs'
import { createRequestListener, type ClientAddress } from 'remix/node-fetch-server'

import { assetServer } from './app/assets.ts'
import { createNewappRouter } from './app/router.ts'
import { initializeAppDatabase, closeAppDatabase } from './app/db.ts'
import { createServerHandler, renderServerError } from './app/utils/server-handler.ts'
import { configuredPublicOrigin } from './app/utils/public-origin.ts'
import { startSessionMaintenance, stopSessionMaintenance } from './app/middleware/session.ts'

await initializeAppDatabase()
startSessionMaintenance()

const REQUIRED_ENV = ['SESSION_SECRET', 'DATABASE_URL'] as const
for (let key of REQUIRED_ENV) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
}

const router = createNewappRouter()

const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 44100
const hmrProxyPort = process.env.HMR_PROXY_PORT
  ? Number.parseInt(process.env.HMR_PROXY_PORT, 10)
  : null
const isHmr = process.env.REMIX_NODE_HMR === '1'

const handleRequest = createServerHandler(router)

const handler = createRequestListener(
  (request: Request, client: ClientAddress) => handleRequest(request, client.address),
  {
    trustProxy: isHmr,
    onError: (error) => {
      console.error(error)
      return renderServerError()
    },
  },
)

const isProduction = process.env.NODE_ENV === 'production'

if (isProduction && configuredPublicOrigin() === undefined) {
  console.warn(
    '[config] No trusted public origin: set PUBLIC_ORIGIN or write the current URL to ' +
      'tmp/public-origin. Password-reset and verification emails will fail until then ' +
      '(the Host header is never trusted for links).',
  )
}

let server: http.Server | https.Server
if (isProduction) {
  let key: Buffer, cert: Buffer
  try {
    key = fs.readFileSync('key.pem')
    cert = fs.readFileSync('cert.pem')
  } catch {
    console.error('Missing TLS certificate files (key.pem, cert.pem)')
    console.error('Generate self-signed certificates for your VPS IP:')
    console.error('  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \\')
    console.error('    -keyout key.pem -certout cert.pem \\')
    console.error('    -addext "subjectAltName = IP:<VPS_IP_ADDRESS>"')
    process.exit(1)
  }
  server = https.createServer({ key, cert }, handler)
} else {
  server = http.createServer(handler)
}

const host = process.env.HOST || (isProduction ? '0.0.0.0' : 'localhost')
server.listen(port, host, () => {
  if (isHmr) {
    import('remix/node-hmr/runtime')
      .then((nodeHmr) => nodeHmr.emitServerReady())
      .catch((error) => console.error('Failed to emit server-ready signal', error))
  }
  console.log(
    `Server listening on ${isProduction ? 'https' : 'http'}://${host}:${hmrProxyPort ?? port}`,
  )
  if (!isProduction) {
    console.log('')
    console.log('Demo accounts (passwords: SEED_ADMIN_PASSWORD / SEED_USER_PASSWORD in .env):')
    console.log('  Admin:    admin@newapp.com')
    console.log('  Customer: user@newapp.com')
    console.log('')
  }
})

const SHUTDOWN_TIMEOUT_MS = 10_000

let shuttingDown = false

async function shutdown(reason: string) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`[shutdown] ${reason}: draining connections`)
  stopSessionMaintenance()

  await new Promise<void>((resolve) => {
    let timer = setTimeout(() => {
      console.warn('[shutdown] drain timed out; closing remaining connections')
      server.closeAllConnections()
      resolve()
    }, SHUTDOWN_TIMEOUT_MS)
    timer.unref()

    server.close(() => {
      clearTimeout(timer)
      resolve()
    })
    // Keep-alive clients can otherwise hold the server open until their idle
    // timeout even though no request is in flight.
    server.closeIdleConnections()
  })

  let results = await Promise.allSettled([assetServer.close(), closeAppDatabase()])
  let failed = results.find((result) => result.status === 'rejected')
  if (failed) {
    console.error('[shutdown] cleanup failed:', failed.reason)
    process.exit(1)
  }
  process.exit(0)
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))

if (isHmr) {
  process.on('disconnect', () => void shutdown('disconnect'))
}
