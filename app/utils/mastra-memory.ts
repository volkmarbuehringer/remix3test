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
    perPage?: number | false
    orderBy?: { field: string; direction: string }
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

// ── Conversation previews ──

export interface ChatThreadPreview {
  /** Single-line snippet rendered in the list cell. */
  preview: string
  /** Longer opening exchange shown in the hover tooltip. */
  previewFull: string
}

const PREVIEW_MAX_LENGTH = 220
const PREVIEW_FULL_MAX_LENGTH = 600

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function buildChatThreadPreview(
  rawMessages: Array<{ role: string; content: unknown }>,
): ChatThreadPreview {
  let turns = rawMessages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      text: messageContentToText(m.content).trim(),
    }))
    .filter((t) => t.text.length > 0)

  if (turns.length === 0) return { preview: '', previewFull: '' }

  // The list column leads with the conversation's opening question (the first
  // user turn, falling back to the first turn for tool-only conversations).
  let opening = turns.find((t) => t.role === 'user') ?? turns[0]
  let preview = collapseWhitespace(opening.text).slice(0, PREVIEW_MAX_LENGTH)

  // The tooltip reveals a little more: the opening question plus the first reply.
  let firstUser = opening.role === 'user' ? opening : turns.find((t) => t.role === 'user')
  let firstAssistant = turns.find((t) => t.role === 'assistant')
  let exchangeLines: string[] = []
  if (firstUser) exchangeLines.push(`User: ${firstUser.text}`)
  if (firstAssistant) exchangeLines.push(`Assistant: ${firstAssistant.text}`)
  let previewFull = exchangeLines
    .map(collapseWhitespace)
    .join('\n')
    .slice(0, PREVIEW_FULL_MAX_LENGTH)

  return { preview, previewFull }
}

/**
 * Fetches a lightweight preview for a batch of threads by reading a bounded
 * slice of the opening messages for each one. Each thread is isolated: a failed
 * lookup falls back to an empty preview rather than failing the whole page.
 */
export async function fetchChatThreadPreviews(
  agent: AgentHandle,
  threadIds: string[],
): Promise<Map<string, ChatThreadPreview>> {
  let previews = new Map<string, ChatThreadPreview>()
  if (threadIds.length === 0) return previews

  let memory = await getMemory(agent)

  await Promise.all(
    threadIds.map(async (threadId) => {
      try {
        let { messages } = await memory.recall({
          threadId,
          perPage: 8,
          orderBy: { field: 'createdAt', direction: 'ASC' },
        })
        let rawMessages = (messages ?? []) as Array<{ role: string; content: unknown }>
        previews.set(threadId, buildChatThreadPreview(rawMessages))
      } catch (error) {
        if (process.env.NODE_ENV !== 'test')
          console.error(`[mastra-memory] preview failed for ${threadId}: ${String(error)}`)
        previews.set(threadId, { preview: '', previewFull: '' })
      }
    }),
  )

  return previews
}
