## Why

The customer agent has destructive capabilities (cancel bookings, trigger workflows) protected only by a soft instruction in the system prompt. There are no input-level guardrails to catch abuse, injection attempts, context overflow, or runaway costs before they reach the model.

## What Changes

- Add four input processors to the customer agent: UnicodeNormalizer, RegexFilterProcessor, TokenLimiterProcessor, CostGuardProcessor
- No changes to agent instructions, tools, or memory configuration
- No changes to the support agent or any other agent

## Capabilities

### New Capabilities
- `customer-agent-processors`: Input-level guardrail pipeline for the customer agent — Unicode sanitization, regex-based blocking (PII/secrets/URLs), token limit enforcement per step, and per-user cost cap

### Modified Capabilities

- _None_

## Impact

- **File**: `app/actions/mastra/agents/customer-agent.ts` — add import and `inputProcessors` array to Agent constructor
- **Dependencies**: All four processors (`UnicodeNormalizer`, `RegexFilterProcessor`, `TokenLimiterProcessor`, `CostGuardProcessor`) are available in installed `@mastra/core@1.50.1`
- **No new npm packages required**
- **Observability**: CostGuardProcessor reuses existing `MastraStorageExporter` already configured in the Mastra instance
