import type { ReadableStream as NodeReadableStream } from 'node:stream/web'

export interface StoredStream {
  runId: string
  userId: string | number
  fullStream: NodeReadableStream<unknown>
  getFullOutput: () => Promise<{
    text: string
    finishReason?: string
    toolCalls?: unknown[]
    toolResults?: unknown[]
    suspendPayload?: unknown
  }>
}

const STORE_TTL_MS = 5 * 60 * 1000

const store = new Map<string, { entry: StoredStream; timer: ReturnType<typeof setTimeout> }>()
const ownershipStore = new Map<
  string,
  { userId: string | number; timer: ReturnType<typeof setTimeout> }
>()

export function setStream(runId: string, stream: StoredStream) {
  let existing = store.get(runId)
  if (existing) clearTimeout(existing.timer)
  let timer = setTimeout(() => {
    store.delete(runId)
  }, STORE_TTL_MS)
  store.set(runId, { entry: stream, timer })

  let existingOwner = ownershipStore.get(runId)
  if (existingOwner) clearTimeout(existingOwner.timer)
  let ownerTimer = setTimeout(() => {
    ownershipStore.delete(runId)
  }, STORE_TTL_MS)
  ownershipStore.set(runId, { userId: stream.userId, timer: ownerTimer })
}

export function getStream(runId: string): StoredStream | undefined {
  let existing = store.get(runId)
  if (!existing) return undefined
  clearTimeout(existing.timer)
  store.delete(runId)
  return existing.entry
}

export function verifyStreamOwner(runId: string, userId: string | number): boolean {
  let existing = ownershipStore.get(runId)
  if (!existing) return false
  return String(existing.userId) === String(userId)
}
