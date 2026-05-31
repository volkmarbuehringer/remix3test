<!-- Context: development/remix3/packages/concepts | Priority: high | Version: 1.0 | Updated: 2026-05-20 -->

# Concept: CLI

**Purpose**: Command-line interface for creating and managing Remix projects. Scaffolds apps, checks project health, inspects routes, and runs tests.

**Key Points**:
- `remix new <target-dir>` — scaffold a new Remix app (conventions-matched project layout)
- `remix doctor` — check project environment and conventions; `--fix` creates low-risk files
- `remix routes` — inspect route tree; `--table` for tabular output; `--no-headers` for scripting
- `remix test` — run project tests
- `remix version` — print current Remix version
- `remix completion bash` / `zsh` — install shell completion
- Programmatic: `import { runRemix } from 'remix/cli'` — returns exit code as promise

**Minimal Example**:
```sh
remix new my-app
cd my-app
remix doctor --fix
remix routes --table
```

**Programmatic**:
```ts
import { runRemix } from 'remix/cli'
let code = await runRemix(['routes', '--table'])
```

**Reference**: `/home/lucky/remix/packages/cli/README.md`
