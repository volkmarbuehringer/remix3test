<!-- Context: development/remix3/session/concepts/session-storage-interface | Priority: medium | Version: 1.0 -->

# Concept: SessionStorage Interface

**Core**: All session backends implement the two-method `SessionStorage` interface: `read(cookie)` and `save(session)`. This abstraction enables swapping storage without changing application code.

## Core Concept

`SessionStorage` is the persistence contract. `read` takes the raw cookie string, retrieves or creates a `Session`, and returns it hydrated. `save` takes the modified session, persists it, and returns the cookie value to set (or `null` if unchanged).

## Key Points

- `read(cookie: string | null): Promise<Session>` — parses cookie, loads data, returns session
- `save(session: Session): Promise<string | null>` — serializes session data, returns cookie value
- `null` from `save` means "no cookie change" (session is clean)
- `''` from `save` means "clear the cookie" (session is destroyed)
- The interface is storage-agnostic — cookie, filesystem, and memory all conform

## Quick Example

```typescript
interface SessionStorage {
  read(cookie: string | null): Promise<Session>
  save(session: Session): Promise<string | null>
}
```

## Reference

- **Source**: `packages/session/src/lib/session-storage.ts` — SessionStorage interface

## Related

- `session-core.md` — Session class consumed by storage backends
- `../guides/cookie-storage.md` — Cookie backend implementation
- `../guides/filesystem-storage.md` — Filesystem backend implementation
- `../guides/memory-storage.md` — Memory backend implementation
