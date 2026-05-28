import type { Database } from 'remix/data-table'
import type { User } from '../data/schema.ts'
import type { userLogger } from '../utils/logger.ts'
import type { Tool } from 'ai'

export interface WorkflowStep {
  id: string
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  input?: unknown
  output?: unknown
  error?: string
  startedAt?: number
  completedAt?: number
}

export interface WorkflowContext {
  db: Database
  tools: Record<string, Tool>
  llm: (prompt: string) => Promise<string>
  user: User | null
  logger: ReturnType<typeof userLogger>
}

export type Workflow = (
  context: WorkflowContext,
  params: Record<string, unknown>
) => AsyncGenerator<WorkflowStep, unknown, unknown>

export interface WorkflowParameter {
  name: string
  type: 'string' | 'number' | 'boolean'
  required: boolean
  description: string
}

export interface ToolCall {
  toolName: string
  input: Record<string, unknown>
  output?: unknown
  error?: string
  elapsed?: number
}

export interface WorkflowResult {
  continueWith?: string
  continueParams?: Record<string, unknown>
  toolCalls?: ToolCall[]
}

export interface WorkflowDefinition {
  id: string
  name: string
  description: string
  parameters?: WorkflowParameter[]
  tools?: string[]
  run: Workflow
}
