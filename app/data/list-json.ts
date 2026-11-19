/**
 * Wire-shape helpers for the JSONB `lists.list` column.
 *
 * `list` is user data: anything that can write JSONB can store an object, a
 * scalar, a pre-serialized string, or an array whose elements do not match the
 * item shape. One such row otherwise 500s its owner's list page, so both the
 * SQL readers and the typed readers tolerate it:
 *
 * - `listItemsArray()` guards `jsonb_array_length` / `jsonb_array_elements`
 *   in raw SQL (shared by `lists.ts` and `admin-lists.ts`).
 * - `toListItems()` is the canonical element projection for the API/editor
 *   shape (`admin-lists.ts` keeps its own narrower display projection).
 *
 * Neither writes anything: the stored payload is only repaired by the
 * `20261119120000_unwrap_double_encoded_json` migration.
 */

export type ItemPriority = 'low' | 'medium' | 'high'

export interface ListItem {
  id: string
  label: string
  done?: boolean
  priority?: ItemPriority
  due?: string
  tags?: string[]
  updatedAt?: number
}

function isItemPriority(value: unknown): value is ItemPriority {
  return value === 'low' || value === 'medium' || value === 'high'
}

/**
 * Narrow an arbitrary JSONB value to an item array callers can iterate.
 *
 * - A JSONB string is unwrapped until it is no longer text; a hand-serialized
 *   write can nest one layer deeper. Text that is not JSON becomes `[]`.
 * - A non-array payload becomes `[]`.
 * - A non-object element is dropped.
 * - A missing/non-string `id`/`label` becomes `''` (mirrors `admin-lists.ts`),
 *   so positional identity survives a partially corrupt row.
 * - Metadata is kept only when it has the declared type; empty tags are
 *   omitted, matching the write path.
 */
export function toListItems(value: unknown): ListItem[] {
  let candidate = value
  while (typeof candidate === 'string') {
    try {
      candidate = JSON.parse(candidate)
    } catch {
      return []
    }
  }
  if (!Array.isArray(candidate)) return []

  let items: ListItem[] = []
  for (let raw of candidate) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue
    let item = raw as Record<string, unknown>
    let tags = Array.isArray(item.tags)
      ? item.tags.filter((tag): tag is string => typeof tag === 'string')
      : []
    items.push({
      id: typeof item.id === 'string' ? item.id : '',
      label: typeof item.label === 'string' ? item.label : '',
      ...(typeof item.done === 'boolean' ? { done: item.done } : {}),
      ...(isItemPriority(item.priority) ? { priority: item.priority } : {}),
      ...(typeof item.due === 'string' && item.due.length > 0 ? { due: item.due } : {}),
      ...(tags.length > 0 ? { tags } : {}),
      ...(typeof item.updatedAt === 'number' && Number.isFinite(item.updatedAt)
        ? { updatedAt: item.updatedAt }
        : {}),
    })
  }
  return items
}

/**
 * SQL guard for a `jsonb` array column that holds user data. `column` is always
 * an internal column reference (`list`, `lists.list`), never user input.
 */
export function listItemsArray(column: string): string {
  return `CASE WHEN jsonb_typeof(${column}) = 'array' THEN ${column} ELSE '[]'::jsonb END`
}
