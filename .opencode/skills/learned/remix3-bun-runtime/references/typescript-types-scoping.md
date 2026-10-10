# Scope `@types/bun` in a Dedicated TypeScript Program

**Source:** `remix3-bun-runtime`

**Extracted:** 2026-09-19

**Context:** Adding Bun types to a Remix 3 app's typecheck.

## Problem

Bun's global `fetch` type requires a `preconnect` property, so bundling `"bun"` into the app program breaks every test that mocks `fetch`: `TS2322 … Property 'preconnect' is missing in type … but required in type 'typeof fetch'`.

## Solution

Use a dedicated program instead:

- `tsconfig.json`: keep `types: ["node", "remix/assets/types/hmr"]`; add `"exclude": ["server.bun.ts"]`.
- `tsconfig.bun.json`: `extends` the base, `types: ["node", "bun", …]`, `files: ["server.bun.ts"]`.
- `typecheck`: `tsc --noEmit && tsc -p tsconfig.bun.json --noEmit`.
- `typecheck:bun` (opt-in): `bun check && bun check -p tsconfig.bun.json`.

## Bun-native check (Bun ≥ 1.4.3)

`bun check` uses the TypeScript 7 checker on all CPU cores and reads the same tsconfig programs, so it mirrors the two-`tsc` pair without needing the `typescript` package. Keep Node-first `typecheck` as the default; Bun stays opt-in.

Verified on Bun 1.4.3 + `typescript@7.0.2`: identical errors to `tsc --noEmit` (including `noUncheckedIndexedAccess`), ~1.4s for both programs vs ~16s for the two `tsc` runs. It only checks (no emit), exits `1` on errors (tsc exits `2`), and exits non-zero on an empty program.
