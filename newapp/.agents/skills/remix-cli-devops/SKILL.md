---
name: remix-cli-devops
description: Use the `remix` CLI for project scaffolding, testing, diagnostics, and TypeScript/JSX loading with `node-tsx`. Activate when running CLI commands, setting up Node.js module loaders, or debugging project health.
---

# Remix CLI and DevOps

Covers `remix/cli` and `remix/node-tsx`.

## CLI Commands

- `remix new <dir>` — scaffold a new Remix app
- `remix test` — run project tests
- `remix doctor` / `remix doctor --fix` — check project conventions and fix low-risk issues
- `remix routes` / `remix routes --table` — inspect the route tree
- `remix version` — print installed version
- `remix completion bash|zsh` — install shell completion

Programmatic: `import { runRemix } from 'remix/cli'`

## node-tsx

Register the TypeScript/JSX loader to run `.ts`, `.tsx`, `.jsx` files directly:

```sh
node --import remix/node-tsx ./server.ts
```

Or side-effect import in code: `import 'remix/node-tsx'`

Use `loadModule` for scoped JSX: `import { loadModule } from 'remix/node-tsx/load-module'`

## TypeScript Config for node-tsx

```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "rewriteRelativeImportExtensions": true
  }
}
```

## References

- `~/remix/packages/cli/README.md` — full CLI docs
- `~/remix/packages/node-tsx/README.md` — loader docs and TS config
