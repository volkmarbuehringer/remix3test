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
