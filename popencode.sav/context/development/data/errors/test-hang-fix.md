<!-- Context: development/data/errors | Priority: high | Version: 1.0 | Updated: 2026-04-17 -->

# Error: Tests Hang After Completion

**Core Idea**: Node.js test runner hangs indefinitely after tests complete when PostgreSQL connection pools keep the event loop alive. Use `node --import tsx` with `--test-force-exit` instead of `tsx` directly.

---

## Root Causes

- `tsx` CLI doesn't properly pass `--test-force-exit` to Node's test runner
- PostgreSQL connection pool maintains open connections that keep the event loop alive
- Tests complete successfully but the process never exits

---

## Solution

**Before** (hangs):
```json
"test": "NODE_ENV=test tsx --test"
```

**After** (exits cleanly):
```json
"test": "NODE_ENV=test node --import tsx --test --test-force-exit 'app/**/*.test.ts'"
```

**Key changes**:
1. `node --import tsx` instead of `tsx` directly — ensures Node.js receives all flags
2. `--test-force-exit` — forces test runner to exit after completion
3. Explicit glob pattern `'app/**/*.test.ts'` — avoids running files in `test/` directory as tests

---

## Database Cleanup Pattern

Create `test/setup.ts` to close pool on exit:

```ts
import { closeDatabasePool } from '../app/data/setup.ts'

process.on('beforeExit', async () => {
  try {
    await closeDatabasePool()
  } catch {
    // Ignore errors during cleanup
  }
  process.exit(0)
})
```

Add `closeDatabasePool()` to database setup:

```ts
export async function closeDatabasePool(): Promise<void> {
  await pool.end()
}
```

Configure pool with `allowExitOnIdle: true` for graceful shutdown.

---

## Codebase References

- `/checker/package.json` — test script configuration
- `/checker/app/data/setup.ts` — `closeDatabasePool()` function
- `/checker/test/setup.ts` — pool cleanup on exit

---

## Related

- Node.js `--test-force-exit` flag: `node --help --test`
- `tsx` register flag: `node --import tsx`
