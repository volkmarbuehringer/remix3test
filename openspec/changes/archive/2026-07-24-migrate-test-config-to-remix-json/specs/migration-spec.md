# Spec: Migrate test config to remix.json

## Requirements

1. `remix.json` must contain the `"test"` key with all fields from the current `remix-test.config.ts`
2. `playwright.config.ts` must contain the inline Playwright config (browser projects, timeouts)
3. `remix-test.config.ts` must be deleted
4. `npm test` must work

## Field mapping

| remix-test.config.ts | remix.json "test" |
|---|---|
| `concurrency: 6` | `"concurrency": 6` |
| `pool: 'forks'` | `"pool": "forks"` |
| `glob.test: '...'` | `"files": "..."` |
| `glob.browser: '...'` | `"browserFiles": "..."` |
| `glob.e2e: '...'` | `"e2eFiles": "..."` |
| `glob.exclude: []` | `"exclude": []` |
| `browser.echo: false` | `"playwright": { "echo": false }` |
| `browser.open: false` | `"playwright": { "open": false }` |
| `playwrightConfig` (inline) | extracted to `playwright.config.ts`, referenced via `"playwright.configFile"` |
| `project: 'chromium'` | `"playwright": { "projects": ["chromium"] }` |
| `reporter: 'spec'` | `"reporter": "spec"` |
| `setup: './test/setup.ts'` | `"setup": "./test/setup.ts"` |
| `type: ['server','browser','e2e']` | `"type": ["server","browser","e2e"]` |
| `watch: false` | `"watch": false` |
