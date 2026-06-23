## 1. Update package.json lint scripts

- [x] 1.1 Change `"lint": "oxlint"` to `"lint": "oxlint --max-warnings=0"`
- [x] 1.2 Change `"lint:fix": "oxlint --fix"` to `"lint:fix": "oxlint --fix --max-warnings=0"`

## 2. Update .oxlintrc.json

- [x] 2.1 Add explicit `"off"` for all category rules (nursery, pedantic, perf, restriction, style, suspicious)
- [x] 2.2 Remove stale remix-specific `ignorePatterns` entries (demos/bookstore, demos/sse, packages/multipart-parser, etc.)
- [x] 2.3 Run `npm run lint` to verify no new failures introduced
