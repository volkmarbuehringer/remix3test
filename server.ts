import * as http from 'node:http'
import * as https from 'node:https'
import * as fs from 'node:fs'
import { createRequestListener } from 'remix/node-fetch-server'

import { createNewappRouter } from './app/router.ts'
import { initializeAppDatabase, closeAppDatabase } from './app/db.ts'
import { createServerHandler } from './app/utils/server-handler.ts'

await initializeAppDatabase()

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
  (request, client) => handleRequest(request, client?.address ?? ''),
  { trustProxy: isHmr },
)

const isProduction = process.env.NODE_ENV === 'production'

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

let shuttingDown = false

function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  closeAppDatabase()
  server.close(() => process.exit(0))
  server.closeAllConnections()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

if (isHmr) {
  process.on('disconnect', () => process.exit(0))
}
