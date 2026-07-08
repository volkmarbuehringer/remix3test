import { Mastra } from '@mastra/core'
import { PinoLogger } from '@mastra/loggers'
import {
  Observability,
  MastraStorageExporter,
  SensitiveDataFilter,
} from '@mastra/observability'
import { supportAgent } from './agents/support-agent.ts'
import { customerAgent } from './agents/customer-agent.ts'
import { bookingWorkflow } from './workflows/booking-workflow.ts'
import { customerBookingWorkflow } from './workflows/customer-booking-workflow.ts'
import { bookingCancellationWorkflow } from './workflows/booking-cancellation-workflow.ts'
import { bookingReminderWorkflow } from './workflows/booking-reminder-workflow.ts'
import { completenessScorer } from './scorers/support-scorers.ts'
import { mastraStorage } from './storage.ts'
import { consoleNotificationSender } from './notifications/sender.ts'
import { setMastra } from './workflow-executor.ts'

export const mastra = new Mastra({
  agents: { supportAgent, customerAgent },
  workflows: { bookingWorkflow, customerBookingWorkflow, bookingCancellationWorkflow, bookingReminderWorkflow },
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

setMastra(mastra)
