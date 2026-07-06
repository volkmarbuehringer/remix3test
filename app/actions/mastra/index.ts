import { Mastra } from '@mastra/core'
import { PinoLogger } from '@mastra/loggers'
import { supportAgent } from './agents/support-agent.ts'
import { completenessScorer } from './scorers/support-scorers.ts'
import { mastraStorage } from './storage.ts'

export const mastra = new Mastra({
  agents: { supportAgent },
  scorers: {
    completeness: completenessScorer,
  },
  storage: mastraStorage,
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
})
