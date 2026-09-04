import { sql, type Database } from 'remix/data-table'
import { z } from 'zod/v4'

import { queryRow } from './rows.ts'

export async function insertAppWebhookRequest(
  db: Database,
  data: { serialized: string; headers: string; sourceIp: string; now: number },
): Promise<string> {
  let row = await queryRow(
    db,
    sql`INSERT INTO webhook_requests (payload, headers, source_ip, created_at)
     VALUES (${data.serialized}, ${data.headers}, ${data.sourceIp}, ${data.now})
     RETURNING id`,
    z.object({ id: z.string() }),
  )
  if (!row) throw new Error('insertAppWebhookRequest: INSERT … RETURNING produced no row')
  return row.id
}
