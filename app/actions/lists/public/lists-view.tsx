import { type RemixNode, css, on, ref } from 'remix/ui'
import { theme } from '../../../ui/theme/theme.ts'
import { frames } from '../../../routes.ts'
import button from '../../../ui/theme/button.ts'
import { Glyph } from '../../../ui/theme/glyph/glyph.tsx'

import type { ListsDragController } from './lists-drag.ts'
import {
  type ItemPriority,
  type ListConflictState,
  type ListItem,
  type SortMode,
  type UndoKind,
  priorityLabel,
} from './lists-state.ts'
import {
  multilineDisplayStyle,
  gripStyle,
  itemMainStyle,
  metaRowStyle,
  metaBadgeStyle,
  dueBadgeStyle,
  tagChipStyle,
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
  bulkSelectStyle,
  bulkNoticeStyle,
  bulkErrorStyle,
  sortSelectStyle,
  filterInputStyle,
  descriptionHeadStyle,
  descriptionLabelStyle,
  collapseBtnStyle,
  descriptionTextareaStyle,
  showDescriptionBtnStyle,
  clearFilterBtnStyle,
  itemActionsStyle,
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
  loadError: string
  conflictState: ListConflictState
  draftRestored: boolean
  undoSnapshot: ListItem[] | null
  undoKind: UndoKind | null
  newItemLabel: string
  listFilter: string
  editingIndex: number | null
  editText: string
  editPriority: '' | ItemPriority
  editDue: string
  editTags: string
  selectedItemIds: Set<string>
  copyTargetId: string
  copyBusy: boolean
  copyError: string
  copyNotice: string
  clearArmed: boolean
  grabbedId: string | null
  drag: ListsDragController

  visibleItems: () => ListItem[]
  showDescription: () => boolean
  statusColor: () => string
  statusLabel: () => string
  isDirty: () => boolean
  activeItemId: () => string | null
  filterActive: () => boolean
  copyTargets: () => Array<{ id: number; label: string }>

  scheduleAutosave: (fast?: boolean) => void
  saveNow: (manual?: boolean) => Promise<boolean>
  flushNow: () => Promise<boolean>
  discardChanges: () => void
  copyCurrentList: () => Promise<void>
  reloadFromServer: () => void
  forceOverwrite: () => void
  discardDraft: () => void
  undo: () => void
  addItem: () => void
  applySort: (mode: SortMode) => void
  reverse: () => void
  shuffle: () => void
  announce: (message: string) => void
  clearDone: () => void
  deleteSelected: () => void
  clearAll: () => void
  toggleSelectAllVisible: () => void
  copySelectedItems: () => Promise<void>
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

  setTitle: (value: string) => void
  setDescription: (value: string) => void
  setDescriptionMode: (mode: 'auto' | 'open' | 'closed') => void
  setNewItemLabel: (value: string) => void
  setListFilter: (value: string) => void
  clearListFilter: () => void
  setCopyTargetId: (value: string) => void
  setFocusedId: (id: string) => void
  setEditText: (value: string) => void
  setEditPriority: (value: '' | ItemPriority) => void
  setEditDue: (value: string) => void
  setEditTags: (value: string) => void

  onTitleInputRef: (el: HTMLInputElement | null) => void
  onDescriptionInputRef: (el: HTMLTextAreaElement | null) => void
  onNewItemRef: (el: HTMLTextAreaElement | null) => void
  onFilterInputRef: (el: HTMLInputElement | null) => void
  onListRef: (el: HTMLDivElement | null) => void
  onCopyFormRef: (el: HTMLFormElement | null) => void
  onCopyCsrfRef: (el: HTMLInputElement | null) => void
  onLiveRegion: (el: HTMLElement | null) => void
}

export function renderListsEditor(view: ListsEditorView): RemixNode {
  if (view.loadingList) {
    return (
      <div
        mix={css({
          fontFamily: theme.fontFamily.sans,
          maxWidth: 'min(1000px, calc(100% - 2rem))',
          width: '100%',
          margin: '0 auto',
          padding: theme.space.xxl,
          textAlign: 'center',
          color: theme.colors.text.secondary,
          fontSize: theme.fontSize.lg,
        })}
      >
        Liste wird geladen…
      </div>
    )
  }

  if (view.loadError) {
    return (
      <div
        mix={css({
          fontFamily: theme.fontFamily.sans,
          maxWidth: 'min(1000px, calc(100% - 2rem))',
          width: '100%',
          margin: '0 auto',
          padding: theme.space.xxl,
          textAlign: 'center',
          color: theme.colors.action.danger.background,
          fontSize: theme.fontSize.lg,
        })}
      >
        {view.loadError}
      </div>
    )
  }

  let {
    items,
    loadedListId,
    title,
    description,
    saving,
    conflictState,
    draftRestored,
    undoSnapshot,
    undoKind,
    newItemLabel,
    listFilter,
    editingIndex,
    editText,
    editPriority,
    editDue,
    editTags,
    selectedItemIds,
    copyTargetId,
    copyBusy,
    copyError,
    copyNotice,
    clearArmed,
    grabbedId,
    drag,
    visibleItems,
    showDescription,
    statusColor,
    statusLabel,
    isDirty,
    activeItemId,
    filterActive,
    copyTargets,
    scheduleAutosave,
    saveNow,
    flushNow,
    discardChanges,
    copyCurrentList,
    reloadFromServer,
    forceOverwrite,
    discardDraft,
    undo,
    addItem,
    applySort,
    reverse,
    shuffle,
    announce,
    clearDone,
    deleteSelected,
    clearAll,
    toggleSelectAllVisible,
    copySelectedItems,
    toggleSelected,
    toggleDone,
    startEditing,
    saveEdit,
    cancelEdit,
    deleteItem,
    moveUp,
    moveDown,
    handleRowKeyDown,
  } = view

  let vis = visibleItems()
  let doneCount = vis.filter((item) => item.done === true).length
  let totalCount = vis.length
  let allVisibleSelected = vis.length > 0 && vis.every((item) => selectedItemIds.has(item.id))

  return (
    <div mix={cardStyle}>
      {/* Card header: editable title + primary action + save status */}
      <div mix={cardHeaderStyle}>
        <div mix={cardTitleWrapStyle}>
          <span mix={listContextStyle} data-list-context>
            {loadedListId === null ? 'Neue Liste' : `Liste #${loadedListId}`}
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
          <span
            role="status"
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
                    : undoKind === 'reorder'
                      ? 'Reihenfolge geändert.'
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
                    disabled={totalCount === 0}
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
                  sortSelectStyle,
                  on('change', (e) => {
                    applySort((e.currentTarget.value as SortMode) || 'manual')
                    e.currentTarget.value = 'manual'
                  }),
                ]}
                aria-label="Sortieren"
                value="manual"
              >
                <option value="manual">Sortieren…</option>
                <option value="az">A–Z</option>
                <option value="done">Nach Erledigt</option>
                <option value="updated">Nach Änderung</option>
              </select>
              <button
                type="button"
                mix={[iconToolbarBtnStyle, on('click', reverse)]}
                title="Reihenfolge umkehren"
                aria-label="Reihenfolge umkehren"
              >
                ↺
              </button>
              <button
                type="button"
                mix={[iconToolbarBtnStyle, on('click', shuffle)]}
                title="Reihenfolge mischen"
                aria-label="Reihenfolge mischen"
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
              <details mix={menuDetailsStyle}>
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
                    title="Ausgewählte Elemente aus der Liste entfernen"
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

          {selectedItemIds.size > 0 && (
            <div mix={bulkBarStyle}>
              <span mix={bulkCountStyle} data-bulk-count={String(selectedItemIds.size)}>
                {selectedItemIds.size} ausgewählt
              </span>
              <button
                type="button"
                mix={[button({ tone: 'secondary' }), on('click', toggleSelectAllVisible)]}
              >
                {allVisibleSelected ? 'Auswahl aufheben' : 'Alle sichtbaren auswählen'}
              </button>
              <span mix={css({ flex: 1 })} />
              <select
                id="copy-items-target"
                aria-label="Ziel-Liste"
                mix={[
                  bulkSelectStyle,
                  on('change', (e) => {
                    view.setCopyTargetId(e.currentTarget.value)
                  }),
                ]}
              >
                <option value="">Ziel-Liste…</option>
                {copyTargets().map((target) => (
                  <option
                    key={target.id}
                    value={target.id}
                    selected={String(target.id) === copyTargetId}
                  >
                    {target.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                mix={[button({ tone: 'primary' }), on('click', () => void copySelectedItems())]}
                disabled={copyBusy || !copyTargetId}
                title="Ausgewählte Elemente in die Ziel-Liste kopieren"
              >
                {copyBusy ? 'Kopiere…' : '⧉ In Liste kopieren'}
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
          ) : totalCount === 0 ? (
            <div
              mix={css({
                padding: `${theme.space.xxl} ${theme.space.lg}`,
                textAlign: 'center',
                color: theme.colors.text.muted,
              })}
            >
              Keine Treffer für „{listFilter.trim()}“.
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
                ref((el) => {
                  let ac = new AbortController()
                  el.addEventListener(
                    'dragover',
                    (e) => drag.handleContainerDragOver(e as DragEvent),
                    { signal: ac.signal },
                  )
                  // Capture-phase so it fires even while over a row (rows
                  // stop the bubble-phase dragover), enabling edge auto-scroll.
                  el.addEventListener(
                    'dragover',
                    (e) => drag.autoScrollList((e as DragEvent).clientY),
                    { capture: true, signal: ac.signal },
                  )
                  el.addEventListener('drop', (e) => drag.handleDrop(e as DragEvent), {
                    signal: ac.signal,
                  })

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
                let realIndex = items.findIndex((i) => i.id === item.id)
                return (
                  <div
                    key={item.id}
                    mix={[
                      css({
                        position: 'relative',
                        display: 'flex',
                        gap: theme.space.md,
                        alignItems: 'center',
                        // Dense rows: the comfortable `md` padding cost 49px
                        // per row, so more of the card's height goes to rows
                        // instead of whitespace.
                        padding: `${theme.space.sm} ${theme.space.md}`,
                        // Keep a right gutter so the label doesn't run under the
                        // overlay action cluster; the cluster itself is absolute
                        // and takes no layout space.
                        paddingRight: '6.5rem',
                        borderBottom:
                          index < vis.length - 1
                            ? `1px solid ${theme.colors.border.subtle}`
                            : 'none',
                        backgroundColor: index % 2 === 0 ? theme.surface.lvl0 : theme.surface.lvl1,
                        '&:focus-visible': {
                          outline: `2px solid ${theme.colors.focus.ring}`,
                          outlineOffset: '-2px',
                        },
                      }),
                      ...(item.id === grabbedId
                        ? [css({ boxShadow: `inset 0 0 0 2px ${theme.colors.focus.ring}` })]
                        : []),
                      ref((el) => {
                        let ac = new AbortController()
                        el.addEventListener(
                          'dragstart',
                          (e) => {
                            let idx = parseInt(
                              (e.currentTarget as HTMLElement).dataset.index || '0',
                              10,
                            )
                            drag.handleDragStart(e as DragEvent, idx)
                          },
                          { signal: ac.signal },
                        )
                        el.addEventListener(
                          'dragover',
                          (e) => {
                            let idx = parseInt(
                              (e.currentTarget as HTMLElement).dataset.index || '0',
                              10,
                            )
                            drag.handleDragOver(e as DragEvent, idx)
                          },
                          { signal: ac.signal },
                        )
                        el.addEventListener('drop', (e) => drag.handleDrop(e as DragEvent), {
                          signal: ac.signal,
                        })
                        el.addEventListener('dragend', () => drag.handleDragEnd(), {
                          signal: ac.signal,
                        })
                        return () => ac.abort()
                      }),
                      on('keydown', (e) => handleRowKeyDown(e, index)),
                      on('click', () => {
                        view.setFocusedId(item.id)
                      }),
                    ]}
                    role="listitem"
                    draggable={!filterActive()}
                    data-index={realIndex}
                    data-item-id={item.id}
                    tabIndex={item.id === activeItemId() ? 0 : -1}
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
                    {editingIndex === realIndex ? (
                      <div mix={itemMainStyle}>
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
                              on('change', (e) => {
                                view.setEditPriority(
                                  (e.currentTarget.value || '') as '' | ItemPriority,
                                )
                              }),
                            ]}
                            aria-label="Priorität"
                            value={editPriority}
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
                              on('change', (e) => {
                                view.setEditDue(e.currentTarget.value)
                              }),
                            ]}
                            aria-label="Fällig am"
                            value={editDue}
                          />
                          <input
                            type="text"
                            mix={[
                              metaFieldStyle,
                              on('input', (e) => {
                                view.setEditTags(e.currentTarget.value)
                              }),
                            ]}
                            placeholder="Tags, kommagetrennt"
                            aria-label="Tags"
                            value={editTags}
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
                            {item.due != null && (
                              <span mix={[metaBadgeStyle, dueBadgeStyle]}>📅 {item.due}</span>
                            )}
                            {Array.from(new Set(item.tags ?? [])).map((tag) => (
                              <span key={tag} mix={[metaBadgeStyle, tagChipStyle]}>
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div
                      draggable="false"
                      data-item-actions
                      mix={[
                        itemActionsStyle,
                        editingIndex === realIndex && css({ opacity: 1, pointerEvents: 'auto' }),
                      ].filter(Boolean)}
                    >
                      {editingIndex === realIndex ? (
                        <>
                          <button
                            mix={[iconActionStyle, iconActionFirstStyle, on('click', saveEdit)]}
                            title="Speichern"
                          >
                            <Glyph name="check" width={16} height={16} />
                          </button>
                          <button
                            mix={[iconActionStyle, iconActionLastStyle, on('click', cancelEdit)]}
                            title="Abbrechen"
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
                          >
                            <Glyph name="edit" width={16} height={16} />
                          </button>
                          <button
                            mix={[
                              iconActionStyle,
                              iconActionDangerStyle,
                              on('click', () => deleteItem(realIndex)),
                            ]}
                            title="Löschen"
                          >
                            <Glyph name="close" width={16} height={16} />
                          </button>
                          {!filterActive() && (
                            <>
                              <button
                                mix={[iconActionStyle, on('click', () => moveUp(realIndex))]}
                                disabled={realIndex === 0}
                                title="Nach oben"
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
                              >
                                ↓
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
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
