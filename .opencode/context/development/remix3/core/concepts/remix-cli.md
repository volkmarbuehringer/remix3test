<!-- Context: development/remix3/core/concepts/remix-cli | Priority: medium | Version: 1.0 | Updated: 2026-04-29 -->

# Concept: Remix CLI

**Core Idea**: The Remix CLI creates and manages Remix projects — scaffolding new apps, checking environment health, syncing skills, running tests, and inspecting routes. Available as `npx remix@next` or the installed `remix` command, and programmatically via `runRemix()` from `remix/cli`.

**Key Points**:
- **Scaffold projects**: `remix new <dir>` creates a starter app matching Remix project layout conventions
- **Inspect routes**: `remix routes` prints the current route tree (with optional `--table` format)
- **Diagnose projects**: `remix doctor` checks environment and conventions; `--fix` creates low-risk project files
- **Manage skills**: `remix skills` syncs Remix skills into `.agents/skills/`
- **Programmatic API**: `runRemix(argv)` returns exit code as a promise — use `import { runRemix } from 'remix/cli'`

**Quick Example**:
```ts
import { runRemix } from 'remix/cli'

// Scaffold a new project
await runRemix(['new', 'my-remix-app'])
// Check project health
let exitCode = await runRemix(['doctor', '--fix'])
```

**Reference**: `packages/cli/README.md`

**Related**:
- guides/cli-setup.md — Installation and usage guide
- lookup/cli-commands.md — Command reference table
- examples/cli-usage.md — CLI and programmatic usage examples
