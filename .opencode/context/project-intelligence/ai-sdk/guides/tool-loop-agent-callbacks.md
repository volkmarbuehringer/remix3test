<!-- Context: project-intelligence/ai-sdk/guides | Priority: high | Version: 1.0 | Updated: 2026-04-15 -->

# Guide: ToolLoopAgent Callbacks

**Core Idea**: `ToolLoopAgent` provides lifecycle callbacks (`onStepFinish`, `prepareStep`) for logging step completion and implementing conditional model switching based on conversation state.

## Key Points

- **onStepFinish**: Called after each agent step with usage stats, finish reason, and tool calls — use for logging, analytics, or adaptive behavior
- **prepareStep**: Called before each step to modify behavior — return options to switch models or modify input
- **Return value**: Both callbacks return objects; `prepareStep` can return `{ model: "..." }` to override the default model
- **Use case**: Switch to faster/cheaper models when conversation is simple (few messages), keep capable model for complex reasoning
- **Logging pattern**: Log token usage and tool counts to track agent behavior and costs

## onStepFinish Example

```ts
import { ToolLoopAgent } from 'ai';

const agent = new ToolLoopAgent({
  model: "anthropic/claude-sonnet-4.5",
  instructions: 'You are a helpful assistant.',
  onStepFinish: async ({ stepNumber, usage, finishReason, toolCalls }) => {
    console.log(`[Agent] Step ${stepNumber} completed:`, {
      inputTokens: usage?.inputTokens,
      outputTokens: usage?.outputTokens,
      finishReason,
      toolsUsed: toolCalls?.map(tc => tc.toolName),
    });
  },
});
```

## prepareStep Example

```ts
import { ToolLoopAgent } from 'ai';

const agent = new ToolLoopAgent({
  model: "anthropic/claude-sonnet-4.5",
  prepareStep: async ({ stepNumber, messages }) => {
    // Switch to faster model for simple conversations
    if (messages.length > 10) {
      console.log(`[Agent] prepareStep: step=${stepNumber}, messages=${messages.length} (>10 - consider model switch)`);
      return { model: "anthropic/claude-3-haiku" };
    }
    return {}; // Continue with default model
  },
});
```

## When to Use Each Callback

| Callback | Purpose | Use Case |
|----------|---------|----------|
| `onStepFinish` | Post-step logging | Track token usage, monitor tool calls, debug agent behavior |
| `prepareStep` | Pre-step modification | Conditional model switching, inject context, validate input |

## Reference

- Full API: `node_modules/ai/docs/07-reference/01-ai-sdk-core/16-tool-loop-agent.mdx`
- Related: [guides/tool-loop-agent.md](../tool-loop-agent.md), [guides/building-agents.md](building-agents.md)