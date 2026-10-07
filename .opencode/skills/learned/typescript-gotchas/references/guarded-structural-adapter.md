# Guarded Structural Adapter for Vendor Types

**Source:** `guarded-structural-adapter`
**Extracted:** 2026-10-07
**Context:** Bridging a vendor class to a minimal app-owned interface in `app/utils/mastra-memory.ts` and `app/utils/agent-chat-durable.ts`. Callers repeated `as unknown as AgentHandle` in 8 places because `Agent`/`DurableAgent` are not structurally assignable to the app's minimal interface.

## Problem

A minimal structural interface (`{ getMemory(): Promise<unknown> }`) documents the methods the app actually calls, but the vendor class does not satisfy it: function parameters are checked **contravariantly**, so a class method with narrower option params is not assignable to the interface's wider method, and TS refuses. The workaround becomes `value as unknown as Interface` repeated at every call site, which:

- silently succeeds even when the value is `undefined` or lacks the method,
- buries the one real boundary among many lookalike casts,
- makes the interface hard to change (every call site must be found first).

## Solution

Export **one** adapter whose parameter is `unknown`, runtime-checks the members the app calls, and returns the interface:

```ts
export function toAgentHandle(agent: unknown): AgentHandle {
  if (
    typeof agent === 'object' &&
    agent !== null &&
    typeof (agent as { getMemory?: unknown }).getMemory === 'function'
  ) {
    return agent as AgentHandle
  }
  throw new Error('Agent does not expose getMemory(); cannot read chat memory.')
}
```

Callers become `toAgentHandle(resolveAgent())` — no double cast, and a bad value fails loudly at the boundary instead of as `undefined is not a function` deeper in.

- Check the methods the consumer actually calls, not the whole vendor surface; one `typeof x.fn === 'function'` per method is enough.
- Keep the single `as Interface` inside the adapter, after the guard; that is the one deliberate cast.
- Name the adapter after the interface (`toAgentHandle`, `toDurableChatAgent`) and colocate it with the interface.
- For a value that may legitimately be absent, prefer a resolver that returns the interface or throws a named error over a nullable return.

## When to Use

- The same `x as unknown as VendorInterface` appears at 3+ call sites.
- Casting a vendor class/SDK value into a minimal app-owned structural interface.
- A type error says the vendor type is not assignable to your interface even though the members look present (suspect contravariant method params).
- A test double and the real vendor value both flow through the same call path.
