<!-- Context: project-intelligence/technical | Priority: high | Version: 1.9 | Updated: 2026-03-27 -->

# Technical Domain

> Remix 3 monorepo - Web standards-first, runtime-agnostic packages and demos.

## Quick Reference

- **Purpose**: Modular web platform packages (headers, routing, SSE, form parsing)
- **Update When**: New packages, major API changes, architecture decisions

## Primary Stack

| Layer           | Technology | Version                   |
| --------------- | ---------- | ------------------------- |
| Language        | TypeScript | Strict, ESNext            |
| Runtime         | Node.js    | 20+                       |
| Package Manager | pnpm       | Workspace (37+ packages)  |
| Database        | PostgreSQL | pg (connection pool) |

## Architecture

**Pattern**: Web Standards First, Runtime Agnostic

**Principles**:

1. Use native APIs (fetch, streams, crypto, URL)
2. Runtime agnostic: Node.js, Bun, Deno, Cloudflare Workers
3. Modular packages: single responsibility, minimal deps
4. Zero config: Works out of the box

## Project Structure

```
remix/
├── packages/         # Published npm packages (fetch-router, headers, etc.)
├── demos/            # Working examples (bookstore, sse, frame-navigation)
└── .opencode/       # Project intelligence
```

## Key Packages

| Package        | Purpose                     |
| -------------- | --------------------------- |
| `fetch-router` | HTTP routing with fetch API |
| `headers`      | HTTP header utilities       |
| `component`    | Web Components              |
| `data-table`   | Database query builder      |
| `form-data`    | Form data parsing           |

## Design Decisions

- **Web Standards**: Native fetch, streams, URL, not Node-only APIs
- **ESM**: Native ESM throughout
- **No config**: Works without setup
- **Modular**: Small packages with clear boundaries

## Related

- `development/navigation.md` - All development context
- `development/remix3/navigation.md` - Remix 3 patterns
