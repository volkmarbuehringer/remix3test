import { generateId } from 'ai'
import { db } from '../data/setup.ts'
import { sql } from 'remix/data-table'

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  elapsed?: number
  tokens?: {
    input: number
    output: number
    total: number
  }
  toolCalls?: Array<{
    name: string
    input: Record<string, unknown>
    result?: unknown
    elapsed?: number
    timestamp: number
  }>
}

export interface ChatLogRow {
  id: string
  user_id: number | null
  conversation: ChatMessage[]
  created_at: number
  updated_at: number
}

function getRows(result: { rows?: Record<string, unknown>[] }): Record<string, unknown>[] {
  return result.rows ?? []
}

function parseConversationField(conv: unknown): ChatMessage[] {
  if (typeof conv === 'string') {
    try {
      return JSON.parse(conv)
    } catch {
      return []
    }
  }
  if (Array.isArray(conv)) {
    return conv as ChatMessage[]
  }
  return []
}

function rowToChatLogRow(row: Record<string, unknown>): ChatLogRow {
  let createdAt = row.created_at
  let updatedAt = row.updated_at
  if (typeof createdAt === 'string') {
    createdAt = Number(createdAt)
  }
  if (typeof updatedAt === 'string') {
    updatedAt = Number(updatedAt)
  }
  return {
    id: row.id as string,
    user_id: (row.user_id as number | null) ?? null,
    conversation: parseConversationField(row.conversation),
    created_at: createdAt as number,
    updated_at: updatedAt as number,
  }
}

export async function createConversation(userId: number): Promise<string> {
  let now = Date.now()
  let attempts = 0
  let maxAttempts = 3

  while (attempts < maxAttempts) {
    let id = generateId()
    try {
      await db.exec(sql`
        INSERT INTO chatlog (id, user_id, conversation, created_at, updated_at)
        VALUES (${id}, ${userId}, '[]', ${now}, ${now})
      `)
      return id
    } catch {
      attempts++
      if (attempts >= maxAttempts) {
        throw new Error('Failed to create conversation')
      }
    }
  }
  throw new Error('Failed to create conversation')
}

export async function getConversation(id: string, userId?: number): Promise<ChatLogRow | null> {
  let ownerFilter = userId != null ? sql`AND user_id = ${userId}` : sql``
  let result = await db.exec(sql`SELECT * FROM chatlog WHERE id = ${id} ${ownerFilter}`)
  let rows = getRows(result)
  if (rows.length === 0) return null
  return rowToChatLogRow(rows[0])
}

export async function appendMessage(
  id: string,
  userId: number | undefined,
  message: ChatMessage,
): Promise<ChatLogRow | null> {
  if (!message.content || message.content.trim().length === 0) {
    throw new Error('Cannot append empty message')
  }
  let messageToSave = { ...message, timestamp: message.timestamp || Date.now() }

  let maxRetries = 3
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    let existing = await getConversation(id, userId)
    if (!existing) {
      console.warn('[ChatLog] Conversation not found:', { id })
      return null
    }

    let updatedConversation = [...existing.conversation, messageToSave]
    let now = Date.now()
    let ownerFilter = userId != null ? sql`AND user_id = ${userId}` : sql``

    let result = await db.exec(sql`
      UPDATE chatlog
      SET conversation = ${JSON.stringify(updatedConversation)}::jsonb,
          updated_at = ${now}
      WHERE id = ${id}
      ${ownerFilter}
      AND jsonb_array_length(conversation) = ${existing.conversation.length}
    `)

    if (result.affectedRows !== 0) {
      return {
        id: existing.id,
        user_id: existing.user_id,
        conversation: updatedConversation,
        created_at: existing.created_at,
        updated_at: now,
      }
    }

    console.warn(
      `[ChatLog] Concurrent modification, retry ${attempt + 1}/${maxRetries}:`,
      { id },
    )
  }

  throw new Error('Failed to append message: too many concurrent modifications')
}

export async function getAllConversations(
  filter?: string,
  limit?: number,
  offset?: number,
  type?: 'chat' | 'agent',
  userId?: number,
): Promise<ChatLogRow[]> {
  let useLimit = limit !== undefined && offset !== undefined && Number.isFinite(limit) && Number.isFinite(offset)
  let ownerFilter = userId != null ? sql`AND user_id = ${userId}` : sql``

  let result
  if (filter && filter.trim()) {
    if (type === 'agent') {
      result = await db.exec(sql`
        SELECT * FROM chatlog
        WHERE conversation::text ILIKE '%' || ${filter.trim()} || '%'
        AND EXISTS (SELECT 1 FROM jsonb_array_elements(conversation::jsonb) AS elem WHERE jsonb_typeof(elem->'toolCalls') = 'array' AND jsonb_array_length(elem->'toolCalls') > 0)
        ${ownerFilter}
        ORDER BY created_at DESC
        ${useLimit ? sql`LIMIT ${limit} OFFSET ${offset}` : sql``}
      `)
    } else if (type === 'chat') {
      result = await db.exec(sql`
        SELECT * FROM chatlog
        WHERE conversation::text ILIKE '%' || ${filter.trim()} || '%'
        AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(conversation::jsonb) AS elem WHERE jsonb_typeof(elem->'toolCalls') = 'array' AND jsonb_array_length(elem->'toolCalls') > 0)
        ${ownerFilter}
        ORDER BY created_at DESC
        ${useLimit ? sql`LIMIT ${limit} OFFSET ${offset}` : sql``}
      `)
    } else {
      result = await db.exec(sql`
        SELECT * FROM chatlog
        WHERE conversation::text ILIKE '%' || ${filter.trim()} || '%'
        ${ownerFilter}
        ORDER BY created_at DESC
        ${useLimit ? sql`LIMIT ${limit} OFFSET ${offset}` : sql``}
      `)
    }
  } else if (type === 'agent') {
    result = await db.exec(sql`
      SELECT * FROM chatlog
      WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(conversation::jsonb) AS elem WHERE jsonb_typeof(elem->'toolCalls') = 'array' AND jsonb_array_length(elem->'toolCalls') > 0)
      ${ownerFilter}
      ORDER BY created_at DESC
      ${useLimit ? sql`LIMIT ${limit} OFFSET ${offset}` : sql``}
    `)
  } else if (type === 'chat') {
    result = await db.exec(sql`
      SELECT * FROM chatlog
      WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(conversation::jsonb) AS elem WHERE jsonb_typeof(elem->'toolCalls') = 'array' AND jsonb_array_length(elem->'toolCalls') > 0)
      ${ownerFilter}
      ORDER BY created_at DESC
      ${useLimit ? sql`LIMIT ${limit} OFFSET ${offset}` : sql``}
    `)
  } else {
    result = await db.exec(sql`
      SELECT * FROM chatlog
      WHERE 1=1
      ${ownerFilter}
      ORDER BY created_at DESC
      ${useLimit ? sql`LIMIT ${limit} OFFSET ${offset}` : sql``}
    `)
  }
  return getRows(result).map(rowToChatLogRow)
}

export async function deleteConversation(id: string, userId?: number): Promise<void> {
  if (userId != null) {
    await db.exec(sql`DELETE FROM chatlog WHERE id = ${id} AND user_id = ${userId}`)
  } else {
    await db.exec(sql`DELETE FROM chatlog WHERE id = ${id}`)
  }
}
