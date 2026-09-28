---
name: remix3-bun-runtime
description: "Use when running a Remix 3 app or its `remix test` suite under Bun, or when a page/test passes under Node but fails under Bun — `TypeError: Type error` from a `handle.frame` listener, uploads rejected as `Dateityp nicht erlaubt.`, or `@types/bun` breaking the app typecheck."
user-invocable: false
origin: consolidated
---

# Remix 3 on Bun — Entrypoint, Tests, and Node↔Bun Divergences

**Consolidated from:** `bun-run-pnpm-shim`

**Extracted:** 2026-09-19
**Context:** Adding Bun as a second runtime to this Remix 3 + pnpm app (remix `3.0.0-rc.3`; `@remix-run/ui` 0.10.0; Bun 1.4.2). Node stays runtime #1; Bun is opt-in via `pnpm dev:bun` / `start:bun` / `test:bun`. Re-validate version-pinned claims against `node_modules/.pnpm/@remix-run+*` and the installed Bun — the current line refs and pass/fail result live in `references/validation-and-result.md`.

This skill is the **index** for running this Remix 3 + pnpm app under Bun. For the runtime APIs themselves, use the vendor `remix` skill (`.opencode/skills/remix/SKILL.md`) and the package READMEs it points at.

## Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| `server.bun.ts`, sharing the router/DB pipeline, or `X-Client-Ip` from `requestIP()` | `references/entrypoint-and-shared-handler.md` |
| `test:bun`, `IS_BUN`, `--coverage` under Bun, or which parts of the suite change | `references/test-runner-and-bun-awareness.md` |
| `TypeError: Type error` from `addEventListener(..., { signal: handle.signal })` during SSR | `references/ssr-signal-eventtarget.md` |
| Uploads rejected under Bun only (`Dateityp nicht erlaubt.`); `File.type` gains `;charset=utf-8` | `references/file-mime-charset.md` |
| `@types/bun` breaking the main typecheck (`Property 'preconnect' is missing`) | `references/typescript-types-scoping.md` |
| `bun run <bin>` silently executing Node in a pnpm project | `references/pnpm-bin-shim.md` |
| Re-validating the version-pinned claims, or the suite's Bun pass/fail result | `references/validation-and-result.md` |

## Core Rules

**Entrypoint (`references/entrypoint-and-shared-handler.md`)**

- `server.bun.ts` must reuse `server.ts`'s router/DB bootstrap through one shared `createServerHandler(router)`; the only Bun-specific part is reading the trusted socket address from `runtime.requestIP(request)?.address` in `fetch(request, runtime)`. Bun auto-loads `.env` (no `--env-file`).

**Test runner (`references/test-runner-and-bun-awareness.md`)**

- `"test:bun": "NODE_ENV=test bun node_modules/remix/dist/cli-entry.js test"` — plain `bun run remix test` runs Node through the pnpm shim. `@remix-run/test` is Bun-aware (`IS_BUN`): native `Glob` discovery, skips `@remix-run/node-tsx`, and skips the Node V8 coverage loader, so `--coverage` is not meaningful under Bun.

**SSR signal (`references/ssr-signal-eventtarget.md`)**

- `handle.signal` is a frozen plain object during SSR, not an `AbortSignal`; Bun's `EventTarget` throws `TypeError: Type error` on `{ signal: handle.signal }`. Guard any registration that can run during SSR with `typeof document !== 'undefined'`.

**File MIME (`references/file-mime-charset.md`)**

- Bun's `File.type` appends `;charset=utf-8`, so exact-match allowlists reject valid uploads. Normalize through `ContentType.from(mime).mediaType?.toLowerCase()`.

**TypeScript types (`references/typescript-types-scoping.md`)**

- Never add `"bun"` to the main `tsconfig` `types` (Bun's `fetch` requires `preconnect`, breaking `fetch` mocks). Use `tsconfig.bun.json` with `files: ["server.bun.ts"]` and exclude `server.bun.ts` from the base.

**pnpm bin shim (`references/pnpm-bin-shim.md`)**

- `bun run <bin>` resolves through `node_modules/.bin/<bin>`, a `/bin/sh` shim ending in `exec node …`, so it silently runs Node. Force Bun with `bun --bun run <bin>`, or invoke the package's real dist entry.

## When to Use

- Adding or debugging `server.bun.ts`, `pnpm dev:bun` / `start:bun` / `test:bun`.
- A Remix 3 page renders under Node but throws `TypeError: Type error` under Bun.
- Uploads are rejected under Bun even though the file type is allowed.
- `tsc` breaks with `Property 'preconnect' is missing` after adding Bun types.
- A CLI launched with `bun run <bin>` behaves like Node at runtime.

## Related Skills

- vendor `remix` skill (`.opencode/skills/remix/SKILL.md`) — canonical runtime/entrypoint APIs
- `security-gotchas` (`references/two-tier-ip-trust-model.md`) — why the `requestIP()` socket tier keeps `X-Client-Ip` unspoofable
- `remix3-build-and-tooling` — the `node-tsx` loader and `@types/bun` interaction; asset-server/dev-server wiring
- `remix3-testing` — the Remix 3 test-suite patterns this runner executes
