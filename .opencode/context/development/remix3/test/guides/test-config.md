# Guide: Test Configuration

**Purpose**: Configure the remix-test CLI via config file or CLI flags

## Config File

Create `remix-test.config.ts` at project root:

```ts
import type { RemixTestConfig } from 'remix/test'

export default {
  // Test file globs
  glob: {
    test: '**/*.test?(.e2e).ts',    // Unit tests
    e2e: '**/*.test.e2e.ts',        // E2E tests
  },

  // Test types to run
  type: 'server,e2e',    // "server", "e2e", or "server,e2e"

  // Concurrency
  concurrency: 2,

  // Coverage
  coverage: {
    enabled: true,
    dir: '.coverage',
    include: ['src/**'],
    exclude: ['src/**/*.test.ts'],
    statements: 80,
    lines: 80,
    branches: 80,
    functions: 80,
  },

  // Test reporters: spec, files, tap, dot
  reporter: 'spec',

  // Watch mode
  watch: false,

  // Setup/teardown
  setup: './test/setup.ts',
} satisfies RemixTestConfig
```

## Setup Module

```ts
// ./test/setup.ts
export async function globalSetup() {
  await db.migrate()
}

export async function globalTeardown() {
  await db.close()
}
```

## CLI Flags

| Flag | Short | Description |
|------|-------|-------------|
| `--config <path>` | | Config file location |
| `--type <name>` | `-t` | Test type: server, e2e |
| `--concurrency <n>` | `-c` | Parallel workers |
| `--project <name>` | `-p` | Playwright project |
| `--reporter <name>` | `-r` | Reporter name |
| `--watch` | `-w` | Watch mode |
| `--coverage` | | Enable coverage |
| `--glob.test <pattern>` | | Override test glob |
| `--setup <path>` | `-s` | Setup file |

**Reference**: `packages/test/README.md` (lines 51-155)

**Related**: concepts/testing-overview.md, guides/e2e-testing.md