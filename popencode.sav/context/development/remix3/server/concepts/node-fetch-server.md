---
title: Node Fetch Server
category: concepts
type: context
source: /home/lucky/remix/packages/node-fetch-server/src/index.ts
tags: [remix3, concepts, server, node, fetch]
---

# Node Fetch Server

## Core Concept
Node.js adapter for Remix's fetch-based server. Wraps Node's `http`/`https` modules to comply with Remix's fetch server interface.

## Key Points
- Supports HTTP/1.1 and HTTP/2 protocols
- Handles TLS termination with configurable certs
- Integrates with Remix's CLI for local dev
- Provides `createRequestListener` for framework integration
- Supports Unix socket connections

## Example
```ts
import { createRequestListener } from 'remix/node-fetch-server'
import http from 'node:http'

const listener = createRequestListener(remixFetchHandler)
http.createServer(listener).listen(3000)
```

## Reference

- Packages: `~/remix/packages/node-fetch-server/README.md`
