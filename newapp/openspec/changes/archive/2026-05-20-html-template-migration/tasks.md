## 1. app/middleware/admin.ts — 403 Forbidden page

- [x] 1.1 Add `import { html } from 'remix/html-template'` to the import block
- [x] 1.2 Wrap the 403 HTML template string with `html\`...\`` and convert via `String()` in the `new Response(...)` call

## 2. app/middleware/auth.ts — Frame-level 401 response

- [x] 2.1 Add `import { html } from 'remix/html-template'` to the import block
- [x] 2.2 Wrap the 401 HTML string with `html\`...\`` and convert via `String()` in the `new Response(...)` call

## 3. app/middleware/render.tsx — Frame error fallback

- [x] 3.1 Add `import { html } from 'remix/html-template'` to the import block
- [x] 3.2 Replace the template literal `` `<pre>Frame error: ${response.status} ${response.statusText}</pre>` `` with `String(html\`<pre>Frame error: ${response.status} ${response.statusText}</pre>\`)`

## 4. Verification

- [x] 4.1 Run `pnpm run typecheck` to confirm no type errors
- [x] 4.2 Run `pnpm run lint` to confirm no lint warnings
- [x] 4.3 Run the existing middleware and router tests to confirm no regressions
