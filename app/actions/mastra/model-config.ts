import { getOpenCodeSessionId } from '../../utils/ai-provider.ts'
import { requireEnv } from '../../config.ts'

// ── Shared OpenCode Go provider config ─────────────────────────────
//
// Deliberately free of storage/env side effects so both the conversation
// agents (`agent-config.ts`) and the headless evaluation model
// (`evaluation-model.ts`) share one model id and one credential path.

export const OPENCODE_PROVIDER_ID = 'opencode-go'

/**
 * DeepSeek V4.1 Flash. OpenCode Go also serves `deepseek-v4-flash` as a
 * separate id with separate monthly usage limits, so this id selects the
 * quota, not a cosmetic rename.
 */
export const OPENCODE_MODEL_ID = 'deepseek-v4.1-flash'

/**
 * Resolved lazily: a missing key must fail the AI route, not module load.
 * `defineAppAgent` builds every agent at import time, so reading the key here
 * would take the whole app down when the variable is unset.
 */
export function requireOpenCodeApiKey(): string {
  return requireEnv(
    'OPENCODE_API_KEY',
    'OPENCODE_API_KEY environment variable is required. Set it before starting the server.',
  )
}

/** Per-request provider headers, including the OpenCode session id. */
export function opencodeRequestHeaders(): Record<string, string> {
  return { 'X-Opencode-Session': getOpenCodeSessionId() }
}
