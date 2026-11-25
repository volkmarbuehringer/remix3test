import type { Middleware, RequestContext } from 'remix/router'

import { envPositiveNumberOrUndefined } from '../config.ts'

// ---------------------------------------------------------------------------
// requestTimeout — an opt-in deadline for non-streaming requests
//
// Since remix #12446 `fetch-router` treats `request.signal` cooperatively: it
// stops starting middleware/handlers after an abort but waits for work already
// in progress. A deadline therefore has to live in middleware (the upstream
// decision note, decisions/011-cooperative-request-aborts.md, recommends
// exactly that):
//
//   1. replace `context.request` with a Request whose signal combines the
//      incoming request signal with a timeout controller, so downstream
//      handlers/fetches can stop when the deadline passes;
//   2. race `next()` against the deadline and answer `504` when it wins;
//   3. cancel the body of a response that arrives after the deadline, which
//      `fetch-router` would otherwise only do for its own abandoned responses.
//
// Off unless `REQUEST_TIMEOUT_MS` is a positive number. Server-sent event
// streams are skipped: their response body is intentionally long-lived and a
// deadline would abort the stream after the headers have already been sent.
// ---------------------------------------------------------------------------

const STREAMING_REQUEST_HEADERS = ['text/event-stream'] as const

function isStreamingRequest(context: RequestContext): boolean {
  let accept = context.request.headers.get('Accept')?.toLowerCase() ?? ''
  if (STREAMING_REQUEST_HEADERS.some((type) => accept.includes(type))) return true
  // fetch()-based SSE callers (app/assets/streams/public/sse-post.ts) mark the
  // request instead of sending an event-stream Accept header.
  return context.request.headers.get('X-Sse-Request') === '1'
}

function timeoutResponse(): Response {
  return new Response('Request timed out.', {
    status: 504,
    statusText: 'Gateway Timeout',
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

export function requestTimeout(options?: { timeoutMs?: number | undefined }): Middleware {
  return async (context, next) => {
    let timeoutMs = options?.timeoutMs ?? envPositiveNumberOrUndefined('REQUEST_TIMEOUT_MS')
    if (timeoutMs === undefined || isStreamingRequest(context)) {
      return next()
    }

    let timeoutError = new DOMException('Request timed out.', 'TimeoutError')
    let controller = new AbortController()
    let timer = setTimeout(() => controller.abort(timeoutError), timeoutMs)
    let deadline = controller.signal
    let signal = AbortSignal.any([context.request.signal, deadline])
    context.request = new Request(context.request, { signal })

    let nextPromise = next()
    let timedOut = new Promise<null>((resolve) => {
      deadline.addEventListener('abort', () => resolve(null), { once: true })
    })

    try {
      let result = await Promise.race([nextPromise.then((response) => ({ response })), timedOut])
      if (result !== null) {
        return result.response
      }

      // The deadline won the race. Cancel a late body so the abandoned response
      // is not left streaming (the #12190 behavior, applied to this race).
      nextPromise.then(
        (response) => response.body?.cancel(timeoutError).catch(() => {}),
        () => {},
      )

      return timeoutResponse()
    } finally {
      // The deadline signal must stay aborted when it fired (downstream reads
      // it), but an early response no longer needs the timer.
      clearTimeout(timer)
    }
  }
}
