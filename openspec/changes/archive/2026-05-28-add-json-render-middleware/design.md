## Context

The app already uses `renderWith` from `remix/middleware/render` to provide a request-scoped `context.render(node, init?)` for HTML UI responses. This same `@remix-run/render-middleware` package is generic — it can store any renderer function type. The JSON renderer is the same pattern with a different return type (`Response.json()` instead of `createHtmlResponse()`).

Current JSON response patterns across controllers fall into two forms:

- `return Response.json(data, init)` — cleaner, but used inconsistently
- `return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' }, ... })` — verbose, repeated ~20+ times

Both require manual status codes and optional header overrides at each call site.

## Goals / Non-Goals

**Goals:**

- Provide a single `context.json(data, init?)` method on `AppContext` that returns `Response` with `Content-Type: application/json`
- Minimize new code — reuse the existing `renderWith` pattern
- Migrate all existing JSON responses in controllers to use `context.json(...)`
- Zero new runtime dependencies

**Non-Goals:**

- Auto-inferring status from payload shape (e.g., "if `error` is present, use 400") — that couples the renderer to a specific error shape and is better handled explicitly
- Changing the UI renderer or frame resolution logic
- Adding a generic serialization layer (Zod or similar) — existing validation patterns stay as-is
- Converting non-JSON responses (plain text, file streams, redirects)

## Decisions

### Decision 1: Use `renderWith` from `remix/middleware/render` (not a standalone middleware)

**Chosen**: `renderWith(() => (data, init?) => Response.json(data, init))`

**Alternatives considered**:

- A standalone middleware that sets `context.json` directly using `context.set(...)` — would duplicate the key/property wiring that `renderWith` already handles
- A plain wrapper function in a utility module — would require passing the full context or creating a new context key manually

**Rationale**: `renderWith` is the idiomatic Remix 3 way to add a renderer. It handles context key generation (`createContextKey`), property binding (`context.render`), and type inference through the middleware tuple. Reusing it costs ~15 lines and is consistent with the existing architecture.

### Decision 2: Use `unknown` as the input type (not a specific `JsonPayload` interface)

**Chosen**: `(data: unknown, init?: ResponseInit) => Response`

**Alternatives considered**:

- A typed `JsonPayload = Record<string, unknown>` — would require widening for array responses, and TypeScript already infers from the literal at each call site
- A discriminated union `{ ok: boolean; error?: string }` — too restrictive; controllers return varied shapes

**Rationale**: TypeScript infers the exact type from the object literal passed to `context.json({...})`. The `unknown` parameter is a formality — the actual type at each call site is what you pass. This keeps the middleware generic and reusable across all controllers.

### Decision 3: Explicit status over auto-mapping

**Chosen**: Status is always explicit: `context.json({ error: '...' }, { status: 400 })`

**Alternatives considered**:

- Auto-set status based on `error` / `ok` keys in payload — reduces boilerplate but couples the renderer to specific payload shapes
- Default to 200 with optional override — same as `Response.json()` behavior

**Rationale**: API responses already have explicit status codes. Making them implicit would hide intent. The `context.json()` call is already shorter than the current alternatives — saving one more argument isn't worth the ambiguity.

## Risks / Trade-offs

- **[Risk] Multiple renderers on context**: The UI `render()` and JSON `json()` both add properties to context. They use different context keys under the hood (`Renderer` vs. a new key from `renderWith`), so no collision. Verified by existing pattern — the same `renderWith` is used in tests with multiple renderers.
  → **Mitigation**: Order doesn't matter, but convention is UI first, JSON second.

- **[Risk] Accidental mixed usage**: A developer might call `context.render(data)` with JSON data or `context.json(<Node>)` with JSX. TypeScript will catch this at compile time because the parameter types differ (JSX vs plain objects).
  → **Mitigation**: No runtime guard needed — the type system enforces correctness.

- **[Risk] Migration errors**: 30+ replacements across 10 files. A manual pass could miss or incorrectly convert a response.
  → **Mitigation**: Each controller has a distinct pattern — `JSON.stringify` or `Response.json`. The migration is mechanical and can be validated by typecheck (`tsc --noEmit`) and a grep for remaining `JSON.stringify` usage in response bodies.

- **[Risk] `Response.json` with non-JSON-serializable data**: `Response.json()` calls `JSON.stringify` internally and throws on circular references or `undefined` values. This is identical behavior to the current manual `JSON.stringify()` calls, so no regression.
  → **Mitigation**: No change in serialization behavior.
