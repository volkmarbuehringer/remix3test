import { type RemixNode, css, on, ref } from 'remix/component'
import { theme } from '../../../ui/theme/theme.ts'
import { frames } from '../../../routes.ts'
import button from '../../../ui/theme/button.ts'
import { Glyph } from '../../../ui/theme/glyph/glyph.tsx'

import type { ListsDragMixinDescriptor } from './lists-drag-mixin.ts'
import type { ListTarget } from './lists-api.ts'
import {
  type ItemPriority,
  type ListConflictState,
  type ListItem,
  type SortMode,
  type StatusCounts,
  type StatusFilter,
  type UndoKind,
  dueBadge,
  priorityLabel,
} from './lists-state.ts'
import { UNTITLED_LIST_LABEL } from './sidebar-sync.ts'
import {
  multilineDisplayStyle,
  gripStyle,
  itemMainStyle,
  metaRowStyle,
  metaBadgeStyle,
  dueBadgeStyle,
  overdueBadgeStyle,
  tagChipStyle,
  tagChipButtonStyle,
  editTextareaStyle,
  metaEditorStyle,
  metaFieldStyle,
  priorityBadge,
  cardStyle,
  cardHeaderStyle,
  cardTitleWrapStyle,
  listContextStyle,
  titleHeadingStyle,
  titleInputStyle,
  visuallyHiddenStyle,
  cardHeaderActionsStyle,
  cardBodyStyle,
  panelHeaderStyle,
  panelLeftStyle,
  panelRightStyle,
  panelFilterInputStyle,
  iconToolbarBtnStyle,
  menuDetailsStyle,
  menuSummaryStyle,
  menuPanelStyle,
  countTextStyle,
  dangerTextStyle,
  dangerArmedStyle,
  selectionCheckboxStyle,
  doneCheckboxStyle,
  bulkBarStyle,
  bulkCountStyle,
  bulkNoticeStyle,
  bulkErrorStyle,
  targetPickerOverlayStyle,
  targetPickerDialogStyle,
  targetPickerHeaderStyle,
  targetPickerTitleStyle,
  targetPickerCloseStyle,
  targetPickerBodyStyle,
  targetPickerSearchStyle,
  targetPickerResultsStyle,
  targetPickerOptionStyle,
  targetPickerOptionLabelStyle,
  targetPickerMetaStyle,
  targetPickerStateStyle,
  targetPickerHintStyle,
  sortSelectStyle,
  viewOnlyHintStyle,
  statusBarStyle,
  statusTabsStyle,
  statusTabStyle,
  statusCountStyle,
  hideDoneLabelStyle,
  resetFiltersStyle,
  filterInputStyle,
  descriptionHeadStyle,
  descriptionLabelStyle,
  collapseBtnStyle,
  descriptionTextareaStyle,
  showDescriptionBtnStyle,
  clearFilterBtnStyle,
  itemActionsStyle,
  itemEditActionsStyle,
  itemEditMainStyle,
  itemMenuButtonStyle,
  itemMenuItemStyle,
  itemMenuStyle,
  iconActionStyle,
  iconActionFirstStyle,
  iconActionLastStyle,
  iconActionDangerStyle,
} from './lists-styles.ts'

/**
 * Presentational contract for the /lists editor. The ListsClient closure builds
 * this view and calls renderListsEditor; every mutation flows back through the
 * setter callbacks so the editor state stays owned by the client entry.
 */
export type ListsEditorView = {
  items: ListItem[]
  loadedListId: number | null
  title: string
  description: string
  saving: boolean
  loadingList: boolean
  saveError: string
  offline: boolean
  conflictState: ListConflictState
  draftRestored: boolean
  undoSnapshot: ListItem[] | null
  undoKind: UndoKind | null
  newItemLabel: string
  listFilter: string
  statusFilter: StatusFilter
  hideDone: boolean
  sortMode: SortMode
  reverseView: boolean
  editingIndex: number | null
  editText: string
  editPriority: '' | ItemPriority
  editDue: string
  editTags: string
  selectedItemIds: Set<string>
  copyBusy: boolean
  copyError: string
  copyNotice: string
  picker: {
    purpose: 'copy' | 'move'
    itemIds: string[]
    singleItemId: string | null
  } | null
  pickerQuery: string
  pickerResults: ListTarget[]
  pickerHasMore: boolean
  pickerLoading: boolean
  pickerError: string
  clearArmed: boolean
  grabbedId: string | null
  openItemMenuId: string | null
  drag: ListsDragMixinDescriptor

  visibleItems: () => ListItem[]
  showDescription: () => boolean
  statusColor: () => string
  statusLabel: () => string
  isDirty: () => boolean
  activeItemId: () => string | null
  reorderLocked: () => boolean
  viewOrderActive: () => boolean
  statusCounts: () => StatusCounts

  scheduleAutosave: (fast?: boolean) => void
  saveNow: (manual?: boolean) => Promise<boolean>
  retrySave: () => void
  dismissSaveError: () => void
  flushNow: () => Promise<boolean>
  discardChanges: () => void
  copyCurrentList: () => Promise<void>
  reloadFromServer: () => void
  forceOverwrite: () => void
  discardDraft: () => void
  undo: () => void
  addItem: () => void
  setStatusFilter: (status: StatusFilter) => void
  setHideDone: (value: boolean) => void
  setSortMode: (mode: SortMode) => void
  toggleReverse: () => void
  reshuffle: () => void
  resetFilters: () => void
  announce: (message: string) => void
  clearDone: () => void
  deleteSelected: () => void
  clearAll: () => void
  toggleSelectAllVisible: () => void
  setDoneSelected: (done: boolean) => void
  openBulkPicker: (purpose: 'copy' | 'move', trigger: HTMLElement | null) => void
  openItemMovePicker: (itemId: string, trigger: HTMLElement | null) => void
  selectPickerTarget: (target: ListTarget) => void
  closeTargetPicker: (restoreFocus?: boolean) => void
  setPickerQuery: (value: string) => void
  handlePickerKeyDown: (event: KeyboardEvent) => void
  clearSelectionAndError: () => void
  toggleSelected: (id: string) => void
  toggleDone: (index: number) => void
  startEditing: (index: number) => void
  saveEdit: () => void
  cancelEdit: () => void
  deleteItem: (index: number) => void
  moveUp: (index: number) => void
  moveDown: (index: number) => void
  handleRowKeyDown: (e: KeyboardEvent, index: number) => void
  toggleItemMenu: (id: string) => void
  closeItemMenu: () => void
  focusItemTrigger: (id: string | null) => void

  setTitle: (value: string) => void
  setDescription: (value: string) => void
  setDescriptionMode: (mode: 'auto' | 'open' | 'closed') => void
  setNewItemLabel: (value: string) => void
  setListFilter: (value: string) => void
  clearListFilter: () => void
  applyTagFilter: (tag: string) => void
  setFocusedId: (id: string) => void
  setEditText: (value: string) => void
  setEditPriority: (value: '' | ItemPriority) => void
  setEditDue: (value: string) => void
  setEditTags: (value: string) => void

  onTitleInputRef: (el: HTMLInputElement | null) => void
  onDescriptionInputRef: (el: HTMLTextAreaElement | null) => void
  onNewItemRef: (el: HTMLTextAreaElement | null) => void
  onFilterInputRef: (el: HTMLInputElement | null) => void
  onSortSelectRef: (el: HTMLSelectElement | null) => void
  onListRef: (el: HTMLDivElement | null) => void
  onCopyFormRef: (el: HTMLFormElement | null) => void
  onCopyCsrfRef: (el: HTMLInputElement | null) => void
  onPickerSearchRef: (el: HTMLInputElement | null) => void
  onLiveRegion: (el: HTMLElement | null) => void
}

export function renderListsEditor(view: ListsEditorView): RemixNode {
  // Loading feedback for a frame swap (list switch, sidebar-search submit,
  // pagination). A non-blocking placeholder, not an error takeover: the old
  // editor is replaced only for the duration of the reload, then reloadComplete
  // re-hydrates the real content.
  if (view.loadingList) {
    return (
      <div
        data-loading-list=""
        role="status"
        aria-live="polite"
        mix={css({
          fontFamily: theme.fontFamily.sans,
          maxWidth: 'min(1000px, calc(100% - 2rem))',
          width: '100%',
          margin: '0 auto',
          padding: theme.space.xxl,
          display: 'flex',
          flexDirection: 'column',
          gap: theme.space.md,
        })}
      >
        <span mix={visuallyHiddenStyle}>Liste wird geladen…</span>
        {[0, 1, 2].map((row) => (
          <span
            key={row}
            aria-hidden="true"
            mix={css({
              display: 'block',
              height: row === 0 ? '2rem' : '3rem',
              width: row === 0 ? '60%' : '100%',
              borderRadius: theme.radius.md,
              backgroundColor: theme.surface.lvl2,
            })}
          />
        ))}
      </div>
    )
  }

  let {
    items,
    loadedListId,
    title,
    description,
    saving,
    saveError,
    offline,
    conflictState,
    draftRestored,
    undoSnapshot,
    undoKind,
    newItemLabel,
    listFilter,
    statusFilter,
    hideDone,
    sortMode,
    reverseView,
    editingIndex,
    editText,
    editPriority,
    editDue,
    editTags,
    selectedItemIds,
    copyBusy,
    copyError,
    copyNotice,
    picker,
    pickerQuery,
    pickerResults,
    pickerHasMore,
    pickerLoading,
    pickerError,
    clearArmed,
    grabbedId,
    openItemMenuId,
    drag,
    visibleItems,
    showDescription,
    statusColor,
    statusLabel,
    isDirty,
    activeItemId,
    reorderLocked,
    viewOrderActive,
    statusCounts,
    scheduleAutosave,
    saveNow,
    retrySave,
    dismissSaveError,
    flushNow,
    discardChanges,
    copyCurrentList,
    reloadFromServer,
    forceOverwrite,
    discardDraft,
    undo,
    addItem,
    setStatusFilter,
    setHideDone,
    setSortMode,
    toggleReverse,
    reshuffle,
    resetFilters,
    announce,
    clearDone,
    deleteSelected,
    clearAll,
    toggleSelectAllVisible,
    setDoneSelected,
    openBulkPicker,
    openItemMovePicker,
    selectPickerTarget,
    closeTargetPicker,
    setPickerQuery,
    handlePickerKeyDown,
    onPickerSearchRef,
    toggleSelected,
    toggleDone,
    startEditing,
    saveEdit,
    cancelEdit,
    deleteItem,
    moveUp,
    moveDown,
    handleRowKeyDown,
    toggleItemMenu,
    closeItemMenu,
    focusItemTrigger,
  } = view

  let vis = visibleItems()
  // One-pass visible→real index map. The row loop runs inside a `vis.map`, and
  // every visible row needs its position in the full `items` array (mutations
  // address the real array, and the filter can reorder/hide rows). Calling
  // `items.findIndex` per row made each `handle.update()` — fired on every
  // member edit commit — O(n²). This keeps the render linear.
  let realIndexById = new Map<string, number>()
  for (let i = 0; i < items.length; i++) {
    let id = items[i]!.id
    if (!realIndexById.has(id)) realIndexById.set(id, i)
  }
  // The roving-tabindex id and the reorder-disabled flag are constant for the
  // whole render. `activeItemId()` is O(n) (`items.some(...)` plus a full
  // `filterItems` allocation in the fallback branch) and `filterActive()` reads
  // the filter, so evaluating either inside `vis.map` turned the render into
  // O(n²) with n array copies — a multi-second stall once a list had enough
  // members. Compute them once here.
  let activeId = activeItemId()
  let rowDraggable = !reorderLocked()
  // Progress reflects the whole list, not the filtered view: hiding done rows
  // must not turn "4 von 10 erledigt" into a misleading "0 von 6".
  let doneCount = items.filter((item) => item.done === true).length
  let totalCount = items.length
  let counts = statusCounts()
  // The All tab count must match what the tab will actually show when the
  // hide-done shortcut is active.
  let allTabCount = hideDone && statusFilter !== 'done' ? counts.open : counts.all
  let allVisibleSelected = vis.length > 0 && vis.every((item) => selectedItemIds.has(item.id))
  let selectedExistingCount = items.filter((item) => selectedItemIds.has(item.id)).length
  let visibleSelectedCount = vis.filter((item) => selectedItemIds.has(item.id)).length
  let hiddenSelectedCount = Math.max(0, selectedExistingCount - visibleSelectedCount)

  return (
    <div
      mix={cardStyle}
      data-lists-active-id={loadedListId === null ? undefined : String(loadedListId)}
    >
      {/* Card header: editable title + primary action + save status */}
      <div mix={cardHeaderStyle}>
        <div mix={cardTitleWrapStyle}>
          <span mix={listContextStyle} data-list-context>
            {loadedListId === null ? 'Neue Liste' : title.trim() ? 'Liste' : UNTITLED_LIST_LABEL}
          </span>
          <h1 mix={titleHeadingStyle}>
            <label mix={visuallyHiddenStyle} htmlFor="lists-title">
              Titel der Liste
            </label>
            <input
              id="lists-title"
              mix={[
                titleInputStyle,
                ref((el: HTMLInputElement) => view.onTitleInputRef(el)),
                on('input', (e) => {
                  view.setTitle(e.currentTarget.value)
                }),
                on('blur', () => {
                  scheduleAutosave(true)
                }),
              ]}
              type="text"
              placeholder={
                loadedListId === null ? 'Kurzer Titel für diese Liste…' : 'Titel der Liste…'
              }
              maxLength={200}
              defaultValue={title}
            />
          </h1>
        </div>
        <div mix={cardHeaderActionsStyle}>
          {loadedListId === null ? (
            <button
              mix={[
                button({ tone: 'primary' }),
                on('click', () => {
                  void saveNow(true)
                }),
              ]}
              disabled={saving}
            >
              + Liste hinzufügen
            </button>
          ) : (
            <>
              <button
                mix={[
                  button({ tone: 'secondary' }),
                  on('click', () => {
                    void copyCurrentList()
                  }),
                ]}
                disabled={saving}
                title="Diese Liste duplizieren"
              >
                ⧉ Duplizieren
              </button>
              {isDirty() && (
                <button
                  mix={[button({ tone: 'secondary' }), on('click', discardChanges)]}
                  disabled={saving}
                  title="Ungespeicherte Änderungen verwerfen"
                >
                  ↶ Verwerfen
                </button>
              )}
              <button
                mix={[
                  button({ tone: 'primary' }),
                  on('click', () => {
                    void flushNow()
                  }),
                ]}
                disabled={!isDirty() || saving}
              >
                Speichern
              </button>
              {/* Hidden form used by Duplizieren — the frame runtime
                      intercepts the POST (data-rmx-target) and follows the
                      server redirect to the new list. */}
              <form
                method="POST"
                action={`/lists/${loadedListId}/copy`}
                data-rmx-target={frames.listsContent}
                hidden
                mix={[ref((el) => view.onCopyFormRef(el))]}
              >
                <input
                  type="hidden"
                  name="_csrf"
                  value=""
                  mix={[ref((el) => view.onCopyCsrfRef(el))]}
                />
              </form>
            </>
          )}
          {saveError ? (
            <button
              type="button"
              data-save-status-retry=""
              title={saveError}
              aria-label={`Speichern fehlgeschlagen: ${saveError}. Erneut versuchen`}
              mix={[
                button({ tone: 'secondary' }),
                css({
                  fontSize: theme.fontSize.xs,
                  fontWeight: theme.fontWeight.semibold,
                  color: statusColor(),
                  padding: `${theme.space.xs} ${theme.space.sm}`,
                  borderRadius: theme.radius.full,
                  backgroundColor: theme.surface.lvl3,
                }),
                on('click', retrySave),
              ]}
            >
              Fehler – Erneut versuchen
            </button>
          ) : (
            <span
              role="status"
              data-save-status=""
              aria-live="polite"
              title="Speicherstatus dieser Liste"
              mix={css({
                fontSize: theme.fontSize.xs,
                fontWeight: theme.fontWeight.semibold,
                color: statusColor(),
                padding: `${theme.space.xs} ${theme.space.sm}`,
                borderRadius: theme.radius.full,
                backgroundColor: theme.surface.lvl3,
              })}
            >
              {statusLabel()}
            </span>
          )}
        </div>
      </div>

      <div mix={cardBodyStyle}>
        {/* Conflict banner */}
        {conflictState.show && (
          <div
            mix={css({
              marginBottom: theme.space.md,
              padding: theme.space.md,
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.action.danger.background + '15',
              border: `1px solid ${theme.colors.action.danger.border}`,
              fontSize: theme.fontSize.sm,
              display: 'flex',
              gap: theme.space.sm,
              alignItems: 'center',
              flexWrap: 'wrap',
            })}
          >
            <span mix={css({ flex: 1 })}>Die Liste wurde in einem anderen Tab geändert.</span>
            <button
              mix={[
                button({ tone: 'secondary' }),
                css({ fontSize: theme.fontSize.xs }),
                on('click', reloadFromServer),
              ]}
            >
              Neu laden
            </button>
            <button
              mix={[
                button({ tone: 'danger' }),
                css({ fontSize: theme.fontSize.xs }),
                on('click', forceOverwrite),
              ]}
            >
              Trotzdem speichern
            </button>
          </div>
        )}

        {/* Save error — in place, never replaces the editor. "Erneut versuchen"
            re-runs the failed write; the banner clears on a successful save. */}
        {saveError && (
          <div
            role="alert"
            data-save-error-banner=""
            mix={css({
              marginBottom: theme.space.md,
              padding: theme.space.md,
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.action.danger.background + '15',
              border: `1px solid ${theme.colors.action.danger.border}`,
              fontSize: theme.fontSize.sm,
              display: 'flex',
              gap: theme.space.sm,
              alignItems: 'center',
              flexWrap: 'wrap',
            })}
          >
            <span mix={css({ flex: 1 })}>{saveError}</span>
            <button
              type="button"
              data-save-retry=""
              mix={[
                button({ tone: 'secondary' }),
                css({ fontSize: theme.fontSize.xs }),
                on('click', retrySave),
              ]}
            >
              Erneut versuchen
            </button>
            <button
              type="button"
              aria-label="Fehlermeldung schließen"
              title="Schließen"
              mix={[
                button({ tone: 'secondary' }),
                css({ fontSize: theme.fontSize.xs }),
                on('click', dismissSaveError),
              ]}
            >
              ×
            </button>
          </div>
        )}

        {/* Offline — keep the editor (and the dirty draft) usable and retry the
            pending write as soon as the browser reports connectivity. */}
        {offline && (
          <div
            role="status"
            data-offline-banner=""
            mix={css({
              marginBottom: theme.space.md,
              padding: theme.space.md,
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.warning.background + '20',
              border: `1px solid ${theme.colors.warning.border}`,
              fontSize: theme.fontSize.sm,
              display: 'flex',
              gap: theme.space.sm,
              alignItems: 'center',
            })}
          >
            <span mix={css({ flex: 1 })}>
              Offline — Änderungen werden gespeichert, sobald die Verbindung wieder da ist.
            </span>
          </div>
        )}

        {/* Restored unsaved draft for a brand-new list */}
        {draftRestored && loadedListId === null && (
          <div
            mix={css({
              marginBottom: theme.space.md,
              padding: theme.space.md,
              borderRadius: theme.radius.md,
              backgroundColor: theme.surface.lvl2,
              border: `1px solid ${theme.colors.border.default}`,
              fontSize: theme.fontSize.sm,
              display: 'flex',
              gap: theme.space.sm,
              alignItems: 'center',
              flexWrap: 'wrap',
            })}
          >
            <span mix={css({ flex: 1 })}>Ein ungespeicherter Entwurf wurde wiederhergestellt.</span>
            <button
              mix={[
                button({ tone: 'secondary' }),
                css({ fontSize: theme.fontSize.xs }),
                on('click', discardDraft),
              ]}
            >
              Entwurf verwerfen
            </button>
          </div>
        )}

        {/* Undo chip */}
        {undoSnapshot !== null && (
          <div
            mix={css({
              display: 'flex',
              alignItems: 'center',
              gap: theme.space.md,
              marginBottom: theme.space.md,
              padding: `${theme.space.sm} ${theme.space.md}`,
              borderRadius: theme.radius.md,
              backgroundColor: theme.surface.lvl2,
              border: `1px solid ${theme.colors.border.default}`,
              fontSize: theme.fontSize.sm,
            })}
          >
            <span mix={css({ flex: 1 })}>
              {undoKind === 'clear'
                ? 'Alle Elemente gelöscht.'
                : undoKind === 'clearDone'
                  ? 'Erledigte Elemente gelöscht.'
                  : undoKind === 'deleteSelected'
                    ? 'Ausgewählte Elemente gelöscht.'
                    : undoKind === 'bulkDone'
                      ? 'Auswahl als erledigt markiert.'
                      : undoKind === 'bulkOpen'
                        ? 'Auswahl als offen markiert.'
                        : 'Element gelöscht.'}
            </span>
            <button
              mix={[
                button({ tone: 'secondary' }),
                css({ fontSize: theme.fontSize.xs }),
                on('click', undo),
              ]}
            >
              ↶ Rückgängig
            </button>
          </div>
        )}

        {/* New-list helper hint */}
        {loadedListId === null && (
          <p
            mix={css({
              marginBottom: theme.space.md,
              fontSize: theme.fontSize.xs,
              color: theme.colors.text.muted,
            })}
          >
            {!title.trim() && !description.trim()
              ? 'Gib deiner Liste einen Titel oder eine Beschreibung.'
              : 'Bereit — klicke auf „+ Liste hinzufügen“, um die Liste zu speichern.'}
          </p>
        )}

        {/* Description — collapsed unless the list has one (or the user opens it) */}
        <div mix={css({ marginBottom: theme.space.md })}>
          {showDescription() ? (
            <>
              <div mix={descriptionHeadStyle}>
                <label mix={descriptionLabelStyle} htmlFor="lists-description">
                  Beschreibung
                </label>
                <button
                  type="button"
                  mix={[
                    collapseBtnStyle,
                    on('click', () => {
                      view.setDescriptionMode('closed')
                    }),
                  ]}
                  aria-label="Beschreibung ausblenden"
                  title="Beschreibung ausblenden"
                >
                  −
                </button>
              </div>
              <textarea
                id="lists-description"
                mix={[
                  descriptionTextareaStyle,
                  on('input', (e) => {
                    view.setDescription(e.currentTarget.value)
                  }),
                  on('blur', () => {
                    scheduleAutosave(true)
                  }),
                  ref((el: HTMLTextAreaElement) => view.onDescriptionInputRef(el)),
                ]}
                placeholder="Beschreibung für diese Liste eingeben…"
                maxLength={500}
                rows={2}
                wrap="soft"
                defaultValue={description}
              />
            </>
          ) : (
            <button
              type="button"
              mix={[
                showDescriptionBtnStyle,
                on('click', () => {
                  view.setDescriptionMode('open')
                }),
              ]}
            >
              + Beschreibung hinzufügen
            </button>
          )}
        </div>

        {/* Add item — one-line field; Enter adds, Shift+Enter inserts a newline */}
        <div
          mix={css({
            display: 'flex',
            gap: theme.space.sm,
            marginBottom: theme.space.md,
            alignItems: 'center',
          })}
        >
          <textarea
            mix={[
              css({
                padding: `${theme.space.xs} ${theme.space.sm}`,
                borderRadius: theme.radius.md,
                border: `1px solid ${theme.colors.border.strong}`,
                flex: 1,
                fontSize: theme.fontSize.md,
                outline: 'none',
                fontFamily: theme.fontFamily.sans,
                minHeight: '38px',
                resize: 'vertical',
                backgroundColor: theme.surface.lvl0,
                color: theme.colors.text.primary,
                '&:focus': {
                  borderColor: theme.colors.focus.ring,
                  boxShadow: `0 0 0 3px ${theme.colors.focus.ring}33`,
                },
              }),
              on('input', (e) => {
                view.setNewItemLabel(e.currentTarget.value)
              }),
              on('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  addItem()
                }
              }),
              ref((el) => view.onNewItemRef(el)),
            ]}
            placeholder="Neues Element eingeben…"
            rows={1}
            wrap="soft"
            defaultValue={newItemLabel}
          />
          <button mix={[button({ tone: 'primary' }), on('click', addItem)]}>
            + Element hinzufügen
          </button>
        </div>

        {/* Screen-reader live region for reorder/undo announcements */}
        <div
          aria-live="polite"
          mix={[
            css({
              position: 'absolute',
              width: '1px',
              height: '1px',
              overflow: 'hidden',
              clip: 'rect(0 0 0 0)',
              whiteSpace: 'nowrap',
            }),
            ref((el: HTMLElement) => view.onLiveRegion(el)),
          ]}
        />

        {/* Items list */}
        <div
          mix={css({
            border: `1px solid ${theme.colors.border.default}`,
            borderRadius: theme.radius.xl,
            overflow: 'hidden',
            // Flex column so the element list below fills the remaining
            // height of the bounded card and scrolls internally. Without
            // this the wrapper stayed `overflow: hidden` block, clipping
            // the (now flex) list so the last items were unreachable even
            // when scrolled. Auto basis keeps the list part of the card's
            // natural height when it is short.
            display: 'flex',
            flexDirection: 'column',
            flexGrow: 1,
            flexShrink: 1,
            flexBasis: 'auto',
            minHeight: 0,
          })}
        >
          <div mix={panelHeaderStyle}>
            <div mix={panelLeftStyle}>
              <h2 mix={visuallyHiddenStyle}>Elemente</h2>
              {items.length > 0 && (
                <>
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    indeterminate={selectedItemIds.size > 0 && !allVisibleSelected}
                    disabled={vis.length === 0}
                    aria-label="Alle sichtbaren Elemente auswählen"
                    title="Alle sichtbaren Elemente auswählen"
                    mix={[selectionCheckboxStyle, on('change', toggleSelectAllVisible)]}
                  />
                  <input
                    id="lists-inner-filter"
                    type="search"
                    placeholder="Elemente durchsuchen…"
                    maxLength={200}
                    aria-label="Elemente durchsuchen"
                    mix={[
                      filterInputStyle,
                      panelFilterInputStyle,
                      ref((el: HTMLInputElement) => view.onFilterInputRef(el)),
                      on('input', (e) => {
                        view.setListFilter(e.currentTarget.value)
                      }),
                      on('keydown', (e) => {
                        if (e.key === 'Escape' && listFilter) {
                          e.preventDefault()
                          view.clearListFilter()
                        }
                      }),
                    ]}
                    defaultValue={listFilter}
                  />
                  {listFilter.trim() && (
                    <button
                      type="button"
                      mix={[
                        clearFilterBtnStyle,
                        on('click', () => {
                          view.clearListFilter()
                        }),
                      ]}
                      aria-label="Suche zurücksetzen"
                      title="Suche zurücksetzen"
                    >
                      ✕
                    </button>
                  )}
                </>
              )}
            </div>
            <div mix={panelRightStyle}>
              <select
                mix={[
                  ref((el: HTMLSelectElement) => view.onSortSelectRef(el)),
                  sortSelectStyle,
                  on('change', (e) => {
                    setSortMode((e.currentTarget.value as SortMode) || 'manual')
                  }),
                ]}
                aria-label="Sortieren"
                title="Nur Ansicht – die gespeicherte Reihenfolge bleibt unverändert"
                data-sort-mode={sortMode}
              >
                <option value="manual">Manuell</option>
                <option value="az">A–Z</option>
                <option value="done">Nach Erledigt</option>
                <option value="due">Nach Fälligkeit</option>
                <option value="updated">Nach Änderung</option>
              </select>
              {viewOrderActive() && (
                <span
                  mix={viewOnlyHintStyle}
                  data-view-only-hint
                  title="Nur Ansicht – die gespeicherte Reihenfolge bleibt unverändert"
                >
                  Ansicht
                </span>
              )}
              <button
                type="button"
                mix={[iconToolbarBtnStyle, on('click', toggleReverse)]}
                title="Ansicht umkehren (nicht gespeichert)"
                aria-label="Ansicht umkehren"
                aria-pressed={reverseView}
              >
                ↺
              </button>
              <button
                type="button"
                mix={[iconToolbarBtnStyle, on('click', reshuffle)]}
                title="Ansicht mischen (nicht gespeichert)"
                aria-label="Ansicht mischen"
              >
                ⇄
              </button>
              <button
                type="button"
                mix={[
                  iconToolbarBtnStyle,
                  on('click', () =>
                    announce(
                      'Tastatur: Enter nimmt ein Element auf, Pfeile verschieben es, Enter legt es ab. Strg+Pfeile verschieben direkt.',
                    ),
                  ),
                ]}
                title="Tastatur: Enter aufnehmen, Pfeile verschieben, Enter ablegen. Strg+Pfeile für Direktverschieben."
                aria-label="Tastatur-Hinweise"
              >
                ?
              </button>
              {totalCount > 0 && (
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={totalCount}
                  aria-valuenow={doneCount}
                  aria-label={`${doneCount} von ${totalCount} erledigt`}
                  mix={css({
                    width: '60px',
                    height: '6px',
                    borderRadius: theme.radius.full,
                    backgroundColor: theme.surface.lvl0,
                    overflow: 'hidden',
                    // The text counter already states "X von Y erledigt"; the
                    // bar is redundant on a phone and stole a toolbar row.
                    '@media (max-width: 768px)': {
                      display: 'none',
                    },
                  })}
                >
                  <div
                    mix={css({
                      height: '100%',
                      width: `${(doneCount / totalCount) * 100}%`,
                      backgroundColor: theme.colors.success.background,
                      borderRadius: theme.radius.full,
                      transition: 'width 0.2s ease',
                    })}
                  />
                </div>
              )}
              <span mix={countTextStyle}>
                {totalCount > 0
                  ? `${doneCount} von ${totalCount} erledigt`
                  : `${totalCount} Einträge`}
              </span>
              <details mix={menuDetailsStyle} data-lists-more="">
                <summary
                  mix={menuSummaryStyle}
                  aria-label="Weitere Aktionen"
                  title="Weitere Aktionen"
                >
                  ⋯
                </summary>
                <div mix={menuPanelStyle}>
                  <button
                    mix={[button({ tone: 'secondary' }), on('click', clearDone)]}
                    disabled={items.filter((item) => item.done === true).length === 0}
                    title="Alle erledigten Elemente aus der Liste entfernen"
                  >
                    ✔ Nur Erledigte löschen
                  </button>
                  <button
                    mix={[
                      button({ tone: 'secondary' }),
                      dangerTextStyle,
                      on('click', deleteSelected),
                    ]}
                    disabled={selectedItemIds.size === 0}
                    title="Ausgewählte Elemente aus der Liste entfernen (auch verborgene)"
                  >
                    {selectedItemIds.size > 0
                      ? `✕ Auswahl löschen (${selectedItemIds.size})`
                      : '✕ Auswahl löschen'}
                  </button>
                  <button
                    mix={[
                      button({ tone: 'secondary' }),
                      dangerTextStyle,
                      ...(clearArmed ? [dangerArmedStyle] : []),
                      on('click', clearAll),
                    ]}
                    disabled={items.length === 0}
                    title="Alle Elemente dieser Liste löschen"
                  >
                    {clearArmed ? 'Wirklich alle löschen?' : '✕ Alle löschen'}
                  </button>
                </div>
              </details>
            </div>
          </div>

          {items.length > 0 && (
            <div mix={statusBarStyle} data-status-bar>
              <div mix={statusTabsStyle} role="group" aria-label="Nach Status filtern">
                {(
                  [
                    ['all', 'Alle', allTabCount],
                    ['open', 'Offen', counts.open],
                    ['done', 'Erledigt', counts.done],
                    ['overdue', 'Überfällig', counts.overdue],
                  ] as const
                ).map(([value, label, count]) => (
                  <button
                    key={value}
                    type="button"
                    data-status-filter={value}
                    data-status-count={String(count)}
                    aria-pressed={statusFilter === value}
                    mix={[statusTabStyle, on('click', () => setStatusFilter(value))]}
                  >
                    {label}
                    <span mix={statusCountStyle}>{count}</span>
                  </button>
                ))}
              </div>
              <label
                mix={hideDoneLabelStyle}
                title={
                  statusFilter === 'done'
                    ? 'Im Tab „Erledigt“ nicht verfügbar'
                    : 'Erledigte Elemente ausblenden'
                }
              >
                <input
                  type="checkbox"
                  checked={hideDone}
                  disabled={statusFilter === 'done'}
                  data-hide-done
                  mix={[
                    selectionCheckboxStyle,
                    on('change', (e) => setHideDone(e.currentTarget.checked)),
                  ]}
                />
                Erledigte ausblenden
              </label>
            </div>
          )}

          {selectedItemIds.size > 0 && (
            <div mix={bulkBarStyle}>
              <span
                mix={bulkCountStyle}
                data-bulk-count={String(selectedItemIds.size)}
                data-bulk-hidden={hiddenSelectedCount > 0 ? String(hiddenSelectedCount) : undefined}
                title={
                  hiddenSelectedCount > 0
                    ? `${hiddenSelectedCount} ausgewählte Elemente sind in dieser Ansicht verborgen`
                    : undefined
                }
              >
                {selectedItemIds.size} ausgewählt
                {hiddenSelectedCount > 0 ? ` (inkl. ${hiddenSelectedCount} verborgener)` : ''}
              </span>
              <button
                type="button"
                mix={[button({ tone: 'secondary' }), on('click', toggleSelectAllVisible)]}
              >
                {allVisibleSelected ? 'Auswahl aufheben' : 'Alle sichtbaren auswählen'}
              </button>
              <button
                type="button"
                mix={[button({ tone: 'secondary' }), on('click', () => setDoneSelected(true))]}
                disabled={copyBusy}
                title="Alle ausgewählten Elemente als erledigt markieren (auch verborgene)"
              >
                ✓ Als erledigt
              </button>
              <button
                type="button"
                mix={[button({ tone: 'secondary' }), on('click', () => setDoneSelected(false))]}
                disabled={copyBusy}
                title="Alle ausgewählten Elemente als offen markieren (auch verborgene)"
              >
                ○ Als offen
              </button>
              <span mix={css({ flex: 1 })} />
              <button
                type="button"
                mix={[
                  button({ tone: 'secondary' }),
                  on('click', (e) => openBulkPicker('copy', e.currentTarget)),
                ]}
                disabled={copyBusy}
                title="Ausgewählte Elemente in eine andere Liste kopieren"
              >
                ⧉ In Liste kopieren
              </button>
              <button
                type="button"
                mix={[
                  button({ tone: 'primary' }),
                  on('click', (e) => openBulkPicker('move', e.currentTarget)),
                ]}
                disabled={copyBusy}
                title="Ausgewählte Elemente in eine andere Liste verschieben"
              >
                → In Liste verschieben
              </button>
              <button
                type="button"
                mix={[
                  button({ tone: 'secondary' }),
                  on('click', () => {
                    view.clearSelectionAndError()
                  }),
                ]}
                title="Auswahl aufheben"
                aria-label="Auswahl aufheben"
              >
                ✕
              </button>
            </div>
          )}
          {copyError && (
            <div role="alert" mix={bulkErrorStyle}>
              {copyError}
            </div>
          )}
          {copyNotice && (
            <div role="status" aria-live="polite" mix={bulkNoticeStyle}>
              {copyNotice}
            </div>
          )}

          {picker && (
            <div
              data-target-picker-overlay
              mix={[
                targetPickerOverlayStyle,
                on('click', (event) => {
                  if (event.target === event.currentTarget) closeTargetPicker(true)
                }),
              ]}
            >
              <div
                data-target-picker-dialog
                role="dialog"
                aria-modal="true"
                aria-labelledby="target-picker-title"
                mix={[
                  targetPickerDialogStyle,
                  on('keydown', (event) => handlePickerKeyDown(event)),
                ]}
              >
                <div mix={targetPickerHeaderStyle}>
                  <h2 id="target-picker-title" mix={targetPickerTitleStyle}>
                    {picker.purpose === 'copy' ? 'In Liste kopieren' : 'In Liste verschieben'}
                  </h2>
                  <button
                    type="button"
                    data-target-picker-close
                    aria-label="Ziel-Liste schließen"
                    title="Schließen"
                    mix={[targetPickerCloseStyle, on('click', () => closeTargetPicker(true))]}
                  >
                    ✕
                  </button>
                </div>
                <div mix={targetPickerBodyStyle}>
                  <p mix={targetPickerHintStyle} data-target-picker-count>
                    {picker.itemIds.length} {picker.itemIds.length === 1 ? 'Element' : 'Elemente'}{' '}
                    ausgewählt. Ziel-Liste suchen:
                  </p>
                  <input
                    type="search"
                    data-target-picker-search
                    placeholder="Liste suchen…"
                    aria-label="Ziel-Liste suchen"
                    defaultValue={pickerQuery}
                    mix={[
                      targetPickerSearchStyle,
                      ref((el) => onPickerSearchRef(el as HTMLInputElement | null)),
                      on('input', (event) => setPickerQuery(event.currentTarget.value)),
                    ]}
                  />
                  {pickerError ? (
                    <div role="alert" mix={targetPickerStateStyle} data-target-picker-error>
                      {pickerError}{' '}
                      <button
                        type="button"
                        mix={[
                          button({ tone: 'secondary' }),
                          on('click', () => setPickerQuery(pickerQuery)),
                        ]}
                      >
                        Erneut versuchen
                      </button>
                    </div>
                  ) : pickerLoading ? (
                    <p role="status" mix={targetPickerStateStyle} data-target-picker-loading>
                      Listen werden geladen…
                    </p>
                  ) : pickerResults.length === 0 ? (
                    <p mix={targetPickerStateStyle} data-target-picker-empty>
                      Keine Listen gefunden.
                    </p>
                  ) : (
                    <div
                      mix={targetPickerResultsStyle}
                      data-target-picker-results
                      role="group"
                      aria-label="Ziel-Listen"
                    >
                      {pickerResults.map((target) => {
                        let label =
                          target.title.trim() ||
                          target.description.trim() ||
                          `${UNTITLED_LIST_LABEL} (#${target.id})`
                        return (
                          <button
                            key={target.id}
                            type="button"
                            data-target-option={target.id}
                            title={`${label} – ${target.count} Einträge`}
                            mix={[
                              targetPickerOptionStyle,
                              on('click', () => selectPickerTarget(target)),
                            ]}
                          >
                            <span mix={targetPickerOptionLabelStyle}>{label}</span>
                            <span mix={targetPickerMetaStyle}>
                              {target.doneCount}/{target.count}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                  {pickerHasMore && !pickerLoading && !pickerError && (
                    <p mix={targetPickerHintStyle}>Weitere Listen vorhanden – Suche eingrenzen.</p>
                  )}
                  <p mix={targetPickerHintStyle}>
                    Pfeiltasten wechseln, Enter wählt, Esc schließt.
                  </p>
                </div>
              </div>
            </div>
          )}

          {items.length === 0 ? (
            <div
              mix={css({
                padding: `${theme.space.xxl} ${theme.space.lg}`,
                textAlign: 'center',
                color: theme.colors.text.muted,
              })}
            >
              Noch keine Elemente. Füge oben eines hinzu.
            </div>
          ) : vis.length === 0 ? (
            <div
              mix={css({
                padding: `${theme.space.xl} ${theme.space.lg}`,
                textAlign: 'center',
                color: theme.colors.text.muted,
              })}
            >
              <p mix={css({ margin: 0 })}>
                {listFilter.trim()
                  ? `Keine Treffer für „${listFilter.trim()}“.`
                  : 'Keine Elemente in dieser Ansicht.'}
              </p>
              <button
                type="button"
                mix={[
                  button({ tone: 'secondary' }),
                  resetFiltersStyle,
                  on('click', () => resetFilters()),
                ]}
              >
                Filter zurücksetzen
              </button>
            </div>
          ) : (
            <div
              role="list"
              mix={[
                css({
                  // Fill the card's remaining height and scroll internally
                  // so the element list is always a bounded, scrollable
                  // region inside the viewport — with any number of items.
                  // (A fixed 320px cap grew the card past the viewport,
                  // pushing later elements below the fold.) Auto basis keeps
                  // items part of the card's natural height when short.
                  flexGrow: 1,
                  flexShrink: 1,
                  flexBasis: 'auto',
                  minHeight: 0,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  // Use the standardized scrollbar properties (Chrome/Edge
                  // 121+, Firefox, Safari 18.2+) instead of the non-standard
                  // ::-webkit-scrollbar pseudo-elements, which Firefox
                  // ignores — that was leaving the element list without a
                  // scrollbar when it overflowed.
                  scrollbarWidth: 'thin',
                  scrollbarColor: `${theme.colors.border.strong} ${theme.surface.lvl2}`,
                }),
                ref((el) => view.onListRef(el)),
                // Browser-only `drag()` mixin: binds the delegated
                // drag-and-drop wiring (row reorder, cross-list move, merge)
                // to this container; see lists-drag-mixin.ts.
                view.drag,
                ref((el) => {
                  let ac = new AbortController()

                  // Reveal/hide a row's action cluster on hover or focus.
                  // Delegated on the container so it survives re-renders.
                  function setRowActions(row: HTMLElement, op: string) {
                    let cluster = row.querySelector<HTMLElement>('[data-item-actions]')
                    if (cluster) {
                      cluster.style.opacity = op
                      cluster.style.pointerEvents = op === '1' ? 'auto' : 'none'
                    }
                  }
                  let activeRow: HTMLElement | null = null
                  function revealRow(row: HTMLElement) {
                    if (activeRow && activeRow !== row) setRowActions(activeRow, '')
                    setRowActions(row, '1')
                    activeRow = row
                  }
                  function hideRowActions() {
                    if (activeRow) {
                      setRowActions(activeRow, '')
                      activeRow = null
                    }
                  }
                  el.addEventListener(
                    'mouseover',
                    (e) => {
                      let row = (e.target as HTMLElement).closest<HTMLElement>('[role="listitem"]')
                      if (row) revealRow(row)
                    },
                    { signal: ac.signal },
                  )
                  el.addEventListener('mouseleave', hideRowActions, { signal: ac.signal })
                  el.addEventListener(
                    'focusin',
                    (e) => {
                      let row = (e.target as HTMLElement).closest<HTMLElement>('[role="listitem"]')
                      if (row) revealRow(row)
                    },
                    { signal: ac.signal },
                  )
                  el.addEventListener(
                    'focusout',
                    (e) => {
                      let row = (e.target as HTMLElement).closest<HTMLElement>('[role="listitem"]')
                      let related = e.relatedTarget as Node | null
                      if (row && (!related || !row.contains(related))) setRowActions(row, '')
                    },
                    { signal: ac.signal },
                  )

                  return () => ac.abort()
                }),
              ]}
            >
              {vis.map((item, index) => {
                let realIndex = realIndexById.get(item.id) ?? index
                // Humanized due date for the badge (heute/morgen/überfällig);
                // done items never read as overdue.
                let dueInfo = item.due != null ? dueBadge(item.due, item.done === true) : null
                let rowEditing = editingIndex === realIndex
                let menuOpen = openItemMenuId === item.id
                return (
                  <div
                    key={item.id}
                    mix={[
                      css({
                        position: 'relative',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: theme.space.md,
                        alignItems: 'center',
                        // Dense rows: the comfortable `md` padding cost 49px
                        // per row, so more of the card's height goes to rows
                        // instead of whitespace.
                        padding: `${theme.space.sm} ${theme.space.md}`,
                        // Keep a right gutter for the overlay action cluster
                        // (edit, move, delete, up, down); the cluster itself is
                        // absolute and takes no layout space.
                        borderBottom:
                          index < vis.length - 1
                            ? `1px solid ${theme.colors.border.subtle}`
                            : 'none',
                        backgroundColor: index % 2 === 0 ? theme.surface.lvl0 : theme.surface.lvl1,
                        '&:focus-visible': {
                          outline: `2px solid ${theme.colors.focus.ring}`,
                          outlineOffset: '-2px',
                        },
                        paddingRight: '10rem',
                        // On touch the hover cluster is replaced by the
                        // kebab + inline menu, so the right gutter is no longer
                        // needed and the menu can wrap below the row.
                        '@media (hover: none)': {
                          paddingRight: theme.space.md,
                          rowGap: theme.space.xs,
                        },
                      }),
                      ...(item.id === grabbedId
                        ? [css({ boxShadow: `inset 0 0 0 2px ${theme.colors.focus.ring}` })]
                        : []),
                      on('keydown', (e) => handleRowKeyDown(e, index)),
                      on('click', () => {
                        view.setFocusedId(item.id)
                      }),
                    ]}
                    role="listitem"
                    draggable={rowDraggable}
                    data-index={realIndex}
                    data-item-id={item.id}
                    tabIndex={item.id === activeId ? 0 : -1}
                  >
                    <input
                      type="checkbox"
                      data-select-item={item.id}
                      checked={selectedItemIds.has(item.id)}
                      aria-label={
                        selectedItemIds.has(item.id)
                          ? 'Element von der Auswahl entfernen'
                          : 'Element auswählen'
                      }
                      title={
                        selectedItemIds.has(item.id)
                          ? 'Element von der Auswahl entfernen'
                          : 'Element auswählen'
                      }
                      mix={[selectionCheckboxStyle, on('change', () => toggleSelected(item.id))]}
                    />
                    <span mix={gripStyle} data-grip="" aria-hidden="true">
                      ⠿
                    </span>
                    <input
                      type="checkbox"
                      data-done-item={item.id}
                      checked={item.done === true}
                      aria-label={
                        item.done === true ? 'Als offen markieren' : 'Als erledigt markieren'
                      }
                      title={item.done === true ? 'Als offen markieren' : 'Als erledigt markieren'}
                      mix={[
                        doneCheckboxStyle,
                        on('change', (e) => {
                          let idx = parseInt(
                            (e.currentTarget.closest('[data-index]') as HTMLElement | null)?.dataset
                              .index || '0',
                            10,
                          )
                          toggleDone(idx)
                        }),
                      ]}
                    />
                    {rowEditing ? (
                      <div mix={[itemMainStyle, itemEditMainStyle]}>
                        <textarea
                          mix={[
                            editTextareaStyle,
                            on('input', (e) => {
                              view.setEditText(e.currentTarget.value)
                            }),
                            on('keydown', (e) => {
                              if (e.key === 'Escape') cancelEdit()
                            }),
                          ]}
                          autoFocus
                          rows={3}
                          wrap="soft"
                          defaultValue={editText}
                        />
                        <div mix={metaEditorStyle}>
                          <select
                            mix={[
                              metaFieldStyle,
                              // Uncontrolled: the initial choice is asserted once on
                              // mount (like the label textarea's `defaultValue`), and the
                              // user's selection lives in the DOM until `saveEdit` reads
                              // `editPriority`. Keeping a controlled `value=` here would
                              // make the runtime's controlled-reflection listener snap the
                              // selection back on the next render, but the fields below are
                              // the ones that actually broke (see the input/change notes).
                              ref((el: HTMLSelectElement) => {
                                if (el && el.value !== editPriority) el.value = editPriority
                              }),
                              on('change', (e) => {
                                view.setEditPriority(
                                  (e.currentTarget.value || '') as '' | ItemPriority,
                                )
                              }),
                            ]}
                            aria-label="Priorität"
                          >
                            <option value="">Priorität…</option>
                            <option value="low">Niedrig</option>
                            <option value="medium">Mittel</option>
                            <option value="high">Hoch</option>
                          </select>
                          <input
                            type="date"
                            mix={[
                              metaFieldStyle,
                              // Uncontrolled via `defaultValue` (mirrors the label
                              // textarea). A controlled `value={editDue}` makes the
                              // component runtime attach a reflection listener that
                              // restores the DOM value to the last render on every
                              // `change`, and `setEditDue` never re-renders — so a picked
                              // date visually vanishes until some unrelated re-render
                              // happens to sync it. `defaultValue` is applied only at
                              // mount, so nothing reverts it while editing.
                              on('change', (e) => {
                                view.setEditDue(e.currentTarget.value)
                              }),
                            ]}
                            aria-label="Fällig am"
                            defaultValue={editDue}
                          />
                          <input
                            type="text"
                            mix={[
                              metaFieldStyle,
                              // Uncontrolled via `defaultValue` (same reason as the date
                              // field): a controlled `value={editTags}` is snapped back
                              // toward the empty last-render value after each keystroke,
                              // so the user can't type a tag at all until a later render.
                              on('input', (e) => {
                                view.setEditTags(e.currentTarget.value)
                              }),
                            ]}
                            placeholder="Tags, kommagetrennt"
                            aria-label="Tags"
                            defaultValue={editTags}
                          />
                        </div>
                      </div>
                    ) : (
                      <div mix={itemMainStyle}>
                        <span
                          mix={[
                            multilineDisplayStyle,
                            item.done === true &&
                              css({
                                textDecoration: 'line-through',
                                color: theme.colors.text.muted,
                              }),
                          ].filter(Boolean)}
                        >
                          {item.label}
                        </span>
                        {(item.priority != null ||
                          item.due != null ||
                          (item.tags != null && item.tags.length > 0)) && (
                          <div mix={metaRowStyle}>
                            {item.priority != null && (
                              <span mix={[metaBadgeStyle, priorityBadge(item.priority)]}>
                                {priorityLabel(item.priority)}
                              </span>
                            )}
                            {item.due != null && dueInfo && (
                              <span
                                data-due-badge=""
                                data-due-overdue={dueInfo.overdue ? '' : undefined}
                                title={`Fällig: ${item.due}`}
                                mix={[
                                  metaBadgeStyle,
                                  dueBadgeStyle,
                                  ...(dueInfo.overdue ? [overdueBadgeStyle] : []),
                                ]}
                              >
                                📅 {dueInfo.text}
                              </span>
                            )}
                            {Array.from(new Set(item.tags ?? [])).map((tag) => (
                              <button
                                key={tag}
                                type="button"
                                data-tag-filter={tag}
                                mix={[
                                  metaBadgeStyle,
                                  tagChipStyle,
                                  tagChipButtonStyle,
                                  on('click', () => view.applyTagFilter(tag)),
                                ]}
                                title={`Nach Tag „${tag}" filtern`}
                                aria-label={`Elemente mit Tag ${tag} anzeigen`}
                              >
                                #{tag}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {!rowEditing && (
                      <button
                        type="button"
                        draggable="false"
                        data-item-menu-button={item.id}
                        aria-label={`Weitere Aktionen für ${item.label}`}
                        aria-expanded={menuOpen}
                        title="Weitere Aktionen"
                        mix={[itemMenuButtonStyle, on('click', () => toggleItemMenu(item.id))]}
                      >
                        ⋯
                      </button>
                    )}
                    <div
                      draggable="false"
                      data-item-actions
                      mix={[
                        rowEditing ? itemEditActionsStyle : itemActionsStyle,
                        rowEditing && css({ opacity: 1, pointerEvents: 'auto' }),
                      ].filter(Boolean)}
                    >
                      {rowEditing ? (
                        <>
                          <button
                            mix={[iconActionStyle, iconActionFirstStyle, on('click', saveEdit)]}
                            title="Speichern"
                            aria-label="Speichern"
                          >
                            <Glyph name="check" width={16} height={16} />
                          </button>
                          <button
                            mix={[iconActionStyle, iconActionLastStyle, on('click', cancelEdit)]}
                            title="Abbrechen"
                            aria-label="Abbrechen"
                          >
                            <Glyph name="close" width={16} height={16} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            mix={[
                              iconActionStyle,
                              iconActionFirstStyle,
                              on('click', () => startEditing(realIndex)),
                            ]}
                            title="Bearbeiten"
                            aria-label="Bearbeiten"
                          >
                            <Glyph name="edit" width={16} height={16} />
                          </button>
                          <button
                            data-item-move-button={item.id}
                            mix={[
                              iconActionStyle,
                              on('click', (event) =>
                                openItemMovePicker(item.id, event.currentTarget),
                              ),
                            ]}
                            title="In Liste verschieben"
                            aria-label="In Liste verschieben"
                          >
                            <Glyph name="arrowRight" width={16} height={16} />
                          </button>
                          <button
                            mix={[
                              iconActionStyle,
                              iconActionDangerStyle,
                              on('click', () => deleteItem(realIndex)),
                            ]}
                            title="Löschen"
                            aria-label="Löschen"
                          >
                            <Glyph name="close" width={16} height={16} />
                          </button>
                          {rowDraggable && (
                            <>
                              <button
                                mix={[iconActionStyle, on('click', () => moveUp(realIndex))]}
                                disabled={realIndex === 0}
                                title="Nach oben"
                                aria-label="Nach oben"
                              >
                                ↑
                              </button>
                              <button
                                mix={[
                                  iconActionStyle,
                                  iconActionLastStyle,
                                  on('click', () => moveDown(realIndex)),
                                ]}
                                disabled={realIndex === items.length - 1}
                                title="Nach unten"
                                aria-label="Nach unten"
                              >
                                ↓
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                    {menuOpen && (
                      <div
                        draggable="false"
                        data-item-menu={item.id}
                        role="group"
                        aria-label="Element-Aktionen"
                        mix={[
                          itemMenuStyle,
                          ref((el: HTMLElement) => {
                            // Move focus into the menu once, when it opens, so a
                            // keyboard user on a touch device lands on an action
                            // instead of having to re-enter the row.
                            if (el && !el.dataset.focusReady) {
                              el.dataset.focusReady = 'true'
                              el.querySelector<HTMLButtonElement>('button')?.focus()
                            }
                          }),
                        ]}
                      >
                        <button
                          type="button"
                          mix={[
                            button({ tone: 'secondary' }),
                            itemMenuItemStyle,
                            on('click', () => startEditing(realIndex)),
                          ]}
                        >
                          Bearbeiten
                        </button>
                        {/* Reordering is disabled while an in-list filter
                            hides rows: moving relative to a hidden neighbour
                            would change the saved order without a visible
                            effect. The same guard exists on the desktop
                            cluster (rowDraggable) and in moveItem. */}
                        {rowDraggable && (
                          <>
                            <button
                              type="button"
                              mix={[
                                button({ tone: 'secondary' }),
                                itemMenuItemStyle,
                                on('click', () => {
                                  closeItemMenu()
                                  moveUp(realIndex)
                                  focusItemTrigger(item.id)
                                }),
                              ]}
                              disabled={realIndex === 0}
                            >
                              Nach oben
                            </button>
                            <button
                              type="button"
                              mix={[
                                button({ tone: 'secondary' }),
                                itemMenuItemStyle,
                                on('click', () => {
                                  closeItemMenu()
                                  moveDown(realIndex)
                                  focusItemTrigger(item.id)
                                }),
                              ]}
                              disabled={realIndex === items.length - 1}
                            >
                              Nach unten
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          mix={[
                            button({ tone: 'secondary' }),
                            itemMenuItemStyle,
                            on('click', () => openItemMovePicker(item.id, null)),
                          ]}
                        >
                          In Liste verschieben
                        </button>
                        <button
                          type="button"
                          mix={[
                            button({ tone: 'dangerOutline' }),
                            itemMenuItemStyle,
                            on('click', () => {
                              let nextVisibleId = vis[index + 1]?.id ?? vis[index - 1]?.id ?? null
                              closeItemMenu()
                              deleteItem(realIndex)
                              focusItemTrigger(nextVisibleId)
                            }),
                          ]}
                        >
                          Löschen
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
