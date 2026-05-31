<!-- Context: development/remix3/guides/cli-setup | Priority: medium | Version: 1.0 | Updated: 2026-04-29 -->

# Guide: Remix CLI Setup and Usage

**Goal**: Install and use the Remix CLI to scaffold and manage projects.

## Installation

Scaffold without installing globally:
```sh
npx remix@next new my-remix-app
```

Install for local `remix` command:
```sh
npm i remix
remix new my-remix-app
```

## Shell Completion

Install bash or zsh completion scripts:
```sh
remix completion bash >> ~/.bashrc
remix completion zsh >> ~/.zshrc
```

## Available Commands

| Command | Description |
|---------|-------------|
| `remix new <dir>` | Scaffold a new Remix project |
| `remix completion <shell>` | Print shell completion script |
| `remix doctor` | Check project environment and conventions |
| `remix doctor --fix` | Create low-risk project and controller files |
| `remix routes` | Inspect route tree |
| `remix routes --table` | Route tree in table format |
| `remix routes --table --no-headers` | Table without column headers |
| `remix skills install` | Sync Remix skills into `.agents/skills` |
| `remix test` | Run project tests |
| `remix version` | Print current Remix version |

## Programmatic Usage

```ts
import { runRemix } from 'remix/cli'

// runRemix returns exit code (0 = success)
let code = await runRemix(['new', 'my-remix-app'])
```

All CLI commands are available as array arguments to `runRemix()`.

**Reference**: `packages/cli/README.md`

**Related**:
- ../concepts/remix-cli.md — CLI concept overview
- lookup/cli-commands.md — Command reference
- examples/cli-usage.md — CLI usage examples
