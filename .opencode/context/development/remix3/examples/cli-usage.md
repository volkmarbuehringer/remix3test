<!-- Context: development/remix3/examples/cli-usage | Priority: medium | Version: 1.0 | Updated: 2026-04-29 -->

# Example: CLI Usage

**Goal**: Demonstrate common CLI commands and programmatic usage.

## CLI Commands

```sh
# Scaffold a new project
remix new my-remix-app

# Install shell completion
remix completion bash >> ~/.bashrc
remix completion zsh >> ~/.zshrc

# Check project health
remix doctor
remix doctor --fix

# Inspect route tree
remix routes
remix routes --table
remix routes --table --no-headers

# Sync skills
remix skills install

# Run tests
remix test

# Check version
remix version
```

## Programmatic Usage

```ts
import { runRemix } from 'remix/cli'

// Scaffold
let code = await runRemix(['new', 'my-remix-app'])

// Doctor with fix + no color
await runRemix(['--no-color', 'doctor', '--fix'])

// Routes in table format
await runRemix(['routes', '--table'])

// exit code 0 = success
console.log(code) // 0
```

**Reference**: `packages/cli/README.md`

**Related**:
- guides/cli-setup.md — CLI setup and usage guide
- lookup/cli-commands.md — Command reference
- ../core/concepts/remix-cli.md — CLI concept overview
