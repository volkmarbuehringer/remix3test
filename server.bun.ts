import * as fs from 'node:fs'

import { createNewappRouter } from './app/router.ts'
import { initializeAppDatabase, closeAppDatabase } from './app/db.ts'
import { createServerHandler } from './app/utils/server-handler.ts'
import { configuredPublicOrigin } from './app/utils/public-origin.ts'

await initializeAppDatabase()

const REQUIRED_ENV = ['SESSION_SECRET', 'DATABASE_URL'] as const
for (let key of REQUIRED_ENV) {
  if (!process.env[key]) {
    throw new Error('Missing required environment variable: ' + key)
  }
}

const router = createNewappRouter()
const handleRequest = createServerHandler(router)

const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 44100
const isProduction = process.env.NODE_ENV === 'production'

if (isProduction && configuredPublicOrigin() === undefined) {
  console.warn(
    '[config] No trusted public origin: set PUBLIC_ORIGIN or write the current URL to ' +
      'tmp/public-origin. Password-reset and verification emails will fail until then ' +
      '(the Host header is never trusted for links).',
  )
}
const hostname = process.env.HOST || (isProduction ? '0.0.0.0' : 'localhost')

function loadTls() {
  try {
    return { key: fs.readFileSync('key.pem'), cert: fs.readFileSync('cert.pem') }
  } catch {
    console.error('Missing TLS certificate files (key.pem, cert.pem)')
    console.error('Generate self-signed certificates for your VPS IP:')
    console.error(
      '  openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout key.pem -certout cert.pem -addext "subjectAltName = IP:<VPS_IP_ADDRESS>"',
    )
    process.exit(1)
  }
}

const server = Bun.serve({
  port,
  hostname,
  development: !isProduction,
  ...(isProduction ? { tls: loadTls() } : {}),
  fetch(request, runtime) {
    // requestIP() is the TCP socket address, so X-Client-Ip stays unspoofable
    // (mirrors the Node entry's createRequestListener client.address).
    return handleRequest(request, runtime.requestIP(request)?.address ?? '')
  },
})

console.log(
  'Server listening on ' + (isProduction ? 'https' : 'http') + '://' + hostname + ':' + server.port,
)
if (!isProduction) {
  console.log('')
  console.log('Demo accounts (passwords: SEED_ADMIN_PASSWORD / SEED_USER_PASSWORD in .env):')
  console.log('  Admin:    admin@newapp.com')
  console.log('  Customer: user@newapp.com')
  console.log('')
}

let shuttingDown = false

async function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  server.stop()
  await closeAppDatabase()
  process.exit(0)
}

process.on('SIGINT', () => void shutdown())
process.on('SIGTERM', () => void shutdown())
