## Why

The app currently uses Prettier for code formatting but already relies on `oxlint` for linting. The upstream `remix` monorepo just completed this same migration (commit `b7065c769`), and the benefits carry over:

- **One tool for lint + format** — oxfmt and oxlint share the same engine (oxc), one install, one config, one parser
- **Performance** — oxfmt is ~10-50x faster than Prettier on large codebases
- **Consistency** — matches the lint tool already in use (`oxlint`), same AST, same parser behavior, no formatting-vs-linting disagreements
- **Simpler dependency tree** — remove Prettier and its transitive deps

## What Changes

- Remove `.prettierrc` config file
- Add `oxfmt.config.ts` config file (same printWidth/semi/singleQuote settings)
- Add `oxfmt` as a devDependency, remove `prettier`
- Update `package.json` scripts: `format` → `oxfmt --check .`, `format:fix` → `oxfmt --write .`
- Update `AGENTS.md` to reference Oxfmt instead of Prettier
- Add `.vscode/extensions.json` recommending `oxc.oxc-vscode`
- Add `.vscode/settings.json` mapping all languages to oxfmt as default formatter
- Re-format all files with oxfmt to normalize any formatting differences

## Non-Goals

- Changing the lint configuration (already using oxlint, staying with it)
- Changing print width, quote style, semicolons, or any formatting options — preserving existing settings exactly
- Touching `node_modules/` or generated files
