import type { ListItem, ListInitialState } from './lists-state.ts'

export type ServerListState = ListInitialState

function toState(raw: unknown): ServerListState {
  let r = (raw ?? {}) as Record<string, unknown>
  return {
    id: Number(r.id),
    title: typeof r.title === 'string' ? r.title : '',
    description: typeof r.description === 'string' ? r.description : '',
    items: Array.isArray(r.items) ? (r.items as ListItem[]) : [],
    updated_at: Number(r.updated_at),
  }
}

/** JSON + CSRF + optional If-Match headers shared by every lists write request. */
export function listsJsonHeaders(input: {
  csrfToken?: string | null | undefined
  ifMatch?: number | null
}): Record<string, string> {
  let headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (input.csrfToken) headers['X-Csrf-Token'] = input.csrfToken
  if (input.ifMatch != null) headers['If-Match'] = String(input.ifMatch)
  return headers
}

type CreateOutcome =
  | { status: 'ok'; state: ServerListState }
  | { status: 'error'; network: boolean }

export async function createListRequest(
  headers: Record<string, string>,
  body: { title: string; description: string; items: ListItem[] },
): Promise<CreateOutcome> {
  try {
    let response = await fetch('/lists', { method: 'POST', headers, body: JSON.stringify(body) })
    if (!response.ok) return { status: 'error', network: false }
    return { status: 'ok', state: toState(await response.json()) }
  } catch {
    return { status: 'error', network: true }
  }
}

type PatchOutcome =
  | { status: 'ok'; state: ServerListState }
  | { status: 'conflict'; state: ServerListState }
  | { status: 'error'; network: boolean }

export async function patchListRequest(
  headers: Record<string, string>,
  id: number,
  partial: Record<string, unknown>,
): Promise<PatchOutcome> {
  try {
    let response = await fetch(`/lists/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(partial),
    })
    if (response.ok) return { status: 'ok', state: toState(await response.json()) }
    if (response.status === 409)
      return { status: 'conflict', state: toState(await response.json()) }
    return { status: 'error', network: false }
  } catch {
    return { status: 'error', network: true }
  }
}

type CopyItemsOutcome =
  | { status: 'ok'; copied: number; target: ServerListState }
  | { status: 'conflict'; state: ServerListState }
  | { status: 'not_found' }
  | { status: 'bad_request' }
  | { status: 'error'; network: boolean }

export async function copyItemsRequest(
  headers: Record<string, string>,
  sourceId: number,
  targetId: number,
  itemIds: string[],
): Promise<CopyItemsOutcome> {
  try {
    let response = await fetch(`/lists/${sourceId}/copy-items`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ targetId, itemIds }),
    })
    if (response.ok) {
      let data = (await response.json()) as { copied?: unknown }
      return {
        status: 'ok',
        target: toState(data),
        copied: typeof data.copied === 'number' ? data.copied : itemIds.length,
      }
    }
    if (response.status === 409)
      return { status: 'conflict', state: toState(await response.json()) }
    if (response.status === 404) return { status: 'not_found' }
    if (response.status === 400) return { status: 'bad_request' }
    return { status: 'error', network: false }
  } catch {
    return { status: 'error', network: true }
  }
}

export type MoveOutcome =
  | { status: 'ok'; source: ServerListState; target: ServerListState }
  | { status: 'conflict'; state: ServerListState }
  | { status: 'not_found' }
  | { status: 'bad_request' }
  | { status: 'error'; network: boolean }

function toMoveState(raw: unknown): { source: ServerListState; target: ServerListState } {
  let r = (raw ?? {}) as Record<string, unknown>
  return { source: toState(r.source), target: toState(r.target) }
}

export async function moveItemRequest(
  headers: Record<string, string>,
  sourceId: number,
  targetId: number,
  itemId: string,
): Promise<MoveOutcome> {
  try {
    let response = await fetch(`/lists/${sourceId}/move`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ targetId, itemId }),
    })
    if (response.ok) return { status: 'ok', ...toMoveState(await response.json()) }
    if (response.status === 409)
      return { status: 'conflict', state: toState(await response.json()) }
    if (response.status === 404) return { status: 'not_found' }
    if (response.status === 400) return { status: 'bad_request' }
    return { status: 'error', network: false }
  } catch {
    return { status: 'error', network: true }
  }
}

type MoveItemsOutcome = MoveOutcome & { moved?: number }

/** Atomic multi-item move: all ids move in one transaction (all-or-nothing). */
export async function moveItemsRequest(
  headers: Record<string, string>,
  sourceId: number,
  targetId: number,
  itemIds: string[],
): Promise<MoveItemsOutcome> {
  try {
    let response = await fetch(`/lists/${sourceId}/move-items`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ targetId, itemIds }),
    })
    if (response.ok) {
      let data = (await response.json()) as { moved?: unknown }
      return {
        status: 'ok',
        ...toMoveState(data),
        moved: typeof data.moved === 'number' ? data.moved : itemIds.length,
      }
    }
    if (response.status === 409)
      return { status: 'conflict', state: toState(await response.json()) }
    if (response.status === 404) return { status: 'not_found' }
    if (response.status === 400) return { status: 'bad_request' }
    return { status: 'error', network: false }
  } catch {
    return { status: 'error', network: true }
  }
}

export type ListTarget = {
  id: number
  title: string
  description: string
  count: number
  doneCount: number
  updated_at: number
}

type ListTargetsOutcome =
  | { status: 'ok'; targets: ListTarget[]; hasMore: boolean }
  | { status: 'error'; network: boolean }

/** Session-authenticated target search. Excludes nothing; the caller drops its
 *  own list. Search covers title, description and item labels server-side. */
export async function searchListTargetsRequest(query: string): Promise<ListTargetsOutcome> {
  try {
    let params = new URLSearchParams({ limit: '100' })
    let trimmed = query.trim()
    if (trimmed) params.set('filter', trimmed)
    let response = await fetch(`/lists/targets?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) return { status: 'error', network: false }
    let data = (await response.json()) as { data?: unknown; hasMore?: unknown }
    let rows = Array.isArray(data.data) ? data.data : []
    let targets: ListTarget[] = []
    for (let raw of rows) {
      let r = (raw ?? {}) as Record<string, unknown>
      let id = Number(r.id)
      if (!Number.isFinite(id) || id < 1) continue
      targets.push({
        id,
        title: typeof r.title === 'string' ? r.title : '',
        description: typeof r.description === 'string' ? r.description : '',
        count: Number(r.count) || 0,
        doneCount: Number(r.doneCount) || 0,
        updated_at: Number(r.updated_at) || 0,
      })
    }
    return { status: 'ok', targets, hasMore: data.hasMore === true }
  } catch {
    return { status: 'error', network: true }
  }
}

type MergeOutcome =
  | { status: 'ok' }
  | { status: 'conflict'; state: ServerListState }
  | { status: 'not_found' }
  | { status: 'bad_request' }
  | { status: 'error'; network: boolean }

export async function mergeListRequest(
  headers: Record<string, string>,
  sourceId: number,
  targetId: number,
): Promise<MergeOutcome> {
  try {
    let response = await fetch(`/lists/${sourceId}/merge`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ targetId }),
    })
    if (response.ok) return { status: 'ok' }
    if (response.status === 409)
      return { status: 'conflict', state: toState(await response.json()) }
    if (response.status === 404) return { status: 'not_found' }
    if (response.status === 400) return { status: 'bad_request' }
    return { status: 'error', network: false }
  } catch {
    return { status: 'error', network: true }
  }
}

/**
 * Best-effort keepalive flush for the unload / frame-swap paths. The update
 * route is PUT, which navigator.sendBeacon cannot send, so use keepalive fetch.
 */
export function sendKeepalivePatch(
  headers: Record<string, string>,
  id: number,
  partial: Record<string, unknown>,
): void {
  try {
    void fetch(`/lists/${id}`, {
      method: 'PUT',
      keepalive: true,
      headers,
      body: JSON.stringify(partial),
    }).catch(() => {})
  } catch {
    // Best-effort flush — ignore any failure surfacing during unload.
  }
}
