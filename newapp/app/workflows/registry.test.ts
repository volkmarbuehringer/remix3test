import { describe, it, beforeEach } from 'remix/test'
import * as assert from 'remix/assert'

import {
  registerWorkflow,
  getWorkflow,
  listWorkflows,
  getWorkflowTools,
  workflowRegistry,
} from './registry.ts'
import type { WorkflowDefinition } from './types.ts'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createWorkflowDef(
  id: string,
  overrides?: Partial<WorkflowDefinition>,
): WorkflowDefinition {
  return {
    id,
    name: `Test ${id}`,
    description: `Test workflow ${id}`,
    run: async function* () {
      return {}
    },
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Workflow Registry tests
// ---------------------------------------------------------------------------

describe('Workflow Registry', () => {
  // Reset registry before each test to ensure isolation
  beforeEach(() => {
    workflowRegistry.clear()
  })

  // -----------------------------------------------------------------------
  // registerWorkflow
  // -----------------------------------------------------------------------

  it('registerWorkflow adds a definition to the registry', () => {
    let def = createWorkflowDef('test-register')

    registerWorkflow(def)

    assert.equal(workflowRegistry.size, 1)
    assert.equal(getWorkflow('test-register'), def)
  })

  it('registerWorkflow throws on duplicate ID', () => {
    registerWorkflow(createWorkflowDef('dup'))

    assert.throws(
      () => registerWorkflow(createWorkflowDef('dup')),
      { message: 'Workflow dup is already registered' },
    )
  })

  // -----------------------------------------------------------------------
  // getWorkflow
  // -----------------------------------------------------------------------

  it('getWorkflow returns the correct definition for a registered ID', () => {
    let def1 = createWorkflowDef('wf-a')
    let def2 = createWorkflowDef('wf-b')
    registerWorkflow(def1)
    registerWorkflow(def2)

    assert.equal(getWorkflow('wf-a'), def1)
    assert.equal(getWorkflow('wf-b'), def2)
  })

  it('getWorkflow returns undefined for an unknown ID', () => {
    assert.equal(getWorkflow('nonexistent'), undefined)
  })

  // -----------------------------------------------------------------------
  // listWorkflows
  // -----------------------------------------------------------------------

  it('listWorkflows returns all registered workflows', () => {
    registerWorkflow(createWorkflowDef('a'))
    registerWorkflow(createWorkflowDef('b'))
    registerWorkflow(createWorkflowDef('c'))

    let result = listWorkflows()

    assert.equal(result.length, 3)
  })

  it('listWorkflows returns an empty array when no workflows are registered', () => {
    let result = listWorkflows()
    assert.equal(result.length, 0)
  })

  // -----------------------------------------------------------------------
  // getWorkflowTools
  // -----------------------------------------------------------------------

  it('getWorkflowTools returns base tools for an unknown workflow', () => {
    let tools = getWorkflowTools('nonexistent')

    assert.ok('get_weather' in tools, 'should include get_weather')
    assert.ok('search_wikipedia' in tools, 'should include search_wikipedia')
  })

  it('getWorkflowTools returns specific tools when a workflow defines them', () => {
    registerWorkflow(createWorkflowDef('tools-test', { tools: ['runQuery'] }))

    let tools = getWorkflowTools('tools-test')

    assert.ok('runQuery' in tools, 'should include runQuery')
    assert.ok(!('get_weather' in tools), 'should NOT include base tools when specific ones are set')
  })

  it('getWorkflowTools falls back to base tools when configured tool names do not exist in allTools', () => {
    registerWorkflow(createWorkflowDef('bad-tools', { tools: ['nonexistent-tool'] }))

    let tools = getWorkflowTools('bad-tools')

    assert.ok('get_weather' in tools, 'should fall back to base tools')
    assert.ok('search_wikipedia' in tools, 'should fall back to base tools')
  })

  it('getWorkflowTools returns base tools for a workflow without a tools array', () => {
    registerWorkflow(createWorkflowDef('no-tools-prop'))

    let tools = getWorkflowTools('no-tools-prop')

    assert.ok('get_weather' in tools, 'should return base tools')
    assert.ok('search_wikipedia' in tools, 'should return base tools')
  })
})
