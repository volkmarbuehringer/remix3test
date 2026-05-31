<!-- Context: sse/navigation | Priority: critical | Version: 3.6 | Updated: 2026-04-29 -->

# SSE Demo Context

Server-Sent Events real-time chat demo using Remix with room-based broadcasting, E2E encryption, and offline messaging.

## Quick Reference

| Feature | Status | Notes |
|---------|--------|-------|
| SSE Streaming | ✅ | ReadableStream + text/event-stream |
| Room Broadcasting | ✅ | Connected clients Map with room/username |
| Compression Middleware | ✅ | gzip compression on responses |
| Rate Limiting | ✅ | 500ms per user per room, TTL cleanup |
| Input Sanitization | ✅ | Room/username/message length + char limits |
| Login Tracking | ✅ | Prevents duplicate sessions per user |
| Health Endpoint | ✅ | GET /health returns metrics JSON |
| Graceful Shutdown | ✅ | SIGINT/SIGTERM handling |
| Message Limit | ✅ | Stream termination after N messages |
| Accessibility | ✅ | WCAG 2.1 AA compliance |
| Dark Mode | ✅ | CSS variables + data-theme attribute |
| Responsive Design | ✅ | Mobile-first breakpoints |
| **E2E Encryption** | ✅ | AES-256-GCM with Web Crypto API |
| **Offline Messaging** | ✅ | SQLite storage, SSE delivery, ACK deletion |

## Structure

```
sse/
├── navigation.md
├── concepts/
│   ├── features.md              # Detailed feature descriptions
│   ├── e2e-encryption.md         # E2E encryption with AES-256
│   ├── sse-streaming.md          # SSE concept + demo client usage
│   ├── room-broadcasting.md      # Room management patterns
│   └── observability.md          # Structured logging + metrics
├── guides/
│   ├── compression.md            # HTTP compression middleware
│   ├── login-tracking.md         # Duplicate session prevention
│   ├── graceful-shutdown.md      # SIGINT/SIGTERM handling
│   ├── security-headers.md       # Security hardening
│   ├── testing-sse.md            # Unit testing patterns
│   ├── e2e-testing.md            # Playwright E2E tests
│   └── accessibility.md          # WCAG 2.1 AA compliance
├── lookup/
│   ├── sse-client-usage.md       # EventSource client (was core/lookup)
│   ├── health-endpoint.md        # Health response schema (was core/lookup)
│   ├── commands.md               # Demo commands (was core/lookup)
│   ├── message-limit.md          # Stream termination patterns
│   ├── offline-message-flow.md   # Offline message lifecycle
│   ├── ADR-001-in-memory-state.md    # ADR: In-memory state
│   ├── ADR-002-sse-protocol.md       # ADR: SSE protocol
│   ├── ADR-003-rate-limiting.md      # ADR: Rate limiting
│   ├── ADR-004-client-encryption.md  # ADR: Client encryption
│   └── ADR-005-room-broadcasting.md  # ADR: Room broadcasting
├── errors/
│   └── sse-encryption-errors.md  # Encryption troubleshooting
└── examples/
```

## Generic SSE Patterns

| Pattern | File | Description |
|---------|------|-------------|
| **SSE Implementation** | `development/remix3/sse/guides/sse-implementation.md` | Complete SSE guide |
| **Event Types** | `development/remix3/sse/guides/sse-event-types.md` | Generic event reference |
| **Client-Side SSE** | `development/remix3/sse/guides/client-side-sse.md` | EventSource patterns |
| **Stream Patterns** | `development/remix3/guides/stream-patterns.md` | ReadableStream patterns |

## Related Contexts

- `development/remix3/` - Generic Remix 3 patterns
- `development/remix3/guides/rate-limiting.md` - Rate limiting patterns
- `development/remix3/guides/input-validation.md` - Input sanitization

## Codebase References

- **Router**: `sse/app/router.tsx` - All SSE handlers
- **Client**: `sse/app/assets/message-stream.tsx` - EventSource client
- **Server**: `sse/server.ts` - HTTP server with graceful shutdown
- **Tokens**: `sse/app/components/tokens.ts` - Design tokens

## Testing

- **Unit Tests**: `sse/app/router.test.ts` - 30 passing tests
- **E2E Tests**: `sse/e2e/` - 28 passing, 74 skipped (see `guides/e2e-testing.md`)
