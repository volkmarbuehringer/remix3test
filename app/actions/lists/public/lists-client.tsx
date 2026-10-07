import { clientEntry, type Handle } from 'remix/component'
import { theme } from '../../../ui/theme/theme.ts'
import { moveItemInArray, findTypeaheadTarget } from '../../../utils/lists-keyboard.ts'

import { sidebarRowLabel, syncSidebarRow, UNTITLED_LIST_LABEL } from './sidebar-sync.ts'
import { createListsDrag } from './lists-drag.ts'
import {
  type ItemPriority,
  type SortMode,
  type ListItem,
  type ListInitialState,
  type ListConflictState,
  type UndoKind,
  cloneItems,
  createItem,
  deleteItemAt,
  editItemFields,
  filterItems,
  itemsFingerprint,
  parseItemsFingerprint,
  removeItemsByIds,
  reverseItems,
  shuffleItems,
  sortItems,
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
  patchListRequest,
  sendKeepalivePatch,
} from './lists-api.ts'
import { renderListsEditor, type ListsEditorView } from './lists-view.tsx'

export const ListsClient = clientEntry(
  import.meta.url + '#ListsClient',
  function ListsClient(handle: Handle<{ initialState?: ListInitialState | null }>) {
    let items: ListItem[] = []
    let title = ''
    let description = ''
    let newItemLabel = ''
    let listFilter = ''
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
    let loadError = ''
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

    // Undo + inline-confirm state
    let undoSnapshot: ListItem[] | null = null
    let undoTimer: ReturnType<typeof setTimeout> | null = null
    let undoKind: UndoKind | null = null
    let clearArmed = false
    let clearArmTimer: ReturnType<typeof setTimeout> | null = null

    // Row selection for "Auswahl → in Liste kopieren". Separate from the done
    // toggle: selecting is view-only and never marks the list dirty.
    let selectedItemIds = new Set<string>()
    let copyTargetId = ''
    let copyBusy = false
    let copyError = ''
    let copyNotice = ''
    let copyNoticeTimer: ReturnType<typeof setTimeout> | null = null

    let clearUndo = () => {
      if (undoTimer) clearTimeout(undoTimer)
      undoTimer = null
      undoSnapshot = null
      undoKind = null
      void handle.update()
    }

    let showUndo = (kind: UndoKind, snapshot: ListItem[]) => {
      if (undoTimer) clearTimeout(undoTimer)
      undoSnapshot = snapshot
      undoKind = kind
      void handle.update()
      undoTimer = setTimeout(() => {
        undoSnapshot = null
        undoKind = null
        undoTimer = null
        void handle.update()
      }, 6000)
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
    let visibleItems = (): ListItem[] => filterItems(items, listFilter)
    // Reset the in-list filter. Called on every reload/hydrate because the
    // client entry is not remounted on frame navigation, so the filter would
    // otherwise persist across switching to a different list.
    let clearFilter = () => {
      listFilter = ''
      if (filterInputRef) filterInputRef.value = ''
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
      clearSelection()
      saveStatus = 'saved'
      loadError = ''
      conflictState = { show: false, serverState: null }
      snapshotClean()
      clearFilter()
      syncFieldInputs()
      void handle.update()
    }

    let scrollToBottom = () => {
      if (listRef) {
        listRef.scrollTop = listRef.scrollHeight
      }
    }

    function navigateFrame(href: string) {
      handle.frame.src = href
      handle.frame.reload().catch(() => {})
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
            newId = outcome.state.id
            loadedListId = newId
            loadedUpdatedAt = outcome.state.updated_at
            ok = true
          } else {
            loadError = outcome.network
              ? 'Speichern fehlgeschlagen (Netzwerkfehler)'
              : 'Speichern fehlgeschlagen'
          }
        } catch {
          loadError = 'Speichern fehlgeschlagen (Netzwerkfehler)'
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
            loadError = outcome.network
              ? 'Aktualisieren fehlgeschlagen (Netzwerkfehler)'
              : 'Aktualisieren fehlgeschlagen'
          }
        } catch {
          loadError = 'Aktualisieren fehlgeschlagen (Netzwerkfehler)'
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
      copyTargetId = ''
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

    // Candidate targets are the sidebar list rows — the same set the
    // list-to-list drag exposes. Read at interaction time so a frame
    // navigation's freshly rendered sidebar is always current.
    let copyTargets = (): Array<{ id: number; label: string }> => {
      if (typeof document === 'undefined') return []
      let seen = new Set<number>()
      let targets: Array<{ id: number; label: string }> = []
      for (let row of Array.from(document.querySelectorAll<HTMLElement>('[data-list-id]'))) {
        let id = Number(row.dataset.listId)
        if (!Number.isFinite(id) || id === loadedListId || seen.has(id)) continue
        seen.add(id)
        targets.push({ id, label: sidebarRowLabel(row, id) })
      }
      return targets
    }

    let copySelectedItems = async () => {
      if (loadedListId === null || copyBusy) return
      let targetId = Number(copyTargetId)
      if (!Number.isFinite(targetId) || targetId < 1) {
        copyError = 'Bitte eine Ziel-Liste wählen'
        void handle.update()
        return
      }
      let itemIds = items.filter((item) => selectedItemIds.has(item.id)).map((item) => item.id)
      if (itemIds.length === 0) {
        copyError = 'Keine Elemente ausgewählt'
        void handle.update()
        return
      }

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
        let outcome = await copyItemsRequest(getCsrfHeaders(), loadedListId, targetId, itemIds)
        if (outcome.status === 'ok') {
          let copied = outcome.copied
          selectedItemIds = new Set()
          copyTargetId = ''
          copyNotice = `${copied} ${copied === 1 ? 'Element' : 'Elemente'} kopiert`
          if (copyNoticeTimer) clearTimeout(copyNoticeTimer)
          copyNoticeTimer = setTimeout(() => {
            copyNotice = ''
            copyNoticeTimer = null
            void handle.update()
          }, 5000)
          announce(
            `${copied} ${copied === 1 ? 'Element' : 'Elemente'} in die gewählte Liste kopiert`,
          )
          void handle.update()
          // Refresh the sidebar so the target row's count reflects the copies.
          handle.frame.reload().catch(() => {})
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

    // Revert unsaved edits back to the last saved snapshot.
    let discardChanges = () => {
      if (autosaveTimer) {
        clearTimeout(autosaveTimer)
        autosaveTimer = null
      }
      if (undoTimer) {
        clearTimeout(undoTimer)
        undoTimer = null
      }
      undoSnapshot = null
      undoKind = null
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
      clearSelection()
      snapshotClean()
      saveStatus = 'saved'
      loadError = ''
      loadingList = false
      conflictState = { show: false, serverState: null }
      clearFilter()
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
        clearSelection()
        saveStatus = 'dirty'
        loadError = ''
        loadingList = false
        conflictState = { show: false, serverState: null }
        draftRestored = true
        clearFilter()
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
      clearSelection()
      saveStatus = 'saved'
      loadError = ''
      loadingList = false
      conflictState = { show: false, serverState: null }
      snapshotClean()
      clearFilter()
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
      function flushBeforeFrameReload() {
        flushWithKeepalive()
      }
      handle.frame.addEventListener('reloadStart', flushBeforeFrameReload, {
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
    // its own module; these callbacks bridge it to the editor's state.
    let drag = createListsDrag({
      getItems: () => items,
      getLoadedListId: () => loadedListId,
      getLoadedUpdatedAt: () => loadedUpdatedAt,
      getListRef: () => listRef,
      isFilterActive: filterActive,
      getCsrfHeaders,
      flush: flushNow,
      commitReorder: (next) => {
        items = next
        setDirty()
        void handle.update()
      },
      setLoadError: (message) => {
        loadError = message
      },
      showConflict: (state) => {
        conflictState = { show: true, serverState: state }
      },
      reloadFrame: () => handle.frame.reload().catch(() => {}),
      update: () => handle.update(),
      signal: handle.signal,
    })

    let clearAll = () => {
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

    // One-shot sort control. Choosing an order reorders the real `items` array
    // (so it autosaves) and offers undo, exactly like Umkehren/Mischen. "manual"
    // is the neutral drag state and does nothing.
    let applySort = (mode: SortMode) => {
      disarmClear()
      if (mode === 'manual') return
      showUndo('reorder', cloneItems(items))
      items = sortItems(items, mode)
      announce(
        mode === 'az'
          ? 'A–Z sortiert'
          : mode === 'done'
            ? 'Nach Erledigt sortiert'
            : 'Nach Änderung sortiert',
      )
      setDirty()
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

    let moveItem = (from: number, to: number) => {
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

    let moveUp = (index: number) => moveItem(index, index - 1)
    let moveDown = (index: number) => moveItem(index, index + 1)

    let reverse = () => {
      disarmClear()
      showUndo('reorder', cloneItems(items))
      items = reverseItems(items)
      setDirty()
      announce('Reihenfolge umgekehrt')
      void handle.update()
    }

    let shuffle = () => {
      disarmClear()
      showUndo('reorder', cloneItems(items))
      items = shuffleItems(items)
      setDirty()
      announce('Reihenfolge gemischt')
      void handle.update()
    }

    let startEditing = (index: number) => {
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
        case 'error':
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
        case 'error':
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

    // The active roving-tabindex id. Falls back to the first item when no item
    // is focused, or when `focusedId` references a row that no longer exists
    // (deleted / cleared / reloaded) — otherwise the whole list would end up
    // with tabindex="-1" and become unreachable by keyboard. While a filter is
    // active the fallback is the first *visible* item, so a filtered view still
    // has a tabbable row.
    let activeItemId = (): string | null =>
      focusedId && items.some((i) => i.id === focusedId)
        ? focusedId
        : (visibleItems()[0]?.id ?? null)

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

      // While filtering, reordering is view-only: arrow keys / Home / End /
      // typeahead only move focus among the visible subset, and grab-reorder /
      // Ctrl+Cmd+Arrow quick-move are skipped so the item's real position never
      // changes under a filter.
      if (filterActive()) {
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
      loadError,
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
        void handle.update()
      },
      clearListFilter: () => {
        listFilter = ''
        if (filterInputRef) filterInputRef.value = ''
        void handle.update()
      },
      setCopyTargetId: (value) => {
        copyTargetId = value
        copyError = ''
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
      },
      onDescriptionInputRef: (el) => {
        descriptionInputRef = el
      },
      onNewItemRef: (el) => {
        newItemRef = el
      },
      onFilterInputRef: (el) => {
        filterInputRef = el
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
