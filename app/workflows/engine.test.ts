import { describe, it, before, after } from 'remix/test'
import * as assert from 'remix/assert'

import { db, initializeAppDatabase } from '../data/setup.ts'
import { sql, Database } from 'remix/data-table'
import { RequestContext } from 'remix/router'
import { asyncContext } from 'remix/middleware/async-context'
import { Auth } from 'remix/middleware/auth'
import {
  createWorkflowRun,
  getWorkflowRun,
  listWorkflowRuns,
  executeWorkflow,
} from './engine.ts'
import { registerWorkflow, getWorkflow, workflowRegistry } from './registry.ts'
import type { WorkflowDefinition, WorkflowContext, WorkflowStep } from './types.ts'

// ---------------------------------------------------------------------------
// Helper: run an async function within the async context middleware so that
// getContext() (used by userLogger → getCurrentUserSafely) works.
// ---------------------------------------------------------------------------

async function withAsyncContext<T>(fn: () => Promise<T>): Promise<T> {
  let request = new Request('https://remix.run/test')
  let context = new RequestContext(request)
  context.set(Database, db, { property: 'db' })
  context.set(Auth, { ok: false }, { property: 'auth' })

  let middleware = asyncContext()
  let result: T | undefined
  let error: unknown

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (middleware as any)(context, async () => {
    try {
      result = await fn()
    } catch (e) {
      error = e
    }
    return new Response('ok')
  })

  if (error !== undefined) {
    throw error
  }
  return result!
}

// ---------------------------------------------------------------------------
// Workflow Engine integration tests
// Requires a running PostgreSQL database seeded with demo users.
// ---------------------------------------------------------------------------

describe('Workflow Engine', () => {
  let testRunIds: string[] = []

  // -----------------------------------------------------------------------
  // Setup / Teardown
  // -----------------------------------------------------------------------

  before(async () => {
    await initializeAppDatabase()

    // Clean up any leftover test data from previous aborted runs
    await db.exec(sql`DELETE FROM workflow_runs WHERE id LIKE 'test-eng-%'`)

    // Clear any prior registry state
    workflowRegistry.clear()
  })

  after(async () => {
    // Clean up test workflow runs
    for (let id of testRunIds) {
      await db.exec(sql`DELETE FROM workflow_runs WHERE id = ${id}`)
    }

    // Unregister any test workflows
    for (let key of workflowRegistry.keys()) {
      if (key.startsWith('test-')) {
        workflowRegistry.delete(key)
      }
    }
  })

  // -----------------------------------------------------------------------
  // createWorkflowRun
  // -----------------------------------------------------------------------

  it('createWorkflowRun creates a workflow_runs record and returns a non-empty ID', async () => {
    let runId = await createWorkflowRun(db, 'test-workflow', { key: 'value' }, null)
    testRunIds.push(runId)

    assert.ok(runId, 'runId should be non-empty')
    assert.equal(typeof runId, 'string')

    // Verify the record exists in the DB
    let result = await db.exec(sql`SELECT * FROM workflow_runs WHERE id = ${runId}`)
    let rows = result.rows ?? []
    assert.equal(rows.length, 1, 'should have exactly 1 row')
    assert.equal((rows[0] as Record<string, unknown>).workflow_id, 'test-workflow')
    assert.equal((rows[0] as Record<string, unknown>).status, 'pending')
  })

  it('createWorkflowRun stores the user ID when provided', async () => {
    let runId = await createWorkflowRun(db, 'test-user-workflow', {}, 1)
    testRunIds.push(runId)

    let result = await db.exec(sql`SELECT * FROM workflow_runs WHERE id = ${runId}`)
    let rows = result.rows ?? []
    assert.equal(rows.length, 1)
    assert.equal((rows[0] as Record<string, unknown>).created_by, 1)
  })

  // -----------------------------------------------------------------------
  // getWorkflowRun
  // -----------------------------------------------------------------------

  it('getWorkflowRun returns the correct run for an existing ID', async () => {
    let runId = await createWorkflowRun(db, 'test-get-run', { foo: 'bar' }, null)
    testRunIds.push(runId)

    let run = await getWorkflowRun(db, runId)

    assert.ok(run, 'should return a run')
    assert.equal(run!.id, runId)
    assert.equal(run!.workflow_id, 'test-get-run')
    assert.equal(run!.params, JSON.stringify({ foo: 'bar' }))
    assert.equal(run!.status, 'pending')
  })

  it('getWorkflowRun returns null for a non-existent run ID', async () => {
    let run = await getWorkflowRun(db, 'nonexistent-run-id')
    assert.equal(run, null)
  })

  // -----------------------------------------------------------------------
  // listWorkflowRuns
  // -----------------------------------------------------------------------

  it('listWorkflowRuns returns runs ordered by created_at descending', async () => {
    // Create 3 runs with manually controlled timestamps
    let runId1 = await createWorkflowRun(db, 'test-list-wf', { seq: 1 }, null)
    testRunIds.push(runId1)

    // Small delay to ensure different timestamps
    await new Promise(r => setTimeout(r, 10))

    let runId2 = await createWorkflowRun(db, 'test-list-wf', { seq: 2 }, null)
    testRunIds.push(runId2)

    await new Promise(r => setTimeout(r, 10))

    let runId3 = await createWorkflowRun(db, 'test-list-wf', { seq: 3 }, null)
    testRunIds.push(runId3)

    let runs = await listWorkflowRuns(db, 10)

    // Should have at least our 3 runs
    let ourRuns = runs.filter(r => r.workflow_id === 'test-list-wf')
    assert.ok(ourRuns.length >= 3, 'should include our test runs')

    // The runs should be in descending order (most recent first)
    assert.ok(
      ourRuns[0].created_at >= ourRuns[1].created_at,
      'first run should be newer than or equal to second',
    )
    assert.ok(
      ourRuns[1].created_at >= ourRuns[2].created_at,
      'second run should be newer than or equal to third',
    )
  })

  it('listWorkflowRuns respects the limit parameter', async () => {
    // Create 3 runs
    for (let i = 0; i < 3; i++) {
      let runId = await createWorkflowRun(db, 'test-limit-wf', { i }, null)
      testRunIds.push(runId)
    }

    let runs = await listWorkflowRuns(db, 2)

    assert.ok(runs.length <= 2, 'should return at most 2 runs with limit=2')
  })

  // -----------------------------------------------------------------------
  // executeWorkflow
  // -----------------------------------------------------------------------

  it('executeWorkflow runs a simple workflow to completion', async () => {
    // Register a simple test workflow that does not call external APIs
    let testWorkflow: WorkflowDefinition = {
      id: 'test-exec-simple',
      name: 'Test Simple Exec',
      description: 'A simple test workflow for execution testing',
      run: async function* (
        _ctx: WorkflowContext,
        _params: Record<string, unknown>,
      ): AsyncGenerator<WorkflowStep, unknown, unknown> {
        yield {
          id: 'step1',
          name: 'Initialize',
          status: 'completed',
          output: 'Step 1 complete',
        }
        return { message: 'All steps done', value: 42 }
      },
    }
    registerWorkflow(testWorkflow)

    let runId = await createWorkflowRun(db, 'test-exec-simple', { input: 'test' }, null)
    testRunIds.push(runId)

    let result = await withAsyncContext(() =>
      executeWorkflow(runId, {
        workflowId: 'test-exec-simple',
        params: { input: 'test' },
        db,
        user: null,
      }),
    )

    assert.equal(result.status, 'completed', 'workflow should complete')
    assert.equal(result.runId, runId)

    // Verify the DB was updated
    let run = await getWorkflowRun(db, runId)
    assert.ok(run, 'run should exist')
    assert.equal(run!.status, 'completed')
    assert.ok(run!.completed_at, 'completed_at should be set')

    // Clean up registry
    workflowRegistry.delete('test-exec-simple')
  })

  it('executeWorkflow handles workflow failure gracefully', async () => {
    // Register a workflow that throws an error
    let failingWorkflow: WorkflowDefinition = {
      id: 'test-exec-fail',
      name: 'Test Failing Exec',
      description: 'A test workflow that fails',
      run: async function* (): AsyncGenerator<WorkflowStep, unknown, unknown> {
        throw new Error('Intentional failure for testing')
      },
    }
    registerWorkflow(failingWorkflow)

    let runId = await createWorkflowRun(db, 'test-exec-fail', {}, null)
    testRunIds.push(runId)

    let result = await withAsyncContext(() =>
      executeWorkflow(runId, {
        workflowId: 'test-exec-fail',
        params: {},
        db,
        user: null,
      }),
    )

    assert.equal(result.status, 'failed', 'workflow should report failure')
    assert.equal(result.error, 'Intentional failure for testing')

    // Verify the DB was updated
    let run = await getWorkflowRun(db, runId)
    assert.ok(run, 'run should exist')
    assert.equal(run!.status, 'failed')
    assert.equal(run!.error, 'Intentional failure for testing')

    // Clean up registry
    workflowRegistry.delete('test-exec-fail')
  })

  it('executeWorkflow throws for an unknown workflow ID', async () => {
    let runId = await createWorkflowRun(db, 'test-exec-unknown', {}, null)
    testRunIds.push(runId)

    await assert.rejects(
      () =>
        withAsyncContext(() =>
          executeWorkflow(runId, {
            workflowId: 'test-exec-unknown',
            params: {},
            db,
            user: null,
          }),
        ),
      { message: 'Workflow test-exec-unknown not found' },
    )
  })
})
