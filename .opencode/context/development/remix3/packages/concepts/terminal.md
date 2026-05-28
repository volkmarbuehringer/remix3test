---
title: Terminal
category: concepts
type: context
source: /home/lucky/remix/packages/terminal/src/index.ts
tags: [remix3, concepts, cli, terminal, ui]
---

# Terminal

## Core Concept
Terminal UI utility for Remix's CLI tooling. Renders progress bars, tables, and colored output for build/deploy commands with CI environment detection.

## Key Points
- Supports ANSI color codes and text styling
- Renders interactive prompts for user input
- Detects CI environments to disable interactive features
- Provides `createTerminal` for custom CLI tools
- Includes predefined styles for success/error/warning

## Example
```ts
import { createTerminal } from 'remix/terminal'

const term = createTerminal()
term.success('Build completed!')
term.error('Failed to deploy')
term.info('Uploading 3 files...')
```

## Reference
- [ANSI Escape Codes](https://en.wikipedia.org/wiki/ANSI_escape_code)
