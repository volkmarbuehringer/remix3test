import { rawSql, sql, type Database } from 'remix/data-table'
import { z } from 'zod/v4'

import { queryRows, queryRow } from './rows.ts'

const webhookRequestRowSchema = z.object({
  id: z.string(),
  payload: z.record(z.string(), z.unknown()),
  headers: z.record(z.string(), z.string()),
  source_ip: z.string(),
  created_at: z.string(),
  hermes_status: z.string().nullable(),
  callback_response: z.union([z.record(z.string(), z.unknown()), z.string()]).nullable(),
  callback_received_at: z.string().nullable(),
})

export type WebhookRequestRow = z.output<typeof webhookRequestRowSchema>

export const WEBHOOK_REQUESTS_PAGE_SIZE = 15

const WEBHOOK_REQUESTS_ORDER_BY_COLUMNS: Record<string, string> = {
  created_at: 'created_at',
  source_ip: 'source_ip',
  hermes_status: 'hermes_status',
  callback_received_at: 'callback_received_at',
}

export interface ListWebhookRequestsOpts {
  offset: number
  column: string
  direction: 'asc' | 'desc'
  filter?: string | undefined
  pageSize?: number
}

export async function listWebhookRequests(
  db: Database,
  opts: ListWebhookRequestsOpts,
): Promise<{ rows: WebhookRequestRow[]; hasMore: boolean }> {
  let { offset, column, direction, filter, pageSize = WEBHOOK_REQUESTS_PAGE_SIZE } = opts

  let query = `SELECT id, payload, headers, source_ip, created_at, hermes_status, callback_response, callback_received_at FROM webhook_requests`
  let params: unknown[] = []
  let paramIndex = 0

  if (filter) {
    paramIndex++
    query += ` WHERE payload::text ILIKE $${paramIndex}`
    let esc = filter.slice(0, 200).replace(/[%_\\]/g, '\\$&')
    params.push(`%${esc}%`)
  }

  paramIndex++
  let orderCol = WEBHOOK_REQUESTS_ORDER_BY_COLUMNS[column]
  if (!orderCol) throw new Error(`Invalid sort column: ${column}`)
  query += ` ORDER BY ${orderCol} ${direction === 'desc' ? 'DESC' : 'ASC'}, id DESC`
  query += ` LIMIT $${paramIndex}`
  params.push(pageSize + 1)

  paramIndex++
  query += ` OFFSET $${paramIndex}`
  params.push(offset)

  let rows = await queryRows(db, rawSql(query, params), webhookRequestRowSchema)
  let hasMore = rows.length > pageSize
  if (hasMore) rows.pop()

  return { rows, hasMore }
}

export async function getWebhookRequest(
  db: Database,
  id: string,
): Promise<WebhookRequestRow | undefined> {
  return await queryRow(
    db,
    sql`SELECT id, payload, headers, source_ip, created_at, hermes_status, callback_response, callback_received_at FROM webhook_requests WHERE id = ${id}`,
    webhookRequestRowSchema,
  )
}

export async function updateWebhookRequestPayload(
  db: Database,
  id: string,
  payload: string,
): Promise<boolean> {
  let result = await db.exec('UPDATE webhook_requests SET payload = $1 WHERE id = $2', [
    payload,
    id,
  ])
  return (result.affectedRows ?? 0) > 0
}

export async function getWebhookRequestPayload(
  db: Database,
  id: string,
): Promise<{ payload: Record<string, unknown> } | undefined> {
  return await queryRow(
    db,
    sql`SELECT payload FROM webhook_requests WHERE id = ${id}`,
    z.object({ payload: z.record(z.string(), z.unknown()) }),
  )
}

export async function resetWebhookRequestCallback(db: Database, id: string): Promise<void> {
  await db.exec(
    'UPDATE webhook_requests SET callback_response = NULL, callback_received_at = NULL WHERE id = $1',
    [id],
  )
}

export async function updateWebhookRequestHermesStatus(
  db: Database,
  id: string,
  status: string,
): Promise<void> {
  await db.exec('UPDATE webhook_requests SET hermes_status = $1 WHERE id = $2', [status, id])
}

export async function insertWebhookRequest(
  db: Database,
  data: { payload: string; headers: string; sourceIp: string; now: number },
): Promise<string> {
  let row = await queryRow(
    db,
    sql`INSERT INTO webhook_requests (payload, headers, source_ip, created_at)
     VALUES (${data.payload}, ${data.headers}, ${data.sourceIp}, ${data.now})
     RETURNING id`,
    z.object({ id: z.string() }),
  )
  if (!row) throw new Error('insertWebhookRequest: INSERT … RETURNING produced no row')
  return row.id
}
