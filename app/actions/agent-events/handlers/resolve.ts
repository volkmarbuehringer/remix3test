import type { EventHandler, BaseEvent } from '../event-bus.ts'
import { db } from '../../../db.ts'
import { sql } from 'remix/data-table'
import { INTENTS } from '../intents.ts'

async function resolveTargetUser(
  query: string,
): Promise<{ targetUserId: number } | { error: string }> {
  try {
    let targetId = Number(query)
    if (!Number.isNaN(targetId) && Number.isInteger(targetId) && targetId > 0) {
      let result = await db.exec(sql`SELECT id FROM users WHERE id = ${targetId}`)
      if ((result.rows ?? [])[0]) return { targetUserId: targetId }
      return { error: `User with ID ${targetId} not found` }
    }
    let pattern = `%${query}%`
    let result = await db.exec(
      sql`SELECT id, name, email FROM users WHERE name ILIKE ${pattern} OR email ILIKE ${pattern} ORDER BY name`,
    )
    let rows = (result.rows ?? []) as Array<{ id: number; name: string; email: string }>
    if (rows.length === 0) return { error: `No user found matching "${query}"` }
    let names = rows.map((r) => `${r.name} (${r.email})`).join(', ')
    if (rows.length > 1)
      return { error: `Multiple users match "${query}": ${names}. Please be more specific.` }
    return { targetUserId: rows[0].id }
  } catch (err) {
    console.error('[resolveTargetUser] database error:', err)
    return { error: 'An internal error occurred while looking up the user.' }
  }
}

const ACTIONABLE_INTS: Set<string> = new Set([
  INTENTS.CANCEL_USER,
  INTENTS.LOCK_USER,
  INTENTS.UNLOCK_USER,
])

function resolveTargetByPattern(query: string): Record<string, unknown> {
  let targetId = Number(query)
  if (!Number.isNaN(targetId) && Number.isInteger(targetId) && targetId > 0) {
    return { targetUserId: targetId, targetQuery: query }
  }
  if (query.includes('@')) {
    return { targetEmail: query, targetQuery: query }
  }
  return { targetName: query, targetQuery: query }
}

export const resolveHandler: EventHandler = {
  name: 'resolve',
  eventType: 'intent.classified',
  async handle(event, emit) {
    let e = event as BaseEvent & { type: 'intent.classified' }
    let targetQuery = String(e.params.targetQuery || '').trim()

    if (!targetQuery) {
      emit({
        type: 'entities.notfound',
        error: 'No target specified. Please provide a user name, email, or ID.',
      })
      return
    }

    if (ACTIONABLE_INTS.has(e.intent)) {
      let resolved = await resolveTargetUser(targetQuery)
      if ('error' in resolved) {
        emit({ type: 'entities.notfound', error: resolved.error })
        return
      }
      emit({
        type: 'entities.resolved',
        intent: e.intent,
        params: e.params,
        resolved: { targetUserId: resolved.targetUserId, targetQuery },
        adminUserId: e.adminUserId,
        adminEmail: e.adminEmail,
      })
      return
    }

    emit({
      type: 'entities.resolved',
      intent: e.intent,
      params: e.params,
      resolved: resolveTargetByPattern(targetQuery),
      adminUserId: e.adminUserId,
      adminEmail: e.adminEmail,
    })
  },
}
