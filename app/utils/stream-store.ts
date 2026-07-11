import type { ReadableStream as NodeReadableStream } from 'node:stream/web'

export interface StoredStream {
  runId: string
  textStream: NodeReadableStream<string>
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

let store = new Map<string, { entry: StoredStream; timer: ReturnType<typeof setTimeout> }>()

export function setStream(runId: string, stream: StoredStream) {
  let existing = store.get(runId)
  if (existing) clearTimeout(existing.timer)
  let timer = setTimeout(() => {
    store.delete(runId)
  }, STORE_TTL_MS)
  store.set(runId, { entry: stream, timer })
}

export function getStream(runId: string): StoredStream | undefined {
  let existing = store.get(runId)
  if (!existing) return undefined
  clearTimeout(existing.timer)
  store.delete(runId)
  return existing.entry
}
