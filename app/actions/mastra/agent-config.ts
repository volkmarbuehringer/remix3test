import { askUserTool } from '@mastra/core/tools'
import type { AgentExecutionOptions } from '@mastra/core/agent'
import { Memory } from '@mastra/memory'
import { mastraStorage } from './storage.ts'
import { AGENT_FIRST_CHUNK_TIMEOUT_MS } from './shared-agent.ts'
import { OPENCODE_API_URL, getOpenCodeSessionId } from '../../utils/ai-provider.ts'

// ── Shared agent scaffolding ───────────────────────────────────────

/**
 * `modelSettings` shared by every app agent. Installed through `defaultOptions`
 * so it is deep-merged into each `stream()`, `resumeStream()` and `generate()`
 * call; call-site options still take precedence.
 *
 * The `satisfies` is load-bearing: `modelSettings` is assigned as a variable
 * rather than an object literal, so without it a misspelled budget key would
 * type-check and then silently do nothing at runtime.
 */
export const agentModelSettings = {
  timeout: { firstChunkMs: AGENT_FIRST_CHUNK_TIMEOUT_MS },
} satisfies NonNullable<AgentExecutionOptions['modelSettings']>

function requireApiKey(): string {
  let key = process.env.OPENCODE_API_KEY
  if (!key) {
    throw new Error(
      'OPENCODE_API_KEY environment variable is required. Set it before starting the server.',
    )
  }
  return key
}

export function createModel() {
  return {
    providerId: 'opencode-go',
    // DeepSeek V4.1 Flash. OpenCode Go also still serves `deepseek-v4-flash`
    // as a separate model id with separate monthly usage limits, so this id is
    // what selects the quota, not a cosmetic rename.
    modelId: 'deepseek-v4.1-flash',
    url: OPENCODE_API_URL,
    headers: {
      'X-Opencode-Session': getOpenCodeSessionId(),
    },
    get apiKey(): string {
      return requireApiKey()
    },
  }
}

export function createMemory(options?: {
  workingMemory?: { enabled: boolean }
  lastMessages?: number
}) {
  return new Memory({
    storage: mastraStorage,
    options: options ?? { workingMemory: { enabled: true } },
  })
}

export function withUserTools<T extends Record<string, unknown>>(tools: T) {
  return { ...tools, askUserTool }
}
