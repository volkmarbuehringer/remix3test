import { initializeAppDatabase, pool } from '../../data/setup.ts'
import { createAuthCookieWithCsrfForUser } from '../../test-utils.ts'

export const BASE = 'https://remix.run'
export const ADMIN_APPT_URL = `${BASE}/verwaltung/appointments`

export async function setupTestEnvironment() {
  await initializeAppDatabase()
  let now = Date.now()

  // ── Create a self-contained test resource WITH offerings ──
  let r1 = await pool.query(
    'INSERT INTO resources (description, created_at, updated_at) VALUES ($1, $2, $3) RETURNING id',
    ['Test Resource - Admin Appointments', now, now],
  )
  let resourceId = r1.rows[0].id as number

  // ── Create a second test resource WITHOUT offerings ──
  let r2 = await pool.query(
    'INSERT INTO resources (description, created_at, updated_at) VALUES ($1, $2, $3) RETURNING id',
    ['Test Resource No Offerings - Admin Appointments', now, now],
  )
  let resource2Id = r2.rows[0].id as number

  // ── Create a test offering for resourceId: tomorrow 08:00–18:00 ──
  let today = new Date()
  let tomorrow =
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) + 86_400_000
  await pool.query(
    `INSERT INTO appointoffering (day, resource_id, during, created_at, updated_at)
     VALUES ($1, $2, '[480,1080)', $3, $3)`,
    [tomorrow, resourceId, now],
  )
  let offeringDateStr = new Date(tomorrow).toISOString().slice(0, 10)

  // ── Admin session (for authorized tests) ──
  let adminAuth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
  if (!adminAuth?.cookie) {
    throw new Error('Failed to create admin session — check admin@newapp.com exists in seed data')
  }

  // ── Non-admin user session (for 403 tests) ──
  let userAuth = await createAuthCookieWithCsrfForUser('user@newapp.com')
  if (!userAuth?.cookie) {
    throw new Error('Failed to create user session — check user@newapp.com exists in seed data')
  }

  let userResult = await pool.query('SELECT id FROM users WHERE email = $1', ['user@newapp.com'])
  let userId = userResult.rows[0]?.id as number

  return {
    adminCookie: adminAuth.cookie,
    adminCsrfToken: adminAuth.csrfToken,
    userCookie: userAuth.cookie,
    resourceId,
    resource2Id,
    userId,
    offeringDateStr,
  }
}

export async function teardownTestEnvironment(
  resourceId: number,
  resource2Id: number,
  appointmentIds: number[],
) {
  for (let id of appointmentIds) {
    try {
      await pool.query('DELETE FROM appointments WHERE id = $1', [id])
    } catch {
      // Ignore cleanup errors
    }
  }
  // delete offerings before the resource that owns them
  try {
    await pool.query('DELETE FROM appointoffering WHERE resource_id = $1 OR resource_id = $2', [
      resourceId,
      resource2Id,
    ])
  } catch {
    /* ignore */
  }
  try {
    await pool.query('DELETE FROM resources WHERE id = $1 OR id = $2', [resourceId, resource2Id])
  } catch {
    /* ignore */
  }
}
