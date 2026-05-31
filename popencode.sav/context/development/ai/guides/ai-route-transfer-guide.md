<!-- Context: development/ai/guides/ai-route-transfer-guide | Priority: high | Version: 1.0 | Updated: 2026-04-23 -->

# Guide: Transferring AI Routes Between Projects

**Purpose**: Step-by-step workflow for transferring /chat, /agent, /agent2 routes between Remix projects.

---

## Prerequisites

1. Source project with working AI routes
2. Target project with Remix 3 setup
3. PostgreSQL database (test1) accessible
4. OPENCODE_API_KEY environment variable

---

## Step 1: Add Dependencies

```bash
pnpm add ai @ai-sdk/openai-compatible @ai-sdk/devtools pg
```

---

## Step 2: Add Database Tables

In `app/data/setup.ts`, add after existing migrations:

```typescript
// chatlog table creation
let chatlogExists = await pool.query(`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'chatlog')`)
if (!chatlogExists.rows[0].exists) {
  await pool.query(`CREATE TABLE chatlog (id TEXT PRIMARY KEY, conversation JSONB NOT NULL DEFAULT '[]', created_at BIGINT NOT NULL, updated_at BIGINT NOT NULL)`)
}

// workflow_runs table creation (similar pattern)
```

---

## Step 3: Create Utilities

### app/utils/ai-provider.ts
```typescript
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { wrapLanguageModel } from 'ai'
import { devToolsMiddleware } from '@ai-sdk/devtools'

export function getModel() {
  let provider = createOpenAICompatible({
    baseURL: 'https://opencode.ai/zen/go/v1',
    name: 'opencode',
    apiKey: process.env.OPENCODE_API_KEY,
  })
  return wrapLanguageModel({
    model: provider.chatModel('minimax-m2.7'),
    middleware: devToolsMiddleware(),
  })
}
```

### app/utils/logger.ts
```typescript
export function userLogger(prefix: string) {
  return {
    log: (...a: unknown[]) => console.log(`[${prefix}]`, ...a),
    error: (...a: unknown[]) => console.error(`[${prefix}]`, ...a),
    warn: (...a: unknown[]) => console.warn(`[${prefix}]`, ...a),
  }
}
```

---

## Step 4: Create chatlog Library

```typescript
// app/lib/chatlog.ts
import { generateId } from 'ai'
import { db } from '../data/setup.ts'
import { sql } from 'remix/data-table'

export async function createConversation(): Promise<string> {
  let id = generateId()
  await db.exec(sql`INSERT INTO chatlog (id, conversation, created_at, updated_at) VALUES (${id}, '[]', ${Date.now()}, ${Date.now()})`)
  return id
}

export async function appendMessage(id: string, message: ChatMessage) {
  await db.exec(sql`UPDATE chatlog SET conversation = conversation || ${JSON.stringify(message)}::jsonb, updated_at = ${Date.now()} WHERE id = ${id}`)
}
```

---

## Step 5: Copy Controllers

Copy folders and update imports:
```typescript
// Before: import { getConversation } from '~/lib/chatlog.ts'
// After:  import { getConversation } from '../../lib/chatlog.ts'
```

---

## Step 6: Register Routes

### routes.ts
```typescript
chat: route('chat', { index: get('/'), action: post('/') }),
agent: route('agent', { index: get('/'), action: post('/') }),
agent2: route('agent2', { index: get('/'), action: post('/') }),
```

### router.ts
```typescript
import chatController from './controllers/chat/controller.tsx'
import agentController from './controllers/agent/controller.tsx'
import agent2Controller from './controllers/agent2/controller.tsx'

router.map(routes.chat, chatController)
router.map(routes.agent, agentController)
router.map(routes.agent2, agent2Controller)
```

---

## Step 7: Add Navbar & dotenv

layout.tsx: `<a href={routes.chat.index.href()}>Chat</a>` etc.

server.ts: `import 'dotenv/config'`

---

## Verification Checklist

- [ ] /chat, /agent, /agent2 accessible
- [ ] Conversations persist after refresh
- [ ] Agent tool calls work
- [ ] Agent2 workflows track runs
- [ ] No console errors

---

## Related

- `concepts/ai-route-transfer.md`
- `lookup/ai-route-transfer-lookup.md`