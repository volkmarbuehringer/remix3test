import { theme } from '../../../ui/theme/theme.ts'
import { resolveDropZone, type RectLike, type SidebarRowRect } from './drop-zone.ts'
import { mergeListRequest, moveItemRequest, type ServerListState } from './lists-api.ts'
import type { ListItem } from './lists-state.ts'
import { sidebarRowLabel } from './sidebar-sync.ts'

/**
 * Drag-and-drop controller for /lists: intra-list item reorder, item drop onto
 * a sidebar row (move to another list), and list-onto-list drop (merge).
 *
 * Extracted from the ListsClient closure. It owns only the transient drag state
 * and the DOM wiring; all editor state is reached through the context callbacks.
 */
export type ListsDragContext = {
  getItems: () => ListItem[]
  getLoadedListId: () => number | null
  getLoadedUpdatedAt: () => number | null
  getListRef: () => HTMLDivElement | null
  isFilterActive: () => boolean
  getCsrfHeaders: () => Record<string, string>
  flush: () => Promise<boolean>
  commitReorder: (items: ListItem[]) => void
  setLoadError: (message: string) => void
  showConflict: (state: ServerListState) => void
  reloadFrame: () => void
  update: () => void
  signal: AbortSignal
}

export type ListsDragController = {
  handleDragStart: (e: DragEvent, index: number) => void
  handleDragOver: (e: DragEvent, index: number) => void
  handleContainerDragOver: (e: DragEvent) => void
  autoScrollList: (clientY: number) => void
  handleDrop: (e: DragEvent) => void
  handleDragEnd: () => void
}

export function createListsDrag(ctx: ListsDragContext): ListsDragController {
  let dragIndex: number | null = null
  let dropIndex: number | null = null
  let draggedEl: HTMLElement | null = null
  let indicatorEl: HTMLElement | null = null

  // Cross-list drag state (sidebar rows as drop targets)
  let sidebarHighlightEl: HTMLElement | null = null
  let editorRect: RectLike | null = null
  let sidebarRows: SidebarRowRect[] = []
  let sidebarDragCleanup: (() => void) | null = null

  // List-to-list drag state (sidebar rows as draggable sources)
  let dragKind: 'item' | 'list' | null = null
  let draggedListId: number | null = null
  let listDragCleanup: (() => void) | null = null

  let clearDragOver = () => {
    if (draggedEl) {
      draggedEl.style.opacity = ''
      draggedEl = null
    }
    if (indicatorEl) {
      indicatorEl.style.borderTop = ''
      indicatorEl.style.borderBottom = ''
      indicatorEl = null
    }
  }

  let handleDragStart = (e: DragEvent, index: number) => {
    let target = e.target as HTMLElement
    if (target.closest('button, input, textarea, [contenteditable]')) {
      e.preventDefault()
      return
    }
    if (ctx.isFilterActive()) {
      e.preventDefault()
      return
    }
    dragKind = 'item'
    dragIndex = index
    dropIndex = null
    e.dataTransfer!.effectAllowed = 'move'
    e.dataTransfer!.setData('text/plain', index.toString())
    let el = e.currentTarget as HTMLElement
    draggedEl = el
    el.style.opacity = '0.4'
    clearSidebarHighlight()
    measureDropZones()
    startSidebarDragWiring()
  }

  let elByIndex = (i: number): HTMLElement | null => {
    let child = ctx.getListRef()?.children[i]
    return child instanceof HTMLElement ? child : null
  }

  let showIndicator = (pos: number) => {
    if (indicatorEl) {
      indicatorEl.style.borderTop = ''
      indicatorEl.style.borderBottom = ''
      indicatorEl = null
    }
    dropIndex = pos
    let isNoop = dragIndex !== null && (dropIndex === dragIndex || dropIndex === dragIndex + 1)
    if (isNoop) return
    if (dropIndex < ctx.getItems().length) {
      let el = elByIndex(dropIndex)
      if (el) {
        el.style.borderTop = `2px solid ${theme.colors.focus.ring}`
        indicatorEl = el
      }
    } else if (dropIndex === ctx.getItems().length && ctx.getItems().length > 0) {
      let el = elByIndex(ctx.getItems().length - 1)
      if (el) {
        el.style.borderBottom = `2px solid ${theme.colors.focus.ring}`
        indicatorEl = el
      }
    }
  }

  let handleDragOver = (e: DragEvent, index: number) => {
    e.preventDefault()
    e.stopPropagation()
    if (dragIndex === null) return
    let rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    let midY = rect.top + rect.height / 2
    let newDropIndex = e.clientY < midY ? index : index + 1
    let isNoop = newDropIndex === dragIndex || newDropIndex === dragIndex + 1
    e.dataTransfer!.dropEffect = isNoop ? 'none' : 'move'
    if (newDropIndex === dropIndex) return
    showIndicator(newDropIndex)
  }

  let handleContainerDragOver = (e: DragEvent) => {
    e.preventDefault()
    if (dragIndex === null || ctx.getItems().length === 0) return
    let newDropIndex = ctx.getItems().length
    for (let i = 0; i < ctx.getItems().length; i++) {
      let el = elByIndex(i)
      if (!el) continue
      let rect = el.getBoundingClientRect()
      if (e.clientY < rect.top + rect.height / 2) {
        newDropIndex = i
        break
      }
    }
    let isNoop = newDropIndex === dragIndex || newDropIndex === dragIndex + 1
    e.dataTransfer!.dropEffect = isNoop ? 'none' : 'move'
    if (newDropIndex === dropIndex) return
    showIndicator(newDropIndex)
  }

  // Scroll the element list toward a pointer near its top/bottom edge during a
  // drag, so an item can be reordered to a position far below the fold.
  let autoScrollList = (clientY: number) => {
    let listRef = ctx.getListRef()
    if (!listRef) return
    let rect = listRef.getBoundingClientRect()
    let edge = 48
    if (clientY < rect.top + edge) {
      listRef.scrollTop -= 14
    } else if (clientY > rect.bottom - edge) {
      listRef.scrollTop += 14
    }
  }

  let handleDrop = (e: DragEvent) => {
    e.preventDefault()
    clearDragOver()
    if (dragIndex === null || dropIndex === null) {
      dragIndex = null
      dropIndex = null
      return
    }
    if (dropIndex === dragIndex || dropIndex === dragIndex + 1) {
      dragIndex = null
      dropIndex = null
      return
    }
    let newItems = [...ctx.getItems()]
    let [removed] = newItems.splice(dragIndex, 1)
    let adjustedDrop = dropIndex > dragIndex ? dropIndex - 1 : dropIndex
    newItems.splice(adjustedDrop, 0, removed!)
    dragIndex = null
    dropIndex = null
    ctx.commitReorder(newItems)
  }

  // Cross-list drag: sidebar rows as drop targets
  let rectOf = (el: HTMLElement): RectLike => {
    let r = el.getBoundingClientRect()
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }
  }

  let measureDropZones = () => {
    let listRef = ctx.getListRef()
    editorRect = listRef ? rectOf(listRef) : null
    sidebarRows = Array.from(document.querySelectorAll<HTMLElement>('[data-list-id]'))
      .map((el) => ({ listId: Number(el.dataset.listId), rect: rectOf(el) }))
      .filter((row) => Number.isFinite(row.listId))
  }

  let showSidebarHighlight = (listId: number) => {
    if (sidebarHighlightEl) sidebarHighlightEl.style.boxShadow = ''
    let row = Array.from(document.querySelectorAll<HTMLElement>('[data-list-id]')).find(
      (el) => Number(el.dataset.listId) === listId,
    )
    sidebarHighlightEl = row ?? null
    if (row) row.style.boxShadow = `inset 0 0 0 2px ${theme.colors.focus.ring}`
  }

  let clearSidebarHighlight = () => {
    if (sidebarHighlightEl) {
      sidebarHighlightEl.style.boxShadow = ''
      sidebarHighlightEl = null
    }
  }

  let startSidebarDragWiring = () => {
    stopSidebarDragWiring()
    let ac = new AbortController()
    window.addEventListener(
      'dragover',
      (e) => {
        let zone = resolveDropZone(e.clientX, e.clientY, editorRect, sidebarRows)
        if (zone.zone === 'none') return
        e.preventDefault()
        if (zone.zone === 'editor') {
          clearSidebarHighlight()
        } else {
          // Dismiss only the intra-list indicator — keep the dragged item lifted.
          if (indicatorEl) {
            indicatorEl.style.borderTop = ''
            indicatorEl.style.borderBottom = ''
            indicatorEl = null
          }
          dropIndex = null
          showSidebarHighlight(zone.listId)
        }
      },
      { capture: true, signal: ac.signal },
    )
    for (let row of Array.from(document.querySelectorAll<HTMLElement>('[data-list-id]'))) {
      row.addEventListener('drop', (e) => handleSidebarDrop(e as DragEvent, row), {
        signal: ac.signal,
      })
    }
    sidebarDragCleanup = () => ac.abort()
  }

  let stopSidebarDragWiring = () => {
    if (sidebarDragCleanup) {
      sidebarDragCleanup()
      sidebarDragCleanup = null
    }
  }

  let handleSidebarDrop = async (e: DragEvent, row: HTMLElement) => {
    e.preventDefault()
    e.stopPropagation()
    if (dragIndex === null) return
    let targetId = Number(row.dataset.listId)
    let sourceId = ctx.getLoadedListId()
    let item = ctx.getItems()[dragIndex]
    dragIndex = null
    dropIndex = null
    clearSidebarHighlight()
    clearDragOver()
    stopSidebarDragWiring()
    if (sourceId === null || !Number.isFinite(targetId) || !item) {
      ctx.update()
      return
    }
    if (targetId === sourceId) {
      ctx.setLoadError('Element kann nicht in dieselbe Liste verschoben werden')
      ctx.update()
      return
    }

    // Persist any pending edits first so the reload reads a consistent row.
    let flushed = await ctx.flush()
    if (!flushed) {
      ctx.update()
      return
    }

    try {
      let outcome = await moveItemRequest(ctx.getCsrfHeaders(), sourceId, targetId, item.id)
      if (outcome.status === 'ok') {
        ctx.reloadFrame()
      } else if (outcome.status === 'conflict') {
        ctx.showConflict(outcome.state)
        ctx.update()
      } else {
        ctx.setLoadError(
          outcome.network
            ? 'Verschieben fehlgeschlagen (Netzwerkfehler)'
            : 'Verschieben fehlgeschlagen',
        )
        ctx.update()
      }
    } catch {
      ctx.setLoadError('Verschieben fehlgeschlagen (Netzwerkfehler)')
      ctx.update()
    }
  }

  // ── List-to-list drag (sidebar rows as draggable sources) ────────────────
  // Dropping list A on list B copies A's ctx.getItems() into B (fresh ids), leaving A
  // intact. Distinct from the item drag above: it uses a dedicated
  // dataTransfer type and never assigns `dragIndex`, so the editor's item
  // drop handlers (which bail on `dragIndex === null`) ignore it.
  let stopListDragWiring = () => {
    if (listDragCleanup) {
      listDragCleanup()
      listDragCleanup = null
    }
  }

  let cleanupListDrag = () => {
    clearSidebarHighlight()
    stopListDragWiring()
    draggedListId = null
    if (dragKind === 'list') dragKind = null
  }

  let parseListCount = (row: HTMLElement | null | undefined): number | null => {
    if (!row) return null
    let text = row.querySelector('[data-list-count]')?.textContent?.trim() ?? ''
    let match = text.match(/(\d+)\s*$/)
    return match ? Number(match[1]) : null
  }

  let handleListDragOver = (e: DragEvent, row: HTMLElement) => {
    if (dragKind !== 'list' || draggedListId === null) return
    let targetId = Number(row.dataset.listId)
    if (!Number.isFinite(targetId) || targetId === draggedListId) {
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'none'
      clearSidebarHighlight()
      return
    }
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    showSidebarHighlight(targetId)
  }

  let startListDragWiring = () => {
    stopListDragWiring()
    let ac = new AbortController()
    // Clear the highlight when the pointer leaves every sidebar row (e.g. over
    // the editor or empty space) so a stale target is never shown.
    window.addEventListener(
      'dragover',
      (e) => {
        if (dragKind !== 'list') return
        let target = e.target as HTMLElement | null
        if (!target?.closest?.('[data-list-id]')) clearSidebarHighlight()
      },
      { capture: true, signal: ac.signal },
    )
    for (let row of Array.from(document.querySelectorAll<HTMLElement>('[data-list-id]'))) {
      row.addEventListener('dragover', (e) => handleListDragOver(e as DragEvent, row), {
        signal: ac.signal,
      })
      row.addEventListener('drop', (e) => handleListDrop(e as DragEvent, row), {
        signal: ac.signal,
      })
    }
    listDragCleanup = () => ac.abort()
  }

  let handleListDragStart = (e: DragEvent, row: HTMLElement) => {
    let target = e.target as HTMLElement
    if (target.closest('button, input, textarea, [contenteditable]')) {
      e.preventDefault()
      return
    }
    let sourceId = Number(row.dataset.listId)
    if (!Number.isFinite(sourceId)) return
    dragKind = 'list'
    draggedListId = sourceId
    dragIndex = null
    dropIndex = null
    clearDragOver()
    clearSidebarHighlight()
    // Synthetic drag events in some browsers (Firefox) carry a null
    // dataTransfer; the wiring must proceed regardless.
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'copy'
      e.dataTransfer.setData('text/x-list-id', String(sourceId))
      e.dataTransfer.setData('text/plain', `list:${sourceId}`)
    }
    startListDragWiring()
  }

  let handleListDrop = async (e: DragEvent, row: HTMLElement) => {
    e.preventDefault()
    e.stopPropagation()
    if (dragKind !== 'list' || draggedListId === null) return
    let sourceId = draggedListId
    let targetId = Number(row.dataset.listId)
    let sourceRow = document.querySelector<HTMLElement>(`[data-list-id="${sourceId}"]`)
    let sourceName = sidebarRowLabel(sourceRow, sourceId)
    let targetName = sidebarRowLabel(row, targetId)
    let sourceUpdatedAt = Number(sourceRow?.dataset.updatedAt)
    let count = parseListCount(sourceRow)
    cleanupListDrag()
    if (!Number.isFinite(targetId) || targetId === sourceId) {
      ctx.update()
      return
    }

    let message =
      count !== null
        ? `Alle ${count} Einträge von "${sourceName}" in "${targetName}" kopieren?`
        : `Alle Einträge von "${sourceName}" in "${targetName}" kopieren?`
    if (typeof window !== 'undefined' && !window.confirm(message)) {
      ctx.update()
      return
    }

    // Flush pending edits when the loaded list is either side of the merge,
    // otherwise the frame reload would discard them.
    if (
      ctx.getLoadedListId() !== null &&
      (ctx.getLoadedListId() === sourceId || ctx.getLoadedListId() === targetId)
    ) {
      let flushed = await ctx.flush()
      if (!flushed) {
        ctx.update()
        return
      }
    }

    // Resolve the precondition *after* the flush: saving the open list bumps
    // its `updated_at`, so the sidebar snapshot taken before the flush would
    // fail the server's If-Match with a spurious 409. The loaded list's live
    // timestamp is authoritative; every other row keeps its server snapshot.
    let sourcePrecondition =
      ctx.getLoadedListId() === sourceId && ctx.getLoadedUpdatedAt() !== null
        ? ctx.getLoadedUpdatedAt()
        : sourceUpdatedAt

    let headers = ctx.getCsrfHeaders()
    if (Number.isFinite(sourcePrecondition)) headers['If-Match'] = String(sourcePrecondition)
    else delete headers['If-Match']

    try {
      let outcome = await mergeListRequest(headers, sourceId, targetId)
      if (outcome.status === 'ok') {
        ctx.reloadFrame()
      } else if (outcome.status === 'conflict') {
        let server = outcome.state
        if (server.id === ctx.getLoadedListId()) {
          // The open list is the one that moved on, so the conflict banner's
          // actions (reload / overwrite) target the right row.
          ctx.showConflict(server)
        } else {
          // A *different* list's source row changed since this page rendered.
          // The conflict banner hydrates and saves the loaded list, so using
          // it here would silently switch the editor to another list. Refresh
          // the stale sidebar snapshot and ask the user to drag again.
          if (sourceRow && Number.isFinite(server.updated_at)) {
            sourceRow.setAttribute('data-updated-at', String(server.updated_at))
          }
          ctx.setLoadError(
            `Die Liste "${sourceName}" wurde zwischenzeitlich geändert. Bitte erneut ziehen.`,
          )
        }
        ctx.update()
      } else if (outcome.status === 'not_found') {
        ctx.setLoadError('Liste nicht gefunden')
        ctx.update()
      } else if (outcome.status === 'bad_request') {
        ctx.setLoadError(count === 0 ? 'Die Quellliste ist leer' : 'Zusammenführen nicht möglich')
        ctx.update()
      } else {
        ctx.setLoadError(
          outcome.network
            ? 'Zusammenführen fehlgeschlagen (Netzwerkfehler)'
            : 'Zusammenführen fehlgeschlagen',
        )
        ctx.update()
      }
    } catch {
      ctx.setLoadError('Zusammenführen fehlgeschlagen (Netzwerkfehler)')
      ctx.update()
    }
  }

  let handleListDragEnd = () => {
    if (dragKind !== 'list') return
    cleanupListDrag()
    ctx.update()
  }

  // Delegated listener: catches dragstart on any sidebar row regardless of
  // when the rows enter the DOM (the frame content is spliced in after this
  // client entry mounts). The event bubbles from the row to the document.
  let onDocumentDragStart = (e: DragEvent) => {
    if (dragKind === 'list') return
    let target = e.target as HTMLElement | null
    let row = target?.closest?.('[data-list-id]') as HTMLElement | null
    if (!row) return
    handleListDragStart(e, row)
  }

  let onDocumentDragEnd = () => {
    if (dragKind !== 'list') return
    cleanupListDrag()
    ctx.update()
  }

  let handleDragEnd = () => {
    let dirty = draggedEl !== null || indicatorEl !== null || dragIndex !== null
    clearDragOver()
    clearSidebarHighlight()
    stopSidebarDragWiring()
    dragIndex = null
    dropIndex = null
    dragKind = null
    if (dirty) ctx.update()
  }
  // Register the delegated list-drag listeners once per mount. The body runs
  // once (only the render function re-runs on update), so this lands before any
  // drag; the document guard keeps SSR a no-op.
  if (typeof document !== 'undefined') {
    document.addEventListener('dragstart', onDocumentDragStart, { signal: ctx.signal })
    document.addEventListener('dragend', onDocumentDragEnd, { signal: ctx.signal })
  }

  return {
    handleDragStart,
    handleDragOver,
    handleContainerDragOver,
    autoScrollList,
    handleDrop,
    handleDragEnd,
  }
}
