import { PostgresStore } from '@mastra/pg'
import { pool } from '../../data/connection.ts'

// Shared storage instance used by both Mastra and Memory.
// PostgresStore.init() auto-creates mastra_* tables (CREATE TABLE IF NOT EXISTS)
// on first storage access. To control this, set disableInit: true and run
// the DDL via a migration script (exportSchemas()). The DB user needs
// CREATE TABLE permission on the schema being used.
export const mastraStorage = new PostgresStore({
  id: 'mastra',
  pool,
})
