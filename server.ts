import * as http from 'node:http'
import * as https from 'node:https'
import * as fs from 'node:fs'
import { createRequestListener } from 'remix/node-fetch-server'

import { createNewappRouter } from './app/router.ts'
import { initializeAppDatabase, closeAppDatabase } from './app/data/setup.ts'

await initializeAppDatabase()

const router = createNewappRouter()

const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 44100

const handler = createRequestListener(async (request) => {
  try {
    return await router.fetch(request)
  } catch (error) {
    if (!(request.signal.aborted && error === request.signal.reason)) {
      console.error(error)
    }
    return new Response('Internal Server Error', { status: 500 })
  }
})

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

server.listen(port, () => {
  console.log(`Server listening on ${isProduction ? 'https' : 'http'}://localhost:${port}`)
  if (!isProduction) {
    console.log('')
    console.log('Demo accounts:')
    console.log('  Admin:    admin@newapp.com / admin123')
    console.log('  Customer: user@newapp.com / password123')
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
