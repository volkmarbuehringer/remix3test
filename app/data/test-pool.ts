import { Pool } from 'pg'

const url = process.env.DATABASE_URL ?? ''
const localeUrl = url + (url.includes('?') ? '&' : '?') + 'options=-c%20lc_messages%3Den_US.UTF-8'

export const pool = new Pool({
  connectionString: localeUrl,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 30000,
})

pool.on('error', (error) => {
  console.error('Test database pool connection error:', error.message)
})
