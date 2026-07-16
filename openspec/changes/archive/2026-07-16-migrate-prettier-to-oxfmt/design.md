## Context

The app's formatting pipeline today:

```
npm run format   → prettier --check app/
npm run format:fix → prettier --write app/
```

With oxfmt, the same becomes:

```
npm run format   → oxfmt . --check
npm run format:fix → oxfmt . --write
```

Key difference: `prettier --check app/` only checked `app/`, while oxfmt operates from the project root. We'll scope it with `oxfmt.config.ts` ignorePatterns instead.

The upstream remix repo's `oxfmt.config.ts` uses identical `printWidth: 100, semi: false, singleQuote: true, useTabs: false` — matching this app's `.prettierrc` exactly. So the actual formatting output should be nearly identical, with only minor differences in edge cases.

## Files to Change

| File                      | Action                                      |
| ------------------------- | ------------------------------------------- |
| `.prettierrc`             | Delete                                      |
| `oxfmt.config.ts`         | Create new                                  |
| `package.json`            | Update scripts, devDependencies             |
| `AGENTS.md`               | Update formatting reference                 |
| `.vscode/extensions.json` | Create new (recommend oxc-vscode)           |
| `.vscode/settings.json`   | Create new (set oxfmt as default formatter) |

## Config (oxfmt.config.ts)

```ts
import { defineConfig } from 'oxfmt'

export default defineConfig({
  printWidth: 100,
  semi: false,
  singleQuote: true,
  useTabs: false,
  ignorePatterns: ['node_modules/', '.mastra/'],
})
```

The `ignorePatterns` mirrors the existing `--ignore-pattern=.mastra` used by `oxlint` in CI.

## VS Code Integration

Following the upstream migration, create `.vscode/extensions.json` recommending `oxc.oxc-vscode`, and `.vscode/settings.json` that sets `editor.defaultFormatter` to `oxc.oxc-vscode` for all languages (css, html, javascript, javascriptreact, json, jsonc, markdown, scss, typescript, typescriptreact, yaml).

## Risks

- **Formatting diff noise** — The initial `oxfmt --write` pass will produce diffs across all files in `app/`. These are purely cosmetic. Recommend committing the formatter change and the format diff as one commit so `git blame` isn't permanently polluted.
- **Oxfmt may handle edge cases differently** — Prettier and oxfmt don't guarantee identical output for the same config. The diff will show the exact differences. Expected to be minimal given matching config.
