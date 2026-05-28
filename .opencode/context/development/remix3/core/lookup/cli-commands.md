<!-- Context: development/remix3/lookup/cli-commands | Priority: medium | Version: 1.0 | Updated: 2026-04-29 -->

# Lookup: Remix CLI Commands

## Command Reference

| Command | Description | Flags |
|---------|-------------|-------|
| `new <dir>` | Scaffold a new Remix project | — |
| `completion <shell>` | Print shell completion script | `bash`, `zsh` |
| `doctor` | Check project env + conventions | `--fix`, `--no-color` |
| `routes` | Inspect route tree | `--table`, `--no-headers` |
| `skills install` | Sync Remix skills into `.agents/skills` | — |
| `test` | Run project tests | — |
| `version` | Print current Remix version | — |

## Programmatic API

```ts
import { runRemix } from 'remix/cli'

// Type signature
runRemix(argv: string[]): Promise<number>
```

`runRemix()` accepts an array of CLI arguments (excluding the `remix` binary name) and returns a promise that resolves to the exit code (0 for success).

### Supported Calls

```ts
await runRemix(['new', 'my-remix-app'])
await runRemix(['completion', 'bash'])
await runRemix(['doctor'])
await runRemix(['doctor', '--fix'])
await runRemix(['routes'])
await runRemix(['routes', '--table'])
await runRemix(['routes', '--table', '--no-headers'])
await runRemix(['skills', 'list'])
await runRemix(['test'])
await runRemix(['version'])
await runRemix(['--no-color', 'doctor'])
```

**Reference**: `packages/cli/README.md`

**Related**:
- guides/cli-setup.md — Installation and usage guide
- ../concepts/remix-cli.md — CLI concept overview
- examples/cli-usage.md — CLI usage examples
