import { createGateStore, type PendingGateRow } from '../../utils/agent-gate-store.ts'

export type { PendingGateRow }

/**
 * Durable pending-gate pointer for the public /chat agent runs.
 *
 * One row per customer (upsert): a new turn supersedes an older suspended gate,
 * and the previous run's later terminal hook cannot clear the newer row (the
 * clear is guarded by run id). The suspension is the authoritative write, so
 * `markMode: 'upsert'` works even if the running row was never written.
 *
 * The customer read joins `chat_runs` so a gate row whose run already settled
 * (its ownership row was cleared) is not surfaced, and filters
 * `status = 'suspended'` so a started run has nothing to render.
 */
export const chatGateStore = createGateStore({
  table: 'chat_pending_gates',
  ownerColumn: 'user_id',
  markMode: 'upsert',
  resolve: {
    suspendedOnly: true,
    ownershipJoin: { table: 'chat_runs', runColumn: 'run_id', ownerColumn: 'user_id' },
  },
})

export const upsertPendingGate = chatGateStore.upsert
export const markGateSuspended = chatGateStore.markSuspended
export const clearPendingGate = chatGateStore.clear
export const resolvePendingGate = chatGateStore.resolve
