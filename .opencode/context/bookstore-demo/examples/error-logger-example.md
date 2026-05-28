<!-- Context: bookstore-demo/examples | Priority: medium | Version: 1.1 | Updated: 2026-04-15 -->

# Example: Error Logging Utility

**Purpose**: Standardized error logging for the bookstore app

**Source**: `bookstore/app/lib/error-logger.ts`

---

## Quick Usage

```typescript
import { logError, logWarning, logDebug, errorHandlers } from '../lib/error-logger'

// Simple logging
logError('Agent', 'Weather fetch failed', error)
// → [Agent] Weather fetch failed | Error: Network timeout

// With context
logErrorWithContext('AISearch', 'Tool failed', { tool: 'search' }, error)

// Pre-configured handlers
errorHandlers.aisearch('Parse error', parseError)
errorHandlers.chat('Failed to load', error)
```

---

## Logging Levels

| Function | Output | When |
|----------|--------|------|
| `logError(c, m, e)` | `console.error` | Always |
| `logWarning(c, m)` | `console.warn` | Always |
| `logDebug(c, m, d)` | `console.log` | Dev only |

---

## Available Handlers

`errorHandlers.agent` | `errorHandlers.aisearch` | `errorHandlers.chat` | `errorHandlers.chatlog` | `errorHandlers.assistant` | `errorHandlers.cart` | `errorHandlers.admin` | `errorHandlers.db`

---

## Create Custom Handler

```typescript
const handleError = createErrorHandler('MyComponent')
handleError('Operation failed', error)
```

---

## Error Formatting

| Input | Output |
|-------|--------|
| `Error` | `{name}: {message}` |
| `string` | `{string}` |
| `unknown` | `String(unknown)` |
| `undefined` | (empty) |

---

## Related

- `../errors/aisearch-errors.md` - AI error handling patterns
- `../../development/ai/errors/ai-error-handling.md` - AI error patterns
