# Tool Result Extraction (Chunk vs Flat Format)

## What This Covers

Extracting structured tool output from `agent.generate()`. Read this when `result.toolResults[i].result` is silently `undefined`, when matching tool names, or when multiple steps make the arrays not align.

## Problem

After calling `agent.generate(message)`, you inspect `result.toolResults` and `result.toolCalls` to extract structured tool output — but the data isn't where you expect it.

The Mastra `FullOutput` type shows `ToolCallChunk[]` and `ToolResultChunk[]`, where each element has `{ type: 'tool-call', payload: { toolName, args, ... } }` or `{ type: 'tool-result', payload: { toolName, result, ... } }`. However, the **runtime** objects may use the chunk format (`result.toolCalls[i].payload.toolName`) OR a flat format (`result.toolCalls[i].toolName`) depending on the Mastra version and how the output was constructed.

Accessing `result.toolResults[i].result` directly fails silently (returns undefined) when the actual structure is `result.toolResults[i].payload.result`.

```typescript
// BROKEN: silently returns undefined when Mastra returns chunk format
let result = await agent.generate(message, opts)
for (let tr of result.toolResults ?? []) {
  console.log(tr.result) // undefined if structure is { payload: { result } }
}
```

## Solution

Always check BOTH formats with a payload-first fallback. **Iterate `toolResults` directly by `toolName`** instead of relying on same-index pairing with `toolCalls` — with multi-step agent responses (`maxSteps > 1`), the arrays may not align.

```typescript
let result = await agent.generate(message, opts)

// Handle both chunk format ({ payload: { toolName, ... } }) and flat format ({ toolName, ... })
// Iterate toolResults directly — more robust than index-based pairing with toolCalls
let toolResults = (result.toolResults ?? []) as unknown[]

for (let tr of toolResults) {
  let entry = tr as Record<string, unknown> | undefined
  // Prefer payload.toolName, fall back to direct toolName
  let payload = (entry?.payload as Record<string, unknown> | undefined) ?? entry
  if (payload?.toolName === 'my_tool' || payload?.toolName === 'my_tool_id') {
    // Prefer payload.result, fall back to direct result
    let toolResult = payload?.result as Record<string, unknown> | undefined
    // Use toolResult here
    console.log(toolResult)
  }
}
```

## Tool names: runtime uses the JavaScript property key, not `id`

At runtime in `@mastra/core@^1.49.0`, `toolName` is the **JavaScript object property key** (camelCase), NOT the `id` field you passed to `createTool()`.

```typescript
// Tool definition — property key is 'myTool', id is 'my_tool_id'
export const myTools = {
  myTool: createTool({ id: 'my_tool_id', ... })
}

// Runtime toolName is the property key, NOT the id
// result.toolResults[i].payload.toolName === 'myTool'  ← actual
// result.toolResults[i].payload.toolName === 'my_tool_id'  ← NOT this
```

This varies between Mastra versions. When in doubt, add a one-shot debug log to see the actual value:

```typescript
let result = await agent.generate(message, opts)
console.log(JSON.stringify(result.toolResults ?? []).slice(0, 1000))
// Look for "toolName": "..." in the output
```

Then use the exact string you see. A safe fallback checks both:

```typescript
if (
  payload?.toolName === 'find_next_available_slots' ||
  payload?.toolName === 'findNextAvailableSlots'
) {
  // either format works
}
```

## Exhaustive check — iterate toolResults directly

If you need the LAST matching tool result (useful when the agent makes multiple calls across steps), iterate `toolResults` directly:

```typescript
let lastResult: Record<string, unknown> | undefined
for (let tr of result.toolResults ?? []) {
  let entry = tr as Record<string, unknown> | undefined
  let payload = (entry?.payload as Record<string, unknown> | undefined) ?? entry
  if (payload?.toolName === 'myTool' || payload?.toolName === 'my_tool_id') {
    let trResult = payload?.result as Record<string, unknown> | undefined
    if (trResult != null) {
      lastResult = trResult // keep overwriting to get the most recent
    }
  }
}
```

This avoids index-based pairing fragility and handles multi-step agent responses correctly.
