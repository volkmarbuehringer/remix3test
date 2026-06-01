import { clientEntry, type Handle, on, css, ref } from 'remix/ui'
import { theme } from 'remix/ui/theme'
import { Glyph } from 'remix/ui/glyph'

import { Button } from 'remix/ui/button'

type ListItem = {
  id: string
  label: string
}

export const ListsClient = clientEntry(
  import.meta.url + '#ListsClient',
  function ListsClient(handle: Handle) {
    let items: ListItem[] = []
    let description = ''
    let newItemLabel = ''
    let nextId = 0
    let showSavedToast = false
    let toastTimeout: ReturnType<typeof setTimeout> | null = null
    let saving = false
    let updating = false
    let loadedListId: number | null = null
    let loadingList = false
    let loadError = ''
    let editingIndex: number | null = null
    let editText = ''
    let newItemRef: HTMLTextAreaElement | null = null
    let listRef: HTMLDivElement | null = null
    let initialized = false

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

    let scrollToBottom = () => {
      if (listRef) {
        listRef.scrollTop = listRef.scrollHeight
      }
    }

    let saveToStorage = async () => {
      saving = true
      handle.update()

      let ok = false
      try {
        let csrfToken = typeof document !== 'undefined'
          ? document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
          : undefined
        let headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (csrfToken) headers['X-Csrf-Token'] = csrfToken
        let response = await fetch('/lists/save', {
          method: 'POST',
          headers,
          body: JSON.stringify({ description, items }),
        })
        ok = response.ok
      } catch {
        // network error — button recovers
      }
      saving = false

      if (ok) {
        showSavedToast = true
        handle.update()
        if (toastTimeout) clearTimeout(toastTimeout)
        toastTimeout = setTimeout(() => {
          showSavedToast = false
          toastTimeout = null
          handle.update()
        }, 2000)
      } else {
        handle.update()
      }
    }

    let updateList = async () => {
      if (loadedListId === null) return
      updating = true
      handle.update()

      let ok = false
      try {
        let csrfToken = typeof document !== 'undefined'
          ? document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
          : undefined
        let headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (csrfToken) headers['X-Csrf-Token'] = csrfToken
        let response = await fetch(`/lists/${loadedListId}/update`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ description, items }),
        })
        ok = response.ok
      } catch {
        // network error — button recovers
      }
      updating = false

      if (ok) {
        showSavedToast = true
        handle.update()
        if (toastTimeout) clearTimeout(toastTimeout)
        toastTimeout = setTimeout(() => {
          showSavedToast = false
          toastTimeout = null
          handle.update()
        }, 2000)
      } else {
        handle.update()
      }
    }

    let moveUp = (index: number) => {
      if (index === 0) return
      let newItems = [...items]
      ;[newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]]
      items = newItems
      handle.update()
    }

    let moveDown = (index: number) => {
      if (index === items.length - 1) return
      let newItems = [...items]
      ;[newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]]
      items = newItems
      handle.update()
    }

    let reverse = () => {
      items = [...items].reverse()
      handle.update()
    }

    let shuffle = () => {
      let newItems = [...items]
      for (let i = newItems.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1))
        ;[newItems[i], newItems[j]] = [newItems[j], newItems[i]]
      }
      items = newItems
      handle.update()
    }

    let clearAll = () => {
      if (!confirm('Alle Elemente löschen? Dies kann nicht rückgängig gemacht werden.')) return
      items = []
      nextId = 0
      handle.update()
    }

    let addItem = () => {
      if (!newItemLabel.trim()) return
      let newItem: ListItem = {
        id: (nextId++).toString(),
        label: newItemLabel.trim(),
      }
      items = [...items, newItem]
      newItemLabel = ''
      if (newItemRef) newItemRef.value = ''
      handle.update()
      setTimeout(scrollToBottom, 0)
    }

    let deleteItem = (index: number) => {
      items = items.filter((_, i) => i !== index).map((item, i) => ({
        ...item,
        id: (i + 1).toString(),
      }))
      nextId = items.length + 1
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

    let loadListFromServer = async (id: string) => {
      try {
        let response = await fetch(`/lists/${id}/data`)
        if (!response.ok) throw new Error('Failed to load')
        let data = await response.json()
        items = Array.isArray(data.items) ? data.items : []
        description = typeof data.description === 'string' ? data.description : ''
        loadedListId = typeof data.id === 'number' ? data.id : null
        // Derive nextId from max existing ID + 1 to avoid key collisions
        nextId =
          items.reduce((max, item) => {
            let n = parseInt(item.id, 10)
            return Number.isFinite(n) && n > max ? n : max
          }, 0) + 1
      } catch {
        loadError = 'Liste konnte nicht geladen werden'
      }
      loadingList = false
      handle.update()
    }

    return () => {
      if (!initialized && typeof document !== 'undefined') {
        initialized = true

        // Defer all state changes to after hydration so SSR and first
        // client render match (both show empty initial state)
        setTimeout(() => {
          let params = new URLSearchParams(location.search)
          let loadId = params.get('load')
          if (loadId) {
            loadingList = true
            handle.update()
            loadListFromServer(loadId)
          }
        }, 0)
      }

      // Show loading state while fetching
      if (loadingList) {
        return (
          <div
            style={{
              fontFamily: theme.fontFamily.sans,
              maxWidth: '600px',
              padding: theme.space.xxl,
              textAlign: 'center',
              color: theme.colors.text.secondary,
              fontSize: theme.fontSize.lg,
            }}
          >
            Liste wird geladen…
          </div>
        )
      }

      // Show error state
      if (loadError) {
        return (
          <div
            style={{
              fontFamily: theme.fontFamily.sans,
              maxWidth: '600px',
              padding: theme.space.xxl,
              textAlign: 'center',
              color: theme.colors.action.danger.background,
              fontSize: theme.fontSize.lg,
            }}
          >
            {loadError}
          </div>
        )
      }

      return (
        <div style={{ fontFamily: theme.fontFamily.sans, maxWidth: '600px' }}>
          {/* Control bar */}
          <div
            style={{
              display: 'flex',
              gap: theme.space.md,
              marginBottom: theme.space.lg,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            <Button tone="secondary" mix={on('click', reverse)}>
              ↺ Umkehren
            </Button>
            <Button tone="primary" mix={on('click', shuffle)}>
              ⇄ Mischen
            </Button>
            <Button
              tone="secondary"
              mix={on('click', clearAll)}
              disabled={items.length === 0}
            >
              ✕ Alle löschen
            </Button>
            <div
              style={{
                display: 'inline-flex',
                marginLeft: 'auto',
              }}
            >
              <Button
                tone="primary"
                mix={on('click', updateList)}
                disabled={loadedListId === null || !description.trim() || items.length === 0 || updating}
                style={{ minWidth: '120px', borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
              >
                {updating ? '⏳ Wird aktualisiert…' : '🔄 Aktualisieren'}
              </Button>
              <Button
                tone="primary"
                mix={on('click', saveToStorage)}
                disabled={!description.trim() || items.length === 0 || saving}
                style={{ minWidth: '100px', borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeft: 'none' }}
              >
                {saving ? '⏳ Speichern…' : '💾 Hinzufügen'}
              </Button>
            </div>
          </div>

          {/* Description input */}
          <div
            style={{
              marginBottom: theme.space.lg,
            }}
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
                  handle.update()
                }),
              ]}
              type="text"
              placeholder="Beschreibung für diese Liste eingeben…"
              maxLength={500}
              defaultValue={description}
            />
          </div>

          {/* Toast notification */}
          {showSavedToast && (
            <div
              style={{
                position: 'fixed',
                top: theme.space.lg,
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: theme.colors.action.primary.background,
                color: theme.colors.action.primary.foreground,
                padding: `${theme.space.sm} ${theme.space.lg}`,
                borderRadius: theme.radius.md,
                fontSize: theme.fontSize.md,
                fontWeight: theme.fontWeight.medium,
                boxShadow: theme.shadow.md,
                zIndex: 1000,
              }}
            >
              ✓ {items.length} Eintr{items.length !== 1 ? 'äge' : 'ag'} gespeichert!
            </div>
          )}

          {/* Add item */}
          <div
            style={{
              display: 'flex',
              gap: theme.space.md,
              marginBottom: theme.space.lg,
              alignItems: 'flex-start',
            }}
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
                ref((el) => { newItemRef = el }),
              ]}
              placeholder="Neues Element eingeben…"
              rows={3}
              wrap="soft"
              defaultValue={newItemLabel}
            />
            <Button tone="primary" mix={on('click', addItem)}>
              + Element hinzufügen
            </Button>
          </div>

          {/* Items list */}
          <div
            style={{
              border: `1px solid ${theme.colors.border.default}`,
              borderRadius: theme.radius.xl,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                backgroundColor: theme.surface.lvl2,
                padding: `${theme.space.sm} ${theme.space.md}`,
                borderBottom: `1px solid ${theme.colors.border.default}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span
                style={{
                  fontSize: theme.fontSize.xs,
                  fontWeight: theme.fontWeight.semibold,
                  color: theme.colors.text.muted,
                }}
              >
                ELEMENTE
              </span>
              <span
                style={{
                  fontSize: theme.fontSize.sm,
                  color: theme.colors.text.secondary,
                  backgroundColor: theme.colors.border.default,
                  padding: `${theme.space.xs} ${theme.space.md}`,
                  borderRadius: theme.radius.full,
                }}
              >
                {items.length} Einträge
              </span>
            </div>

            {items.length === 0 ? (
              <div
                style={{
                  padding: `${theme.space.xxl} ${theme.space.lg}`,
                  textAlign: 'center',
                  color: theme.colors.text.muted,
                }}
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
                    '&::-webkit-scrollbar-thumb:hover': { backgroundColor: theme.colors.text.muted },
                  }),
                  ref((el) => { listRef = el }),
                ]}
              >
                {items.map((item, index) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      gap: theme.space.md,
                      alignItems: 'center',
                      padding: `${theme.space.md} ${theme.space.md}`,
                      borderBottom:
                        index < items.length - 1
                          ? `1px solid ${theme.colors.border.subtle}`
                          : 'none',
                      backgroundColor:
                        index % 2 === 0 ? theme.surface.lvl0 : theme.surface.lvl1,
                    }}
                  >
                    <span
                      style={{
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
                      }}
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

                    <div style={{ display: 'flex', gap: theme.space.xs }}>
                      {editingIndex === index ? (
                        <>
                          <Button tone="primary" mix={on('click', saveEdit)} title="Speichern"><Glyph name="check" width={16} height={16} /></Button>
                          <Button tone="secondary" mix={on('click', cancelEdit)} title="Abbrechen"><Glyph name="close" width={16} height={16} /></Button>
                        </>
                      ) : (
                        <>
                          <Button tone="secondary" mix={on('click', () => startEditing(index))} title="Bearbeiten"><Glyph name="edit" width={16} height={16} /></Button>
                          <Button tone="danger" mix={on('click', () => deleteItem(index))} title="Löschen"><Glyph name="close" width={16} height={16} /></Button>
                          <Button tone="secondary" mix={on('click', () => moveUp(index))} disabled={index === 0} title="Nach oben">↑</Button>
                          <Button tone="secondary" mix={on('click', () => moveDown(index))} disabled={index === items.length - 1} title="Nach unten">↓</Button>
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
