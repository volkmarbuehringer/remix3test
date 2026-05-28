---
title: CLI Commands Full Reference
category: lookup
type: context
source: /home/lucky/remix/packages/cli/src/index.ts
tags: [remix3, lookup, reference, cli, commands]
---

# CLI Commands Full Reference

## Core Concept
Complete reference for all Remix 3 CLI commands, including flags, environment variables, and example usage.

## Commands

### remix dev
Start local development server with hot reload.
```bash
remix dev [--port 3000] [--open] [--https]
```

### remix build
Build production-ready application.
```bash
remix build [--sourcemap] [--analyze]
```

### remix start
Start production server.
```bash
remix start [--port 8080] [--cluster]
```

### remix test
Run test suite.
```bash
remix test [--coverage] [--watch]
```

### remix data-table migrate
Run data-table schema migrations.
```bash
remix data-table migrate --adapter mysql|postgres|sqlite
```

## Environment Variables
- `PORT`: Override default port (default: 3000 dev, 8080 prod)
- `NODE_ENV`: Set environment (development/production/test)
- `REMIX_LOG_LEVEL`: Set log level (debug/info/warn/error)

## Reference
- [Remix CLI Docs](https://remix.run/docs/en/main/other-api/cli)
