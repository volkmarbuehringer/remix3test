export type KeyboardListItem = { id: string; label: string; done?: boolean }

/**
 * Pure reorder of an array element from `from` to `to`. Returns the same
 * reference when the move is a no-op (out of bounds or from === to) so callers
 * can skip side effects.
 */
export function moveItemInArray<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || from >= items.length) return items
  if (to < 0 || to >= items.length) return items
  if (from === to) return items
  let next = items.slice()
  let [removed] = next.splice(from, 1)
  next.splice(to, 0, removed!)
  return next
}

/**
 * Resolve the index of the first item whose label starts with `char`,
 * searching forward from `fromIndex` and wrapping to the start if not found.
 * Returns -1 when nothing matches.
 */
export function findTypeaheadTarget(
  items: Array<{ label: string }>,
  fromIndex: number,
  char: string,
): number {
  let lower = char.toLowerCase()
  let target = items.findIndex((it, i) => i > fromIndex && it.label.toLowerCase().startsWith(lower))
  if (target === -1) target = items.findIndex((it) => it.label.toLowerCase().startsWith(lower))
  return target
}

/**
 * Resolve the next roving-focus index for arrow / Home / End navigation,
 * clamped to the list bounds.
 */
export function nextFocusIndex(length: number, current: number, key: string): number {
  if (length <= 0) return -1
  switch (key) {
    case 'ArrowDown':
      return Math.min(length - 1, current + 1)
    case 'ArrowUp':
      return Math.max(0, current - 1)
    case 'Home':
      return 0
    case 'End':
      return length - 1
    default:
      return current
  }
}
