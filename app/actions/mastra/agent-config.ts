import { Agent, type AgentConfig, type ToolsInput } from '@mastra/core/agent'
import { askUserTool } from '@mastra/core/tools'
import type { AgentExecutionOptions } from '@mastra/core/agent'
import { Memory } from '@mastra/memory'
import { mastraStorage } from './storage.ts'
import { AGENT_FIRST_CHUNK_TIMEOUT_MS } from './shared-agent.ts'
import { OPENCODE_API_URL } from '../../utils/ai-provider.ts'
import {
  OPENCODE_MODEL_ID,
  OPENCODE_PROVIDER_ID,
  opencodeRequestHeaders,
  requireOpenCodeApiKey,
} from './model-config.ts'

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

export function createModel() {
  return {
    providerId: OPENCODE_PROVIDER_ID,
    modelId: OPENCODE_MODEL_ID,
    url: OPENCODE_API_URL,
    headers: opencodeRequestHeaders(),
    get apiKey(): string {
      return requireOpenCodeApiKey()
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

function withUserTools<T extends ToolsInput>(tools: T) {
  return { ...tools, askUserTool }
}

/**
 * The per-agent content of an app agent. Everything that differs between
 * `supportAgent` and `customerAgent` lives here; everything they share (model,
 * model settings, memory defaults, `ask_user`) is filled in by
 * {@link defineAppAgent} so the definitions stay pure content.
 */
interface AppAgentDefinition<TTools extends ToolsInput> {
  id: string
  name: string
  instructions: string
  tools: TTools
  /** Defaults to working memory; pass {@link createMemory} for other options. */
  memory?: Memory | undefined
  inputProcessors?: AgentConfig['inputProcessors']
  outputProcessors?: AgentConfig['outputProcessors']
  errorProcessors?: AgentConfig['errorProcessors']
  /**
   * Agent-level cap on error-processor retries. Defaults to 2. Each retry is a
   * full model call, so this is set explicitly rather than left to Mastra's
   * implicit backstop (3), which logs a warning on every run when unset.
   */
  maxProcessorRetries?: number | undefined
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
    // Each error-processor retry re-runs the model call. Bound it explicitly so
    // a retrying processor cannot silently cost up to four calls per turn; the
    // framework's own backstop is 3 and warns when this is unset.
    maxProcessorRetries: definition.maxProcessorRetries ?? 2,
    tools: withUserTools(definition.tools),
    memory: definition.memory ?? createMemory(),
    ...(definition.inputProcessors !== undefined
      ? { inputProcessors: definition.inputProcessors }
      : {}),
    ...(definition.outputProcessors !== undefined
      ? { outputProcessors: definition.outputProcessors }
      : {}),
    ...(definition.errorProcessors !== undefined
      ? { errorProcessors: definition.errorProcessors }
      : {}),
    ...(definition.scorers !== undefined ? { scorers: definition.scorers } : {}),
  })
}
