<!-- Context: bookstore-demo/navigation | Priority: critical | Version: 1.11 | Updated: 2026-05-01 -->

# Navigation: Bookstore Demo Context

**Purpose**: Context documentation for bookstore AI features including chatlog admin, LLM usage tracking, StreamText options, and admin books management with filter/sort/pagination.

> **Note**: Some patterns have been migrated to `development/` directories:
> - Remix-specific patterns → `../development/remix3/`
> - AI-specific patterns → `../development/ai/`
> - Generic filter/sort/pagination → `../development/remix3/guides/`
> These files remain here as working examples from the bookstore implementation.

---

## File Structure

```
bookstore-demo/
├── concepts/         # Core concepts
├── guides/          # Implementation guides
├── examples/        # Code examples
├── lookup/         # Reference patterns
├── errors/         # Error handling
└── navigation.md   # This file
```

---

## Quick Reference

| Task | Context to Load |
|------|----------------|
| AI search concept | concepts/ai-book-search.md |
| Chat log pattern | concepts/chat-log-pattern.md |
| JSONB database patterns | concepts/jsonb-database-patterns.md |
| Conversation tracking | concepts/chat-conversation-tracking.md |
| LLM usage tracking | concepts/llm-usage-tracking.md |
| User preferences pattern | concepts/user-preferences.md |
| Dark mode styling | concepts/dark-mode-styling.md |
| Theme CSS architecture | concepts/theme-css-architecture.md |
| Navbar active route | guides/navbar-active-route.md |
| Admin nesting + filtering | guides/admin-chatlog-routes.md |
| Lists SSR admin route | guides/admin-lists-route.md |
| Client form handling | guides/client-side-form-handling.md |
| Per-tool timeouts | guides/per-tool-timeouts.md |
| Retry implementation | guides/ai-retry-patterns.md |
| Chat ARIA attributes | lookup/chat-log-aria-reference.md |
| Error handling | errors/aisearch-errors.md |
| Messages architecture | concepts/messages-architecture.md |
| Messages SSE streaming | guides/messages-sse-streaming.md |
| Messages integration | lookup/messages-integration-points.md |
| Messages gotchas | errors/messages-implementation-gotchas.md |
| In-memory filtering | lookup/database-filtering.md |
| SQL filtering for chatlog | lookup/chatlog-database-filtering.md |
| StreamText options | lookup/streamtext-options.md |
| Agent vs Chat patterns | lookup/agent-vs-chat-patterns.md |
| Full example | examples/ai-book-search-ui.md |
| Error logging utility | examples/error-logger-example.md |
| Implementation patterns | lookup/ai-implementation-patterns.md |
| Admin books FSP | lookup/admin-books-fsp.md |
| Import paths | lookup/import-paths.md |
