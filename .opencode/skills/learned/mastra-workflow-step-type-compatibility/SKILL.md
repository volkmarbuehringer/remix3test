---
name: mastra-workflow-step-type-compatibility
description: "Mastra Workflow .parallel() and .then() require matching input/output schemas; workaround via Promise.all in executor"
origin: auto-extracted
---

# Mastra Workflow Step Type Compatibility

**Extracted:** 2026-07-25
**Context:** Building Mastra Workflows with `.parallel()` and `.then()` chains, where steps have different input schemas.

## Problem

Mastra Workflows enforce strict TypeScript type compatibility between step schemas:

1. **`.parallel([stepA, stepB])`** — All parallel steps must have input schemas compatible with the workflow's `inputSchema`. A step declared with `inputSchema: z.object({})` (empty schema) cannot be placed in a parallel array where the workflow input is `{ targetUserId: number }`. TypeScript error:
   ```
   Property 'targetUserId' is missing in type 'Record<string, never>'
   ```

2. **`.then(stepA).then(stepB)`** — Step B's `inputSchema` must be compatible with Step A's `outputSchema`. If Step A outputs `{ found, user }` and Step B expects `{ targetUserId }`, TypeScript errors.

## Solution

**Option A: Compose workflows at the executor level (recommended)**

Instead of trying to fit incompatible steps into a single workflow, run separate workflows in parallel from the executor and combine their outputs:

```typescript
// workflow-executor.ts
export async function executeCombinedWorkflow(input: {
  targetUserId: number
}): Promise<CombinedResult> {
  let [resultA, resultB] = await Promise.all([
    (async () => {
      let wf = _mastra.getWorkflow('workflowA')
      let run = await wf.createRun({ resourceId: String(input.targetUserId) })
      return run.start({ inputData: input })
    })(),
    (async () => {
      let wf = _mastra.getWorkflow('workflowB')
      let run = await wf.createRun({ resourceId: 'static-key' })
      return run.start({ inputData: {} })
    })(),
  ])
  return { ...resultA, ...resultB }
}
```

**Option B: Merge steps with compatible schemas**

If the steps are logically sequential and share the same input context, merge them into a single step:

```typescript
const combinedStep = createStep({
  id: 'lookup-and-count',
  inputSchema: z.object({
    targetUserId: z.number().positive(),
  }),
  outputSchema: z.object({
    found: z.boolean(),
    user: z.object({ ... }).optional(),
    pendingCount: z.number(),
    error: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    let user = await lookupUser(inputData.targetUserId)
    let count = await countAppointments(inputData.targetUserId)
    return { found: true, user, pendingCount: count }
  },
})
```

**Option C: Sequential chain with passthrough**

Make earlier steps pass through fields needed by later steps in their output schema:

```typescript
.then(step1) // outputs { found, user, targetUserId (passthrough) }
.then(step2) // expects { targetUserId }
```

## When to Use

- TypeScript errors about `inputSchema` incompatibility in `.parallel()` arrays
- TypeScript errors about output/input mismatch across `.then()` chains in Mastra Workflows
- You need to run system-wide queries (no specific input) alongside user-specific queries in parallel
- You want to reuse existing Mastra Workflow steps defined with `z.object({})` input in a workflow that has structured input
