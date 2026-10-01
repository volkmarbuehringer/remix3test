import { Mastra } from '@mastra/core'
import type { Agent } from '@mastra/core/agent'
import { createDurableAgent } from '@mastra/core/agent/durable'
import { PinoLogger } from '@mastra/loggers'
import { Observability, MastraStorageExporter, SensitiveDataFilter } from '@mastra/observability'
import { supportAgent } from './agents/support-agent.ts'
import { customerAgent } from './agents/customer-agent.ts'
import { bookingWorkflow } from './workflows/booking-workflow.ts'
import { customerBookingWorkflow } from './workflows/customer-booking-workflow.ts'
import { bookingCancellationWorkflow } from './workflows/booking-cancellation-workflow.ts'
import { bookingReminderWorkflow } from './workflows/booking-reminder-workflow.ts'
import { cancelUserWorkflow } from './workflows/cancel-user-workflow.ts'
import { lockUserWorkflow } from './workflows/lock-user-workflow.ts'
import { unlockUserWorkflow } from './workflows/unlock-user-workflow.ts'
import { consistencyCheckWorkflow } from './workflows/consistency-check-workflow.ts'
import { userPreflightWorkflow } from './workflows/user-preflight-workflow.ts'
import { userManagementWorkflow } from './workflows/user-management-workflow.ts'
import { deleteUserAppointmentsWorkflow } from './workflows/delete-user-appointments.ts'
import { completenessScorer } from './scorers/support-scorers.ts'
import { appointmentCreatedScorer } from './scorers/booking-scorers.ts'
import { mastraStorage } from './storage.ts'
import { setMastra } from './workflow-executor.ts'

export const mastra = new Mastra({
  agents: { supportAgent, customerAgent },
  workflows: {
    bookingWorkflow,
    customerBookingWorkflow,
    bookingCancellationWorkflow,
    bookingReminderWorkflow,
    cancelUserWorkflow,
    lockUserWorkflow,
    unlockUserWorkflow,
    consistencyCheckWorkflow,
    userPreflightWorkflow,
    userManagementWorkflow,
    deleteUserAppointmentsWorkflow,
  },
  scorers: {
    completeness: completenessScorer,
    appointmentCreated: appointmentCreatedScorer,
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
        logging: { enabled: true, level: 'info' },
      },
    },
  }),
})

/**
 * Lazily creates and registers the durable customer agent.
 *
 * `DurableAgent`'s constructor resolves the wrapped agent's model eagerly
 * (`model: agent.__model ?? agent.getModel()`), so wrapping at module load made
 * a missing `OPENCODE_API_KEY` fail app startup instead of the AI route — the
 * opposite of this app's lazy-model design. Register on first durable use
 * instead; `addAgent()` also wires the durable agent's required workflows.
 *
 * The wrapper id is distinct from the raw agent's so the durable workflow's
 * `getAgentById(agentId)` rebuild resolves the wrapper, not the raw agent.
 */
let durableCustomerAgent: Agent | undefined
export function getDurableCustomerAgent(): Agent {
  if (!durableCustomerAgent) {
    durableCustomerAgent = createDurableAgent({
      agent: customerAgent as unknown as Agent,
      id: 'customer-agent-durable',
    }) as unknown as Agent
    mastra.addAgent(durableCustomerAgent, 'durableCustomerAgent')
  }
  return durableCustomerAgent
}

setMastra(mastra)
