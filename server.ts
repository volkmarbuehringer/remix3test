import * as http from 'node:http'
import * as https from 'node:https'
import * as fs from 'node:fs'
import { createRequestListener } from 'remix/node-fetch-server'
import { html } from 'remix/html-template'

import { createNewappRouter } from './app/router.ts'
import { initializeAppDatabase, closeAppDatabase } from './app/data/setup.ts'

await initializeAppDatabase()

const REQUIRED_ENV = ['SESSION_SECRET', 'DATABASE_URL'] as const
for (let key of REQUIRED_ENV) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
}

const router = createNewappRouter()

const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 44100

const handler = createRequestListener(
  async (request, client) => {
    try {
      if (client?.address) {
        request.headers.set('X-Client-Ip', client.address)
      }
      return await router.fetch(request)
    } catch (error) {
      if (!(request.signal.aborted && error === request.signal.reason)) {
        console.error(error)
      }
      return new Response(
        String(
          html`<!doctype html>
            <html lang="de">
              <head>
                <meta charset="utf-8" />
                <title>Serverfehler — newapp</title>
                <style>
                  body {
                    font-family: 'JetBrains Mono', ui-monospace, monospace;
                    background: #f7fbff;
                    color: #313539;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    margin: 0;
                  }
                  .card {
                    background: #ffffff;
                    padding: 2rem;
                    border-radius: 8px;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                    text-align: center;
                    max-width: 480px;
                  }
                  h1 {
                    font-size: 1.25rem;
                    margin: 0 0 0.5rem;
                  }
                  p {
                    color: #5a5e62;
                    margin: 0;
                  }
                </style>
              </head>
              <body>
                <div class="card">
                  <h1>Serverfehler</h1>
                  <p>Bitte versuchen Sie es später erneut.</p>
                </div>
              </body>
            </html>`,
        ),
        {
          status: 500,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        },
      )
    }
  },
  { trustProxy: true },
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
  console.log(`Server listening on ${isProduction ? 'https' : 'http'}://${host}:${port}`)
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
