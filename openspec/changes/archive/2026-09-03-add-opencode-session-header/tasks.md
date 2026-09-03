## 1. Model config header

- [x] 1.1 Add a session-id resolver in `app/utils/ai-provider.ts` (or `app/actions/mastra/agent-config.ts`) that returns `process.env.OPENCODE_SESSION_ID`, falling back to a UUID persisted to a stable project file across restarts (in-memory random with a warning if the write fails). Verify: `npm run typecheck` passes and the resolver returns the same value across two invocations within one process.
- [x] 1.2 Add `headers: { 'x-opencode-session': <resolved id> }` to the inline config returned by `createModel()` in `app/actions/mastra/agent-config.ts`. Verify: `npm run typecheck` passes and `createModel()` returns an object whose `headers['x-opencode-session']` is a non-empty string.
- [x] 1.3 Add a commented `OPENCODE_SESSION_ID` entry to `.env.example` and set a real value in `.env`. Verify: the resolver reads the env value when present (no auto-generated file created).

## 2. Verification

- [x] 2.1 Smoke-test one agent chat turn (support or customer) and confirm the request to `opencode.ai/zen/go/v1` carries `x-opencode-session` and returns a normal stream (no 4xx). Verify: a chat turn completes with a streamed reply; optionally capture the outbound request headers via a temporary log or proxy to confirm the header value.
- [x] 2.2 Update the learned `mastra-agent` skill to document the `headers` field of the inline Mastra model config (currently lists only `providerId`/`modelId`/`url`/`apiKey`). Verify: the skill file lists `headers` with a one-line note that it is merged into outbound request headers.

## 3. Ops note (out of repo)

- [x] 3.1 Record in the change summary that Hermes on the VPS must be updated to the latest release (hermes-agent#101864) for its own requests to the same API; no code in this repo. Verify: the note is captured in the change's tasks/proposal for handoff.