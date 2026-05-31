---
title: Node Serve
category: concepts
type: context
source: /home/lucky/remix/packages/node-serve/src/index.ts
tags: [remix3, concepts, server, node, production]
---

# Node Serve

## Core Concept
Production server launcher for Remix apps on Node.js. Handles process management, graceful shutdown, and port binding with optional cluster mode.

## Key Points
- Supports cluster mode for multi-core utilization
- Graceful shutdown on SIGTERM/SIGINT signals
- Logs server start/stop events with request metrics
- Supports TLS with SNI for multiple certificates
- Integrates with process managers like PM2

## Example
```ts
import { serve } from 'remix/node-serve'

serve({
  fetch: remixFetchHandler,
  port: 8080,
  cluster: true, // use all CPU cores
})
```

## Reference
- [Node.js Cluster Module](https://nodejs.org/api/cluster.html)
