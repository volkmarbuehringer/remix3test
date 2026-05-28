# Lookup: RemixTestConfig Type

**Purpose**: Complete type definition for `remix-test.config.ts`

## Interface

```ts
interface RemixTestConfig {
  // Browser options
  browser?: {
    echo?: boolean    // Echo browser console to stdout
    open?: boolean   // Keep browser open after tests
  }

  // Test file globs
  glob?: {
    test?: string    // Unit test pattern (default: "**/*.test?(.e2e).ts")
    e2e?: string     // E2E test pattern (default: "**/*.test.e2e.ts")
    exclude?: string // Patterns to exclude
  }

  // Parallel workers (default: os.availableParallelism())
  concurrency?: number | string

  // Coverage settings
  coverage?:
    | boolean
    | {
        dir?: string
        include?: string[]
        exclude?: string[]
        statements?: number | string
        lines?: number | string
        branches?: number | string
        functions?: number | string
      }

  // Setup/teardown module
  setup?: string

  // Playwright config (inline or path)
  playwrightConfig?: string | PlaywrightTestConfig

  // Run specific projects
  project?: string

  // Reporter: spec, files, tap, dot
  reporter?: string

  // Test types: server, e2e, server,e2e
  type?: string

  // Watch mode
  watch?: boolean
}
```

## Example Config

```ts
import type { RemixTestConfig } from 'remix/test'

export default {
  browser: { echo: true, open: false },
  glob: {
    test: '**/*.test?(.e2e).ts',
    e2e: '**/*.test.e2e.ts',
    exclude: ['**/node_modules/**']
  },
  concurrency: 4,
  coverage: { enabled: true, dir: '.coverage', statements: 80 },
  playwrightConfig: { projects: [{ name: 'chromium' }] },
  project: 'chromium',
  reporter: 'spec',
  type: 'server,e2e',
  watch: false,
} satisfies RemixTestConfig
```

**Reference**: `packages/test/src/lib/config.ts` (lines 134-190)

**Related**: guides/test-config.md