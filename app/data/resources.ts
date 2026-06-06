import { type Database } from 'remix/data-table'

import { resources, type Resource } from './schema.ts'

export async function listResources(db: Database): Promise<Resource[]> {
  return await db.query(resources).orderBy('description', 'asc').all()
}
