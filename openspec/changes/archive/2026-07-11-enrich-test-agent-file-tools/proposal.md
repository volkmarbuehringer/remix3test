## Why

The test agent's `listTestFiles` tool only returns file names and directory flags — no size, mtime, or sorting. When a user asks "what's the biggest file?" or "what changed recently?", the agent can't answer. Enriching the tool with optional sorting, filtering, and stats turns it from a simple `ls` into a `ls -la | sort` equivalent, without multiplying tool count.

## What Changes

- Add optional `sort`, `order`, `limit`, `ext`, and `recursive` parameters to `listTestFiles`
- Return size (bytes) and mtime (Unix ms) alongside each entry when sorting is requested
- Cap output at max 100 entries
- Exclude `.git` and `node_modules` from recursive traversal
- Update agent instructions to teach the new capabilities
- Note: `readTestFile` is unchanged

## Capabilities

### New Capabilities
- `file-directory-enumeration`: Enriched directory listing with metadata, sorting, filtering, and recursion limits

### Modified Capabilities

None — this capability is new.

## Impact

- `app/actions/mastra/tools/test-tools.ts` — `listTestFiles` signature and implementation
- `app/actions/mastra/agents/test-agent.ts` — agent instructions
- `app/actions/mastra/tools/test-tools.test.ts` — new tests
