## Context

The `/testagent` route is currently gated at the router level by `NODE_ENV !== 'production'`. It has no auth middleware, CSRF is skipped, and there is no nav entry in the admin sidebar. The `listTestFiles` tool returns raw file metadata (numeric bytes, Unix ms timestamps) with no visual distinction between files and directories.

## Goals / Non-Goals

**Goals:**
- Availability of `/testagent` in all environments behind auth
- "Test-Agent" nav item in admin sidebar under "Daten" group
- Agent directory listing output shows directories with distinct formatting, sizes in human-readable units, and visual grouping

**Non-Goals:**
- No changes to the streaming SSE protocol or approval flow
- No changes to `readTestFile` behavior
- No changes to production agents (supportAgent, customerAgent)
- No database schema changes

## Decisions

### Decision: Wrap testAgent in requireAuth instead of NODE_ENV gate

The router already has a pattern for auth-gated routes (admin subtree). Remove the `if (process.env.NODE_ENV !== 'production')` guard and instead wrap `router.map(routes.testAgent, testAgent)` with the existing `requireAuth()` middleware. This pattern is already established — admin routes are wrapped in middleware stacks that include auth. Since the test agent controller is a standalone `createController`, we can apply `requireAuth` as a middleware wrapper at the router level, similar to how admin routes are composed.

Alternative considered: Adding `requireAuth` inside the controller's `use` or `middleware` option. Rejected because the router-level wrapping is the established pattern (see admin barrel in router.ts), and it keeps the controller pure.

### Decision: Keep CSRF skip for testagent paths

The `/testagent` routes use JSON API-style POST responses (not form redirects with session flash). The existing CSRF skip in `skip-csrf.ts` already exempts `/testagent` and `/testagent/*`. This skip is appropriate — the test agent is now auth-gated, and the SSE streaming + approval flow relies on fetch-based POSTs. Adding CSRF tokens would add complexity to the clientEntry script.

### Decision: Enrich listTestFiles output with formatted display data

Instead of returning raw bytes and plain names, add a `display` field to each file entry with:
- `formattedSize`: human-readable size (e.g., "2.3 MB", "1.2 KB")
- `type`: "directory" | "file" for agent prompt context
- `icon`: Unicode icon (📁 for dirs, 📄 for files) so the LLM can render rich text

Alternative considered: Returning ANSI escape codes or Markdown formatting. Rejected because it would couple the tool to a specific output rendering format. Instead, provide structured display hints and let the agent format the response naturally.

## Risks / Trade-offs

- **Auth on SSE**: The SSE endpoint (`/testagent/stream/:runId`) will inherit the auth middleware, meaning unauthenticated SSE connections are rejected. This is correct — the stream is only meaningful in the context of a session that initiated the agent call.
- **CSRF skip with auth**: Skipping CSRF is acceptable because auth now gates access. The test agent only uses fetch-based POSTs, which require an authenticated session cookie.
- **Tool output growth**: Adding `display` fields increases the token cost of each `listTestFiles` response. Mitigation: keep display fields concise (no long paths, no repeated prefixes).
