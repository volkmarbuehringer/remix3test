# SuperHeaders Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace raw `headers.set('Name', value)` calls with typed SuperHeaders property accessors in 4 files.

**Architecture:** Each file change is independent — no shared state, no sequential dependencies. Can be done in any order.

**Tech Stack:** Remix 3, `remix/headers` (SuperHeaders, Accept, AcceptEncoding, SetCookie, CacheControl)

---

### Task 1: SSE channel headers (`app/lib/sse.ts`)

**File:** `app/lib/sse.ts:120-124`

- [ ] **Replace Content-Type and Cache-Control with SuperHeaders**

Current:

```ts
let headers = new Headers()
headers.set('Content-Type', 'text/event-stream')
headers.set('Cache-Control', 'no-cache')
headers.set('Connection', 'keep-alive')
headers.set('X-Accel-Buffering', 'no')
```

Replace with:

```ts
let headers = new Headers()
headers.contentType = { mediaType: 'text/event-stream' }
headers.cacheControl = { noCache: true }
headers.set('Connection', 'keep-alive')
headers.set('X-Accel-Buffering', 'no')
```

No new imports needed — SuperHeaders extends `Headers`, property accessors are built-in.

- [ ] **Run tests to verify**

Run: `npm test`
Expected: All existing SSE tests pass (they assert exact header values in `app/lib/sse.test.ts`).

- [ ] **Commit**

```bash
git add app/lib/sse.ts
git commit -m "refactor: use SuperHeaders for SSE Content-Type and Cache-Control"
```

---

### Task 2: Frame resolve headers (`app/middleware/render.tsx`)

**File:** `app/middleware/render.tsx:1,51-58`

- [ ] **Add imports**

Add to top of file:

```ts
import { Accept, AcceptEncoding } from 'remix/headers'
```

- [ ] **Replace Accept and Accept-Encoding with SuperHeaders**

Current:

```ts
let headers = new Headers()
headers.set('Accept', 'text/html')
headers.set('Accept-Encoding', 'identity')
headers.set('X-Remix-Frame', 'true')
```

Replace with:

```ts
let headers = new Headers()
headers.accept = new Accept('text/html')
headers.acceptEncoding = new AcceptEncoding('identity')
headers.set('X-Remix-Frame', 'true')
```

- [ ] **Run tests to verify**

Run: `npm test`
Expected: All existing render/router tests pass.

- [ ] **Commit**

```bash
git add app/middleware/render.tsx
git commit -m "refactor: use SuperHeaders for Accept and Accept-Encoding headers"
```

---

### Task 3: Fragment Cache-Control (`app/middleware/render.tsx`)

**File:** `app/middleware/render.tsx:99-104`

- [ ] **Replace Cache-Control set with SuperHeaders**

Current:

```ts
export function fragmentResponseInit(init?: ResponseInit): ResponseInit {
  let headers = new Headers(init?.headers)
  if (!headers.has('Cache-Control')) {
    headers.set('Cache-Control', 'no-store')
  }
  return { ...init, headers }
}
```

Replace with:

```ts
export function fragmentResponseInit(init?: ResponseInit): ResponseInit {
  let headers = new Headers(init?.headers)
  if (!headers.cacheControl) {
    headers.cacheControl = { noStore: true }
  }
  return { ...init, headers }
}
```

No new imports needed.

- [ ] **Run tests to verify**

Run: `npm test`
Expected: All existing tests pass.

- [ ] **Commit**

```bash
git add app/middleware/render.tsx
git commit -m "refactor: use SuperHeaders for fragment Cache-Control"
```

---

### Task 4: Set-Cookie parsing in test-utils (`app/test-utils.ts`)

**File:** `app/test-utils.ts:159-166`

- [ ] **Add import**

Add to top of file:

```ts
import { SetCookie } from 'remix/headers'
```

- [ ] **Replace manual Set-Cookie parsing**

Current:

```ts
export function extractCookie(response: Response): string {
  let setCookie = response.headers.get('Set-Cookie')
  if (!setCookie) return ''
  return setCookie.split(';')[0]
}
```

Replace with:

```ts
export function extractCookie(response: Response): string {
  let parsed = SetCookie.from(response.headers.get('Set-Cookie'))
  if (!parsed.name) return ''
  return `${parsed.name}=${parsed.value ?? ''}`
}
```

- [ ] **Run tests to verify**

Run: `npm test`
Expected: All existing tests pass (extractCookie is used in test-utils and auth tests).

- [ ] **Commit**

```bash
git add app/test-utils.ts
git commit -m "refactor: use SuperHeaders SetCookie for typed cookie parsing"
```
