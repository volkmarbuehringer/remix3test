---
name: mastra-tool-suspension-detection
description: "Detect which tool caused a Mastra agent suspension by inspecting suspendPayload args shape"
origin: auto-extracted
---

# Mastra Agent Suspension Tool Detection

**Extracted:** 2026-07-11
**Context:** Mastra agent applications where multiple tools have `requireApproval: true` and the controller needs to handle different approval UI types

## Problem

When a Mastra agent suspends execution (because a tool has `requireApproval: true`), the agent's `generate()` returns `finishReason: 'suspended'` with a `suspendPayload` that contains the tool args and `toolCallId` — but **not the tool name or ID**. If multiple tools have `requireApproval`, the controller can't directly know which tool caused the suspension, making it impossible to render different approval UIs for different tools.

For example, both `confirmResource` (shows resource details) and `cancelBooking` (shows appointment summary with danger styling) require approval, but need completely different UI cards.

## Solution

Infer the tool name from the shape of the `suspendPayload.args` — each tool has a unique set of parameter names:

```typescript
type ApprovalData = {
  type: 'resource' | 'cancel_single' | 'cancel_all'
  resourceName?: string
  resourceDescription?: string
  cancelSummary?: string
  cancelCount?: number
  cancelSummaries?: string[]
}

function extractApprovalData(suspendPayload: unknown): ApprovalData {
  let sp = suspendPayload as { args?: Record<string, unknown> } | undefined
  let args = sp?.args ?? {}

  // cancel_booking has appointmentSummary
  if ('appointmentSummary' in args) {
    return {
      type: 'cancel_single',
      cancelSummary: String(args.appointmentSummary ?? ''),
    }
  }
  // cancel_all_appointments has count/appointmentSummaries
  if ('count' in args || 'appointmentSummaries' in args) {
    return {
      type: 'cancel_all',
      cancelCount: Number(args.count ?? 0),
      cancelSummaries: (args.appointmentSummaries as string[]) ?? [],
    }
  }
  // confirm_resource has resourceName/description
  return {
    type: 'resource',
    resourceName: String(args.resourceName ?? ''),
    resourceDescription: String(args.description ?? ''),
  }
}
```

Usage in the controller:

```typescript
if (result.finishReason === 'suspended') {
  let approval = extractApprovalData(result.suspendPayload)
  session.flash('toolApproval', {
    runId: result.runId,
    toolCallId: suspendPayload.toolCallId,
    ...approval,  // type + tool-specific display fields
  })
  // UI reads approvalData.type to render the correct card
}
```

## When to Use

- Multiple Mastra tools with `requireApproval: true` in the same agent
- Different approval UI cards needed for different tools
- Controller needs to route suspension handling by tool type
- Cannot rely on tool name being present in the suspend payload

## Limitations

- Fragile if future tools share field names — consider adding a `_approvalType` field to tool args as a more robust alternative
- Only works if each tool has a unique set of required parameter names
