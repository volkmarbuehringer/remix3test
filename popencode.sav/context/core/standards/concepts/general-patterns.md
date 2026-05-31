<!-- Context: standards/patterns/general | Priority: high | Version: 2.0 | Updated: 2026-04-15 -->

# Essential Coding Patterns

**Purpose**: Language-agnostic patterns for robust code

---

## Error Handling

**ALWAYS** handle errors gracefully:
- Catch specific errors, not generic ones
- Log errors with context
- Return meaningful error messages
- Don't expose internal implementation details

---

## Database Lifecycle

**Initialization**:
```typescript
let dbInitialized = false
let dbError: Error | null = null

export function isDatabaseReady(): boolean {
  return dbInitialized && dbError === null
}
```

**Graceful Shutdown**:
```typescript
async function shutdown() {
  await pool.end() // Close pool first
  server.close(() => process.exit(0))
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
```

---

## Configuration

- Use environment variables for secrets
- Provide sensible defaults
- Validate required config on startup

---

## Code Organization

- Single Responsibility: one function, one purpose
- Don't Repeat Yourself (DRY)
- Keep functions small (< 50 lines)

---

## Testing

- Use dependency injection
- Write unit tests for business logic
- Write integration tests for external deps

---

## Logging Levels

- **Debug**: Detailed info (dev only)
- **Info**: Important milestones
- **Warning**: Potential issues
- **Error**: Failures

---

## Performance

- Cache expensive results
- Use efficient data structures
- Profile before optimizing

---

## Related

- `concepts/security-patterns.md` - Security patterns
