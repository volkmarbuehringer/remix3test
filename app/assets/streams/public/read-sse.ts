/**
 * Minimal browser-side SSE frame parser for `fetch` streaming responses.
 *
 * The request/response body is a `text/event-stream` (see app/utils/agent-sse.ts):
 * frames are `event: <type>\ndata: <json>\n\n`. This reads the stream and calls
 * `onEvent(type, data)` for each dispatched frame, closing when the body ends.
 */
export function parseSseFrame(frame: string): { event: string; data: unknown } | null {
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

export async function readEventStream(
  res: Response,
  onEvent: (type: string, data: unknown) => void,
): Promise<void> {
  if (!res.body) throw new Error('No response body')
  let reader = res.body.getReader()
  let decoder = new TextDecoder()
  let buffer = ''

  try {
    let done = false
    while (!done) {
      let read = await reader.read()
      done = read.done
      buffer += decoder.decode(read.value ?? new Uint8Array(), { stream: !done })

      let idx: number
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        let frame = buffer.slice(0, idx)
        buffer = buffer.slice(idx + 2)
        if (!frame.trim()) continue
        let parsed = parseSseFrame(frame)
        if (parsed) onEvent(parsed.event, parsed.data)
      }
    }
  } finally {
    reader.releaseLock()
  }
}
