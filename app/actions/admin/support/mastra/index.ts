import { Mastra } from '@mastra/core'
import { LibSQLStore } from '@mastra/libsql'
import { PinoLogger } from '@mastra/loggers'

// TODO: Use persistent storage before prod (LibSQL file or Postgres-backed store).
// In-memory means agent memory is lost on restart and diverges from chatlog.
export const mastra = new Mastra({
  storage: new LibSQLStore({
    id: 'mastra-storage',
    url: ':memory:',
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
})
