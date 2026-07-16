## 1. Install oxfmt and remove prettier

- [x] 1.1 Run `pnpm remove prettier` to uninstall prettier
- [x] 1.2 Run `pnpm add -D oxfmt` to install oxfmt (installed v0.59.0)

## 2. Create `oxfmt.config.ts`

- [x] 2.1 Create `oxfmt.config.ts` at project root with:
  - `printWidth: 100`, `semi: false`, `singleQuote: true`, `useTabs: false`
  - `ignorePatterns: ['node_modules/', '.mastra/']`
  - Import `defineConfig` from `oxfmt`

## 3. Remove `.prettierrc`

- [x] 3.1 Delete `.prettierrc`

## 4. Update `package.json` scripts

- [x] 4.1 Change `"format"` from `"prettier --check app/"` to `"oxfmt . --check"`
- [x] 4.2 Change `"format:fix"` from `"prettier --write app/"` to `"oxfmt . --write"`

## 5. Set up VS Code integration

- [x] 5.1 Create `.vscode/extensions.json` recommending `"oxc.oxc-vscode"`
- [x] 5.2 Create `.vscode/settings.json` with `editor.defaultFormatter: "oxc.oxc-vscode"` for all languages

## 6. Update AGENTS.md

- [x] 6.1 Change "Prettier" reference to "Oxfmt" (with matching config description)

## 7. Re-format all files

- [x] 7.1 Run `pnpm format:fix` to apply oxfmt across the codebase (1697 files)
- [x] 7.2 Verify no files remain unformatted: `pnpm format`

## 8. Verify

- [x] 8.1 Run `pnpm typecheck` — passes with zero errors
- [x] 8.2 Run `pnpm test` — 483/523 pass, 40 pre-existing Mastra PG partition failures (unrelated)
- [x] 8.3 Run `pnpm lint` — passes with zero warnings
