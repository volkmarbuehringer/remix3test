<!-- Context: development/remix3/packages/concepts | Priority: high | Version: 1.0 | Updated: 2026-05-20 -->

# Concept: node-tsx

**Purpose**: Run Node.js with TypeScript and JSX syntax support. Transforms `.ts`, `.tsx`, and `.jsx` files before execution, including enums, namespaces, and parameter properties. Does not type-check or change module resolution.

**Key Points**:
- Register via `--import remix/node-tsx` flag when running `node`
- JSX compiler options read from nearest `tsconfig.json` per file
- Does NOT type check, change Node.js module resolution, apply path aliases, or downlevel syntax
- Programmatic: `import 'remix/node-tsx'` (side-effect register) or `loadModule` from `remix/node-tsx/load-module`
- Recommended tsconfig: `module: NodeNext`, `moduleResolution: NodeNext`, `allowImportingTsExtensions: true`, `isolatedModules: true`, `verbatimModuleSyntax: true`, `rewriteRelativeImportExtensions: true`
- Do NOT enable `erasableSyntaxOnly` (it rejects transform-only syntax that node-tsx can execute)

**Minimal Example**:
```sh
node --import remix/node-tsx ./server.ts
```

**Programmatic**:
```ts
import { loadModule } from 'remix/node-tsx/load-module'
let mod = await loadModule('./app/server.tsx', import.meta.url)
```

**Reference**: `/home/lucky/remix/packages/node-tsx/README.md`
