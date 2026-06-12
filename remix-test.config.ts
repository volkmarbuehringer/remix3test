import type { PlaywrightTestConfig } from 'playwright/test'
import type { RemixTestConfig } from 'remix/test'

export default {
  // Browser options for E2E tests
  browser: {
    // Echo browser console output to the terminal
    echo: false,
    // Open browser (via playwright `headless:false`) and keep it open after tests
    // complete (useful for debugging)
    open: false,
  },

  // Max number of concurrent test workers (default `os.availableParallelism()`)
  concurrency: 6,

  // Pool for server and E2E test files ("forks", "threads")
  pool: 'forks',

  // Code coverage options (set to `true` to enable with defaults, or an object for settings)
  coverage: {
    // Output directory (default: ".coverage")
    dir: '.coverage',
    // Glob pattern(s) to include/exclude
    include: 'app/**',
    exclude: 'app/**/*.test.ts',
    // Minimum thresholds (%)
    statements: 80,
    lines: 80,
    branches: 80,
    functions: 80,
  },

  // Glob pattern(s) identifying test files
  glob: {
    // All test files (default: "**/*.test{,.browser,.e2e}.{ts,tsx}").
    test: '**/*.test{,.browser,.e2e}.ts',
    // Browser test files (default: "**/*.test.browser.{ts,tsx}")
    browser: '**/*.test.browser.ts',
    // E2E test files (default: "**/*.test.e2e.{ts,tsx}")
    e2e: '**/*.test.e2e.ts',
  },

  // Playwright configuration for E2E tests, or string path to an existing
  // config file on disk
  playwrightConfig: {
    projects: [
      { name: 'chromium', use: { browserName: 'chromium' } },
      { name: 'firefox', use: { browserName: 'firefox' } },
    ],
    use: {
      navigationTimeout: 5_000,
      actionTimeout: 5_000,
    },
  },

  // Playwright project(s) to run E2E tests for
  project: 'chromium',

  // Test reporter ("spec", "files", "tap", "dot")
  reporter: 'spec',

  // Path to a setup module (exports globalSetup / globalTeardown)
  setup: './test/setup.ts',

  // Test type(s) to run ("server", "browser", "e2e")
  type: ['server', 'browser', 'e2e'],

  // Watch for file changes and re-run
  watch: false,
} satisfies RemixTestConfig
