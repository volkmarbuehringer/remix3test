<!-- Context: development/remix3/packages/concepts | Priority: high | Version: 1.0 | Updated: 2026-05-20 -->

# Concept: Remix (Metapackage)

**Purpose**: The `remix` npm package is the single entry point for all Remix sub-packages. Install once, access all APIs through `remix/*` import paths. Also provides the CLI for project scaffolding, diagnostics, and route inspection.

**Key Points**:
- Single install: `npm i remix` gives you all packages under `remix/*` imports
- CLI commands: `new`, `completion`, `doctor`, `routes`, `test`, `version`
- Programmatic API via `runRemix()` from `remix/cli`
- `remix doctor` checks project environment and conventions (with `--fix` for auto-repair)
- `remix routes` inspects the route tree (`--table` for tabular output)

**Minimal Example**:
```sh
npx remix@next new my-app
cd my-app && npm i remix
remix doctor
remix routes --table
```

**Programmatic CLI**:
```ts
import { runRemix } from 'remix/cli'
await runRemix(['new', 'my-remix-app'])
await runRemix(['doctor', '--fix'])
```

**Reference**: `/home/lucky/remix/packages/remix/README.md`
