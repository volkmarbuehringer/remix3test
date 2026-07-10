import type { ChatMessage } from '../types/chatlog.ts'
import { messageContentToText } from './message-content.ts'

interface ChatThreadRow {
  id: string
  createdAt: number
  updatedAt: number
}

export interface ThreadListResult {
  threads: ChatThreadRow[]
  hasMore: boolean
}

interface MemoryHandle {
  recall: (opts: {
    threadId: string
    resource?: string
    perPage: false
  }) => Promise<{ messages?: unknown[] }>
  listThreads: (opts: {
    page: number
    perPage: number
    orderBy: { field: string; direction: string }
  }) => Promise<{ threads?: unknown[] }>
  deleteThread: (id: string) => Promise<void>
}

// Accept any agent that has a getMemory() method returning something with the right shape
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AgentHandle = { getMemory: () => Promise<any> }

async function getMemory(agent: AgentHandle): Promise<MemoryHandle> {
  let memory = await agent.getMemory()
  if (!memory) throw new Error('Memory not available')
  return memory as MemoryHandle
}

export async function recallChatMessages(
  agent: AgentHandle,
  threadId: string,
  resource?: string,
): Promise<ChatMessage[]> {
  let memory = await getMemory(agent)
  let { messages } = await memory.recall({ threadId, resource, perPage: false })
  let rawMessages = (messages ?? []) as Array<{
    role: string
    content: unknown
    createdAt: string | number
  }>
  return rawMessages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: messageContentToText(m.content),
      timestamp:
        typeof m.createdAt === 'string' ? new Date(m.createdAt).getTime() : Number(m.createdAt),
    }))
    .filter((m) => m.content.length > 0)
}

export async function listChatThreads(
  agent: AgentHandle,
  opts: { page: number; perPage: number },
): Promise<ThreadListResult> {
  let memory = await getMemory(agent)
  let result = await memory.listThreads({
    page: opts.page,
    perPage: opts.perPage + 1,
    orderBy: { field: 'createdAt', direction: 'DESC' },
  })
  let allThreads = (result.threads ?? []) as Array<{
    id: string
    createdAt: Date | string
    updatedAt: Date | string
  }>
  let hasMore = allThreads.length > opts.perPage
  let threads = hasMore ? allThreads.slice(0, opts.perPage) : allThreads
  return {
    threads: threads.map((t) => ({
      id: t.id,
      createdAt:
        typeof t.createdAt === 'string' ? new Date(t.createdAt).getTime() : t.createdAt.getTime(),
      updatedAt:
        typeof t.updatedAt === 'string' ? new Date(t.updatedAt).getTime() : t.updatedAt.getTime(),
    })),
    hasMore,
  }
}

export async function deleteChatThread(agent: AgentHandle, threadId: string): Promise<void> {
  let memory = await agent.getMemory()
  if (memory) {
    await memory.deleteThread(threadId)
  }
}
