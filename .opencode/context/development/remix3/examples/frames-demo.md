---
title: Frames Demo
category: examples
type: context
source: /home/lucky/remix/demos/frames
tags: [remix3, examples, demo, frames, components]
---

# Frames Demo

## Core Concept
Demo of Remix 3's frame component for embedding independent sub-applications. Supports cross-frame communication via postMessage.

## Key Points
- Renders multiple frames in a single page
- Shares context across frames via Remix's context API
- Handles frame resize and lazy loading
- Uses controller pattern for frame-specific logic
- Includes example US states dropdown with frame rendering

## Example
```ts
// app/router.ts - Frames setup
import { createRouter } from 'remix/fetch-router'
import { staticFiles } from 'remix/static-middleware'
import { framesController } from './actions/frames/controller.tsx'

const router = createRouter({
  middleware: [staticFiles('./public')]
})

router.map(routes, rootController)
router.map(routes.frames, framesController)
```

## Reference
- [Frames Demo Source](https://github.com/remix-run/remix/tree/main/demos/frames)
