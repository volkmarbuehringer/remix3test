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

export type UndoKind = 'delete' | 'clear' | 'clearDone' | 'deleteSelected' | 'bulkDone' | 'bulkOpen'

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

/** Set the completion state for every selected id in one pass. Ids that no
 *  longer exist are ignored, so a stale hidden selection can never resurrect a
 *  deleted row. */
export function setDoneByIds(
  items: ListItem[],
  ids: ReadonlySet<string>,
  done: boolean,
  now: number,
): ListItem[] {
  return items.map((item) => (ids.has(item.id) ? { ...item, done, updatedAt: now } : item))
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

export type StatusFilter = 'all' | 'open' | 'done' | 'overdue'

export type StatusCounts = {
  all: number
  open: number
  done: number
  overdue: number
}

/**
 * An open item whose due date is strictly before today. Mirrors the badge:
 * completed items never read as overdue, and malformed dates are ignored (the
 * server schema is the validation boundary).
 */
export function isOverdueItem(
  item: ListItem,
  todayKey: string = localDateKey(new Date()),
): boolean {
  return (
    item.done !== true &&
    typeof item.due === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(item.due) &&
    item.due < todayKey
  )
}

/**
 * Status tab predicate. `done` intentionally ignores `hideDone` — the user
 * explicitly asked to see completed rows. `open` and `overdue` already exclude
 * done items, so `hideDone` only narrows the `all` tab.
 */
export function filterItemsByStatus(
  items: ListItem[],
  status: StatusFilter,
  hideDone = false,
  nowMs: number = Date.now(),
): ListItem[] {
  let today = localDateKey(new Date(nowMs))
  switch (status) {
    case 'done':
      return items.filter((item) => item.done === true)
    case 'overdue':
      return items.filter((item) => isOverdueItem(item, today))
    case 'open':
      return items.filter((item) => item.done !== true)
    case 'all':
      return hideDone ? items.filter((item) => item.done !== true) : items
    default:
      return items
  }
}

/** Counts for the status tabs. Overdue only counts open items. */
export function countItemsByStatus(items: ListItem[], nowMs: number = Date.now()): StatusCounts {
  let today = localDateKey(new Date(nowMs))
  let counts: StatusCounts = { all: items.length, open: 0, done: 0, overdue: 0 }
  for (let item of items) {
    if (item.done === true) {
      counts.done++
    } else {
      counts.open++
      if (isOverdueItem(item, today)) counts.overdue++
    }
  }
  return counts
}

export type ViewOrderOptions = {
  reverse?: boolean
  /** Stable random ranking (item ids in display order). Overrides `mode`. */
  shuffleOrder?: readonly string[] | null
}

/**
 * View-only ordering. It never touches the persisted array: sort/reverse/
 * shuffle are applied to a copy for display, so the manual order survives until
 * the user explicitly reorders with drag/keyboard.
 */
export function orderViewItems(
  items: ListItem[],
  mode: SortMode,
  options: ViewOrderOptions = {},
): ListItem[] {
  let next: ListItem[]
  let shuffleOrder = options.shuffleOrder
  if (shuffleOrder && shuffleOrder.length > 0) {
    let rank = new Map(shuffleOrder.map((id, index) => [id, index]))
    next = items.toSorted(
      (a, b) =>
        (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER),
    )
  } else {
    next = sortItems(items, mode)
  }
  return options.reverse ? reverseItems(next) : next
}

export type ItemViewOptions = {
  query?: string
  status?: StatusFilter
  hideDone?: boolean
  sort?: SortMode
} & ViewOrderOptions

/**
 * The single composition used by the editor: text/tag filter → status filter →
 * view-only ordering. Each stage is pure, so callers can reuse the pieces.
 */
export function buildVisibleItems(
  items: ListItem[],
  options: ItemViewOptions = {},
  nowMs: number = Date.now(),
): ListItem[] {
  let filtered = filterItems(items, options.query ?? '')
  filtered = filterItemsByStatus(
    filtered,
    options.status ?? 'all',
    options.hideDone ?? false,
    nowMs,
  )
  return orderViewItems(filtered, options.sort ?? 'manual', {
    reverse: options.reverse ?? false,
    shuffleOrder: options.shuffleOrder ?? null,
  })
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
