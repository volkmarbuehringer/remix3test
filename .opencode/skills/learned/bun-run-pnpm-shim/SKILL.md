---
name: bun-run-pnpm-shim
description: "Use when `bun run <bin>` silently runs Node instead of Bun in a pnpm project (Bun-only flags/behavior have no effect, `process.versions.bun` is undefined) — pnpm's `.bin` shim `exec`s node; use `bun --bun run <bin>` or the package's dist entry."
user-invocable: false
origin: auto-extracted
---

# `bun run <bin>` Silently Runs Node in pnpm Projects

**Extracted:** 2026-09-19
**Context:** Any pnpm-managed Node project where you launch an existing CLI (test runner, bundler, dev server) under Bun. Observed with pnpm 11 + Bun 1.4.2 running the `remix test` CLI (remix 3.0.0-rc.3).

## Problem
`bun run <bin>` looks like it forces Bun, but pnpm generates `node_modules/.bin/<bin>` as a `/bin/sh` shim whose final line is `exec node <entry> "$@"` (falling back to `exec "$basedir/node"` when a local Node exists). Bun runs the shim as a shell script, which hands off to Node. The CLI — and anything it forks — runs under Node, so `process.versions.bun` is undefined and every `IS_BUN`-gated branch stays off. Nothing errors and output can look identical, so the fall-back is silent.

## Solution
Force the runtime, or bypass the shim entirely:

```sh
# A) force Bun for the resolved bin
bun --bun run <bin> <args>

# B) invoke the package's real entry file directly
bun node_modules/<pkg>/dist/<cli>.js <args>
```

Find the real entry in the package's `package.json` `bin` field.

Observed with `remix test`: `bun run remix test …` ran Node (Node's `module.register()` DEP0205 warning appeared), while `bun --bun run remix test …` ran Bun (no such warning, `process.versions.bun` set).

Detect a silent Node fall-back:
- The target prints a Node version, or `process.versions.bun` is undefined.
- A Bun-specific branch doesn't fire (e.g. `@remix-run/test`'s `IS_BUN` skips the Node coverage loader under Bun).

Caveats:
- `bunx <bin>` resolves local bins through the same `.bin` shims — treat it as affected and verify.
- `bun run <script>` for a `package.json` script is fine when that script's own command is `bun …`; the trap is the resolved-bin shim.

## When to Use
- `bun run <bin>` runs, but Bun-only behavior, flags, or speedups don't apply.
- A CLI behaves like Node at runtime although you launched it with Bun.
- Wiring a `test:bun` / `dev:bun` script around an existing Node CLI.
