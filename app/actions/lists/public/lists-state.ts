export type ItemPriority = 'low' | 'medium' | 'high'
export type SortMode = 'manual' | 'az' | 'done' | 'due' | 'updated'

export type ListItem = {
  id: string
  label: string
  done?: boolean
  priority?: ItemPriority
  due?: string
  tags?: string[]
  updatedAt?: number
}

export type ListInitialState = {
  id: number
  title: string
  description: string
  items: ListItem[]
  updated_at: number
}

export type UndoKind = 'delete' | 'clear' | 'clearDone' | 'deleteSelected' | 'reorder'

export type ListConflictState = {
  show: boolean
  serverState: ListInitialState | null
}

export function priorityLabel(p: ItemPriority): string {
  return p === 'high' ? 'Hoch' : p === 'medium' ? 'Mittel' : 'Niedrig'
}

/**
 * Local calendar date key ("YYYY-MM-DD") for an epoch — compared against item
 * `due` strings, which are plain calendar days (no time, no timezone). ISO
 * keys sort lexicographically in chronological order.
 */
function localDateKey(date: Date): string {
  let m = String(date.getMonth() + 1).padStart(2, '0')
  let d = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${m}-${d}`
}

/**
 * Humanize a `due` date ("YYYY-MM-DD") for the badge: "heute" / "morgen" /
 * "überfällig", else a short "18.10." (with year when it differs from the
 * current one). Done items never read "überfällig" — a finished task should
 * not keep alarming. `overdue` marks the state for styling. Malformed values
 * fall through untouched (the server schema is the validation boundary).
 */
export function dueBadge(
  due: string,
  done = false,
  nowMs: number = Date.now(),
): { text: string; overdue: boolean } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return { text: due, overdue: false }
  let now = new Date(nowMs)
  let today = localDateKey(now)
  if (due < today && !done) return { text: 'überfällig', overdue: true }
  if (due === today) return { text: 'heute', overdue: false }
  // Day rollover via the Date constructor so DST/month ends stay correct.
  let tomorrow = localDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1))
  if (due === tomorrow) return { text: 'morgen', overdue: false }
  let short = `${due.slice(8, 10)}.${due.slice(5, 7)}.`
  return due.slice(0, 4) === today.slice(0, 4)
    ? { text: short, overdue: false }
    : { text: `${short}${due.slice(0, 4)}`, overdue: false }
}

/** Shallow copy used for undo snapshots and hydration; mirrors the old inline .map. */
export function cloneItems(items: ListItem[]): ListItem[] {
  return items.map((item) => ({ ...item }))
}

export function createItem(label: string, id: string, now: number): ListItem {
  return { id, label: label.trim(), updatedAt: now }
}

export function addItem(items: ListItem[], item: ListItem): ListItem[] {
  return [...items, item]
}

export function deleteItemAt(items: ListItem[], index: number): ListItem[] {
  if (!items[index]) return items
  return items.filter((_, i) => i !== index)
}

export function toggleDoneAt(items: ListItem[], index: number, now: number): ListItem[] {
  return items.map((item, i) =>
    i === index ? { ...item, done: !(item.done === true), updatedAt: now } : item,
  )
}

export function reverseItems(items: ListItem[]): ListItem[] {
  return items.toReversed()
}

export function shuffleItems(items: ListItem[], rand: () => number = Math.random): ListItem[] {
  let next = [...items]
  for (let i = next.length - 1; i > 0; i--) {
    let j = Math.floor(rand() * (i + 1))
    ;[next[i], next[j]] = [next[j]!, next[i]!]
  }
  return next
}

export function sortItems(items: ListItem[], mode: SortMode): ListItem[] {
  let next = [...items]
  switch (mode) {
    case 'az':
      next.sort((a, b) => a.label.localeCompare(b.label, 'de'))
      break
    case 'done':
      next.sort((a, b) => (a.done === true ? 1 : 0) - (b.done === true ? 1 : 0))
      break
    case 'updated':
      next.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
      break
    case 'due':
      // Dated items first, earliest due date on top (ISO calendar days compare
      // lexicographically in chronological order); undated items keep their
      // relative order at the end (Array#sort is stable).
      next.sort((a, b) => {
        if (!a.due && !b.due) return 0
        if (!a.due) return 1
        if (!b.due) return -1
        return a.due < b.due ? -1 : a.due > b.due ? 1 : 0
      })
      break
    case 'manual':
      break
  }
  return next
}

export function clearDoneItems(items: ListItem[]): { items: ListItem[]; removedIds: string[] } {
  let removedIds = items.filter((item) => item.done === true).map((item) => item.id)
  return { items: items.filter((item) => item.done !== true), removedIds }
}

export function removeItemsByIds(
  items: ListItem[],
  ids: ReadonlySet<string>,
): { items: ListItem[]; removed: ListItem[] } {
  let removed = items.filter((item) => ids.has(item.id))
  return { items: items.filter((item) => !ids.has(item.id)), removed }
}

export function toggleSelected(selected: ReadonlySet<string>, id: string): Set<string> {
  let next = new Set(selected)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

export function toggleAllVisible(selected: ReadonlySet<string>, visibleIds: string[]): Set<string> {
  let all = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id))
  let next = new Set(selected)
  if (all) {
    for (let id of visibleIds) next.delete(id)
  } else {
    for (let id of visibleIds) next.add(id)
  }
  return next
}

type ItemEdit = {
  label: string
  priority: '' | ItemPriority
  due: string
  tags: string
}

export function editItemFields(item: ListItem, edit: ItemEdit, now: number): ListItem {
  let next: ListItem = { ...item, label: edit.label.trim(), updatedAt: now }
  if (edit.priority) next.priority = edit.priority
  else delete next.priority
  if (edit.due.trim()) next.due = edit.due.trim()
  else delete next.due
  // Dedupe tags so a repeated value can't produce duplicate keys later.
  let tags = [
    ...new Set(
      edit.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  ]
  if (tags.length > 0) next.tags = tags
  else delete next.tags
  return next
}

export function itemsFingerprint(items: ListItem[]): string {
  return JSON.stringify(items)
}

export function parseItemsFingerprint(fingerprint: string): ListItem[] {
  return JSON.parse(fingerprint) as ListItem[]
}

/** In-list search: a falsy query returns the original reference (no copy).
 *  Matches the label or any tag, case-insensitive substring. */
export function filterItems(items: ListItem[], query: string): ListItem[] {
  let q = query.trim().toLowerCase()
  if (!q) return items
  return items.filter(
    (item) =>
      item.label.toLowerCase().includes(q) ||
      (item.tags ?? []).some((t) => t.toLowerCase().includes(q)),
  )
}
