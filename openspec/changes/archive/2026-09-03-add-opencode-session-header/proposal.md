## Why

OpenCode Go — the managed-inference API this app's Mastra agents call at `https://opencode.ai/zen/go/v1` (`providerId: 'opencode-go'`) — will reject requests missing the `x-opencode-session` header starting 2026-09-05/06 (per [vercel/ai#20271](https://github.com/vercel/ai/issues/20271) and the account notice). The shared model config in `app/actions/mastra/agent-config.ts` sends no such header, so the support, customer, and workflow agents will error on every inference call after the deadline. The header is also a cost lever: Zen prices cached reads at ~3% of input tokens for DeepSeek V4 Flash, and session-aware routing/caching is exactly what the header enables.

## What Changes

- Add an `x-opencode-session` header to the shared Mastra model config produced by `createModel()` in `app/actions/mastra/agent-config.ts`, so every agent inference request carries a stable session id.
- Choose the session-id granularity (per-conversation thread id vs. static per-deployment id) and implement the corresponding Mastra mechanism — `OpenAICompatibleConfig.headers` (static) or the `ModelWithRetries`/`DynamicArgument` + `requestContext` form (per-thread). Details land in `design.md`.
- If per-thread is chosen: plumb the active `threadId` through `requestContext` at the `agent.stream()`/`agent.generate()` call sites (`app/actions/support-agent/controller.tsx`, `app/actions/chat/controller.tsx`, `app/actions/agent-events/controller.tsx`).
- Document the `headers` field of the inline Mastra model config in the learned `mastra-agent` skill, which currently lists only `providerId`/`modelId`/`url`/`apiKey`.
- Out-of-repo ops note (no code): update Hermes on the VPS to the latest release, which ships the header fix (NousResearch/hermes-agent#101864).

No behavior change for users: this restores the agent behavior that the provider's header enforcement would otherwise break.

## Capabilities

### New Capabilities

None — this is a transport/infra fix with no new user-visible capability.

### Modified Capabilities

None — the agent chat/workflow specs (`customer-chat`, `support-agent-*`, `workflow-agent-*`) describe user-visible behavior, not outbound provider transport details, so no requirement changes.

This change sets `skip_specs: true` in `.openspec.yaml` because it is pure plumbing: the agent behavior contract is unchanged, only the outbound HTTP headers used to reach the LLM provider.

## Impact

- **Code:** `app/actions/mastra/agent-config.ts` (`createModel()`); possibly the three agent call sites if per-thread headers are chosen; `.env.example` if a deployment-level session id env var is introduced.
- **Runtime:** all Mastra agent inference requests to `opencode.ai/zen/go/v1` carry `x-opencode-session`; without it they would error after 2026-09-05/06.
- **Docs/skills:** learned `mastra-agent` skill updated to document the `headers` inline-config field.
- **Ops (out of repo):** Hermes VPS gateway must be updated to the latest release for its own requests to the same API.