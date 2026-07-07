import { Mastra } from '@mastra/core'
import { PinoLogger } from '@mastra/loggers'
import {
  Observability,
  MastraStorageExporter,
  SensitiveDataFilter,
} from '@mastra/observability'
import { supportAgent } from './agents/support-agent.ts'
import { customerAgent } from './agents/customer-agent.ts'
import { bookingAgent } from './agents/booking-agent.ts'
import { bookingWorkflow } from './workflows/booking-workflow.ts'
import { completenessScorer } from './scorers/support-scorers.ts'
import { mastraStorage } from './storage.ts'

export const mastra = new Mastra({
  agents: { supportAgent, customerAgent, bookingAgent },
  workflows: { bookingWorkflow },
  scorers: {
    completeness: completenessScorer,
  },
  storage: mastraStorage,
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'mastra',
        exporters: [new MastraStorageExporter()],
        spanOutputProcessors: [new SensitiveDataFilter()],
      },
    },
  }),
})
