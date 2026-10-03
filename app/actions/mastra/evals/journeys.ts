/**
 * Behavior contracts for the app agents, expressed as tool-call gates.
 *
 * `mustCall` / `mustNotCall` use the tool's **runtime name** — the JavaScript
 * property key on the agent's tools object (e.g. `listRecentAppointments`), not
 * the `createTool({ id })` value (`list_recent_appointments`).
 * `checks.calledTool()` matches the runtime name, and `gates.test.ts` locks
 * every gate to a key the agent actually exposes.
 *
 * Customer journeys set `actorId`, which `gates.ts` turns into the same
 * `RequestContext` the route passes to `agent.stream()`. `runEvals` forwards a
 * per-data-item `requestContext` to the target, so the customer tools that call
 * `requireActorId(requestContext)` run under evaluation too.
 */
export interface EvalJourney {
  id: string
  agent: 'supportAgent' | 'customerAgent'
  input: string
  /** Runtime tool names the agent must call. */
  mustCall: string[]
  /** Runtime tool names the agent must NOT call. */
  mustNotCall?: string[]
  /** Authenticated actor for agents whose tools read the request context. */
  actorId?: number
}

export const EVAL_JOURNEYS: EvalJourney[] = [
  {
    id: 'support-recent-appointments',
    agent: 'supportAgent',
    input: 'Zeig mir die letzten Termine.',
    mustCall: ['listRecentAppointments'],
  },
  {
    id: 'support-user-lookup',
    agent: 'supportAgent',
    input: 'Finde den Benutzer admin@newapp.com.',
    mustCall: ['lookupUser'],
  },
  {
    id: 'support-weather',
    agent: 'supportAgent',
    input: 'Wie ist das Wetter in Ransbach-Baumbach?',
    mustCall: ['getWeather'],
  },
  {
    id: 'support-count-users',
    agent: 'supportAgent',
    input: 'Wie viele Benutzer gibt es insgesamt?',
    mustCall: ['countUsers'],
  },
  {
    id: 'support-holiday',
    agent: 'supportAgent',
    input: 'Ist der 3. Oktober 2026 ein Feiertag?',
    mustCall: ['lookupHoliday'],
  },
  {
    id: 'customer-list-appointments',
    agent: 'customerAgent',
    input: 'Was habe ich für Termine?',
    mustCall: ['listMyAppointments'],
    actorId: 1,
  },
  {
    id: 'customer-search-resources',
    agent: 'customerAgent',
    input: 'Ich suche eine Massage.',
    mustCall: ['searchResourcesByCapability'],
    actorId: 1,
  },
]
