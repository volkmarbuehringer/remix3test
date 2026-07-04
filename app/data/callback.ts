import { type Database } from 'remix/data-table'

export async function updateCallbackResponse(
  db: Database,
  data: { serialized: string; now: number; id: string },
): Promise<boolean> {
  let result = await db.exec(
    `UPDATE webhook_requests SET callback_response = $1, callback_received_at = $2 WHERE id = $3 AND callback_received_at IS NULL`,
    [data.serialized, data.now, data.id],
  )
  return (result.affectedRows ?? 0) > 0
}

export async function checkWebhookRequestExists(
  db: Database,
  id: string,
): Promise<boolean> {
  let result = await db.exec('SELECT 1 FROM webhook_requests WHERE id = $1', [id])
  return (result.rows ?? []).length > 0
}
