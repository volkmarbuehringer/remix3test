export type DropZoneResult =
  | { zone: 'editor' }
  | { zone: 'sidebar'; listId: number }
  | { zone: 'none' }

export interface RectLike {
  top: number
  bottom: number
  left: number
  right: number
}

export interface SidebarRowRect {
  listId: number
  rect: RectLike
}

/**
 * Decides which drop zone a pointer is over. The editor container and the
 * sidebar rows never overlap geometrically; a single zone is always returned
 * so the reorder indicator and the sidebar highlight stay mutually exclusive.
 */
export function resolveDropZone(
  x: number,
  y: number,
  editorRect: RectLike | null,
  sidebarRows: SidebarRowRect[],
): DropZoneResult {
  if (
    editorRect &&
    y >= editorRect.top &&
    y <= editorRect.bottom &&
    x >= editorRect.left &&
    x <= editorRect.right
  ) {
    return { zone: 'editor' }
  }
  for (let row of sidebarRows) {
    let r = row.rect
    if (y >= r.top && y <= r.bottom && x >= r.left && x <= r.right) {
      return { zone: 'sidebar', listId: row.listId }
    }
  }
  return { zone: 'none' }
}
