import type { EventHandler, BaseEvent } from '../event-bus.ts'
import { classifyWithAgent, type ClassifyAgent } from '../../mastra/intent-classifier.ts'

let _agent: ClassifyAgent | undefined
let _agentReady = false

export function __setAgent(agent: ClassifyAgent | undefined): void {
  _agent = agent
  _agentReady = true
}

async function getAgent(): Promise<ClassifyAgent> {
  if (_agentReady) {
    if (!_agent) throw new Error('No classify agent configured')
    return _agent
  }
  let mod = await import('../../mastra/index.ts')
  if (_agentReady) return _agent as ClassifyAgent
  let agent = mod.mastra.getAgent('workflowAgent')
  _agent = {
    generate: (message, opts) => agent.generate(message, opts ?? {}),
  }
  _agentReady = true
  return _agent
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
      },
      adminUserId: e.adminUserId,
      adminEmail: e.adminEmail,
    })
  },
}
