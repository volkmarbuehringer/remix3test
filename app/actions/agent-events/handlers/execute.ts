import type { EventHandler, BaseEvent } from '../event-bus.ts'

type ExecutorInput = {
  targetUserId: number
  adminUserId: number
  adminEmail: string
}
type ExecutorResult = Promise<{ success: boolean; error?: string }>
type Executor = (input: ExecutorInput) => ExecutorResult

let _executors: Record<string, Executor> = {}
let _executorsReady = false

export function __setExecutors(m: Record<string, Executor>): void {
  _executors = m
  _executorsReady = true
}

async function initExecutors(): Promise<void> {
  if (_executorsReady) return
  let { executeCancelUserWorkflow, executeLockUserWorkflow, executeUnlockUserWorkflow } =
    await import('../../mastra/workflow-executor.ts')
  if (_executorsReady) return
  _executors = {
    cancel: async (input) => {
      let r = await executeCancelUserWorkflow(input)
      return { success: r.success, error: r.error }
    },
    lock: async (input) => {
      let r = await executeLockUserWorkflow(input)
      return { success: r.success, error: r.error }
    },
    unlock: async (input) => {
      let r = await executeUnlockUserWorkflow(input)
      return { success: r.success, error: r.error }
    },
  }
  _executorsReady = true
}

initExecutors()

function parsePayload(payload: unknown): {
  intent: string
  targetUserId: number
  adminUserId: number
  adminEmail: string
} {
  let p = (payload || {}) as Record<string, unknown>
  let rawId = p.targetUserId
  let targetUserId = typeof rawId === 'number' && Number.isFinite(rawId) ? Math.floor(rawId) : 0
  return {
    intent: typeof p.intent === 'string' ? p.intent : '',
    targetUserId: targetUserId > 0 ? targetUserId : 0,
    adminUserId:
      typeof p.adminUserId === 'number' && Number.isFinite(p.adminUserId)
        ? Math.floor(p.adminUserId)
        : 0,
    adminEmail: typeof p.adminEmail === 'string' ? p.adminEmail : '',
  }
}

export const executeHandler: EventHandler = {
  name: 'execute',
  eventType: 'confirm.resolved',
  async handle(event, emit) {
    let e = event as BaseEvent & { type: 'confirm.resolved' }
    if (!e.confirmed) {
      emit({ type: 'action.completed', success: false, result: { error: 'Cancelled by admin' } })
      return
    }

    let { intent, targetUserId, adminUserId, adminEmail } = parsePayload(e.payload)

    if (!targetUserId) {
      emit({
        type: 'action.completed',
        success: false,
        result: { error: 'No target user specified' },
      })
      return
    }

    let executor = _executors[intent]
    if (!executor) {
      emit({
        type: 'action.completed',
        success: false,
        result: { error: `Unknown action: ${intent}`, intent, targetUserId },
      })
      return
    }

    try {
      let result = await executor({ targetUserId, adminUserId, adminEmail })
      emit({
        type: 'action.completed',
        success: result.success,
        result: { ...result, intent, targetUserId },
      })
    } catch (err) {
      console.error('[executeHandler] workflow error:', err)
      emit({
        type: 'action.completed',
        success: false,
        result: { error: 'Failed to execute action', intent, targetUserId },
      })
    }
  },
}
