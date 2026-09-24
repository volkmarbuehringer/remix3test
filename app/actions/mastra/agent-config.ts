import { Agent, type AgentConfig, type ToolsInput } from '@mastra/core/agent'
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

export function withUserTools<T extends ToolsInput>(tools: T) {
  return { ...tools, askUserTool }
}

/**
 * The per-agent content of an app agent. Everything that differs between
 * `supportAgent` and `customerAgent` lives here; everything they share (model,
 * model settings, memory defaults, `ask_user`) is filled in by
 * {@link defineAppAgent} so the definitions stay pure content.
 */
export interface AppAgentDefinition<TTools extends ToolsInput> {
  id: string
  name: string
  instructions: string
  tools: TTools
  /** Defaults to working memory; pass {@link createMemory} for other options. */
  memory?: Memory | undefined
  inputProcessors?: AgentConfig['inputProcessors']
  scorers?: AgentConfig['scorers']
}

/**
 * Builds an app agent with the shared scaffolding applied.
 *
 * This is the single choke point for the model, the model settings and the
 * `ask_user` tool every conversational agent gets, so the agent files only
 * declare what is unique to them.
 */
export function defineAppAgent<TTools extends ToolsInput>(definition: AppAgentDefinition<TTools>) {
  return new Agent({
    id: definition.id,
    name: definition.name,
    instructions: definition.instructions,
    model: createModel(),
    defaultOptions: { modelSettings: agentModelSettings },
    tools: withUserTools(definition.tools),
    memory: definition.memory ?? createMemory(),
    ...(definition.inputProcessors !== undefined
      ? { inputProcessors: definition.inputProcessors }
      : {}),
    ...(definition.scorers !== undefined ? { scorers: definition.scorers } : {}),
  })
}
