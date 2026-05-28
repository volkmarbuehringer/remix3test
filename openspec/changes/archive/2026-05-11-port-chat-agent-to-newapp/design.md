## Context

newapp currently has basic CRUD routes (lists), auth flows, and a UI showcase. It needs AI-powered conversational capabilities — a simple chat route and a tool-calling agent route — that already exist in the sibling my_app project. Both apps share the same Remix 3 framework, the same `ai` SDK, and the same data-table + fetch-router infrastructure.

The challenge is adapting my_app's chat/agent implementation to newapp's conventions:
- newapp uses composite controllers (`app/actions/controller.tsx` pattern) rather than per-action subdirectories
- newapp has a custom theme via `app/theme.tsx` with its own surface/color tokens
- newapp's nav is declarative via `NAV_SECTIONS` in `app/ui/nav.ts`
- newapp's router uses `router.map(routes, controller)` for sub-routes
- newapp already has `ai`, `@ai-sdk/openai-compatible`, `@ai-sdk/devtools`, and `zod` in dependencies

## Goals / Non-Goals

**Goals:**
- Port the `/chat` route with LLM-powered conversational AI, message history, and conversation persistence
- Port the `/agent` route with tool-calling (weather, Wikipedia), tool call metadata display, and conversation persistence
- Add `chatlog` database table and seed it during app initialization
- Create shared utilities (AI provider, rate limiter, logger, error handling) used by both routes
- Create client-side UI components (form loading state, scroll-to-top) used by both route pages
- Adapt all pages to newapp's theme system and layout

**Non-Goals:**
- No changes to `package.json` (dependencies already present)
- No changes to auth, database, or middleware infrastructure
- No changes to existing routes or functionality
- No porting of admin/chatlog routes, workflow routes, or other my_app features
- No porting of e2e tests (those are my_app-specific)
- No addition of new npm dependencies
- No refactoring of existing newapp code outside the scope of integrating chat/agent

## Decisions

### 1. Composite Controller Pattern (newapp style)

**Decision**: Create `app/actions/chat-controller.tsx` and `app/actions/agent-controller.tsx` as standalone composite controllers, following newapp's existing `auth-login-controller.tsx` and `auth-register-controller.tsx` pattern.

**Rationale**: my_app uses subdirectory controllers (`actions/chat/controller.tsx`). newapp uses flat composite controllers. Following the host project's convention is more maintainable.

### 2. Theme Adaptation

**Decision**: Replace all `theme` references from my_app's theme tokens with newapp's `Theme` object. Use newapp's `Document`, `Layout`, spacing/radius/color tokens directly.

**Rationale**: The UI must look consistent with the rest of newapp. Both use the `remix/ui` CSS-in-JS system, so the port is straightforward — only token keys differ.

### 3. Chatlog Library Location

**Decision**: Create `app/lib/chatlog.ts` for the conversation persistence layer (matching my_app's structure). newapp doesn't have a `lib/` directory yet, but this is a clear boundary for a reusable data-access module.

**Rationale**: Chatlog operations are shared between chat and agent controllers. Placing them in a focused module avoids duplication. The AGENTS.md says to avoid "generic dumping-ground directories like app/lib/" but a specific module with a single responsibility is appropriate.

### 4. Asset Server for Client Entry Files

**Decision**: The `FormLoadingState` and `ScrollToTop` components use `clientEntry()`, which requires the asset server to serve `app/ui/*` files. newapp's asset server already allows `app/ui/**` — verified.

**Rationale**: No changes needed to `assets.ts`. The existing config already covers these paths.

### 5. Toast Redirect for Error Handling (Agent route)

**Decision**: Port `toastRedirect` from my_app's `error-handling.ts` since the agent controller uses it for error display. This requires the session middleware (already installed in newapp's router).

**Rationale**: The agent route redirects to the agent page with a flash message on error. This is cleaner than the chat route's URL-param-based error approach. Porting the small utility is better than rewriting the error handling flow.

### 6. Rate Limiter Scope

**Decision**: Port a simplified version of the rate limiter. Use global rate limiting only (not per-user) for simplicity, matching the chat controller's current usage.

**Rationale**: newapp doesn't have a rate limiter yet. Porting the full per-user version adds complexity without current need. The implementation supports both modes, so per-user can be added later.

## Risks / Trade-offs

- **[Risk] LLM API key missing**: The AI provider requires `OPENCODE_API_KEY`. If unset, chat/agent will error at runtime. → Mitigation: Clear error message directs users to set the env var.
- **[Risk] Rate limiter in-memory state**: The global rate limiter is in-memory and resets on server restart. → Acceptable for development; a Redis-backed version can be added later.
- **[Risk] Chatlog table doesn't exist yet**: If the DB isn't initialized, chat/agent will fail. → Mitigation: `initializeAppDatabase()` is called at server startup and creates tables if needed.
- **[Trade-off] No streaming responses**: Both routes use `generateText` and `ToolLoopAgent` which return complete responses. Adding SSE streaming would be a future enhancement.
- **[Trade-off] No e2e tests ported**: my_app has e2e tests for chat and agent. Porting tests adds scope. They should be added in a follow-up change.
