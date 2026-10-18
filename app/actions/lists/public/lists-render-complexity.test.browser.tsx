import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { renderListsEditor, type ListsEditorView } from './lists-view.tsx'
import { drag } from './lists-drag-mixin.ts'
import type { ListsDragContext } from './lists-drag.ts'
import type { ListItem } from './lists-state.ts'

// ---------------------------------------------------------------------------
// /lists editor render-complexity guard (browser suite).
//
// `renderListsEditor` runs the row loop inside a single `vis.map`, and each row
// used to recompute values that are constant for the whole render but linear in
// the item count — `activeItemId()` (`items.some(...)` plus a `filterItems`
// allocation in its fallback) and a per-row `items.findIndex`. With a few
// hundred members that turned every `handle.update()` (fired on each member
// commit: the only way to persist a due date or tag) into an O(n²) scan, so a
// priority/tag edit took many seconds to paint.
//
// This pins the invariant: those helpers are evaluated a constant number of
// times per render, not once per row. No DOM or server needed — the JSX is only
// built, not mounted, so the spies observe exactly the render path.
// ---------------------------------------------------------------------------

function makeItems(count: number): ListItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `it-${i}`,
    label: `Member ${i}`,
    ...(i % 3 === 0 ? { done: true } : {}),
    ...(i % 5 === 0 ? { priority: 'high' as const } : {}),
    ...(i % 7 === 0 ? { due: '2026-01-01' } : {}),
    ...(i % 4 === 0 ? { tags: ['work', `t${i}`] } : {}),
  }))
}

type Counts = {
  visibleItems: number
  activeItemId: number
  reorderLocked: number
}

function renderWithSpy(items: ListItem[]): Counts {
  let counts: Counts = { visibleItems: 0, activeItemId: 0, reorderLocked: 0 }
  let noop = () => {}
  let noopAsync = async () => {}

  let view: ListsEditorView = {
    items,
    loadedListId: 7,
    title: 'Complexity guard',
    description: 'seeded',
    saving: false,
    loadingList: false,
    saveError: '',
    offline: false,
    conflictState: { show: false, serverState: null },
    draftRestored: false,
    undoSnapshot: null,
    undoKind: null,
    newItemLabel: '',
    listFilter: '',
    statusFilter: 'all',
    hideDone: false,
    sortMode: 'manual',
    reverseView: false,
    editingIndex: null,
    editText: '',
    editPriority: '',
    editDue: '',
    editTags: '',
    selectedItemIds: new Set<string>(),
    copyBusy: false,
    copyError: '',
    copyNotice: '',
    picker: null,
    pickerQuery: '',
    pickerResults: [],
    pickerHasMore: false,
    pickerLoading: false,
    pickerError: '',
    helpOpen: false,
    clearArmed: false,
    grabbedId: null,
    openItemMenuId: null,
    // The drag wiring is a browser-only mixin descriptor. The JSX is only
    // built here (never mounted), so the context is never invoked; the cast
    // just satisfies the descriptor's factory argument.
    drag: drag({} as ListsDragContext),
    visibleItems: () => {
      counts.visibleItems++
      return items
    },
    showDescription: () => true,
    statusColor: () => '#888',
    statusLabel: () => 'Gespeichert',
    isDirty: () => false,
    activeItemId: () => {
      counts.activeItemId++
      return items[0]?.id ?? null
    },
    reorderLocked: () => {
      counts.reorderLocked++
      return false
    },
    viewOrderActive: () => false,
    statusCounts: () => ({ all: items.length, open: items.length, done: 0, overdue: 0 }),
    scheduleAutosave: noop,
    saveNow: () => Promise.resolve(false),
    retrySave: noop,
    dismissSaveError: noop,
    flushNow: () => Promise.resolve(false),
    discardChanges: noop,
    copyCurrentList: noopAsync,
    reloadFromServer: noop,
    forceOverwrite: noop,
    discardDraft: noop,
    undo: noop,
    addItem: noop,
    setStatusFilter: noop,
    setHideDone: noop,
    setSortMode: noop,
    toggleReverse: noop,
    reshuffle: noop,
    resetFilters: noop,
    announce: noop,
    clearDone: noop,
    deleteSelected: noop,
    clearAll: noop,
    toggleSelectAllVisible: noop,
    setDoneSelected: noop,
    openBulkPicker: noop,
    openItemMovePicker: noop,
    selectPickerTarget: noop,
    closeTargetPicker: noop,
    setPickerQuery: noop,
    handlePickerKeyDown: noop,
    toggleHelp: noop,
    closeHelp: noop,
    clearSelectionAndError: noop,
    toggleSelected: noop,
    toggleDone: noop,
    startEditing: noop,
    saveEdit: noop,
    cancelEdit: noop,
    deleteItem: noop,
    moveUp: noop,
    moveDown: noop,
    handleRowKeyDown: noop,
    toggleItemMenu: noop,
    closeItemMenu: noop,
    focusItemTrigger: noop,
    setTitle: noop,
    setDescription: noop,
    setDescriptionMode: noop,
    setNewItemLabel: noop,
    setListFilter: noop,
    clearListFilter: noop,
    applyTagFilter: noop,
    setFocusedId: noop,
    setEditText: noop,
    setEditPriority: noop,
    setEditDue: noop,
    setEditTags: noop,
    onTitleInputRef: noop,
    onDescriptionInputRef: noop,
    onNewItemRef: noop,
    onFilterInputRef: noop,
    onSortSelectRef: noop,
    onListRef: noop,
    onCopyFormRef: noop,
    onCopyCsrfRef: noop,
    onPickerSearchRef: noop,
    onLiveRegion: noop,
  }

  renderListsEditor(view)
  return counts
}

describe('lists editor render complexity', () => {
  it('evaluates per-render constants once, not once per row', () => {
    let small = renderWithSpy(makeItems(20))
    let large = renderWithSpy(makeItems(400))

    // `visibleItems` is read once to build `vis`. `activeItemId` and
    // `reorderLocked` are hoisted above the row loop (previously O(n) each,
    // called per row). A linear-time render keeps these at a small constant
    // count whether there are 20 or 400 members.
    assert.ok(
      large.visibleItems <= 2,
      `visibleItems must not scale with rows (got ${large.visibleItems})`,
    )
    assert.ok(
      large.activeItemId <= 2,
      `activeItemId must not scale with rows (got ${large.activeItemId})`,
    )
    assert.ok(
      large.reorderLocked <= 2,
      `reorderLocked must not scale with rows (got ${large.reorderLocked})`,
    )

    // And it must not grow at all between 20 and 400 members.
    assert.equal(
      large.activeItemId,
      small.activeItemId,
      'activeItemId call count is independent of item count',
    )
    assert.equal(
      large.visibleItems,
      small.visibleItems,
      'visibleItems call count is independent of item count',
    )
  })
})
