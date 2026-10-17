# Running `runEvals` Gates Against App Agents

**Source:** `runEvals` gate harness (`app/actions/mastra/evals/`, `scripts/eval-mastra.ts`)

**Extracted:** 2026-10-02
**Context:** Adding a pass/fail eval gate (`runEvals` + `@mastra/evals/checks`) over the App Mastra agents, driven from a standalone script.

## Problem

`runEvals` reads like a pure scorer harness, but it drives a real agent run. Three
non-obvious constraints decide whether a gate can run at all — and a leaked
connection pool decides whether the runner script ever exits.

## Solution

### 1. The target must be a real `Agent` (or `Workflow`)

`runEvals({ target })` accepts only an `Agent` or `AnyWorkflow`. A plain function
or fake object throws at runtime:

```
Failed to run experiment: Error generating result from target
```

So gates cannot be unit-tested deterministically without a live model. The cheap
always-on CI substitute is a **gate-definition drift test**: assert every
`mustCall` name is a real tool key via `agent.listTools()`. It runs without a key
and catches the failure that would otherwise fail silently (a gate name that
scores 0 forever).

### 2. `requestContext` is per data item, not a top-level option

`targetOptions` omits `requestContext`, but each `RunEvalsDataItem` accepts its
own `requestContext?: RequestContext` (`@mastra/core/dist/evals/run/index.d.ts`).
Build one per journey (`createActorRequestContext(actorId)`) and actor-scoped
tools (`requireActorId(requestContext)`) run under `runEvals` — the harness
covers the customer agent, not just the support agent.

### 3. Gate names are runtime tool keys

`checks.calledTool(name)` matches the JavaScript property key on the agent's tools
object (`listRecentAppointments`), **not** the `createTool({ id })` value
(`list_recent_appointments`). A gate written with the id scores 0 forever.

```ts
const tools = await supportAgent.listTools()
const runtimeNames = new Set(Object.keys(tools)) // gate against these
```

Gate-only runs are supported — `scorers` is optional when `gates` is provided.
`result.verdict` is `'passed' | 'scored' | 'failed'` and is **omitted** when every
gate returned `notScorable()`; treat only an explicit `'failed'` as failure.

### 4. The runner script must exit explicitly

The app's Mastra storage is a `pg.Pool`, so a script that queries through it keeps
live sockets and **does not terminate** after logging success (verified: a pooled
`pg` query with no explicit exit hangs until an external timeout). End the runner
with `process.exit(0)`, or close the store's pool. A CI step that prints "all
gates passed" and then hangs reads as a timeout, not a pass.

## When to Use

- Adding `runEvals` gates over the app agents, or wiring them into CI
- Deciding which agent a journey can target (actor-scoped tools need a per-item requestContext)
- A gate never passes and the tool name looks right (check the runtime key)
- A Node script or test using the app's Postgres-backed Mastra storage hangs after
  printing its result
