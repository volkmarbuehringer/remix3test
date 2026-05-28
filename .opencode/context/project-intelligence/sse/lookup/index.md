<!-- Context: sse/decisions/index | Priority: high | Version: 1.0 | Updated: 2026-03-25 -->

# SSE Demo Architecture Decision Records

This directory contains ADRs (Architecture Decision Records) documenting the key architectural decisions made in the SSE demo.

## Active ADRs

| ADR                                     | Title                          | Status   |
| --------------------------------------- | ------------------------------ | -------- |
| [ADR-001](ADR-001-in-memory-state.md)   | In-Memory State Management     | accepted |
| [ADR-002](ADR-002-sse-protocol.md)      | SSE Event Streaming Protocol   | accepted |
| [ADR-003](ADR-003-rate-limiting.md)     | Rate Limiting Implementation   | accepted |
| [ADR-004](ADR-004-client-encryption.md) | Client-Side Encryption         | accepted |
| [ADR-005](ADR-005-room-broadcasting.md) | Room Broadcasting Architecture | accepted |

## Decision Summary

- **State Management**: In-memory Maps (simplicity for demo)
- **Real-time Protocol**: Server-Sent Events with ReadableStream
- **Rate Limiting**: 500ms per-user-per-room with TTL cleanup
- **Encryption**: AES-256-GCM with PBKDF2 key derivation (client-side)
- **Room Routing**: Global client Map with O(n) broadcast filtering

## Related Documentation

- [SSE Features](../features.md)
- [Room Broadcasting Concept](../core/concepts/room-broadcasting.md)
- [SSE Streaming Concept](../core/concepts/sse-streaming.md)
- [Graceful Shutdown Guide](../guides/graceful-shutdown.md)
