<!-- Context: development/navigation | Priority: critical | Version: 1.3 | Updated: 2026-04-11 -->

# AI Navigation

**Purpose**: AI frameworks, agent runtimes, and LLM integration patterns.

---

## Structure

```
ai/
├── navigation.md
├── concepts/
│   ├── ai-book-search.md          # AI search concept
│   ├── ai-sdk-overview.md        # AI SDK overview (NEW)
│   ├── agent-route.md              # Agent route implementation
│   └── ai-route-transfer.md        # Route transfer pattern (NEW)
├── guides/
│   ├── vercel-ai-sdk-agent.md     # Vercel AI SDK agent
│   ├── ai-agent-tools.md          # Tool examples
│   ├── ai-retry-patterns.md       # Retry with backoff
│   ├── ai-sdk-devtools.md         # DevTools setup (NEW)
│   ├── ai-sdk-type-safe.md       # Type-safe agents (NEW)
│   ├── per-tool-timeouts.md        # Per-tool timeouts
│   ├── agent-toolloop-pattern.md  # Complete agent pattern
│   ├── workflow-tools-chaining.md # Workflow tools & chaining (NEW)
│   └── ai-route-transfer-guide.md # Route transfer guide (NEW)
├── lookup/
│   ├── ai-implementation-patterns.md # Pattern reference
│   ├── ai-docs-reference.md          # AI SDK docs path (NEW)
│   └── ai-route-transfer-lookup.md   # File mapping reference (NEW)
└── errors/
    ├── ai-error-handling.md        # Error handling
    └── ai-sdk-common-errors.md   # AI SDK common errors (NEW)
```

---

## Quick Routes

| Task | Path |
|------|------|
| **AI Book Search** | `concepts/ai-book-search.md` |
| **AI SDK Overview** | `concepts/ai-sdk-overview.md` |
| **Agent Route** | `concepts/agent-route.md` |
| **Route Transfer** | `concepts/ai-route-transfer.md` |
| **ToolLoopAgent Pattern** | `guides/agent-toolloop-pattern.md` |
| **Retry Patterns** | `guides/ai-retry-patterns.md` |
| **Per-Tool Timeouts** | `guides/per-tool-timeouts.md` |
| **Type-Safe Agents** | `guides/ai-sdk-type-safe.md` |
| **DevTools** | `guides/ai-sdk-devtools.md` |
| **Route Transfer Guide** | `guides/ai-route-transfer-guide.md` |
| **Workflow Tools & Chaining** | `guides/workflow-tools-chaining.md` (NEW) |
| **Implementation Patterns** | `lookup/ai-implementation-patterns.md` |
| **AI SDK Docs** | `lookup/ai-docs-reference.md` |
| **Transfer Lookup** | `lookup/ai-route-transfer-lookup.md` |
| **Error Handling** | `errors/ai-error-handling.md` |
| **AI SDK Errors** | `errors/ai-sdk-common-errors.md` |

---

## By Technology

| Technology | Use Case | Guide |
|------------|---------|-------|
| **Vercel AI SDK** | ToolLoopAgent with tools | `guides/vercel-ai-sdk-agent.md` |
| **OpenCode API** | Direct LLM calls | `concepts/ai-book-search.md` |

---

## Available Patterns

| Pattern | Description |
|---------|-------------|
| `streamText` | Streaming response collection |
| `ToolLoopAgent` | Agent with multiple tools |
| `inputSchema` | Tool definition with Zod |
| Per-tool timeouts | AbortController per operation |
| Exponential backoff | Retry for rate limits |

---

## Debugging

| Tool | Location |
|------|----------|
| **DevTools Setup** | `guides/ai-sdk-devtools.md` |
| **Docs Search** | `lookup/ai-docs-reference.md` |
| **Provider utility** | `bookstore/app/utils/ai-provider.ts` |
