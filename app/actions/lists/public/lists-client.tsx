import { clientEntry, type Handle } from 'remix/component'
import { theme } from '../../../ui/theme/theme.ts'
import { moveItemInArray, findTypeaheadTarget } from '../../../utils/lists-keyboard.ts'

import { syncSidebarRow, UNTITLED_LIST_LABEL } from './sidebar-sync.ts'
import type { ListsDragContext } from './lists-drag.ts'
import { drag } from './lists-drag-mixin.ts'
import {
  type ItemPriority,
  type SortMode,
  type StatusCounts,
  type StatusFilter,
  type ListItem,
  type ListInitialState,
  type ListConflictState,
  type UndoKind,
  buildVisibleItems,
  cloneItems,
  countItemsByStatus,
  createItem,
  deleteItemAt,
  editItemFields,
  filterItems,
  itemsFingerprint,
  parseItemsFingerprint,
  removeItemsByIds,
  setDoneByIds,
  shuffleItems,
  clearDoneItems,
  toggleDoneAt,
  addItem as appendItem,
  toggleSelected as toggleSelectedIn,
  toggleAllVisible as toggleAllVisibleIn,
} from './lists-state.ts'
import {
  copyItemsRequest,
  createListRequest,
  listsJsonHeaders,
  mergeListRequest,
  moveItemRequest,
  moveItemsRequest,
  patchListRequest,
  searchListTargetsRequest,
  sendKeepalivePatch,
  type ListTarget,
} from './lists-api.ts'
import { renderListsEditor, type ListsEditorView } from './lists-view.tsx'
import { requestConfirmDecision } from '../../../ui/confirm-delete.browser.tsx'

export const ListsClient = clientEntry(
  import.meta.url + '#ListsClient',
  function ListsClient(handle: Handle<{ initialState?: ListInitialState | null }>) {
    let items: ListItem[] = []
    let title = ''
    let description = ''
    let newItemLabel = ''
    let listFilter = ''
    // View-only status and ordering controls. They never mutate `items`, so the
    // persisted manual order is only changed by drag/keyboard/move actions.
    let statusFilter: StatusFilter = 'all'
    let hideDone = false
    let sortMode: SortMode = 'manual'
    let reverseView = false
    let shuffleOrder: string[] | null = null
    let sortSelectRef: HTMLSelectElement | null = null
    // Description visibility. 'auto' shows the field only when the list has a
    // description, 'open' forces it visible, 'closed' hides it even when filled.
    // Resets to 'auto' on every list load so switching lists always reflects the
    // new list's own content.
    let descriptionMode: 'auto' | 'open' | 'closed' = 'auto'
    let loadedListId: number | null = null
    let loadedUpdatedAt: number | null = null
    let saving = false
    // A single in-flight save. Autosave, manual flush and keepalive all await
    // this so two PUTs cannot race the same If-Match precondition.
    let savingPromise: Promise<boolean> | null = null
    // Last failed write (create/patch/keepalive/drag). Rendered as an in-place
    // banner with a retry action; never a full-editor takeover. Cleared by a
    // successful save or an explicit dismissal.
    let saveError = ''
    // Browser connectivity, surfaced as a banner. Kept in closure state so a
    // reconnect can retry the pending write.
    let offline = typeof navigator !== 'undefined' && navigator.onLine === false
    let editingIndex: number | null = null
    let editText = ''
    let editPriority: '' | ItemPriority = ''
    let editDue = ''
    let editTags = ''
    let newItemRef: HTMLTextAreaElement | null = null
    let filterInputRef: HTMLInputElement | null = null
    let listRef: HTMLDivElement | null = null
    let copyFormRef: HTMLFormElement | null = null
    let copyCsrfRef: HTMLInputElement | null = null
    // The title/description fields are uncontrolled (the user's typing owns the
    // DOM value), so `defaultValue` no longer applies once they have been
    // edited. Without these refs, switching to another list kept showing the
    // previous list's title/description — a stale header that could be written
    // into the newly opened list on the next keystroke. `syncFieldInputs()`
    // pushes the newly hydrated state back into the DOM on every list load.
    let titleInputRef: HTMLInputElement | null = null
    let descriptionInputRef: HTMLTextAreaElement | null = null
    let initialized = false

    // Keyboard navigation state
    let focusedId: string | null = null
    let grabbedId: string | null = null
    let liveRegion: HTMLElement | null = null

    // Autosave state
    type SaveStatus = 'saved' | 'saving' | 'dirty' | 'error'
    let saveStatus: SaveStatus = 'saved'
    let autosaveTimer: ReturnType<typeof setTimeout> | null = null

    // Conflict state
    let conflictState: ListConflictState = { show: false, serverState: null }

    // Undo + inline-confirm state. The undo chip now stays until the next
    // mutation (see setDirty) instead of expiring on a timer, so Ctrl/Cmd+Z
    // can revert the last destructive action even after a pause.
    let undoSnapshot: ListItem[] | null = null
    let undoKind: UndoKind | null = null
    // One-shot guard: showUndo runs immediately before setDirty in every
    // destructive path, and that setDirty must not clear the chip it just set.
    let keepUndoForMutation = false
    let clearArmed = false
    let clearArmTimer: ReturnType<typeof setTimeout> | null = null

    // Row selection for "Auswahl → in Liste kopieren". Separate from the done
    // toggle: selecting is view-only and never marks the list dirty.
    let selectedItemIds = new Set<string>()
    // Bulk copy/move target operations (the request itself, not the picker).
    let copyBusy = false
    let copyError = ''
    let copyNotice = ''
    let copyNoticeTimer: ReturnType<typeof setTimeout> | null = null

    // Searchable target picker. The candidate lists come from the server
    // (/lists/targets), not from the 15-row sidebar page, so a target stays
    // reachable on any page and while a search narrows the sidebar.
    type PickerPurpose = 'copy' | 'move'
    type PickerState = {
      purpose: PickerPurpose
      itemIds: string[]
      /** Set for a single-row move so closing can refocus that row. */
      singleItemId: string | null
      /** Row (bulk) or menu trigger to refocus when the dialog closes. */
      trigger: HTMLElement | null
    }
    let picker: PickerState | null = null
    let pickerQuery = ''
    let pickerResults: ListTarget[] = []
    let pickerHasMore = false
    let pickerLoading = false
    let pickerError = ''
    let pickerRequestId = 0
    let pickerDebounce: ReturnType<typeof setTimeout> | null = null
    let pickerSearchRef: HTMLInputElement | null = null

    // Touch-only per-row action menu (the kebab). Rendering it inline below
    // the row keeps the element list scroll container from clipping it.
    let openItemMenuId: string | null = null

    // Keyboard-help sheet (the "?" trigger). Focus managed like the picker.
    let helpOpen = false
    let helpTrigger: HTMLElement | null = null

    // Drop the undo snapshot without a render. Used when the editor switches
    // lists: an undo from list A must never be applied to list B's items.
    let resetUndoState = () => {
      undoSnapshot = null
      undoKind = null
      keepUndoForMutation = false
    }

    let clearUndo = () => {
      resetUndoState()
      void handle.update()
    }

    let showUndo = (kind: UndoKind, snapshot: ListItem[]) => {
      undoSnapshot = snapshot
      undoKind = kind
      keepUndoForMutation = true
      void handle.update()
    }

    let undo = () => {
      if (undoSnapshot === null) return
      items = undoSnapshot.map((item) => ({ ...item }))
      clearUndo()
      setDirty()
      announce('Rückgängig gemacht')
      void handle.update()
      scheduleAutosave(true)
    }

    let disarmClear = () => {
      if (clearArmTimer) clearTimeout(clearArmTimer)
      clearArmTimer = null
      if (clearArmed) {
        clearArmed = false
        void handle.update()
      }
    }

    // Track whether items, title or description are dirty
    let cleanTitle = ''
    let cleanDescription = ''
    let cleanItemsJSON = ''
    let snapshotClean = () => {
      cleanTitle = title
      cleanDescription = description
      cleanItemsJSON = itemsFingerprint(items)
    }
    let isDirty = () =>
      title !== cleanTitle ||
      description !== cleanDescription ||
      itemsFingerprint(items) !== cleanItemsJSON

    // ── In-list search (view-only filter) ───────────────────────────────────
    // The filter narrows only what is rendered. Mutations always target the
    // real `items` array through the visible→real index mapping, so toggling,
    // editing and deleting hit the correct item. Position-based reordering
    // (drag + keyboard grab + up/down buttons) is disabled while a filter is
    // active, because moving "up/down" inside a filtered subset is ambiguous.
    let filterActive = (): boolean => listFilter.trim() !== ''
    let viewOrderActive = (): boolean =>
      sortMode !== 'manual' || reverseView || shuffleOrder !== null
    // Position-based reordering is only meaningful while rows are displayed in
    // their persisted order. Any hidden row (text/tag, status, hide-done) or any
    // view-only sort/reverse/shuffle makes an *array-adjacent* move ambiguous.
    let reorderLocked = (): boolean =>
      filterActive() || statusFilter !== 'all' || hideDone || viewOrderActive()
    // The ↑/↓ buttons (and the touch menu's move actions) step through the
    // *visible* order instead: swapping a row with its neighbouring visible
    // item keeps hidden rows in their slots, so "Erledigte ausblenden" no
    // longer removes the buttons. View-only orders and the text/status
    // filters still hide them because those views are not the persisted order.
    let visibleReorderLocked = (): boolean =>
      filterActive() || statusFilter !== 'all' || viewOrderActive()
    let visibleItems = (): ListItem[] =>
      buildVisibleItems(items, {
        query: listFilter,
        status: statusFilter,
        hideDone,
        sort: sortMode,
        reverse: reverseView,
        shuffleOrder,
      })
    // Status tab counts follow the text/tag filter (a search narrows every tab),
    // but not the status filter itself — otherwise every inactive tab would
    // read zero.
    let visibleStatusCounts = (): StatusCounts => countItemsByStatus(filterItems(items, listFilter))
    let syncSortSelect = () => {
      if (sortSelectRef && sortSelectRef.value !== sortMode) sortSelectRef.value = sortMode
    }
    // Reset the in-list filter. Called on every reload/hydrate because the
    // client entry is not remounted on frame navigation, so the filter would
    // otherwise persist across switching to a different list.
    let clearFilter = () => {
      listFilter = ''
      if (filterInputRef) filterInputRef.value = ''
    }
    // Frame navigation opens a different list; none of the view-only controls
    // should leak into it.
    let resetViewState = () => {
      clearFilter()
      statusFilter = 'all'
      hideDone = false
      sortMode = 'manual'
      reverseView = false
      shuffleOrder = null
      syncSortSelect()
    }
    let resetFilters = () => {
      disarmClear()
      clearFilter()
      statusFilter = 'all'
      hideDone = false
      openItemMenuId = null
      announce('Filter zurückgesetzt')
      void handle.update()
    }
    let statusFilterLabel = (status: StatusFilter): string =>
      status === 'open'
        ? 'Offen'
        : status === 'done'
          ? 'Erledigt'
          : status === 'overdue'
            ? 'Überfällig'
            : 'Alle'
    let setStatusFilter = (status: StatusFilter) => {
      disarmClear()
      statusFilter = status
      // "Erledigt" is an explicit request to see completed rows; the hide-done
      // shortcut must not silently turn that tab into an empty view.
      if (status === 'done') hideDone = false
      openItemMenuId = null
      announce(`Status: ${statusFilterLabel(status)}`)
      void handle.update()
    }
    let setHideDone = (value: boolean) => {
      disarmClear()
      hideDone = value
      openItemMenuId = null
      announce(value ? 'Erledigte ausgeblendet' : 'Erledigte eingeblendet')
      void handle.update()
    }
    let sortLabel = (mode: SortMode): string =>
      mode === 'az'
        ? 'A–Z'
        : mode === 'done'
          ? 'Nach Erledigt'
          : mode === 'due'
            ? 'Nach Fälligkeit'
            : mode === 'updated'
              ? 'Nach Änderung'
              : 'Manuell'
    let setSortMode = (mode: SortMode) => {
      disarmClear()
      sortMode = mode
      shuffleOrder = null
      if (mode === 'manual') reverseView = false
      openItemMenuId = null
      syncSortSelect()
      announce(
        mode === 'manual'
          ? 'Manuelle Reihenfolge'
          : `Ansicht: ${sortLabel(mode)} (nicht gespeichert)`,
      )
      void handle.update()
    }
    let toggleReverse = () => {
      disarmClear()
      reverseView = !reverseView
      announce(reverseView ? 'Ansicht umgekehrt (nicht gespeichert)' : 'Ansicht zurückgedreht')
      void handle.update()
    }
    let reshuffle = () => {
      disarmClear()
      if (items.length < 2) return
      sortMode = 'manual'
      shuffleOrder = shuffleItems(items).map((item) => item.id)
      reverseView = false
      openItemMenuId = null
      syncSortSelect()
      announce('Ansicht gemischt (nicht gespeichert)')
      void handle.update()
    }

    // Push the current `title`/`description` state into the uncontrolled
    // title/description DOM nodes. Must run after every hydration/discard so the
    // header always reflects the list that is actually open.
    let syncFieldInputs = () => {
      if (titleInputRef && titleInputRef.value !== title) titleInputRef.value = title
      if (descriptionInputRef && descriptionInputRef.value !== description) {
        descriptionInputRef.value = description
      }
    }

    // The description field is collapsed for lists without one so the editor
    // spends its vertical space on the element rows instead.
    let showDescription = (): boolean =>
      descriptionMode === 'open' || (descriptionMode === 'auto' && description.trim() !== '')

    // ── Unsaved new-list draft ───────────────────────────────────────────────
    // A brand-new list (loadedListId === null) has no id, so the unload beacon
    // cannot flush it — navigating to another list silently discarded the draft.
    // Persist a session-scoped draft as we type and restore it when a fresh "new
    // list" is opened, so nothing typed is ever lost. It is cleared the moment
    // the list is saved (an id exists) or the user discards it.
    let DRAFT_KEY = 'lists:draft:new'
    let draftRestored = false

    let loadDraft = (): ListInitialState | null => {
      if (typeof sessionStorage === 'undefined') return null
      try {
        let raw = sessionStorage.getItem(DRAFT_KEY)
        if (!raw) return null
        let data = JSON.parse(raw)
        if (data && typeof data === 'object') {
          return {
            id: 0,
            title: typeof data.title === 'string' ? data.title : '',
            description: typeof data.description === 'string' ? data.description : '',
            items: Array.isArray(data.items) ? data.items : [],
            updated_at: 0,
          }
        }
      } catch {
        /* ignore a corrupt draft */
      }
      return null
    }

    let clearDraft = () => {
      if (typeof sessionStorage === 'undefined') return
      try {
        sessionStorage.removeItem(DRAFT_KEY)
      } catch {
        /* ignore */
      }
      draftRestored = false
    }

    let saveDraft = () => {
      if (loadedListId !== null) return
      if (typeof sessionStorage === 'undefined') return
      if (!isDirty()) {
        clearDraft()
        return
      }
      try {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ title, description, items }))
      } catch {
        /* storage full / unavailable — ignore */
      }
    }

    let setDirty = () => {
      // The previous action's undo stays available until the next mutation, but
      // not across it: a second edit must not silently revert to a stale state.
      if (keepUndoForMutation) {
        keepUndoForMutation = false
      } else if (undoSnapshot !== null) {
        clearUndo()
      }
      // Runs before the dirty early-return so that reverting a new-list draft
      // back to clean clears the stored draft rather than leaving it stale.
      saveDraft()
      if (!isDirty()) return
      if (saveStatus === 'saved' || saveStatus === 'error') {
        saveStatus = 'dirty'
        void handle.update()
      }
      scheduleAutosave()
    }

    // Discard a restored unsaved draft completely and reset to a clean new list.
    let discardDraft = () => {
      clearDraft()
      items = []
      title = ''
      description = ''
      descriptionMode = 'auto'
      loadedListId = null
      loadedUpdatedAt = null
      openItemMenuId = null
      clearSelection()
      saveStatus = 'saved'
      saveError = ''
      conflictState = { show: false, serverState: null }
      snapshotClean()
      resetViewState()
      syncFieldInputs()
      void handle.update()
    }

    let scrollToBottom = () => {
      if (listRef) {
        listRef.scrollTop = listRef.scrollHeight
      }
    }

    function navigateFrame(href: string) {
      handle.frame.reload({ src: href }).catch(() => {})
    }

    let getCsrfHeaders = (): Record<string, string> => {
      let csrfToken =
        typeof document !== 'undefined'
          ? document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
          : undefined
      return listsJsonHeaders({ csrfToken, ifMatch: loadedUpdatedAt })
    }

    let performSave = async (manual = false): Promise<boolean> => {
      conflictState = { show: false, serverState: null }
      if (loadedListId === null) {
        // A brand-new list is created only by an explicit user action (the
        // "+ Liste hinzufügen" button). Autosave must never materialize a list
        // on its own, or a half-typed list silently appears and navigates away.
        if (!manual) {
          return false
        }
        // Don't create a nameless list: require a title or a description.
        // Items are optional — a list may be created empty and filled in later.
        if (!title.trim() && !description.trim()) {
          return false
        }
        // Create new list
        saving = true
        saveStatus = 'saving'
        void handle.update()
        let ok = false
        let newId: number | null = null
        try {
          let outcome = await createListRequest(getCsrfHeaders(), { title, description, items })
          if (outcome.status === 'ok') {
            saveError = ''
            newId = outcome.state.id
            loadedListId = newId
            loadedUpdatedAt = outcome.state.updated_at
            ok = true
          } else {
            saveError = outcome.network
              ? 'Speichern fehlgeschlagen (Netzwerkfehler)'
              : 'Speichern fehlgeschlagen'
          }
        } catch {
          saveError = 'Speichern fehlgeschlagen (Netzwerkfehler)'
        }
        saving = false
        if (ok && newId !== null) {
          snapshotClean()
          clearDraft()
          saveStatus = 'saved'
          void handle.update()
          navigateFrame(`/lists?load=${newId}`)
          return true
        } else {
          saveStatus = 'error'
          void handle.update()
          return false
        }
      } else {
        // Patch existing list
        saving = true
        saveStatus = 'saving'
        void handle.update()
        // Capture snapshot at send time to detect drift during the await
        let sentTitle = title
        let sentDesc = description
        let sentItemsJSON = itemsFingerprint(items)
        let ok = false
        try {
          let partial: Record<string, unknown> = {}
          if (isDirty()) {
            if (title !== cleanTitle) partial.title = title
            if (description !== cleanDescription) partial.description = description
            if (sentItemsJSON !== cleanItemsJSON) partial.items = items
          } else {
            // Fall back to sending full if nothing explicitly changed
            partial = { title, description, items }
          }
          let outcome = await patchListRequest(getCsrfHeaders(), loadedListId, partial)
          if (outcome.status === 'ok') {
            saveError = ''
            let state = outcome.state
            if (Number.isFinite(state.updated_at)) loadedUpdatedAt = state.updated_at
            // If the user kept typing during the save, mark dirty and reschedule
            let drifted =
              title !== sentTitle ||
              description !== sentDesc ||
              itemsFingerprint(items) !== sentItemsJSON
            if (drifted) {
              saveStatus = 'dirty'
              scheduleAutosave()
              ok = true
              saving = false
              void handle.update()
              return true
            }
            // Apply server echo only if nothing drifted
            items = state.items
            title = state.title
            description = state.description
            ok = true
          } else if (outcome.status === 'conflict') {
            conflictState = { show: true, serverState: outcome.state }
            ok = false
          } else {
            saveError = outcome.network
              ? 'Speichern fehlgeschlagen (Netzwerkfehler)'
              : 'Speichern fehlgeschlagen'
          }
        } catch {
          saveError = 'Speichern fehlgeschlagen (Netzwerkfehler)'
        }
        saving = false
        if (ok) {
          snapshotClean()
          saveStatus = 'saved'
          syncEditorSidebar()
          void handle.update()
          return true
        } else {
          saveStatus = 'error'
          void handle.update()
          return false
        }
      }
    }

    // Serialize saves: a second call while one is in flight reuses the same
    // promise instead of firing another PUT against the same If-Match, which
    // would 409 against the updated_at the first request just bumped.
    let saveNow = (manual = false): Promise<boolean> => {
      if (savingPromise) return savingPromise
      let promise = performSave(manual)
      savingPromise = promise
      let clear = () => {
        if (savingPromise === promise) savingPromise = null
      }
      void promise.then(clear, clear)
      return promise
    }

    // Re-run the failed write. Pass `manual` so a not-yet-created list can still
    // be created on retry; the flag is ignored for an existing list.
    let retrySave = () => {
      if (offline) return
      void saveNow(true)
    }

    let dismissSaveError = () => {
      saveError = ''
      // The error is still real (the edit is unsaved) — but the user chose to
      // dismiss it, so fall back to the honest "Ungespeichert" state instead of
      // leaving an inert "Fehler" pill behind.
      if (saveStatus === 'error') saveStatus = isDirty() ? 'dirty' : 'saved'
      void handle.update()
    }

    // Push the current editor state into the matching sidebar row so the
    // sidebar's title / count stay in sync without a full frame reload.
    let syncEditorSidebar = () => {
      if (loadedListId === null) return
      let name = title.trim() || description.trim()
      syncSidebarRow(loadedListId, {
        label: name || UNTITLED_LIST_LABEL,
        untitled: !name,
        count: items.length,
        doneCount: items.filter((item) => item.done === true).length,
        updatedAt: loadedUpdatedAt ?? undefined,
      })
    }

    let scheduleAutosave = (fast = false) => {
      if (conflictState.show) return
      if (autosaveTimer) clearTimeout(autosaveTimer)
      autosaveTimer = setTimeout(
        async () => {
          autosaveTimer = null
          if (!isDirty()) return
          // Re-check conflict before saving
          if (conflictState.show) return
          await saveNow()
        },
        fast ? 300 : 1500,
      )
    }

    let flushNow = async (): Promise<boolean> => {
      if (autosaveTimer) {
        clearTimeout(autosaveTimer)
        autosaveTimer = null
      }
      // Await the in-flight save (a promise, not a polling loop) before deciding
      // whether more work is still pending.
      if (savingPromise) await savingPromise.catch(() => {})
      if (conflictState.show) return false
      if (!isDirty()) return true
      return await saveNow()
    }

    // Drop the current row selection. Called on every list load so a selection
    // never leaks onto a different list.
    let clearSelection = () => {
      selectedItemIds = new Set()
    }

    let closeItemMenu = () => {
      if (openItemMenuId === null) return
      openItemMenuId = null
      void handle.update()
    }

    let toggleItemMenu = (id: string) => {
      openItemMenuId = openItemMenuId === id ? null : id
      void handle.update()
    }

    // Move focus back to the row that owned the menu after it closes, or to a
    // neighbouring row after a delete. The kebab is the intended target on
    // touch, but it is display:none on pointer devices, so fall back to the
    // row itself (tabindex -1 still accepts programmatic focus).
    let focusItemTrigger = (id: string | null) => {
      handle.queueTask(() => {
        if (id) {
          let trigger = document.querySelector<HTMLElement>(
            `[data-item-menu-button="${CSS.escape(id)}"]`,
          )
          if (trigger && trigger.offsetParent !== null) {
            trigger.focus()
            return
          }
          let row = document.querySelector<HTMLElement>(`[data-item-id="${CSS.escape(id)}"]`)
          if (row) {
            row.focus()
            return
          }
        }
        newItemRef?.focus()
      })
    }

    // Re-focus the same ↑/↓ button in the moved row. Reordering re-inserts the
    // row DOM node (up) or leaves it in place (down), and moving a focused
    // node detaches/blurs it; restoring the button keeps repeated Enter/click
    // moves on the same row and stops keyboard users landing on <body>. The
    // cluster's reveal is focus-visible-gated, so this mouse-restored focus
    // does not pin the toolbar open next to the row that slid under the
    // pointer.
    let focusItemAction = (id: string, label: 'Nach oben' | 'Nach unten') => {
      handle.queueTask(() => {
        let row = document.querySelector<HTMLElement>(`[data-item-id="${CSS.escape(id)}"]`)
        let button = row?.querySelector<HTMLButtonElement>(
          `[data-item-actions] button[aria-label="${label}"]`,
        )
        if (button && !button.disabled) {
          button.focus()
          return
        }
        row?.focus()
      })
    }

    // Keyboard shortcut sheet. The visible list lives in lists-view; the live
    // region announcement keeps the pre-existing screen-reader affordance.
    let openHelp = (trigger: HTMLElement | null) => {
      helpTrigger = trigger
      helpOpen = true
      announce(
        'Tastatur-Hilfe geöffnet: Enter nimmt ein Element auf, Pfeile verschieben es, Enter legt es ab, Strg oder Cmd plus Pfeile verschieben direkt, Escape bricht ab, Strg oder Cmd plus Z macht die letzte Aktion rückgängig, Doppelklick auf den Elementtext bearbeitet es.',
      )
      void handle.update()
    }

    let closeHelp = () => {
      if (!helpOpen) return
      helpOpen = false
      announce('Tastatur-Hilfe geschlossen')
      let trigger = helpTrigger
      helpTrigger = null
      handle.queueTask(() => {
        if (trigger && trigger.isConnected && trigger.offsetParent !== null) {
          trigger.focus()
          return
        }
        // On touch the "?" button is folded into the "…" menu, so restore
        // focus to that menu's summary instead.
        document.querySelector<HTMLElement>('[data-lists-more] summary')?.focus()
      })
      void handle.update()
    }

    let toggleHelp = (trigger: HTMLElement | null) => {
      if (helpOpen) closeHelp()
      else openHelp(trigger)
    }

    let toggleSelected = (id: string) => {
      selectedItemIds = toggleSelectedIn(selectedItemIds, id)
      copyError = ''
      void handle.update()
    }

    let toggleSelectAllVisible = () => {
      selectedItemIds = toggleAllVisibleIn(
        selectedItemIds,
        visibleItems().map((item) => item.id),
      )
      copyError = ''
      void handle.update()
    }

    let targetDisplayLabel = (target: ListTarget): string =>
      target.title.trim() || target.description.trim() || `${UNTITLED_LIST_LABEL} (#${target.id})`

    let showTargetNotice = (message: string) => {
      copyNotice = message
      if (copyNoticeTimer) clearTimeout(copyNoticeTimer)
      copyNoticeTimer = setTimeout(() => {
        copyNotice = ''
        copyNoticeTimer = null
        void handle.update()
      }, 5000)
      announce(message)
      void handle.update()
    }

    /** Push a server response into the matching sidebar row (when that row is
     *  on the current page) so its count/updated-at stay accurate without a
     *  full frame reload that would discard the success notice and focus. */
    let syncSidebarState = (state: ListInitialState) => {
      let label = state.title.trim() || state.description.trim()
      syncSidebarRow(state.id, {
        label: label || `${UNTITLED_LIST_LABEL} (#${state.id})`,
        untitled: !label,
        count: state.items.length,
        doneCount: state.items.filter((item) => item.done === true).length,
        updatedAt: state.updated_at,
      })
    }

    let searchTargets = async (query: string) => {
      let requestId = ++pickerRequestId
      pickerLoading = true
      pickerError = ''
      void handle.update()
      let outcome = await searchListTargetsRequest(query)
      // A slower earlier request must never overwrite a newer search.
      if (requestId !== pickerRequestId) return
      pickerLoading = false
      if (outcome.status === 'ok') {
        // The loaded list is never a valid target (server rejects it too).
        pickerResults = outcome.targets.filter((target) => target.id !== loadedListId)
        pickerHasMore = outcome.hasMore
      } else {
        pickerResults = []
        pickerHasMore = false
        pickerError = outcome.network
          ? 'Listen konnten nicht geladen werden (Netzwerkfehler).'
          : 'Listen konnten nicht geladen werden.'
      }
      void handle.update()
    }

    let setPickerQuery = (value: string) => {
      pickerQuery = value
      if (pickerDebounce) clearTimeout(pickerDebounce)
      pickerDebounce = setTimeout(() => {
        pickerDebounce = null
        void searchTargets(pickerQuery)
      }, 250)
      void handle.update()
    }

    let closeTargetPicker = (restoreFocus = true) => {
      let current = picker
      if (!current) return
      picker = null
      pickerQuery = ''
      pickerResults = []
      pickerHasMore = false
      pickerLoading = false
      pickerError = ''
      // Invalidate any in-flight search so its late response cannot reopen the
      // result list after the dialog closed.
      pickerRequestId++
      if (pickerDebounce) {
        clearTimeout(pickerDebounce)
        pickerDebounce = null
      }
      if (!restoreFocus) {
        void handle.update()
        return
      }
      handle.queueTask(() => {
        let trigger = current.trigger
        if (trigger && trigger.isConnected && trigger.offsetParent !== null) {
          trigger.focus()
          return
        }
        if (current.singleItemId) {
          let row = document.querySelector<HTMLElement>(
            `[data-item-id="${CSS.escape(current.singleItemId)}"]`,
          )
          row?.focus()
        }
      })
      // queueTask is drained by the next component update, so schedule it
      // after queueing (otherwise the task can be left waiting forever).
      void handle.update()
    }

    let openTargetPicker = (
      purpose: 'copy' | 'move',
      itemIds: string[],
      trigger: HTMLElement | null,
      singleItemId: string | null = null,
    ) => {
      if (loadedListId === null) {
        copyError = 'Bitte zuerst eine Liste öffnen'
        void handle.update()
        return
      }
      if (itemIds.length === 0) {
        copyError = 'Keine Elemente ausgewählt'
        void handle.update()
        return
      }
      picker = { purpose, itemIds, trigger, singleItemId }
      pickerQuery = ''
      pickerResults = []
      pickerHasMore = false
      pickerError = ''
      pickerLoading = true
      handle.queueTask(() => pickerSearchRef?.focus())
      void handle.update()
      void searchTargets('')
    }

    let selectPickerTarget = (target: ListTarget) => {
      let current = picker
      if (!current) return
      closeTargetPicker(true)
      if (current.purpose === 'copy') {
        void copyItemsToTarget(target, current.itemIds)
      } else if (current.singleItemId) {
        void moveSingleItemToTarget(current.singleItemId, target)
      } else {
        void moveItemsToTarget(target, current.itemIds)
      }
    }

    let handlePickerKeyDown = (event: KeyboardEvent) => {
      if (!picker) return
      if (event.key === 'Escape') {
        event.preventDefault()
        closeTargetPicker(true)
        return
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
      let buttons = Array.from(
        document.querySelectorAll<HTMLButtonElement>('[data-target-option]'),
      ).filter((button) => button.offsetParent !== null)
      if (buttons.length === 0) return
      event.preventDefault()
      let index = buttons.indexOf(document.activeElement as HTMLButtonElement)
      let next =
        event.key === 'ArrowDown'
          ? index < 0
            ? 0
            : Math.min(buttons.length - 1, index + 1)
          : index < 0
            ? buttons.length - 1
            : Math.max(0, index - 1)
      buttons[next]?.focus()
    }

    let copyItemsToTarget = async (target: ListTarget, itemIds: string[]) => {
      let sourceId = loadedListId
      if (sourceId === null || copyBusy || itemIds.length === 0) return
      // Claim the in-flight guard *before* awaiting. A pending autosave makes
      // `flushNow` span a network round-trip; without this, a second click could
      // pass the `copyBusy` guard and copy the same selection twice.
      copyBusy = true
      copyError = ''
      void handle.update()
      try {
        // Persist pending edits first: the server checks If-Match against the
        // source's `updated_at`, which a pending autosave is about to bump.
        let flushed = await flushNow()
        if (!flushed) return
        if (loadedListId !== sourceId) {
          copyError = 'Die Liste wurde gewechselt – Aktion abgebrochen'
          return
        }
        let outcome = await copyItemsRequest(getCsrfHeaders(), sourceId, target.id, itemIds)
        if (outcome.status === 'ok') {
          if (loadedListId !== sourceId) {
            copyError = 'Die Liste wurde gewechselt – Aktion abgebrochen'
            return
          }
          let copied = outcome.copied
          selectedItemIds = new Set()
          if (outcome.target) syncSidebarState(outcome.target)
          showTargetNotice(
            `${copied} ${copied === 1 ? 'Element' : 'Elemente'} nach „${targetDisplayLabel(target)}" kopiert`,
          )
          // The bulk bar (and its trigger) unmounts with the cleared
          // selection; land keyboard users back in the editor.
          handle.queueTask(() => newItemRef?.focus())
        } else if (outcome.status === 'conflict') {
          conflictState = { show: true, serverState: outcome.state }
        } else if (outcome.status === 'not_found') {
          copyError = 'Liste nicht gefunden'
        } else if (outcome.status === 'bad_request') {
          copyError = 'Kopieren nicht möglich'
        } else {
          copyError = outcome.network
            ? 'Kopieren fehlgeschlagen (Netzwerkfehler)'
            : 'Kopieren fehlgeschlagen'
        }
      } catch {
        copyError = 'Kopieren fehlgeschlagen (Netzwerkfehler)'
      } finally {
        copyBusy = false
        void handle.update()
      }
    }

    let moveItemsToTarget = async (target: ListTarget, itemIds: string[]) => {
      let sourceId = loadedListId
      if (sourceId === null || copyBusy || itemIds.length === 0) return
      copyBusy = true
      copyError = ''
      void handle.update()
      try {
        let flushed = await flushNow()
        if (!flushed) return
        if (loadedListId !== sourceId) {
          copyError = 'Die Liste wurde gewechselt – Aktion abgebrochen'
          return
        }
        let outcome = await moveItemsRequest(getCsrfHeaders(), sourceId, target.id, itemIds)
        if (outcome.status === 'ok') {
          // The request may outlive a frame navigation. Never apply list A's
          // response to the editor that now shows list B.
          if (loadedListId !== sourceId) {
            copyError = 'Die Liste wurde gewechselt – Aktion abgebrochen'
            return
          }
          items = cloneItems(outcome.source.items)
          loadedUpdatedAt = outcome.source.updated_at
          clearSelection()
          snapshotClean()
          saveStatus = 'saved'
          syncEditorSidebar()
          syncSidebarState(outcome.target)
          let moved = outcome.moved ?? itemIds.length
          showTargetNotice(
            `${moved} ${moved === 1 ? 'Element' : 'Elemente'} nach „${targetDisplayLabel(target)}" verschoben`,
          )
          handle.queueTask(() => newItemRef?.focus())
        } else if (outcome.status === 'conflict') {
          conflictState = { show: true, serverState: outcome.state }
        } else if (outcome.status === 'not_found') {
          copyError = 'Liste nicht gefunden'
        } else if (outcome.status === 'bad_request') {
          copyError = 'Verschieben nicht möglich'
        } else {
          copyError = outcome.network
            ? 'Verschieben fehlgeschlagen (Netzwerkfehler)'
            : 'Verschieben fehlgeschlagen'
        }
      } catch {
        copyError = 'Verschieben fehlgeschlagen (Netzwerkfehler)'
      } finally {
        copyBusy = false
        void handle.update()
      }
    }

    let moveSingleItemToTarget = async (itemId: string, target: ListTarget) => {
      let sourceId = loadedListId
      if (sourceId === null || copyBusy) return
      // Focus the surviving neighbour after the row leaves the editor.
      let currentIndex = items.findIndex((item) => item.id === itemId)
      let nextFocusId =
        currentIndex < 0
          ? null
          : (items[currentIndex + 1]?.id ?? items[currentIndex - 1]?.id ?? null)
      copyBusy = true
      copyError = ''
      void handle.update()
      try {
        let flushed = await flushNow()
        if (!flushed) return
        if (loadedListId !== sourceId) {
          copyError = 'Die Liste wurde gewechselt – Aktion abgebrochen'
          return
        }
        let outcome = await moveItemRequest(getCsrfHeaders(), sourceId, target.id, itemId)
        if (outcome.status === 'ok') {
          if (loadedListId !== sourceId) {
            copyError = 'Die Liste wurde gewechselt – Aktion abgebrochen'
            return
          }
          items = cloneItems(outcome.source.items)
          loadedUpdatedAt = outcome.source.updated_at
          snapshotClean()
          saveStatus = 'saved'
          syncEditorSidebar()
          syncSidebarState(outcome.target)
          showTargetNotice(`Element nach „${targetDisplayLabel(target)}" verschoben`)
          focusItemTrigger(nextFocusId)
        } else if (outcome.status === 'conflict') {
          conflictState = { show: true, serverState: outcome.state }
        } else if (outcome.status === 'not_found') {
          copyError = 'Liste nicht gefunden'
        } else if (outcome.status === 'bad_request') {
          copyError = 'Verschieben nicht möglich'
        } else {
          copyError = outcome.network
            ? 'Verschieben fehlgeschlagen (Netzwerkfehler)'
            : 'Verschieben fehlgeschlagen'
        }
      } catch {
        copyError = 'Verschieben fehlgeschlagen (Netzwerkfehler)'
      } finally {
        copyBusy = false
        void handle.update()
      }
    }

    let setDoneSelected = (done: boolean) => {
      if (selectedItemIds.size === 0) return
      // A bulk update is a mutation like any other: drop a previously armed
      // "Alle löschen" so the next click cannot delete without re-arming.
      disarmClear()
      let ids = new Set(items.filter((item) => selectedItemIds.has(item.id)).map((item) => item.id))
      if (ids.size === 0) return
      showUndo(done ? 'bulkDone' : 'bulkOpen', cloneItems(items))
      items = setDoneByIds(items, ids, done, Date.now())
      setDirty()
      announce(
        `${ids.size} ${ids.size === 1 ? 'Element' : 'Elemente'} als ${done ? 'erledigt' : 'offen'} markiert`,
      )
      void handle.update()
      scheduleAutosave(true)
    }

    let openBulkPicker = (purpose: 'copy' | 'move', trigger: HTMLElement | null) => {
      let itemIds = items.filter((item) => selectedItemIds.has(item.id)).map((item) => item.id)
      openTargetPicker(purpose, itemIds, trigger)
    }

    let openItemMovePicker = (itemId: string, trigger: HTMLElement | null) => {
      closeItemMenu()
      let focusTarget =
        trigger && trigger.isConnected
          ? trigger
          : document.querySelector<HTMLElement>(`[data-item-menu-button="${CSS.escape(itemId)}"]`)
      openTargetPicker('move', [itemId], focusTarget, itemId)
    }

    // Sidebar menu action: copy every item of the open list into the clicked
    // sidebar list, using the same server merge as the list-to-list drag. The
    // server-side merge is atomic (source untouched, target appended), so a
    // single confirmation covers the whole operation.
    let copyOpenListInto = async (targetId: number, targetName: string) => {
      let sourceId = loadedListId
      if (copyBusy || targetId === sourceId) return
      if (sourceId === null) {
        copyError = 'Bitte zuerst eine Liste öffnen'
        void handle.update()
        return
      }
      if (items.length === 0) {
        copyError = 'Die geöffnete Liste ist leer'
        void handle.update()
        return
      }
      let sourceName = title.trim() || description.trim() || UNTITLED_LIST_LABEL
      let count = items.length
      let message =
        count > 0
          ? `Alle ${count} Einträge von "${sourceName}" in "${targetName}" kopieren?`
          : `Alle Einträge von "${sourceName}" in "${targetName}" kopieren?`
      let run = async () => {
        copyBusy = true
        copyError = ''
        void handle.update()
        try {
          let flushed = await flushNow()
          if (!flushed) return
          if (loadedListId !== sourceId) {
            copyError = 'Die Liste wurde gewechselt – Aktion abgebrochen'
            return
          }
          let outcome = await mergeListRequest(getCsrfHeaders(), sourceId, targetId)
          if (outcome.status === 'ok') {
            // The merge ran against the captured source; only refresh when the
            // editor still shows that list, otherwise the user is elsewhere.
            if (loadedListId === sourceId) {
              showTargetNotice(`Alle Einträge in „${targetName}" kopiert`)
              handle.frame.reload().catch(() => {})
            }
          } else if (outcome.status === 'conflict') {
            conflictState = { show: true, serverState: outcome.state }
          } else if (outcome.status === 'not_found') {
            copyError = 'Liste nicht gefunden'
          } else if (outcome.status === 'bad_request') {
            copyError = count === 0 ? 'Die Quellliste ist leer' : 'Kopieren nicht möglich'
          } else {
            copyError = outcome.network
              ? 'Kopieren fehlgeschlagen (Netzwerkfehler)'
              : 'Kopieren fehlgeschlagen'
          }
        } catch {
          copyError = 'Kopieren fehlgeschlagen (Netzwerkfehler)'
        } finally {
          copyBusy = false
          void handle.update()
        }
      }
      let decision = requestConfirmDecision({
        message,
        title: 'Elemente kopieren bestätigen',
        confirmLabel: 'Kopieren',
      })
      if (decision) {
        void decision.then((accepted) => {
          if (accepted) void run()
        })
        return
      }
      if (typeof window !== 'undefined' && window.confirm(message)) void run()
    }

    if (typeof document !== 'undefined') {
      document.addEventListener(
        'click',
        (event) => {
          let target = event.target
          if (!(target instanceof Element)) return
          let button = target.closest<HTMLElement>('[data-list-copy-here-btn]')
          if (!button) return
          event.preventDefault()
          let row = button.closest<HTMLElement>('[data-list-id]')
          let targetId = Number(row?.dataset.listId)
          if (!Number.isFinite(targetId) || targetId < 1) return
          let targetName =
            row?.querySelector<HTMLElement>('[data-list-name]')?.textContent?.trim() || 'Liste'
          void copyOpenListInto(targetId, targetName)
        },
        { signal: handle.signal },
      )

      // Ctrl/Cmd+Z outside form fields. Inputs keep their native text undo;
      // inside the editor the document shortcut reverts the last destructive
      // action (the chip above documents that it is still available).
      document.addEventListener(
        'keydown',
        (event) => {
          if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return
          if (event.key.toLowerCase() !== 'z') return
          let target = event.target
          if (
            target instanceof Element &&
            target.closest(
              'input, textarea, select, [contenteditable=""], [contenteditable="true"]',
            )
          ) {
            return
          }
          if (undoSnapshot === null) return
          event.preventDefault()
          undo()
        },
        { signal: handle.signal },
      )
    }

    // Revert unsaved edits back to the last saved snapshot.
    let discardChanges = () => {
      if (autosaveTimer) {
        clearTimeout(autosaveTimer)
        autosaveTimer = null
      }
      resetUndoState()
      openItemMenuId = null
      helpOpen = false
      picker = null
      clearSelection()
      items = parseItemsFingerprint(cleanItemsJSON)
      title = cleanTitle
      description = cleanDescription
      descriptionMode = 'auto'
      saveStatus = 'saved'
      conflictState = { show: false, serverState: null }
      clearDraft()
      syncFieldInputs()
      void handle.update()
    }

    // Hydrate from server-injected initial state
    let hydrateFromInitialState = (state: ListInitialState) => {
      items = cloneItems(state.items)
      title = state.title ?? ''
      description = state.description
      descriptionMode = 'auto'
      loadedListId = state.id
      loadedUpdatedAt = state.updated_at
      openItemMenuId = null
      helpOpen = false
      picker = null
      resetUndoState()
      clearSelection()
      snapshotClean()
      saveStatus = 'saved'
      saveError = ''
      loadingList = false
      conflictState = { show: false, serverState: null }
      resetViewState()
      syncFieldInputs()
    }

    // Initialize from initial state
    let loadingList = false
    if (handle.props.initialState) {
      hydrateFromInitialState(handle.props.initialState)
      initialized = true
    }

    // Reload handler: re-reads initial state from the new frame document
    function reloadFromFrame() {
      if (handle.signal.aborted) return
      if (typeof document === 'undefined') return
      let el = document.getElementById('lists-initial-state')
      if (el) {
        let raw = el.getAttribute('data-state')
        if (raw) {
          try {
            let data = JSON.parse(raw)
            if (data && typeof data.id === 'number') {
              hydrateFromInitialState(data)
              void handle.update()
              return
            }
          } catch {
            // ignore parse errors, fall through to new-list state
          }
        }
      }
      // No initial state: start new
      // Restore an unsaved new-list draft if one exists, so a dismissed or
      // navigated-away draft is recovered instead of silently lost.
      let draft = loadDraft()
      if (draft) {
        items = draft.items.map((item) => ({ ...item }))
        title = draft.title ?? ''
        description = draft.description ?? ''
        descriptionMode = 'auto'
        loadedListId = null
        loadedUpdatedAt = null
        openItemMenuId = null
        resetUndoState()
        clearSelection()
        saveStatus = 'dirty'
        saveError = ''
        loadingList = false
        conflictState = { show: false, serverState: null }
        draftRestored = true
        resetViewState()
        syncFieldInputs()
        void handle.update()
        return
      }
      items = []
      title = ''
      description = ''
      descriptionMode = 'auto'
      loadedListId = null
      loadedUpdatedAt = null
      openItemMenuId = null
      resetUndoState()
      clearSelection()
      saveStatus = 'saved'
      saveError = ''
      loadingList = false
      conflictState = { show: false, serverState: null }
      snapshotClean()
      resetViewState()
      syncFieldInputs()
      void handle.update()
    }

    // Frame reload events only fire in the browser. Registering them during SSR
    // would pass @remix-run/ui's frozen, AbortSignal-shaped `handle.signal` stub
    // as a native addEventListener option: Node tolerates it, but Bun requires a
    // real AbortSignal and throws `TypeError: Type error`.
    if (typeof document !== 'undefined') {
      handle.frame.addEventListener('reloadComplete', reloadFromFrame, {
        signal: handle.signal,
      })

      // Flush pending edits *before* the frame swaps in the next list.
      //
      // `beforeunload` never fires for a frame navigation (the document is not
      // unloaded), so switching list / searching / paginating used to silently
      // discard anything typed within the 1.5s autosave debounce. `reloadStart`
      // fires synchronously before the new content is fetched, while
      // `loadedListId`/`clean*` still describe the outgoing list — the only point
      // where the edit can still be attributed to the right row.
      function beginFrameReload() {
        flushWithKeepalive()
        openItemMenuId = null
        // Real loading feedback for the frame swap (list switch, sidebar search,
        // pagination). reloadFromFrame clears it on reloadComplete.
        loadingList = true
        void handle.update()
      }
      handle.frame.addEventListener('reloadStart', beginFrameReload, {
        signal: handle.signal,
      })
    }

    // On init, if no initial state was already provided, wait for frame load
    if (!initialized) {
      setTimeout(() => {
        reloadFromFrame()
      }, 0)
    }

    // Drag-and-drop (item reorder, cross-list item move, list merge) lives in
    // its own module and is applied to the element-list container through the
    // browser-only `drag()` mixin (see lists-drag-mixin.ts). These callbacks
    // bridge it to the editor's state; the object is built once so the mixin's
    // controller keeps the same stable context on every render.
    let dragContext: ListsDragContext = {
      getItems: () => items,
      getLoadedListId: () => loadedListId,
      getLoadedUpdatedAt: () => loadedUpdatedAt,
      getListRef: () => listRef,
      isReorderLocked: reorderLocked,
      getCsrfHeaders,
      flush: flushNow,
      commitReorder: (next) => {
        items = next
        setDirty()
        void handle.update()
      },
      setSaveError: (message) => {
        saveError = message
      },
      showConflict: (state) => {
        conflictState = { show: true, serverState: state }
      },
      reloadFrame: () => handle.frame.reload().catch(() => {}),
      update: () => handle.update(),
      signal: handle.signal,
    }

    let clearAll = () => {
      openItemMenuId = null
      if (!clearArmed) {
        clearArmed = true
        if (clearArmTimer) clearTimeout(clearArmTimer)
        clearArmTimer = setTimeout(() => disarmClear(), 4000)
        void handle.update()
        return
      }
      disarmClear()
      showUndo('clear', cloneItems(items))
      items = []
      selectedItemIds = new Set()
      setDirty()
      void handle.update()
    }

    // "Nur Erledigte löschen": remove every completed item in one action, with
    // the same undo banner as the other deletions. It is only enabled while at
    // least one item is completed.
    let clearDone = () => {
      openItemMenuId = null
      disarmClear()
      let result = clearDoneItems(items)
      if (result.removedIds.length === 0) return
      showUndo('clearDone', cloneItems(items))
      items = result.items
      // Drop the removed rows from the copy selection.
      let nextSelected = new Set(selectedItemIds)
      for (let id of result.removedIds) nextSelected.delete(id)
      selectedItemIds = nextSelected
      setDirty()
      announce('Erledigte Elemente gelöscht')
      void handle.update()
    }

    // "Auswahl löschen": remove every checked element in one action, with the
    // same undo banner as the other deletions. Only reachable while at least
    // one row is selected; clearing the selection afterwards keeps the bulk bar
    // from lingering over rows that no longer exist.
    let deleteSelected = () => {
      openItemMenuId = null
      disarmClear()
      if (selectedItemIds.size === 0) return
      let result = removeItemsByIds(items, selectedItemIds)
      if (result.removed.length === 0) return
      showUndo('deleteSelected', cloneItems(items))
      items = result.items
      clearSelection()
      copyError = ''
      setDirty()
      announce(
        result.removed.length === 1
          ? 'Ausgewähltes Element gelöscht'
          : `${result.removed.length} ausgewählte Elemente gelöscht`,
      )
      void handle.update()
    }

    // Duplicate the currently open list by submitting the hidden copy form. The
    // frame runtime intercepts the POST (data-rmx-target) and follows the
    // server redirect straight to the new list's load URL, refreshing both the
    // editor and the sidebar. Any unsaved edits are flushed first so the copy
    // reflects what the user is currently looking at (otherwise the server would
    // copy the last persisted version).
    let copyCurrentList = async () => {
      if (loadedListId === null) return
      // Abort if there is an unresolved conflict the user must resolve first.
      let flushed = await flushNow()
      if (!flushed) return
      let token =
        typeof document !== 'undefined'
          ? document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
          : undefined
      if (token && copyCsrfRef) copyCsrfRef.value = token
      copyFormRef?.requestSubmit()
    }

    let addItem = () => {
      disarmClear()
      if (!newItemLabel.trim()) return
      // Use crypto.randomUUID() for stable client-side id
      items = appendItem(items, createItem(newItemLabel, crypto.randomUUID(), Date.now()))
      newItemLabel = ''
      if (newItemRef) newItemRef.value = ''
      setDirty()
      void handle.update()
      setTimeout(scrollToBottom, 0)
      scheduleAutosave(true)
    }

    let deleteItem = (index: number) => {
      openItemMenuId = null
      disarmClear()
      if (!items[index]) return
      let removedId = items[index].id
      showUndo('delete', cloneItems(items))
      // Simply filter — no id rewriting
      items = deleteItemAt(items, index)
      // Never leave a deleted row in the copy selection.
      if (selectedItemIds.has(removedId)) {
        selectedItemIds = toggleSelectedIn(selectedItemIds, removedId)
      }
      setDirty()
      void handle.update()
    }

    let toggleDone = (index: number) => {
      disarmClear()
      items = toggleDoneAt(items, index, Date.now())
      setDirty()
      void handle.update()
      scheduleAutosave(true)
    }

    // Full-array reorder for the keyboard quick-move / grab paths. Those stay
    // locked whenever `reorderLocked()` is true (including hide-done); the
    // ↑/↓ buttons use `moveVisibleStep` so they also work while done rows are
    // hidden.
    let moveItem = (from: number, to: number) => {
      if (reorderLocked()) return
      disarmClear()
      if (from < 0 || from >= items.length) return
      if (to < 0 || to >= items.length) return
      if (from === to) return
      let newItems = moveItemInArray(items, from, to)
      if (newItems === items) return
      items = newItems
      setDirty()
      void handle.update()
      scheduleAutosave(true)
    }

    // Move a row one step within the visible order by swapping it with its
    // nearest visible neighbour. With "Erledigte ausblenden" active the full
    // order can contain hidden rows between the two visible rows; swapping the
    // visible pair (instead of splicing into an array-adjacent slot) changes
    // exactly one visible step and leaves every hidden row in its slot.
    let moveVisibleStep = (index: number, direction: -1 | 1): boolean => {
      if (visibleReorderLocked()) return false
      let item = items[index]
      if (!item) return false
      let vis = visibleItems()
      let position = vis.findIndex((candidate) => candidate.id === item.id)
      if (position === -1) return false
      let neighbour = vis[position + direction]
      if (!neighbour) return false
      let target = items.findIndex((candidate) => candidate.id === neighbour.id)
      if (target === -1 || target === index) return false
      disarmClear()
      let next = items.slice()
      ;[next[index], next[target]] = [next[target]!, next[index]!]
      items = next
      setDirty()
      void handle.update()
      scheduleAutosave(true)
      return true
    }

    let moveUp = (index: number) => moveVisibleStep(index, -1)
    let moveDown = (index: number) => moveVisibleStep(index, 1)

    let startEditing = (index: number) => {
      openItemMenuId = null
      editingIndex = index
      let item = items[index]!
      editText = item.label
      editPriority = item.priority ?? ''
      editDue = item.due ?? ''
      editTags = (item.tags ?? []).join(', ')
      void handle.update()
    }

    let saveEdit = () => {
      if (editingIndex !== null && editText.trim()) {
        let index = editingIndex
        let edit = { label: editText, priority: editPriority, due: editDue, tags: editTags }
        items = items.map((item, i) =>
          i === index ? editItemFields(item, edit, Date.now()) : item,
        )
        setDirty()
        // Commit at the fast 300ms debounce, exactly like addItem / toggleDone /
        // moveItem and the title/description blur handlers. This is the ONLY
        // path that persists a member's due date or tags, so without it an
        // "add a date / tag" rides setDirty()'s default 1500ms debounce and
        // feels much slower than every other edit. Calling it after setDirty()
        // re-arms the already-scheduled slow timer to the fast one.
        scheduleAutosave(true)
      }
      editingIndex = null
      editText = ''
      editPriority = ''
      editDue = ''
      editTags = ''
      void handle.update()
    }

    let cancelEdit = () => {
      editingIndex = null
      editText = ''
      editPriority = ''
      editDue = ''
      editTags = ''
      void handle.update()
    }

    // Conflict resolution handlers
    let reloadFromServer = () => {
      if (conflictState.serverState) {
        hydrateFromInitialState(conflictState.serverState)
      }
      conflictState = { show: false, serverState: null }
      void handle.update()
    }

    let forceOverwrite = () => {
      if (conflictState.serverState) {
        loadedUpdatedAt = conflictState.serverState.updated_at
      }
      conflictState = { show: false, serverState: null }
      void handle.update()
      // Re-trigger save immediately
      setTimeout(() => saveNow(), 0)
    }

    // Best-effort keepalive flush of any pending edit to the currently loaded
    // list. The update route is PUT, which navigator.sendBeacon cannot send (it
    // is always POST), so use fetch with keepalive: true instead. keepalive lets
    // custom headers ride along (CSRF + If-Match), so we no longer need the
    // query-param CSRF or the _if_match body fallback.
    //
    // Shared by `beforeunload` (full page unload) and the frame's `reloadStart`
    // (list switch / search / pagination), which would otherwise discard edits
    // that are still inside the autosave debounce window.
    function flushWithKeepalive() {
      if (autosaveTimer) {
        clearTimeout(autosaveTimer)
        autosaveTimer = null
      }
      if (!isDirty()) return
      if (loadedListId === null) return
      let partial: Record<string, unknown> = {}
      if (title !== cleanTitle) partial.title = title
      if (description !== cleanDescription) partial.description = description
      if (JSON.stringify(items) !== cleanItemsJSON) partial.items = items
      if (Object.keys(partial).length === 0) return
      sendKeepalivePatch(getCsrfHeaders(), loadedListId, partial)
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', flushWithKeepalive, { signal: handle.signal })

      // Lost connectivity: keep the editor and the dirty draft, surface a
      // banner, and retry the pending/failed write once the browser is back.
      window.addEventListener(
        'offline',
        () => {
          offline = true
          void handle.update()
        },
        { signal: handle.signal },
      )
      window.addEventListener(
        'online',
        () => {
          offline = false
          void handle.update()
          if (saveError || isDirty()) retrySave()
        },
        { signal: handle.signal },
      )
    }

    // The "Weitere Aktionen" menu is a native <details>, which otherwise never
    // dismisses: it stays open after choosing an action and ignores outside
    // clicks and Escape. Close it from one delegated set of document listeners.
    if (typeof document !== 'undefined') {
      let closeMoreMenus = (except?: Node) => {
        for (let menu of Array.from(
          document.querySelectorAll<HTMLDetailsElement>('details[data-lists-more][open]'),
        )) {
          if (except && menu.contains(except)) continue
          menu.open = false
        }
      }

      document.addEventListener(
        'pointerdown',
        (e) => {
          let target = e.target as Node | null
          let summary = target instanceof Element ? target.closest('summary') : null
          // Let the native toggle run; just dismiss any other open menu.
          closeMoreMenus(summary ?? target ?? undefined)

          // The touch row menu is rendered inline (not a <details>), so it
          // needs its own outside-pointer dismissal. A tap on any kebab is
          // left to the button's click handler, which toggles the right menu.
          if (openItemMenuId !== null && target instanceof Element) {
            if (!target.closest('[data-item-menu]') && !target.closest('[data-item-menu-button]')) {
              openItemMenuId = null
              void handle.update()
            }
          }
        },
        { signal: handle.signal },
      )

      document.addEventListener(
        'click',
        (e) => {
          let target = e.target as Node | null
          if (target instanceof Element && target.closest('details[data-lists-more] button')) {
            closeMoreMenus()
          }
        },
        { signal: handle.signal },
      )

      document.addEventListener(
        'keydown',
        (e) => {
          if (e.key !== 'Escape') return
          // The row menu is the topmost transient surface: close it first and
          // return focus to the kebab that opened it.
          if (openItemMenuId !== null) {
            let id = openItemMenuId
            openItemMenuId = null
            void handle.update()
            focusItemTrigger(id)
            return
          }
          let open = document.querySelector<HTMLDetailsElement>('details[data-lists-more][open]')
          if (!open) return
          open.open = false
          open.querySelector('summary')?.focus()
        },
        { signal: handle.signal },
      )
    }

    // Status pill display
    let statusLabel = (): string => {
      // A brand-new list that has not been created yet must not claim to be
      // saved — "Gespeichert" is reserved for a list that exists on the server.
      if (loadedListId === null && saveStatus === 'saved') return 'Nicht gespeichert'
      switch (saveStatus) {
        case 'saved':
          return 'Gespeichert'
        case 'saving':
          return 'Speichern…'
        case 'dirty':
          return 'Ungespeichert'
        default:
          return 'Fehler'
      }
    }

    let statusColor = (): string => {
      switch (saveStatus) {
        case 'saved':
          return theme.colors.text.muted
        case 'saving':
          return theme.colors.text.secondary
        case 'dirty':
          return theme.colors.warning.foreground
        default:
          return theme.colors.action.danger.background
      }
    }

    // Keyboard navigation helpers
    let announce = (msg: string) => {
      if (liveRegion) liveRegion.textContent = msg
    }

    let focusItem = (id: string) => {
      setTimeout(() => {
        let el = listRef?.querySelector<HTMLElement>(`[data-item-id="${id}"]`)
        if (el) el.focus()
      }, 0)
    }

    let moveFocus = (targetIndex: number) => {
      let vis = visibleItems()
      if (targetIndex < 0 || targetIndex >= vis.length) return
      focusedId = vis[targetIndex]!.id
      void handle.update()
      focusItem(vis[targetIndex]!.id)
    }

    // The active roving-tabindex id. Falls back to the first *visible* item when
    // no item is focused, the focused row was deleted/reloaded, or the focused
    // row is hidden by a filter — otherwise the whole visible list would end up
    // with tabindex="-1" and become unreachable by keyboard.
    let activeItemId = (): string | null => {
      let vis = visibleItems()
      return focusedId && vis.some((i) => i.id === focusedId) ? focusedId : (vis[0]?.id ?? null)
    }

    let grabbedMove = (from: number, to: number) => {
      if (to < 0 || to >= items.length) return
      moveItem(from, to)
      grabbedId = items[to]!.id
      focusedId = items[to]!.id
      announce(`Position ${to + 1} von ${items.length}`)
      focusItem(items[to]!.id)
    }

    let handleRowKeyDown = (e: KeyboardEvent, index: number) => {
      // Only handle keydowns that originate on the row itself. Bubbled events
      // from nested controls (checkbox, edit textarea, action buttons) must
      // keep their own semantics.
      if (e.target !== e.currentTarget) return

      // While the view hides rows or applies a view-only order, reordering is
      // view-only: arrow keys / Home / End / typeahead only move focus among the
      // visible subset, and grab-reorder / Ctrl+Cmd+Arrow quick-move are skipped
      // so the item's real position never changes under a filter or view sort.
      if (reorderLocked()) {
        let vis = visibleItems()
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault()
            moveFocus(index + 1)
            return
          case 'ArrowUp':
            e.preventDefault()
            moveFocus(index - 1)
            return
          case 'Home':
            e.preventDefault()
            moveFocus(0)
            return
          case 'End':
            e.preventDefault()
            moveFocus(vis.length - 1)
            return
          default:
            if (e.key.length === 1 && !e.altKey && !e.ctrlKey && !e.metaKey) {
              let target = findTypeaheadTarget(vis, index, e.key)
              if (target !== -1) {
                e.preventDefault()
                moveFocus(target)
              }
            }
            return
        }
      }

      let id = items[index]!.id

      // Quick-move: Ctrl/Cmd + Arrow moves the focused item directly
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          moveItem(index, index - 1)
          let target = items[index - 1] ? items[index - 1]!.id : id
          focusedId = target
          focusItem(target)
          return
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          moveItem(index, index + 1)
          let target = items[index + 1] ? items[index + 1]!.id : id
          focusedId = target
          focusItem(target)
          return
        }
      }

      if (grabbedId === null) {
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault()
            moveFocus(index + 1)
            return
          case 'ArrowUp':
            e.preventDefault()
            moveFocus(index - 1)
            return
          case 'Home':
            e.preventDefault()
            moveFocus(0)
            return
          case 'End':
            e.preventDefault()
            moveFocus(items.length - 1)
            return
          case 'Enter':
          case ' ':
            e.preventDefault()
            grabbedId = id
            announce(`Element aufgenommen, Position ${index + 1} von ${items.length}`)
            void handle.update()
            return
          default:
            if (e.key.length === 1 && !e.altKey && !e.ctrlKey && !e.metaKey) {
              let target = findTypeaheadTarget(items, index, e.key)
              if (target !== -1) {
                e.preventDefault()
                moveFocus(target)
              }
            }
            return
        }
      }

      // Grabbed state
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          grabbedMove(index, index + 1)
          return
        case 'ArrowUp':
          e.preventDefault()
          grabbedMove(index, index - 1)
          return
        case 'Enter':
        case ' ':
          e.preventDefault()
          grabbedId = null
          announce(`Abgelegt an Position ${index + 1} von ${items.length}`)
          void handle.update()
          return
        case 'Escape':
          e.preventDefault()
          grabbedId = null
          announce('Verschieben abgebrochen')
          void handle.update()
          return
      }
    }

    let buildView = (): ListsEditorView => ({
      items,
      loadedListId,
      title,
      description,
      saving,
      loadingList,
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
      helpOpen,
      clearArmed,
      grabbedId,
      openItemMenuId,
      drag: drag(dragContext),
      visibleItems,
      showDescription,
      statusColor,
      statusLabel,
      isDirty,
      activeItemId,
      reorderLocked,
      visibleReorderLocked,
      viewOrderActive,
      statusCounts: visibleStatusCounts,
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
      toggleHelp,
      closeHelp,
      onPickerSearchRef: (el) => {
        pickerSearchRef = el
      },
      clearSelectionAndError: () => {
        clearSelection()
        copyError = ''
        void handle.update()
      },
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
      focusItemAction,
      setTitle: (value) => {
        title = value
        setDirty()
        void handle.update()
      },
      setDescription: (value) => {
        description = value
        setDirty()
        void handle.update()
      },
      setDescriptionMode: (mode) => {
        descriptionMode = mode
        void handle.update()
      },
      setNewItemLabel: (value) => {
        newItemLabel = value
        void handle.update()
      },
      setListFilter: (value) => {
        listFilter = value
        openItemMenuId = null
        void handle.update()
      },
      clearListFilter: () => {
        listFilter = ''
        openItemMenuId = null
        if (filterInputRef) filterInputRef.value = ''
        void handle.update()
      },
      // Tag chips set the filter programmatically: the field is uncontrolled,
      // so the DOM value must be synced alongside the state (mirrors
      // clearListFilter). Announced because the click moves focus context.
      applyTagFilter: (tag: string) => {
        listFilter = tag
        openItemMenuId = null
        if (filterInputRef) filterInputRef.value = tag
        announce(`Nach Tag „${tag}" gefiltert`)
        void handle.update()
      },
      setFocusedId: (id) => {
        focusedId = id
        void handle.update()
      },
      setEditText: (value) => {
        editText = value
        void handle.update()
      },
      setEditPriority: (value) => {
        editPriority = value
      },
      setEditDue: (value) => {
        editDue = value
      },
      setEditTags: (value) => {
        editTags = value
      },
      onTitleInputRef: (el) => {
        titleInputRef = el
        // The input is uncontrolled: `defaultValue` only applies when the node is
        // created, so a frame swap landing after `syncFieldInputs()` would leave
        // it showing the previous list's value. Re-assert the state on bind.
        if (el && el.value !== title) el.value = title
      },
      onDescriptionInputRef: (el) => {
        descriptionInputRef = el
        if (el && el.value !== description) el.value = description
      },
      onNewItemRef: (el) => {
        newItemRef = el
      },
      onFilterInputRef: (el) => {
        filterInputRef = el
      },
      onSortSelectRef: (el) => {
        sortSelectRef = el
        syncSortSelect()
      },
      onListRef: (el) => {
        listRef = el
      },
      onCopyFormRef: (el) => {
        copyFormRef = el
      },
      onCopyCsrfRef: (el) => {
        copyCsrfRef = el
      },
      onLiveRegion: (el) => {
        liveRegion = el
      },
    })

    return () => renderListsEditor(buildView())
  },
)
