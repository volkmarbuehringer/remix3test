## 1. server.ts — 500 Internal Server Error

- [x] 1.1 Add `import { html } from 'remix/html-template'` at the top of `server.ts`
- [x] 1.2 Replace the plain-text 500 response with `String(html\`...\`)` returning a complete HTML document with inline CSS, heading "Serverfehler" and message "Bitte versuchen Sie es später erneut."
- [x] 1.3 Add Content-Type `text/html; charset=utf-8` header to the 500 response

## 2. global-rate-limit.ts — 429 Too Many Requests

- [x] 2.1 Add `import { html } from 'remix/html-template'` at the top of `app/middleware/global-rate-limit.ts`
- [x] 2.2 Replace the plain-text 429 response with `String(html\`...\`)` returning a complete HTML document with inline CSS, heading "Zu viele Anfragen", an explanation message, and the retry-after duration interpolated as "Wiederholen in ${retryAfter} Sekunden"
- [x] 2.3 Change `Content-Type` header from `text/plain` to `text/html`

## 3. Verification

- [x] 3.1 Run `npm run typecheck` to verify no type errors
- [x] 3.2 Run `npm test` to verify existing tests still pass
