import type { ChatMessage } from '../types/chatlog.ts'
import { messageContentToText } from './message-content.ts'

interface ChatThreadRow {
  id: string
  resourceId: string
  createdAt: number
  updatedAt: number
}

interface ThreadListResult {
  threads: ChatThreadRow[]
  hasMore: boolean
}

/** A stored Mastra thread as a storage integration may return it. */
interface RawThreadRow {
  id: string
  resourceId?: string | undefined
  createdAt: Date | string | number
  updatedAt: Date | string | number
}

interface MemoryHandle {
  recall: (opts: {
    threadId: string
    resource?: string | undefined
    perPage?: number | false
    orderBy?: { field: string; direction: string }
  }) => Promise<{ messages?: unknown[]; total?: number }>
  listThreads: (opts: {
    page: number
    perPage: number
    orderBy: { field: string; direction: string }
    filter?: { resourceId?: string; metadata?: Record<string, unknown> }
  }) => Promise<{ threads?: unknown[] }>
  getThreadById: (args: { threadId: string; resourceId?: string }) => Promise<RawThreadRow | null>
  deleteThread: (id: string) => Promise<void>
}

// Accept any agent that has a getMemory() method returning something with the right shape
export type AgentHandle = { getMemory: () => Promise<unknown> }

async function getMemory(agent: AgentHandle): Promise<MemoryHandle> {
  let memory = await agent.getMemory()
  if (!memory) throw new Error('Memory not available')
  return memory as MemoryHandle
}

function toTimestamp(value: Date | string | number): number {
  if (value instanceof Date) return value.getTime()
  return typeof value === 'string' ? new Date(value).getTime() : Number(value)
}

/** Normalises a stored thread, defaulting a missing owner to an empty resource. */
function toChatThread(row: RawThreadRow): ChatThreadRow {
  return {
    id: row.id,
    resourceId: String(row.resourceId ?? ''),
    createdAt: toTimestamp(row.createdAt),
    updatedAt: toTimestamp(row.updatedAt),
  }
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
  let allThreads = (result.threads ?? []) as RawThreadRow[]
  let hasMore = allThreads.length > opts.perPage
  let threads = hasMore ? allThreads.slice(0, opts.perPage) : allThreads
  return {
    threads: threads.map(toChatThread),
    hasMore,
  }
}

/**
 * Resolves the most recently updated thread for a resource (the customer's
 * active conversation), or null if the resource has no threads. Used by the
 * `/chat` index route to resume the latest conversation on load.
 */
export async function listLatestCustomerThread(
  agent: AgentHandle,
  resourceId: string,
): Promise<string | null> {
  let memory = await getMemory(agent)
  let result = await memory.listThreads({
    page: 0,
    perPage: 1,
    orderBy: { field: 'updatedAt', direction: 'DESC' },
    filter: { resourceId },
  })
  let threads = (result.threads ?? []) as Array<{ id: string }>
  return threads[0]?.id ?? null
}

export async function deleteChatThread(agent: AgentHandle, threadId: string): Promise<void> {
  let memory = await agent.getMemory()
  if (memory) {
    await (memory as MemoryHandle).deleteThread(threadId)
  }
}

// ── Single-thread lookup and bounded sweep (chatlog source derivation) ──

/** A stored thread with its owning resource, as the chatlog needs it. */
export interface ChatThreadSummary {
  id: string
  resourceId: string
  createdAt: number
  updatedAt: number
}

/** Upper bound on a full chatlog sweep so a runaway store cannot hang a request. */
const CHATLOG_SWEEP_MAX_THREADS = 5000
/** Page size used while sweeping the thread store. */
const CHATLOG_SWEEP_PAGE_SIZE = 100

/**
 * Reads one stored thread by id, or null when it does not exist.
 *
 * The chatlog and the support-agent entry contract use this to check ownership
 * (the thread's `resourceId`) before disclosing or continuing a conversation.
 */
export async function getChatThread(
  agent: AgentHandle,
  threadId: string,
): Promise<ChatThreadSummary | null> {
  let memory = await getMemory(agent)
  let thread = await memory.getThreadById({ threadId })
  return thread ? toChatThread(thread) : null
}

/**
 * Reads every stored thread (up to a bound) with its owning resource.
 *
 * Mastra's `listThreads` only filters by an exact `resourceId`, so deriving a
 * source for every thread — or counting threads per source — requires walking
 * the store. The sweep stops at `maxThreads` so a large store degrades to a
 * partial list rather than an unbounded request.
 */
export async function listAllChatThreads(
  agent: AgentHandle,
  opts?: { maxThreads?: number },
): Promise<ChatThreadSummary[]> {
  let memory = await getMemory(agent)
  let maxThreads = opts?.maxThreads ?? CHATLOG_SWEEP_MAX_THREADS
  let all: ChatThreadSummary[] = []
  let page = 0

  while (all.length < maxThreads) {
    let perPage = Math.min(CHATLOG_SWEEP_PAGE_SIZE, maxThreads - all.length)
    let result = await memory.listThreads({
      page,
      perPage,
      orderBy: { field: 'createdAt', direction: 'DESC' },
    })
    let threads = (result.threads ?? []) as RawThreadRow[]
    all.push(...threads.map(toChatThread))
    if (threads.length < perPage) break
    page++
  }

  return all
}

// ── Conversation previews ──

export interface ChatThreadPreview {
  /** Single-line snippet rendered in the list cell. */
  preview: string
  /** Longer opening exchange shown in the hover tooltip. */
  previewFull: string
  /** Total stored messages in the thread (a metadata signal, not a transcript length). */
  messageCount: number
}

const PREVIEW_MAX_LENGTH = 220
const PREVIEW_FULL_MAX_LENGTH = 600

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function buildChatThreadPreview(
  rawMessages: Array<{ role: string; content: unknown }>,
  messageCount: number,
): ChatThreadPreview {
  let turns = rawMessages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      text: messageContentToText(m.content).trim(),
    }))
    .filter((t) => t.text.length > 0)

  if (turns.length === 0) return { preview: '', previewFull: '', messageCount }

  // The list column leads with the conversation's opening question (the first
  // user turn, falling back to the first turn for tool-only conversations).
  let opening = turns.find((t) => t.role === 'user') ?? turns[0]!
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

  return { preview, previewFull, messageCount }
}

/**
 * Fetches a lightweight preview for a batch of threads by reading a bounded
 * slice of the opening messages for each one. Each thread is isolated: a failed
 * lookup falls back to an empty preview rather than failing the whole page. The
 * same read carries the thread's message total, so the count adds no query.
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
        let { messages, total } = await memory.recall({
          threadId,
          perPage: 8,
          orderBy: { field: 'createdAt', direction: 'ASC' },
        })
        let rawMessages = (messages ?? []) as Array<{ role: string; content: unknown }>
        let messageCount = typeof total === 'number' ? total : rawMessages.length
        previews.set(threadId, buildChatThreadPreview(rawMessages, messageCount))
      } catch (error) {
        if (process.env.NODE_ENV !== 'test')
          console.error(`[mastra-memory] preview failed for ${threadId}: ${String(error)}`)
        previews.set(threadId, { preview: '', previewFull: '', messageCount: 0 })
      }
    }),
  )

  return previews
}
