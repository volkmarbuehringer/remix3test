<!-- Context: development/remix3/core/concepts/remix-design-principles | Priority: high | Version: 1.0 | Updated: 2026-05-02 -->

# Concept: Remix 3 Design Principles

**Core Idea**: Remix 3 is guided by 6 design principles — model-first development, web API foundation, runtime-agnosticism, dependency avoidance, demand composition, and cohesive distribution — ensuring all packages are portable, composable, and independently useful.

## Key Points

1. **Model-First Development** — Optimize source code, docs, tooling, and abstractions for LLMs. Build model-aware product abstractions.

2. **Build on Web APIs** — Share abstractions across the full stack. Use Web APIs + JavaScript as the only full-stack ecosystem foundation.

3. **Religiously Runtime** — No static analysis requirements. All packages must work without bundling. `--import` loaders for TS/JSX transformations are permissible.

4. **Avoid Dependencies** — Choose dependencies wisely, wrap them completely, expect to replace most. Goal is zero dependencies.

5. **Demand Composition** — Single-purpose, replaceable abstractions. Every package must be independently useful. New features start as new packages.

6. **Distribute Cohesively** — Single `remix` package for distribution and documentation, despite composable internals.

## Portability Goals

Each package has single responsibility, prioritizes web standards, and augments standards unobtrusively. Code is portable across Node.js, Bun, Deno, and Cloudflare Workers using web standard alternatives:

| Node-specific | Web Alternative |
|---|---|
| `node:stream` | Web Streams API |
| `Buffer` | `Uint8Array` |
| `node:crypto` | Web Crypto API |
| Runtime-specific APIs | `Blob` / `File` |

**Quick Example**:
```sh
npm install remix@next
npx remix@next new my-remix-app
```

**Reference**: [Remix 3 README — Design Principles](https://github.com/remix-run/remix#welcome-to-remix-3)

**Related**:
- `./remix-packages.md` — Package catalog (cohesive distribution in practice)
- `./remix-core-rules.md` — Development rules derived from these principles
- `navigation.md` — Full context navigation
