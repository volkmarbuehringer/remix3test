# Rendered-HTML content-model conformance with html-validate

**Applies to:** html-validate 11.16.2 (devDependency), Remix 3 server tests.
See `.htmlvalidate.json`, `app/html-conformance.test.ts`.

## Why

`remix-a11y/no-nested-interactive` (`scripts/oxlint-plugins/no-nested-interactive-plugin.ts`)
only walks literal JSX in app source. A component prop (`<a>{children}</a>`) or a raw
`remix/html-template` string bypasses it. Validating the actual `router.fetch(...)`
response with `element-permitted-content` closes the gap (bug class 553bbc4, 0bd7076).

## Config and API (verified against the installed types)

- `.htmlvalidate.json` MUST set `"extends": []`. Without it the loader default is
  `Config.defaultConfig()` = `{ extends: ["html-validate:recommended"] }`, so every
  recommended rule fires and buries `element-permitted-content`.
- `new HtmlValidate()` uses that built-in preset and **never reads `.htmlvalidate.json`**.
  Read the file with `new HtmlValidate(new FileSystemConfigLoader())`; the CLI
  (`node node_modules/html-validate/bin/html-validate.mjs file.html`) does read it.
- `FileSystemConfigLoader` is **asynchronous**: `validateStringSync` throws
  `Cannot use asynchronous config loader with synchronous api`. Use
  `await hv.validateString(html, absoluteFilename)` with a path under the repo root so
  discovery does not depend on the runner cwd.
- `MIN(uuid)` does not exist in Postgres; resolve `?editing=<id>` with
  ``SELECT id FROM ${table} ORDER BY id LIMIT 1`` (`webhook_requests.id` is UUID).

## Frame `<head>` artifacts

The render runtime streams scoped styles as an inline `<head>` block right after the
`<!-- rmx:f:HASH -->` frame marker, so html-validate reports `<head>` under a body
element. Strip every head block — only body content models are in scope:

```ts
let documentHtml = html.replace(/<head>[\s\S]*?<\/head>/g, '')
```

## Shape of the test

- `before()`: `initializeAppDatabase()`, admin/user cookies via
  `createAuthCookieWithCsrfForUser(email)`.
- Fetch each curated route; assert `response.status === 200` and
  `html.includes('<html')` (frame fragments are not documents).
- Collect every `report.results[].messages` entry (ruleId, message, line, column) and
  assert zero at the end so the failing element is visible in one run.
- Pair it with a negative case: `<a href="#"><button>x</button></a>` must be invalid and
  include `element-permitted-content` — a checker that cannot fail is worthless.
- Dev-only: no runtime import; `remix.json` `denyFiles: ["app/**/*.test.*"]` keeps the
  test and the devDependency out of the asset graph.

## What it caught

- `<h2>` inside the admin `NavCard` `<span>` (fixed: `<div>`).
- `ConnectionIndicator`'s inline `<style>` inside its `<div>` (fixed: `sse-pulse`
  keyframes moved to the document shell in `app/ui/document.tsx`).

## Cross-reference

`remix3-rendering-ui/references/first-party-ui-blocks.md` owns the `<a><button>` bug
class and the `buttonLink()` fix; this check is additive to the AST rule.
