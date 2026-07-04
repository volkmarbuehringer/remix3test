import { type Database } from 'remix/data-table'

export interface WebhookRequestRow {
  id: string
  payload: Record<string, unknown>
  headers: Record<string, string>
  source_ip: string
  created_at: number
  hermes_status: string | null
  callback_response: Record<string, unknown> | string | null
  callback_received_at: number | null
}

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
  filter?: string
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
  query += ` ORDER BY ${WEBHOOK_REQUESTS_ORDER_BY_COLUMNS[column] || 'created_at'} ${direction === 'desc' ? 'DESC' : 'ASC'}`
  query += ` LIMIT $${paramIndex}`
  params.push(pageSize + 1)

  paramIndex++
  query += ` OFFSET $${paramIndex}`
  params.push(offset)

  let result = await db.exec(query, params)
  let rows = (result.rows ?? []) as unknown as WebhookRequestRow[]
  let hasMore = rows.length > pageSize
  if (hasMore) rows.pop()

  return { rows, hasMore }
}

export async function getWebhookRequest(
  db: Database,
  id: string,
): Promise<WebhookRequestRow | undefined> {
  let result = await db.exec(
    `SELECT id, payload, headers, source_ip, created_at, hermes_status, callback_response, callback_received_at FROM webhook_requests WHERE id = $1`,
    [id],
  )
  return (result.rows ?? []).length > 0
    ? (result.rows![0] as unknown as WebhookRequestRow)
    : undefined
}

export async function updateWebhookRequestPayload(
  db: Database,
  id: string,
  payload: string,
): Promise<boolean> {
  let result = await db.exec(
    'UPDATE webhook_requests SET payload = $1 WHERE id = $2',
    [payload, id],
  )
  return (result.affectedRows ?? 0) > 0
}

export async function getWebhookRequestPayload(
  db: Database,
  id: string,
): Promise<{ payload: Record<string, unknown> } | undefined> {
  let result = await db.exec(
    'SELECT payload FROM webhook_requests WHERE id = $1',
    [id],
  )
  return (result.rows ?? []).length > 0
    ? (result.rows![0] as { payload: Record<string, unknown> })
    : undefined
}

export async function resetWebhookRequestCallback(
  db: Database,
  id: string,
): Promise<void> {
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
  await db.exec(
    'UPDATE webhook_requests SET hermes_status = $1 WHERE id = $2',
    [status, id],
  )
}

export async function insertWebhookRequest(
  db: Database,
  data: { payload: string; headers: string; sourceIp: string; now: number },
): Promise<void> {
  await db.exec(
    `INSERT INTO webhook_requests (payload, headers, source_ip, created_at)
     VALUES ($1, $2, $3, $4)`,
    [data.payload, data.headers, data.sourceIp, data.now],
  )
}
