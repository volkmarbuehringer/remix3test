---
title: Workflow Tools and Chaining
description: Implementing AI-powered workflows with tool definitions and multi-step chaining.
priority: high
version: 1.0
updated: 2026-04-24
---

# Guide: Workflow Tools and Chaining

**Core Idea**: Implement AI-driven workflows that call tools (like weather APIs, databases) and chain multiple workflow steps together. Uses parent_run_id and chain_depth for tracking.

## Why This Pattern

- **Autonomous execution**: AI decides which tools to call
- **Multi-step workflows**: Chain workflows that pass results to the next step
- **Audit trail**: Each step is tracked in the database
- **Type safety**: Full TypeScript types from AI SDK

## Key Components

| Component | File | Purpose |
|------------|------|---------|
| Tool definitions | `bookstore/app/workflows/tools.ts` | Tool implementations (weather, wiki, etc.) |
| Types | `bookstore/app/workflows/types.ts` | Workflow, WorkflowResult, ToolCall types |
| Registry | `bookstore/app/workflows/registry.ts` | Workflow registration and tool filtering |
| Engine | `bookstore/app/workflows/engine.ts` | Execution and chaining logic |
| Definitions | `bookstore/app/workflows/definitions/*.ts` | Workflow implementations |

## Database Schema

```ts
// bookstore/app/data/schema.ts
workflow_runs: {
  id: c.text().primaryKey(),
  workflow_id: c.text(),
  status: c.text(), // 'pending' | 'running' | 'completed' | 'failed'
  params: c.text(), // JSON
  steps: c.text(), // JSON array
  result: c.text().optional(),
  error: c.text().optional(),
  parent_run_id: c.text().optional(),  // ← links to parent run
  chain_depth: c.integer().default(0), // ← tracks chain depth
  created_at: c.integer(),
  completed_at: c.integer().optional(),
  created_by: c.integer().optional(),
}
```

## Tool Definitions

```ts
// bookstore/app/workflows/tools.ts
import { tool } from 'ai'
import { z } from 'zod'

export const baseTools = {
  get_weather: tool({
    description: 'Get current weather for a location worldwide',
    inputSchema: z.object({
      location: z.string().min(1).max(30),
    }),
    execute: async ({ location }, { abortSignal }) => {
      // Fetch from Open-Meteo API
      return { temperature: 72, condition: 'Sunny', windSpeed: 10 }
    },
  }),

  search_wikipedia: tool({
    description: 'Search Wikipedia for information',
    inputSchema: z.object({
      query: z.string().min(1).max(150),
    }),
    execute: async ({ query }) => {
      // Fetch from Wikipedia API
      return { query, results: [] }
    },
  }),
}

export const workflowTools = {
  runQuery: tool({
    description: 'Execute a database query',
    inputSchema: z.object({ table: z.string(), limit: z.number().optional() }),
    execute: async ({ table }) => ({ table, rows: [] }),
  }),

  sendNotification: tool({
    description: 'Send a notification via webhook',
    inputSchema: z.object({ url: z.string().url(), subject: z.string(), body: z.string() }),
    execute: async ({ url, subject, body }) => ({ success: true }),
  }),
}

export const allTools = { ...baseTools, ...workflowTools }
```

## Workflow Types

```ts
// bookstore/app/workflows/types.ts
export interface WorkflowContext {
  db: Database
  tools: Record<string, Tool>
  llm: (prompt: string) => Promise<string>
  user: User | null
  logger: ReturnType<typeof userLogger>
}

export interface WorkflowResult {
  continueWith?: string  // next workflow to run
  continueParams?: Record<string, unknown>
  toolCalls?: ToolCall[]
}

export interface WorkflowDefinition {
  id: string
  name: string
  description: string
  parameters?: WorkflowParameter[]
  tools?: string[]  // tools this workflow can use
  run: Workflow
}

export type Workflow = (
  context: WorkflowContext,
  params: Record<string, unknown>
) => AsyncGenerator<WorkflowStep, unknown, unknown>
```

## Registry Pattern

```ts
// bookstore/app/workflows/registry.ts
import { baseTools, allTools } from './tools.ts'

export const workflowRegistry = new Map<string, WorkflowDefinition>()

export function getWorkflowTools(workflowId: string): Record<string, Tool> {
  let def = getWorkflow(workflowId)
  if (!def?.tools) return baseTools

  // Filter tools based on workflow definition
  let result: Record<string, Tool> = {}
  for (let name of def.tools) {
    if (name in allTools) result[name] = allTools[name]
  }
  return Object.keys(result).length > 0 ? result : baseTools
}
```

## Engine Execution

```ts
// bookstore/app/workflows/engine.ts
import { getWorkflow } from './registry.ts'
import { getWorkflowTools } from './registry.ts'

const MAX_CHAIN_DEPTH = 5

export async function executeWorkflow(
  runId: string,
  options: RunWorkflowOptions
): Promise<WorkflowRunResult> {
  let workflow = getWorkflow(options.workflowId)

  // Build context with filtered tools
  let context: WorkflowContext = {
    db: options.db,
    tools: getWorkflowTools(options.workflowId),
    llm: (prompt) => callLlm(prompt, logger),
    user: options.user,
    logger,
  }

  // Execute as async generator
  let generator = workflow.run(context, options.params)
  let steps: WorkflowStep[] = []

  while (true) {
    let next = await generator.next()
    if (next.done) {
      finalResult = next.value
      break
    }
    steps.push(next.value)
    await db.update(workflowRuns, runId, { steps: JSON.stringify(steps) })
  }

  return { runId, status: 'completed', result: finalResult }
}
```

## Chaining Logic

```ts
// bookstore/app/workflows/engine.ts
export async function executeWorkflowChain(
  runId: string,
  options: RunWorkflowOptions
): Promise<WorkflowChainResult[]> {
  let results: WorkflowChainResult[] = []
  let chainDepth = 0
  let currentParams = { ...options.params }
  let parentRunId = options.parentRunId
  let workflowId = options.workflowId

  while (chainDepth < MAX_CHAIN_DEPTH) {
    if (chainDepth > 0) {
      // Create new run linked to parent
      let newRunId = await createWorkflowRun(options.db, workflowId, currentParams, options.user?.id ?? null)
      await options.db.update(workflowRuns, newRunId, {
        parent_run_id: parentRunId,
        chain_depth: chainDepth,
      })
      currentRunId = newRunId
    }

    let result = await executeWorkflow(currentRunId, { ...options, workflowId, params: currentParams })
    results.push({ ...result, chainDepth })

    if (result.status === 'failed') break

    // Check for chaining
    let output = result.result as WorkflowResult
    let nextWorkflowId = output?.continueWith

    if (!nextWorkflowId) break

    // Merge params for next workflow
    if (output?.continueParams) {
      currentParams = { ...currentParams, ...output.continueParams }
    }

    parentRunId = currentRunId
    workflowId = nextWorkflowId
    chainDepth++
  }

  return results
}
```

## Workflow Definition Example

```ts
// bookstore/app/workflows/definitions/restock-analysis.ts
import { registerWorkflow } from '../registry.ts'
import type { Workflow } from '../types.ts'

const restockAnalysisWorkflow: Workflow = async function* (context, params) {
  let { tools, logger, llm } = context

  // Step 1: Get weather
  yield { id: 'weather', name: 'Getting weather', status: 'running' }

  let weatherTool = tools['get_weather']
  let weatherResult = await weatherTool.execute({ location: 'Pirmasens, Germany' }, { toolCallId: 'test', messages: [] })

  yield { id: 'weather', name: 'Getting weather', status: 'completed', output: weatherResult }

  // Step 2: Call LLM for analysis
  let windSpeed = (weatherResult as { windSpeed: number }).windSpeed

  if (windSpeed > 2) {
    // Continue with restock check
    return {
      outOfStockCount: 3,
      continueWith: 'create-purchase-order',
      continueParams: { books: [{ title: 'Book 1' }] },
    }
  }

  return { message: 'Wind too low', weather: weatherResult }
}

registerWorkflow({
  id: 'restock-analysis',
  name: 'Restock Analysis',
  description: 'Check weather; if wind > 2, list out-of-stock books',
  tools: ['get_weather'],
  run: restockAnalysisWorkflow,
})
```

## Debug Logging

```ts
// Controller - with [Agent2] prefix
import { userLogger } from '../utils/logger.ts'
let logger = userLogger('[Agent2]')
logger.log('Starting workflow:', workflowId, params)

// Engine - with [WorkflowEngine] prefix
import { userLogger } from '../utils/logger.ts'
let logger = userLogger('[WorkflowEngine]')
logger.log('Step completed:', step.id, step.status)
```

## Key Points

- **Tools**: Define with `tool()` from AI SDK, use Zod schemas, implement execute()
- **Chaining**: Return `continueWith` and `continueParams` in workflow result to trigger next
- **Max depth**: Chain limited to 5 by default (MAX_CHAIN_DEPTH)
- **Parent tracking**: parent_run_id and chain_depth link runs in a chain
- **Tool filtering**: Each workflow can specify which tools it can use
- **LLM calls**: Use context.llm() for AI analysis within workflows
- **DevTools**: Add @ai-sdk/devtools middleware for AI call logging

## Related Files

| File | Description |
|------|-------------|
| [guides/ai-agent-tools.md](ai-agent-tools.md) | Tool definitions from AI SDK |
| [guides/ai-sdk-devtools.md](ai-sdk-devtools.md) | DevTools for logging |
| [concepts/ai-sdk-overview.md](concepts/ai-sdk-overview.md) | AI SDK core concepts |
| [lookup/ai-implementation-patterns.md](../lookup/ai-implementation-patterns.md) | Pattern reference |