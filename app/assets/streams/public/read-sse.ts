/**
 * Minimal browser-side SSE frame parser for `fetch` streaming responses.
 *
 * The request/response body is a `text/event-stream` (see app/utils/agent-sse.ts):
 * frames are `event: <type>\ndata: <json>\n\n`. This reads the stream and calls
 * `onEvent(type, data)` for each dispatched frame, closing when the body ends.
 */

export type SseEventHandler = (type: string, data: unknown) => void | boolean

export type ReadEventStreamOptions = {
  /**
   * Stop reading when this signal aborts. The response body is cancelled so the
   * server sees the disconnect, and the call resolves with `true`.
   */
  signal?: AbortSignal | undefined
}

function parseSseFrame(frame: string): { event: string; data: unknown } | null {
  let event = 'message'
  let dataLines: string[] = []

  for (let line of frame.split('\n')) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim()
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim())
    }
  }

  if (dataLines.length === 0) return null
  let raw = dataLines.join('\n')
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    data = raw
  }
  return { event, data }
}

/**
 * Reads an SSE response until the body ends, the signal aborts, or a handler
 * returns `false`.
 *
 * Returns `true` when reading stopped early (abort or handler request) and
 * `false` when the stream was exhausted. Callers that keep stream-level state
 * (for example a suspended-run gate) use this to skip their "settled" cleanup.
 */
export async function readEventStream(
  res: Response,
  onEvent: SseEventHandler,
  options?: ReadEventStreamOptions,
): Promise<boolean> {
  if (!res.body) throw new Error('No response body')
  let reader = res.body.getReader()
  let decoder = new TextDecoder()
  let buffer = ''
  let stopped = false

  try {
    let done = false
    while (!done && !stopped) {
      if (options?.signal?.aborted) {
        stopped = true
        await reader.cancel().catch(() => {})
        break
      }

      let read = await reader.read()
      done = read.done
      buffer += decoder.decode(read.value ?? new Uint8Array(), { stream: !done })

      let idx: number
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        let frame = buffer.slice(0, idx)
        buffer = buffer.slice(idx + 2)
        if (!frame.trim()) continue
        let parsed = parseSseFrame(frame)
        if (parsed && onEvent(parsed.event, parsed.data) === false) {
          stopped = true
          await reader.cancel().catch(() => {})
          break
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  return stopped
}
