import { type Database } from 'remix/data-table'

export async function insertAppWebhookRequest(
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
  if (!row) throw new Error('insertAppWebhookRequest: INSERT … RETURNING produced no row')
  return String(row.id)
}

export async function updateHermesStatus(db: Database, id: string, status: string): Promise<void> {
  await db.exec('UPDATE webhook_requests SET hermes_status = $1 WHERE id = $2', [status, id])
}
