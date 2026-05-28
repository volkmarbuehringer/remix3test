import type { WorkflowDefinition } from './types.ts'
import { baseTools, allTools } from './tools.ts'
import type { Tool } from 'ai'

export const workflowRegistry = new Map<string, WorkflowDefinition>()

export function registerWorkflow(def: WorkflowDefinition): void {
  if (workflowRegistry.has(def.id)) {
    throw new Error(`Workflow ${def.id} is already registered`)
  }
  workflowRegistry.set(def.id, def)
}

export function getWorkflow(id: string): WorkflowDefinition | undefined {
  return workflowRegistry.get(id)
}

export function listWorkflows(): WorkflowDefinition[] {
  return Array.from(workflowRegistry.values())
}

export function getWorkflowTools(workflowId: string): Record<string, Tool> {
  let def = getWorkflow(workflowId)
  if (!def || !def.tools) {
    return baseTools
  }
  let result: Record<string, Tool> = {}
  for (let name of def.tools) {
    if (name in allTools) {
      result[name] = allTools[name as keyof typeof allTools]
    }
  }
  return Object.keys(result).length > 0 ? result : baseTools
}
