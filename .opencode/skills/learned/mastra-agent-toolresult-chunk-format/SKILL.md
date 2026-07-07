---
name: mastra-agent-toolresult-chunk-format
description: "Extract tool results and tool calls from Mastra Agent generate() output — handle both chunk and flat formats"
origin: auto-extracted
---

# Mastra Agent Tool Result Extraction (Chunk vs Flat Format)

**Extracted:** 2026-07-07
**Context:** Reading `result.toolResults` and `result.toolCalls` from `agent.generate()` and finding empty or missing data despite the agent having called tools

## Problem

After calling `agent.generate(message)`, you inspect `result.toolResults` and `result.toolCalls` to extract structured tool output — but the data isn't where you expect it.

The Mastra `FullOutput` type shows `ToolCallChunk[]` and `ToolResultChunk[]`, where each element has `{ type: 'tool-call', payload: { toolName, args, ... } }` or `{ type: 'tool-result', payload: { toolName, result, ... } }`. However, the **runtime** objects may use the chunk format (`result.toolCalls[i].payload.toolName`) OR a flat format (`result.toolCalls[i].toolName`) depending on the Mastra version and how the output was constructed.

Accessing `result.toolResults[i].result` directly fails silently (returns undefined) when the actual structure is `result.toolResults[i].payload.result`.

```typescript
// BROKEN: silently returns undefined when Mastra returns chunk format
let result = await agent.generate(message, opts)
for (let tr of (result.toolResults ?? [])) {
  console.log(tr.result) // undefined if structure is { payload: { result } }
}
```

## Solution

Always check BOTH formats by using a payload-first fallback pattern:

```typescript
let result = await agent.generate(message, opts)

// Handle both chunk format ({ payload: { toolName, ... } }) and flat format ({ toolName, ... })
let toolCalls = (result.toolCalls ?? []) as unknown[]
let toolResults = (result.toolResults ?? []) as unknown[]

for (let i = 0; i < toolCalls.length; i++) {
  let tc = toolCalls[i] as Record<string, unknown> | undefined
  // Prefer payload.toolName, fall back to direct toolName
  let tcPayload = (tc?.payload as Record<string, unknown> | undefined) ?? tc
  if (tcPayload?.toolName === 'my_tool_id') {
    let tr = toolResults[i] as Record<string, unknown> | undefined
    // Prefer payload.result, fall back to direct result
    let trPayload = (tr?.payload as Record<string, unknown> | undefined) ?? tr
    let toolResult = trPayload?.result as Record<string, unknown> | undefined
    // Use toolResult here
    console.log(toolResult)
  }
}
```

### Tool names are the `id` you passed to `createTool()`

When checking `toolName`, use the value of the `id` field from `createTool({ id: 'my_tool_id' })`, not the camelCase JavaScript object key.

```typescript
// Tool definition
export const myTools = {
  myTool: createTool({ id: 'my_tool_id', ... })  // toolName will be 'my_tool_id'
}

// In the agent response
if (tcPayload?.toolName === 'my_tool_id') { ... }  // correct
if (tcPayload?.toolName === 'myTool') { ... }       // wrong
```

### Exhaustive check pattern with type narrowing

If you need the LAST matching tool result (useful when the agent makes multiple calls):

```typescript
let lastResult: Record<string, unknown> | undefined
for (let i = 0; i < toolCalls.length; i++) {
  let tc = toolCalls[i] as Record<string, unknown> | undefined
  let tcPayload = (tc?.payload as Record<string, unknown> | undefined) ?? tc
  if (tcPayload?.toolName === 'my_tool_id') {
    let tr = toolResults[i] as Record<string, unknown> | undefined
    let trPayload = (tr?.payload as Record<string, unknown> | undefined) ?? tr
    let trResult = trPayload?.result as Record<string, unknown> | undefined
    if (trResult != null) {
      lastResult = trResult  // keep overwriting to get the most recent
    }
  }
}
```

## When to Use

- Extracting structured output from `agent.generate()` tool calls in Mastra
- Building controllers that react to agent tool results (e.g., show a UI form after a slot-finding tool)
- Writing Mastra workflow steps that inspect agent execution results
- Debugging why `result.toolResults` appears empty even though the agent called a tool
