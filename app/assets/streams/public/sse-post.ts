/**
 * Shared HTTP transport for the `fetch`-based SSE endpoints.
 *
 * Three browser entries (customer chat, support agent, agent events) reach
 * the same server protocol: POST with `X-Sse-Request: 1`, stream the
 * `text/event-stream` body through `readEventStream`, and turn a failed
 * response body into a human-readable message. This module owns that shape
 * so the entries cannot drift apart; the per-stream UI policy (error bubble,
 * retry row, status bar) stays with each entry.
 *
 * Re-exported so callers import one module.
 */
export { readEventStream } from './read-sse.ts'

/** Classifies a failed request as an intentional cancellation. */
export function isAbortError(err: unknown): boolean {
  return (err as Error | undefined)?.name === 'AbortError'
}

/**
 * Extracts a human-readable message from a failed SSE response body. The
 * server renders failures with the same `data: {"error": ...}` frame shape
 * as real streams, so look for it first; fall back to the status text. The
 * frame may be the body's last line, so the trailing newline is optional —
 * and a `data:` line that is not JSON must degrade to the status text, not
 * throw out of `fetchSseStream`'s documented `{ ok: false; message }` shape.
 */
function describeSseFailure(text: string, statusText: string): string {
  let match = text.match(/data: (.*)\n?/)
  if (!match) return statusText
  try {
    let parsed = JSON.parse(match[1]!) as { error?: string }
    return parsed.error ?? statusText
  } catch {
    return statusText
  }
}

export type SseInit = Omit<RequestInit, 'headers' | 'signal'> & {
  headers?: Record<string, string> | undefined
}

type SseStreamResult = { ok: true; res: Response } | { ok: false; message: string }

/** POSTs to an SSE endpoint and either the streaming response or a failure message. */
export async function fetchSseStream(
  url: string,
  init: SseInit,
  signal: AbortSignal,
): Promise<SseStreamResult> {
  let res = await fetch(url, {
    ...init,
    signal,
    headers: { 'X-Sse-Request': '1', ...(init.headers ?? {}) },
  })

  if (!res.ok) {
    let text = await res.text().catch(() => '')
    return { ok: false, message: describeSseFailure(text, res.statusText) }
  }

  return { ok: true, res }
}
