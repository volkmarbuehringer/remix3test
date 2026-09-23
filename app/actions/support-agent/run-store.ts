import { createGateStore, type PendingGateRow } from '../../utils/agent-gate-store.ts'

export type { PendingGateRow }

/**
 * Durable per-admin pointer to the support agent's currently pending gate.
 *
 * The Mastra run is the source of truth; this row is a pointer so a suspended
 * tool approval or ask_user question can be re-surfaced after a reload, a
 * browser change, or a server restart without an in-memory stream store (a
 * PostgresStoreVNext agent-run-status query is not exposed, so the indexed
 * row is the durable record). One row per admin: a new run supersedes a
 * previous pending one, and the previous run's terminal hook is guarded by run
 * id in `clear` so it cannot clear the newer run's row.
 */
export const supportGateStore = createGateStore({
  table: 'support_agent_pending_gates',
  ownerColumn: 'admin_user_id',
  markMode: 'update',
})

export const upsertPendingGate = supportGateStore.upsert
export const markGateSuspended = supportGateStore.markSuspended
export const clearPendingGate = supportGateStore.clear
export const resolvePendingGate = supportGateStore.resolve
