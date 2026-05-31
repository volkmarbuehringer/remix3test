---
title: Node Fetch Server Errors
category: errors
type: context
source: /home/lucky/remix/packages/node-fetch-server/src/index.ts
tags: [remix3, errors, server, node, fetch]
---

# Node Fetch Server Errors

## Core Concept
Common errors when using Remix's Node.js fetch server, including port conflicts and TLS misconfigurations. Includes resolution steps.

## Common Errors

### EADDRINUSE (Port Already in Use)
❌ **Wrong**:
```ts
createRequestListener({ port: 3000 })
// Error: listen EADDRINUSE: address already in use :::3000
```

✅ **Correct**:
```ts
const port = process.env.PORT || 3000
const listener = createRequestListener({ fetch: remixHandler })

http.createServer(listener).listen(port, () => {
  console.log(`Server on port ${port}`)
})
```

### Invalid TLS Cert/Key Paths (Server Fails to Start)
❌ **Wrong**:
```ts
createRequestListener({
  tls: { cert: './missing-cert.pem', key: './missing-key.pem' }
})
```

✅ **Correct**:
```ts
import fs from 'fs'
const tlsOptions = {
  cert: fs.readFileSync('./cert.pem'),
  key: fs.readFileSync('./key.pem'),
}
createRequestListener({ tls: tlsOptions })
```

### Silent Crashes on Unhandled Errors
✅ **Add error handler**:
```ts
const server = http.createServer(listener)
server.on('error', (error) => {
  console.error('Server error:', error)
  process.exit(1)
})
```

## Reference
- [Node.js HTTPS Module](https://nodejs.org/api/https.html)
