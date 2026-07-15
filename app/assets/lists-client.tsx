import { clientEntry, type Handle, on, css, ref } from 'remix/ui'
import { theme } from '../ui/theme/theme.ts'
import { Glyph } from '../ui/theme/glyph/glyph.tsx'

import button from '../ui/theme/button.ts'

type ListItem = {
  id: string
  label: string
}

type ListInitialState = {
  id: number
  description: string
  items: Array<{ id: string; label: string }>
  updated_at: number
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const ListsClient = clientEntry(
  import.meta.url + '#ListsClient',
  function ListsClient(handle: Handle<{ initialState?: ListInitialState | null }>) {
    let items: ListItem[] = []
    let description = ''
    let newItemLabel = ''
    let nextId = 0
    let loadedListId: number | null = null
    let loadedUpdatedAt: number | null = null
    let saving = false
    let loadError = ''
    let editingIndex: number | null = null
    let editText = ''
    let newItemRef: HTMLTextAreaElement | null = null
    let listRef: HTMLDivElement | null = null
    let initialized = false

    // Drag state
    let dragIndex: number | null = null
    let dropIndex: number | null = null
    let draggedEl: HTMLElement | null = null
    let indicatorEl: HTMLElement | null = null

    // Autosave state
    type SaveStatus = 'saved' | 'saving' | 'dirty' | 'error'
    let saveStatus: SaveStatus = 'saved'
    let autosaveTimer: ReturnType<typeof setTimeout> | null = null

    // Conflict state
    type ConflictState = { show: boolean; serverState: ListInitialState | null }
    let conflictState: ConflictState = { show: false, serverState: null }

    // Track whether items or description are dirty
    let cleanDescription = ''
    let cleanItemsJSON = ''
    let snapshotClean = () => {
      cleanDescription = description
      cleanItemsJSON = JSON.stringify(items)
    }
    let isDirty = () => description !== cleanDescription || JSON.stringify(items) !== cleanItemsJSON

    let setDirty = () => {
      if (!isDirty()) return
      if (saveStatus === 'saved' || saveStatus === 'error') {
        saveStatus = 'dirty'
        handle.update()
      }
      scheduleAutosave()
    }

    let multilineDisplayStyle = css({
      flex: 1,
      fontSize: theme.fontSize.lg,
      color: theme.colors.text.primary,
      display: '-webkit-box',
      WebkitLineClamp: 3,
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden',
      wordBreak: 'break-word',
      whiteSpace: 'pre-wrap',
    })

    let gripStyle = css({
      cursor: 'grab',
      padding: '0 6px',
      userSelect: 'none',
      color: theme.colors.text.secondary,
      fontSize: theme.fontSize.lg,
      lineHeight: 1,
      '&:active': {
        cursor: 'grabbing',
      },
      '&:hover': {
        color: theme.colors.text.primary,
      },
    })

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
      let headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (csrfToken) headers['X-Csrf-Token'] = csrfToken
      if (loadedUpdatedAt !== null) headers['If-Match'] = String(loadedUpdatedAt)
      return headers
    }

    let saveNow = async (): Promise<boolean> => {
      conflictState = { show: false, serverState: null }
      if (loadedListId === null) {
        // Don't auto-create lists without a description or items
        if (!description.trim() || items.length === 0) {
          saveStatus = 'saved'
          handle.update()
          return false
        }
        // Create new list
        saving = true
        saveStatus = 'saving'
        handle.update()
        let ok = false
        let newId: number | null = null
        try {
          let response = await fetch('/lists', {
            method: 'POST',
            headers: getCsrfHeaders(),
            body: JSON.stringify({ description, items }),
          })
          if (response.ok) {
            let data = await response.json()
            newId = typeof data.id === 'number' ? data.id : null
            ok = true
            if (newId !== null) {
              loadedListId = newId
              loadedUpdatedAt = typeof data.updated_at === 'number' ? data.updated_at : null
            }
          } else {
            loadError = 'Speichern fehlgeschlagen'
          }
        } catch {
          loadError = 'Speichern fehlgeschlagen (Netzwerkfehler)'
        }
        saving = false
        if (ok && newId !== null) {
          snapshotClean()
          saveStatus = 'saved'
          handle.update()
          navigateFrame(`/lists?load=${newId}`)
          return true
        } else {
          saveStatus = 'error'
          handle.update()
          return false
        }
      } else {
        // Patch existing list
        saving = true
        saveStatus = 'saving'
        handle.update()
        // Capture snapshot at send time to detect drift during the await
        let sentDesc = description
        let sentItemsJSON = JSON.stringify(items)
        let ok = false
        try {
          let partial: Record<string, unknown> = {}
          if (isDirty()) {
            if (description !== cleanDescription) partial.description = description
            if (sentItemsJSON !== cleanItemsJSON) partial.items = items
          } else {
            // Fall back to sending full if nothing explicitly changed
            partial = { description, items }
          }
          let response = await fetch(`/lists/${loadedListId}`, {
            method: 'PUT',
            headers: getCsrfHeaders(),
            body: JSON.stringify(partial),
          })
          if (response.ok) {
            let data = await response.json()
            loadedUpdatedAt = typeof data.updated_at === 'number' ? data.updated_at : null
            // If the user kept typing during the save, mark dirty and reschedule
            let drifted = description !== sentDesc || JSON.stringify(items) !== sentItemsJSON
            if (drifted) {
              saveStatus = 'dirty'
              scheduleAutosave()
              ok = true
              saving = false
              handle.update()
              return true
            }
            // Apply server echo only if nothing drifted
            if (data.items) items = data.items
            if (data.description !== undefined) description = data.description
            ok = true
          } else if (response.status === 409) {
            let server = await response.json()
            conflictState = {
              show: true,
              serverState: {
                id: server.id,
                description: server.description,
                items: server.items,
                updated_at: server.updated_at,
              },
            }
            ok = false
          } else {
            loadError = 'Aktualisieren fehlgeschlagen'
          }
        } catch {
          loadError = 'Aktualisieren fehlgeschlagen (Netzwerkfehler)'
        }
        saving = false
        if (ok) {
          snapshotClean()
          saveStatus = 'saved'
          handle.update()
          return true
        } else {
          saveStatus = 'error'
          handle.update()
          return false
        }
      }
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

    let flushNow = async () => {
      if (autosaveTimer) clearTimeout(autosaveTimer)
      autosaveTimer = null
      if (!isDirty()) return
      await saveNow()
    }

    // Hydrate from server-injected initial state
    let hydrateFromInitialState = (state: ListInitialState) => {
      items = state.items.map((item) => ({ ...item }))
      description = state.description
      loadedListId = state.id
      loadedUpdatedAt = state.updated_at
      nextId =
        items.reduce((max, item) => {
          let n = parseInt(item.id, 10)
          return Number.isFinite(n) && n > max ? n : max
        }, 0) + 1
      snapshotClean()
      saveStatus = 'saved'
      loadError = ''
      loadingList = false
      conflictState = { show: false, serverState: null }
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
              handle.update()
              return
            }
          } catch {
            // ignore parse errors, fall through to new-list state
          }
        }
      }
      // No initial state: start new
      items = []
      description = ''
      loadedListId = null
      loadedUpdatedAt = null
      nextId = 0
      saveStatus = 'saved'
      loadError = ''
      loadingList = false
      conflictState = { show: false, serverState: null }
      snapshotClean()
      handle.update()
    }

    // Listen for frame reloads
    handle.frame.addEventListener('reloadComplete', reloadFromFrame, { signal: handle.signal })

    // On init, if no initial state was already provided, wait for frame load
    if (!initialized) {
      setTimeout(() => {
        reloadFromFrame()
      }, 0)
    }

    // Drag-and-drop handlers (unchanged logic, just no id rewriting)
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
      dragIndex = index
      dropIndex = null
      e.dataTransfer!.effectAllowed = 'move'
      e.dataTransfer!.setData('text/plain', index.toString())
      let el = e.currentTarget as HTMLElement
      draggedEl = el
      el.style.opacity = '0.4'
    }

    let elByIndex = (i: number): HTMLElement | null => {
      let child = listRef?.children[i]
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
      if (dropIndex < items.length) {
        let el = elByIndex(dropIndex)
        if (el) {
          el.style.borderTop = `2px solid ${theme.colors.focus.ring}`
          indicatorEl = el
        }
      } else if (dropIndex === items.length && items.length > 0) {
        let el = elByIndex(items.length - 1)
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
      if (dragIndex === null || items.length === 0) return
      let newDropIndex = items.length
      for (let i = 0; i < items.length; i++) {
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
      let newItems = [...items]
      let [removed] = newItems.splice(dragIndex, 1)
      let adjustedDrop = dropIndex > dragIndex ? dropIndex - 1 : dropIndex
      newItems.splice(adjustedDrop, 0, removed)
      items = newItems
      dragIndex = null
      dropIndex = null
      setDirty()
      handle.update()
    }

    let handleDragEnd = () => {
      let dirty = draggedEl !== null || indicatorEl !== null || dragIndex !== null
      clearDragOver()
      dragIndex = null
      dropIndex = null
      if (dirty) handle.update()
    }

    let clearAll = () => {
      if (!confirm('Alle Elemente löschen? Dies kann nicht rückgängig gemacht werden.')) return
      items = []
      nextId = 0
      setDirty()
      handle.update()
    }

    let addItem = () => {
      if (!newItemLabel.trim()) return
      // Use crypto.randomUUID() for stable client-side id
      let newItem: ListItem = {
        id: crypto.randomUUID(),
        label: newItemLabel.trim(),
      }
      items = [...items, newItem]
      newItemLabel = ''
      if (newItemRef) newItemRef.value = ''
      setDirty()
      handle.update()
      setTimeout(scrollToBottom, 0)
      scheduleAutosave(true)
    }

    let deleteItem = (index: number) => {
      // Simply filter — no id rewriting
      items = items.filter((_, i) => i !== index)
      setDirty()
      handle.update()
    }

    let moveUp = (index: number) => {
      if (index === 0) return
      let newItems = [...items]
      ;[newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]]
      items = newItems
      setDirty()
      handle.update()
    }

    let moveDown = (index: number) => {
      if (index === items.length - 1) return
      let newItems = [...items]
      ;[newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]]
      items = newItems
      setDirty()
      handle.update()
    }

    let reverse = () => {
      items = [...items].reverse()
      setDirty()
      handle.update()
    }

    let shuffle = () => {
      let newItems = [...items]
      for (let i = newItems.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1))
        ;[newItems[i], newItems[j]] = [newItems[j], newItems[i]]
      }
      items = newItems
      setDirty()
      handle.update()
    }

    let startEditing = (index: number) => {
      editingIndex = index
      editText = items[index].label
      handle.update()
    }

    let saveEdit = () => {
      if (editingIndex !== null && editText.trim()) {
        items = items.map((item, i) =>
          i === editingIndex ? { ...item, label: editText.trim() } : item,
        )
        setDirty()
      }
      editingIndex = null
      editText = ''
      handle.update()
    }

    let cancelEdit = () => {
      editingIndex = null
      editText = ''
      handle.update()
    }

    // Conflict resolution handlers
    let reloadFromServer = () => {
      if (conflictState.serverState) {
        hydrateFromInitialState(conflictState.serverState)
      }
      conflictState = { show: false, serverState: null }
      handle.update()
    }

    let forceOverwrite = () => {
      if (conflictState.serverState) {
        loadedUpdatedAt = conflictState.serverState.updated_at
      }
      conflictState = { show: false, serverState: null }
      handle.update()
      // Re-trigger save immediately
      setTimeout(() => saveNow(), 0)
    }

    // SendBeacon for navigate-away flush
    // Beacon cannot set custom headers, so we pass the CSRF token as a query param
    // and the precondition via _if_match in the body.
    function flushOnUnload() {
      if (!isDirty()) return
      if (loadedListId === null) return
      let partial: Record<string, unknown> = {}
      if (description !== cleanDescription) partial.description = description
      if (JSON.stringify(items) !== cleanItemsJSON) partial.items = items
      if (Object.keys(partial).length === 0) return
      partial._if_match = loadedUpdatedAt
      let csrfToken =
        document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? ''
      let url = `/lists/${loadedListId}?_csrf=${encodeURIComponent(csrfToken)}`
      let blob = new Blob([JSON.stringify(partial)], { type: 'application/json' })
      navigator.sendBeacon(url, blob)
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', flushOnUnload, { signal: handle.signal })
    }

    // Status pill display
    let statusLabel = (): string => {
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
          return '#d69e2e'
        case 'error':
          return theme.colors.action.danger.background
      }
    }

    return () => {
      // Show loading state
      if (loadingList) {
        return (
          <div
            mix={css({
              fontFamily: theme.fontFamily.sans,
              maxWidth: '600px',
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

      // Show error state
      if (loadError) {
        return (
          <div
            mix={css({
              fontFamily: theme.fontFamily.sans,
              maxWidth: '600px',
              padding: theme.space.xxl,
              textAlign: 'center',
              color: theme.colors.action.danger.background,
              fontSize: theme.fontSize.lg,
            })}
          >
            {loadError}
          </div>
        )
      }

      return (
        <div mix={css({ fontFamily: theme.fontFamily.sans, maxWidth: '600px' })}>
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

          {/* Control bar */}
          <div
            mix={css({
              display: 'flex',
              gap: theme.space.md,
              marginBottom: theme.space.lg,
              flexWrap: 'wrap',
              alignItems: 'center',
            })}
          >
            <button mix={[button({ tone: 'secondary' }), on('click', reverse)]}>↺ Umkehren</button>
            <button mix={[button({ tone: 'primary' }), on('click', shuffle)]}>⇄ Mischen</button>
            <button
              mix={[button({ tone: 'danger' }), on('click', clearAll)]}
              disabled={items.length === 0}
            >
              ✕ Alle löschen
            </button>

            {/* Status pill */}
            <span
              mix={css({
                marginLeft: 'auto',
                fontSize: theme.fontSize.xs,
                fontWeight: theme.fontWeight.semibold,
                color: statusColor(),
                padding: `${theme.space.xs} ${theme.space.sm}`,
                borderRadius: theme.radius.full,
                backgroundColor: theme.surface.lvl2,
              })}
            >
              {statusLabel()}
            </span>

            {/* Demoted manual flush buttons — escape hatch */}
            {loadedListId !== null && (
              <button
                mix={[
                  button({ tone: 'secondary' }),
                  css({ fontSize: theme.fontSize.xs }),
                  on('click', () => {
                    flushNow()
                  }),
                ]}
                disabled={!isDirty() || saving}
              >
                Aktualisieren
              </button>
            )}
            {loadedListId === null && (
              <button
                mix={[
                  button({ tone: 'secondary' }),
                  css({ fontSize: theme.fontSize.xs }),
                  on('click', () => {
                    saveNow()
                  }),
                ]}
                disabled={!description.trim() || items.length === 0 || saving}
              >
                Hinzufügen
              </button>
            )}
          </div>

          {/* Description input */}
          <div
            mix={css({
              marginBottom: theme.space.lg,
            })}
          >
            <input
              mix={[
                css({
                  width: '100%',
                  padding: `${theme.space.sm} ${theme.space.md}`,
                  borderRadius: theme.radius.md,
                  border: `1px solid ${theme.colors.border.strong}`,
                  fontSize: theme.fontSize.md,
                  outline: 'none',
                  fontFamily: theme.fontFamily.sans,
                  boxSizing: 'border-box',
                  backgroundColor: theme.surface.lvl0,
                  color: theme.colors.text.primary,
                  '&:focus': {
                    borderColor: theme.colors.focus.ring,
                    boxShadow: `0 0 0 3px ${theme.colors.focus.ring}33`,
                  },
                  '&::placeholder': {
                    color: theme.colors.text.muted,
                  },
                }),
                on('input', (e) => {
                  description = e.currentTarget.value
                  setDirty()
                  handle.update()
                }),
                on('blur', () => {
                  scheduleAutosave(true)
                }),
              ]}
              type="text"
              placeholder="Beschreibung für diese Liste eingeben…"
              maxLength={500}
              defaultValue={description}
            />
          </div>

          {/* Add item */}
          <div
            mix={css({
              display: 'flex',
              gap: theme.space.md,
              marginBottom: theme.space.lg,
              alignItems: 'flex-start',
            })}
          >
            <textarea
              mix={[
                css({
                  padding: `${theme.space.sm} ${theme.space.md}`,
                  borderRadius: theme.radius.md,
                  border: `1px solid ${theme.colors.border.strong}`,
                  flex: 1,
                  fontSize: theme.fontSize.md,
                  outline: 'none',
                  fontFamily: theme.fontFamily.sans,
                  width: '300px',
                  minHeight: '60px',
                  resize: 'vertical',
                  backgroundColor: theme.surface.lvl0,
                  color: theme.colors.text.primary,
                  '&:focus': {
                    borderColor: theme.colors.focus.ring,
                    boxShadow: `0 0 0 3px ${theme.colors.focus.ring}33`,
                  },
                }),
                on('input', (e) => {
                  newItemLabel = e.currentTarget.value
                  handle.update()
                }),
                on('keydown', (e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    addItem()
                  }
                }),
                ref((el) => {
                  newItemRef = el
                }),
              ]}
              placeholder="Neues Element eingeben…"
              rows={3}
              wrap="soft"
              defaultValue={newItemLabel}
            />
            <button mix={[button({ tone: 'primary' }), on('click', addItem)]}>
              + Element hinzufügen
            </button>
          </div>

          {/* Items list */}
          <div
            mix={css({
              border: `1px solid ${theme.colors.border.default}`,
              borderRadius: theme.radius.xl,
              overflow: 'hidden',
            })}
          >
            <div
              mix={css({
                backgroundColor: theme.surface.lvl2,
                padding: `${theme.space.sm} ${theme.space.md}`,
                borderBottom: `1px solid ${theme.colors.border.default}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              })}
            >
              <span
                mix={css({
                  fontSize: theme.fontSize.xs,
                  fontWeight: theme.fontWeight.semibold,
                  color: theme.colors.text.muted,
                })}
              >
                ELEMENTE
              </span>
              <span
                mix={css({
                  fontSize: theme.fontSize.sm,
                  color: theme.colors.text.secondary,
                  backgroundColor: theme.colors.border.default,
                  padding: `${theme.space.xs} ${theme.space.md}`,
                  borderRadius: theme.radius.full,
                })}
              >
                {items.length} Einträge
              </span>
            </div>

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
            ) : (
              <div
                mix={[
                  css({
                    maxHeight: '320px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    '&::-webkit-scrollbar': { width: '8px' },
                    '&::-webkit-scrollbar-track': { backgroundColor: theme.surface.lvl2 },
                    '&::-webkit-scrollbar-thumb': {
                      backgroundColor: theme.colors.border.strong,
                      borderRadius: '4px',
                    },
                    '&::-webkit-scrollbar-thumb:hover': {
                      backgroundColor: theme.colors.text.muted,
                    },
                  }),
                  ref((el) => {
                    listRef = el
                  }),
                  ref((el) => {
                    let ac = new AbortController()
                    el.addEventListener(
                      'dragover',
                      (e) => handleContainerDragOver(e as DragEvent),
                      { signal: ac.signal },
                    )
                    el.addEventListener('drop', (e) => handleDrop(e as DragEvent), {
                      signal: ac.signal,
                    })
                    return () => ac.abort()
                  }),
                ]}
              >
                {items.map((item, index) => (
                  <div
                    key={item.id}
                    mix={[
                      css({
                        display: 'flex',
                        gap: theme.space.md,
                        alignItems: 'center',
                        padding: `${theme.space.md} ${theme.space.md}`,
                        borderBottom:
                          index < items.length - 1
                            ? `1px solid ${theme.colors.border.subtle}`
                            : 'none',
                        backgroundColor: index % 2 === 0 ? theme.surface.lvl0 : theme.surface.lvl1,
                      }),
                      ref((el) => {
                        let ac = new AbortController()
                        el.addEventListener(
                          'dragstart',
                          (e) => {
                            let idx = parseInt(
                              (e.currentTarget as HTMLElement).dataset.index || '0',
                              10,
                            )
                            handleDragStart(e as DragEvent, idx)
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
                            handleDragOver(e as DragEvent, idx)
                          },
                          { signal: ac.signal },
                        )
                        el.addEventListener('drop', (e) => handleDrop(e as DragEvent), {
                          signal: ac.signal,
                        })
                        el.addEventListener('dragend', () => handleDragEnd(), { signal: ac.signal })
                        return () => ac.abort()
                      }),
                    ]}
                    draggable="true"
                    data-index={index}
                  >
                    <span mix={gripStyle} data-grip="" aria-hidden="true">
                      ⠿
                    </span>
                    <span
                      mix={css({
                        width: '28px',
                        height: '28px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: theme.surface.lvl2,
                        color: theme.colors.text.secondary,
                        borderRadius: theme.radius.md,
                        fontSize: theme.fontSize.xs,
                        fontWeight: theme.fontWeight.semibold,
                      })}
                    >
                      {index + 1}
                    </span>

                    {editingIndex === index ? (
                      <textarea
                        mix={[
                          css({
                            padding: `${theme.space.sm} ${theme.space.md}`,
                            borderRadius: theme.radius.md,
                            border: `1px solid ${theme.colors.focus.ring}`,
                            flex: 1,
                            fontSize: theme.fontSize.lg,
                            outline: 'none',
                            fontFamily: theme.fontFamily.sans,
                            width: '300px',
                            minHeight: '60px',
                            resize: 'vertical',
                            backgroundColor: theme.surface.lvl0,
                            color: theme.colors.text.primary,
                          }),
                          on('input', (e) => {
                            editText = e.currentTarget.value
                            handle.update()
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
                    ) : (
                      <span mix={multilineDisplayStyle}>{item.label}</span>
                    )}

                    <div draggable="false" mix={css({ display: 'flex', gap: theme.space.xs })}>
                      {editingIndex === index ? (
                        <>
                          <button
                            mix={[button({ tone: 'primary' }), on('click', saveEdit)]}
                            title="Speichern"
                          >
                            <Glyph name="check" width={16} height={16} />
                          </button>
                          <button
                            mix={[button({ tone: 'secondary' }), on('click', cancelEdit)]}
                            title="Abbrechen"
                          >
                            <Glyph name="close" width={16} height={16} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            mix={[
                              button({ tone: 'secondary' }),
                              on('click', () => startEditing(index)),
                            ]}
                            title="Bearbeiten"
                          >
                            <Glyph name="edit" width={16} height={16} />
                          </button>
                          <button
                            mix={[button({ tone: 'danger' }), on('click', () => deleteItem(index))]}
                            title="Löschen"
                          >
                            <Glyph name="close" width={16} height={16} />
                          </button>
                          <button
                            mix={[button({ tone: 'secondary' }), on('click', () => moveUp(index))]}
                            disabled={index === 0}
                            title="Nach oben"
                          >
                            ↑
                          </button>
                          <button
                            mix={[
                              button({ tone: 'secondary' }),
                              on('click', () => moveDown(index)),
                            ]}
                            disabled={index === items.length - 1}
                            title="Nach unten"
                          >
                            ↓
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )
    }
  },
)
