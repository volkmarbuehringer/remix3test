import * as http from 'node:http'
import { createRequestListener } from 'remix/node-fetch-server'

import { createNewappRouter } from './app/router.ts'
import { initializeAppDatabase, closeAppDatabase } from './app/data/setup.ts'

await initializeAppDatabase()

const router = createNewappRouter()

const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 44100

const server = http.createServer(
  createRequestListener(async (request) => {
    try {
      return await router.fetch(request)
    } catch (error) {
      if (!(request.signal.aborted && error === request.signal.reason)) {
        console.error(error)
      }
      return new Response('Internal Server Error', { status: 500 })
    }
  }),
)

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`)
  if (process.env.NODE_ENV !== 'production') {
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
