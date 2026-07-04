import { type Database } from 'remix/data-table'

export async function insertWebhookRequest(
  db: Database,
  data: { serialized: string; headers: string; sourceIp: string; now: number },
): Promise<string> {
  let result = await db.exec(
    `INSERT INTO webhook_requests (payload, headers, source_ip, created_at)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [data.serialized, data.headers, data.sourceIp, data.now],
  )
  let row = result.rows?.[0] as { id: unknown } | undefined
  if (!row) throw new Error('insertWebhookRequest: INSERT … RETURNING produced no row')
  return String(row.id)
}
