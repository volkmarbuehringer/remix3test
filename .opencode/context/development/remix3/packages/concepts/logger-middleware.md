<!-- Context: development/remix3/packages/concepts | Priority: medium | Version: 1.1 | Updated: 2026-05-20 -->

# Concept: Logger Middleware

**Purpose**: HTTP request/response logging middleware with customizable output formats. Exposes the configured logger on request context.

**Key Points**:
- Logs method, path, status, response metadata with configurable format
- `context.logger(message)` (or `context.get(Logger)(message)`) for app logs using configured logger
- 18 format tokens: %date, %dateISO, %duration, %contentLength, %contentType, %host, %hostname, %method, %path, %pathname, %port, %query, %referer, %search, %status, %statusText, %url, %userAgent
- Colorized output auto-detects TTY (respects CI, NO_COLOR, FORCE_COLOR, TERM=dumb); set `colors: true/false` to override
- Apache combined log format: `'%host - - [%date] "%method %path" %status %contentLength "%referer" "%userAgent"'`
- Custom `log(message)` option for file/stream output

**Minimal Example**:
```ts
import { logger } from 'remix/middleware/logger'

let router = createRouter({
  middleware: [logger({ format: '%method %path - %status (%duration ms)' })],
})

router.get('/users/:id', (context) => {
  context.logger(`Loading user ${context.params.id}`)
  return Response.json(loadUser(context.params.id))
})
// Logs: GET /users/123 - 200 (42 ms)
```

**Reference**: https://github.com/remix-run/remix/tree/main/packages/logger-middleware
