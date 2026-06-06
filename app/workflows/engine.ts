import { generateId } from 'ai'
import { sql } from 'remix/data-table'
import type { Database } from 'remix/data-table'
import { getModel } from '../utils/ai-provider.ts'
import { userLogger } from '../utils/logger.ts'
import type { User } from '../data/schema.ts'

export interface WorkflowRun {
  id: string
  workflow_id: string
  status: string
  params: string
  steps: string
  result: string | null
  error: string | null
  created_at: number
  completed_at: number | null
  created_by: number | null
  parent_run_id: string | null
  chain_depth: number
}
import type { Workflow, WorkflowContext, WorkflowStep } from './types.ts'
import { getWorkflow } from './registry.ts'
import { getWorkflowTools } from './registry.ts'

const MAX_CHAIN_DEPTH = 5

export interface RunWorkflowOptions {
  workflowId: string
  params: Record<string, unknown>
  db: Database
  user: User | null
  logger?: ReturnType<typeof userLogger>
  parentRunId?: string
}

export interface WorkflowRunResult {
  runId: string
  status: 'completed' | 'failed'
  result?: unknown
  error?: string
}



async function callLlm(prompt: string, logger: ReturnType<typeof userLogger>): Promise<string> {
  logger.log('Calling LLM with prompt:', prompt.slice(0, 200) + (prompt.length > 200 ? '...' : ''))

  let { generateText } = await import('ai')
  let result = await generateText({
    model: getModel(),
    prompt,
    maxOutputTokens: 2048,
  })

  logger.log('LLM response:', result.text.slice(0, 200) + (result.text.length > 200 ? '...' : ''))
  return result.text
}

export async function createWorkflowRun(
  db: Database,
  workflowId: string,
  params: Record<string, unknown>,
  userId: number | null
): Promise<string> {
  let id = generateId()
  let now = Date.now()
  await db.exec(sql`
    INSERT INTO workflow_runs (id, workflow_id, status, params, steps, created_at, created_by)
    VALUES (${id}, ${workflowId}, 'pending', ${JSON.stringify(params)}, '[]', ${now}, ${userId})
  `)
  return id
}

export async function executeWorkflow(
  runId: string,
  options: RunWorkflowOptions
): Promise<WorkflowRunResult> {
  let { workflowId, params, db, user, logger: providedLogger } = options
  let logger = providedLogger ?? userLogger('WorkflowEngine')
  let workflow = getWorkflow(workflowId)

  if (!workflow) {
    throw new Error(`Workflow ${workflowId} not found`)
  }

  logger.log(`Starting workflow ${workflowId}, run ${runId}`)

  await db.exec(sql`UPDATE workflow_runs SET status = 'running' WHERE id = ${runId}`)

  let context: WorkflowContext = {
    db,
    tools: getWorkflowTools(workflowId),
    llm: (prompt: string) => callLlm(prompt, logger),
    user,
    logger,
  }

  let steps: WorkflowStep[] = []
  let finalResult: unknown
  let finalError: string | undefined

  try {
    let generator = workflow.run(context, params)

    while (true) {
      let next = await generator.next()

      if (next.done) {
        finalResult = next.value
        break
      }

      let step = next.value
      let existingStep = steps.find(s => s.id === step.id)
      if (existingStep) {
        Object.assign(existingStep, step)
      } else {
        steps.push(step)
      }

      await db.exec(sql`UPDATE workflow_runs SET steps = ${JSON.stringify(steps)} WHERE id = ${runId}`)

      logger.log(`Step ${step.id}: ${step.status}`)
    }

    logger.log(`Workflow ${workflowId} completed successfully`)

    let now = Date.now()
    await db.exec(sql`
      UPDATE workflow_runs
      SET status = 'completed', steps = ${JSON.stringify(steps)},
          result = ${finalResult ? JSON.stringify(finalResult) : null},
          completed_at = ${now}
      WHERE id = ${runId}
    `)

    return { runId, status: 'completed', result: finalResult }
  } catch (error) {
    finalError = error instanceof Error ? error.message : String(error)
    logger.error(`Workflow ${workflowId} failed:`, finalError)

    let now = Date.now()
    await db.exec(sql`
      UPDATE workflow_runs
      SET status = 'failed', steps = ${JSON.stringify(steps)},
          error = ${finalError}, completed_at = ${now}
      WHERE id = ${runId}
    `)

    return { runId, status: 'failed', error: finalError }
  }
}

function rowToWorkflowRun(row: Record<string, unknown>): WorkflowRun {
  return {
    id: row.id as string,
    workflow_id: row.workflow_id as string,
    status: row.status as string,
    params: row.params as string,
    steps: row.steps as string,
    result: row.result as string | null,
    error: row.error as string | null,
    created_at: typeof row.created_at === 'string' ? Number(row.created_at) : (row.created_at as number),
    completed_at: row.completed_at ? (typeof row.completed_at === 'string' ? Number(row.completed_at) : (row.completed_at as number)) : null,
    created_by: row.created_by as number | null,
    parent_run_id: row.parent_run_id as string | null,
    chain_depth: typeof row.chain_depth === 'string' ? Number(row.chain_depth) : (row.chain_depth as number),
  }
}

export async function getWorkflowRun(
  db: Database,
  runId: string
): Promise<WorkflowRun | null> {
  let result = await db.exec(sql`SELECT * FROM workflow_runs WHERE id = ${runId}`)
  let rows = result.rows ?? []
  if (rows.length === 0) return null
  return rowToWorkflowRun(rows[0] as Record<string, unknown>)
}

export async function listWorkflowRuns(
  db: Database,
  limit: number = 50
): Promise<WorkflowRun[]> {
  let result = await db.exec(sql`SELECT * FROM workflow_runs ORDER BY created_at DESC LIMIT ${limit}`)
  return (result.rows ?? []).map(r => rowToWorkflowRun(r as Record<string, unknown>))
}


