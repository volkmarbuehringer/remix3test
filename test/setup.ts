export function globalSetup() {
  process.env.NODE_ENV = 'test'
  process.loadEnvFile('./.env')
}

export async function globalTeardown() {
  let { pool } = await import('../app/data/connection.ts')
  try {
    await pool.end()
  } catch (err) {
    console.error('Error closing database pool:', err)
  }
}
