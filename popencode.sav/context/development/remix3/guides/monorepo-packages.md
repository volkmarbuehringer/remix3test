<!-- Context: development/remix3/guides/monorepo-packages | Priority: medium | Version: 1.0 | Updated: 2026-03-24 -->

# Monorepo Package Conventions

How to create and standardize Remix packages following monorepo conventions.

## Core Concept

Packages in this monorepo follow strict conventions for structure, exports, and configuration. Always align new packages with existing patterns.

## Key Points

- Package name: `@remix-run/<name>` with `version: "0.0.0"` for new packages
- `exports` maps public subpaths to `src/` files that re-export from `src/lib/`
- Build output goes to `dist/`, tests run from `src/` via Node test runner
- `package.json` includes standard scripts: `build`, `clean`, `test`, `typecheck`
- README follows specific section order and import conventions

## Package Structure

```
packages/<name>/
├── package.json        # Name, exports, scripts
├── tsconfig.json       # Strict TypeScript config
├── tsconfig.build.json # Build output config
├── README.md
├── LICENSE
├── CHANGELOG.md
├── .changes/
│   └── README.md
└── src/
    ├── index.ts        # Public entry (re-exports from lib)
    └── lib/
        └── *.ts       # Implementation
```

## Export Pattern

```ts
// src/index.ts - Public entry
export { createThing, type ThingOptions } from './lib/thing.ts'

// src/lib/thing.ts - Implementation
export function createThing() {
  /* ... */
}
```

## Code Style

- `import type { X }` for types, include `.ts` extensions
- Prefer `let` for locals, `const` for module scope
- Arrow functions for callbacks, function declarations for normal functions
- Use `import type` and `export type` for type-only exports

## Validation

```bash
npm run typecheck --workspace=remix-<name>
npm run test --workspace=remix-<name>
npm run build --workspace=remix-<name>
npm run lint
```

## 📂 Codebase References

- `packages/fetch-router/` - Reference package structure
- `.agents/skills/add-package/SKILL.md` - Full skill guide

## Related

- `guides/release-process.md` - Change files and releases
- `guides/readme-style.md` - README conventions
