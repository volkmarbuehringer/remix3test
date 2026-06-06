process.loadEnvFile('./.env')
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCookie } from 'remix/cookie'
import { Session } from 'remix/session'
import { createFsSessionStorage } from 'remix/session-storage/fs'

const appRootPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sessionDirectoryPath = path.join(appRootPath, '..', 'tmp', 'sessions')

fs.mkdirSync(sessionDirectoryPath, { recursive: true })

const sessionSecret = process.env.SESSION_SECRET
if (!sessionSecret) {
  throw new Error('SESSION_SECRET environment variable is required. Set it in .env')
}

export const sessionCookie = createCookie('session', {
  secrets: [sessionSecret],
  secure: true,
  httpOnly: true,
  sameSite: 'Strict',
  maxAge: 2592000,
  path: '/',
})

export const sessionStorage = createFsSessionStorage(sessionDirectoryPath)


