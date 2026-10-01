import { RequestContext } from '@mastra/core/request-context'

// ── Request-scoped actor identity ──────────────────────────────────
//
// Tools read the authenticated actor from the Mastra RequestContext passed into
// `agent.stream()` / `resumeStream()` / `approveToolCallGenerate()`, instead of
// a process-wide AsyncLocalStorage. A request context travels with the run
// itself, so it survives the workflow, background-task and subagent boundaries
// that AsyncLocalStorage does not cross.

/**
 * Minimal structural view of a request context, so `requireActorId` accepts any
 * `RequestContext<Values>` regardless of the caller's declared value map.
 */
interface RequestContextReader {
  getRaw(key: string): unknown
}

/**
 * Builds the per-request context that carries the authenticated actor.
 *
 * The value map is intentionally left undeclared: Mastra types a run's
 * `requestContext` as `RequestContext<any>`, and a narrower
 * `RequestContext<Values>` is not assignable to it. Reads go through
 * {@link requireActorId}, which validates the value at runtime.
 */
export function createActorRequestContext(actorId: number): RequestContext {
  let requestContext = new RequestContext()
  requestContext.set('actorId', actorId)
  return requestContext
}

/**
 * Reads the authenticated actor id from a tool's request context.
 *
 * Throws when a tool runs outside an authenticated agent run, matching the
 * previous `requireId()` guard so an unauthenticated call can never act.
 */
export function requireActorId(requestContext: RequestContextReader | undefined): number {
  let actorId = requestContext?.getRaw('actorId')
  if (typeof actorId !== 'number') {
    throw new Error('Not authenticated: missing actorId in request context')
  }
  return actorId
}
