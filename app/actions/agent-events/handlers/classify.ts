import type { EventHandler, BaseEvent } from '../event-bus.ts'
import {
  classifyWithAgent,
  resolveWorkflowAgent,
  __setWorkflowAgent,
  type ClassifyAgent,
} from '../../mastra/intent-classifier.ts'

// Test seam kept at the handler (the public injection point the agent-events
// tests use); the lazy registry lookup lives in the classifier module so the
// support agent's classify_intent tool resolves the same agent.
export function __setAgent(agent: ClassifyAgent | undefined): void {
  __setWorkflowAgent(agent)
}

async function getAgent(): Promise<ClassifyAgent> {
  return resolveWorkflowAgent()
}

export const classifyHandler: EventHandler = {
  name: 'classify',
  eventType: 'request.validated',
  async handle(event, emit) {
    let e = event as BaseEvent & { type: 'request.validated' }
    let agent
    try {
      agent = await getAgent()
    } catch (err) {
      console.error('[classifyHandler] agent setup error:', err)
      emit({ type: 'intent.unclear', text: 'Could not initialize the intent resolver.' })
      return
    }
    let result = await classifyWithAgent(agent, e.message)

    if ('unclear' in result) {
      emit({ type: 'intent.unclear', text: result.unclear })
      return
    }

    emit({
      type: 'intent.classified',
      intent: result.intent,
      params: {
        targetQuery: result.targetQuery,
        ...(result.resourceQuery ? { resourceQuery: result.resourceQuery } : {}),
        ...(result.period ? { period: result.period } : {}),
        ...(result.status ? { status: result.status } : {}),
      },
      adminUserId: e.adminUserId,
      adminEmail: e.adminEmail,
    })
  },
}
