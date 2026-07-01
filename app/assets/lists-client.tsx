import { clientEntry, type Handle, on, css, ref } from 'remix/ui'
import { theme } from '../lib/theme.ts'
import { Glyph } from '../lib/glyph.ts'

import button from '../lib/button.ts'

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
    let expectedListId: string | null = null

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

    function navigateFrame(href: string) {
      handle.frame.src = href
      handle.frame.reload().catch(() => {})
    }

    let saveToStorage = async () => {
      saving = true
      loadError = ''
      handle.update()

      let newId: number | null = null
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
        if (response.ok) {
          let data = await response.json()
          newId = typeof data.id === 'number' ? data.id : null
        } else {
          loadError = 'Speichern fehlgeschlagen'
        }
      } catch {
        loadError = 'Speichern fehlgeschlagen (Netzwerkfehler)'
      }
      saving = false

      if (newId !== null) {
        navigateFrame(`/lists?load=${newId}`)
      } else {
        handle.update()
      }
    }

    let updateList = async () => {
      if (loadedListId === null) return
      updating = true
      loadError = ''
      handle.update()

      let savedId = loadedListId
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
        if (!ok) {
          loadError = 'Aktualisieren fehlgeschlagen'
        }
      } catch {
        loadError = 'Aktualisieren fehlgeschlagen (Netzwerkfehler)'
      }
      updating = false

      if (ok) {
        navigateFrame(`/lists?load=${savedId}`)
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

    let loadController: AbortController | null = null

    let loadListFromServer = async (id: string, signal?: AbortSignal) => {
      try {
        let response = await fetch(`/lists/${id}/data`, signal ? { signal } : undefined)
        if (!response.ok) throw new Error('Failed to load')
        let data = await response.json()
        if (signal?.aborted) return
        items = Array.isArray(data.items) ? data.items : []
        description = typeof data.description === 'string' ? data.description : ''
        loadedListId = typeof data.id === 'number' ? data.id : null
        loadError = ''
        // Derive nextId from max existing ID + 1 to avoid key collisions
        nextId =
          items.reduce((max, item) => {
            let n = parseInt(item.id, 10)
            return Number.isFinite(n) && n > max ? n : max
          }, 0) + 1
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return
        loadError = 'Liste konnte nicht geladen werden'
      }
      if (signal?.aborted) return
      loadingList = false
      handle.update()
    }

    function reloadListFromFrame() {
      if (handle.signal.aborted) return
      let url = new URL(handle.frame.src, location.origin)
      let loadId = url.searchParams.get('load')
      let effectiveLoadId = loadId ?? null
      if (effectiveLoadId === expectedListId) return
      expectedListId = effectiveLoadId
      loadError = ''
      loadController?.abort()
      loadController = new AbortController()
      if (effectiveLoadId) {
        loadingList = true
        handle.update()
        loadListFromServer(effectiveLoadId, loadController.signal)
      } else if (loadedListId !== null) {
        items = []
        description = ''
        loadedListId = null
        nextId = 0
        handle.update()
      }
    }

    // React to frame navigation — reloads the list when sidebar link is clicked
    handle.frame.addEventListener('reloadComplete', reloadListFromFrame, { signal: handle.signal })

    return () => {
      if (!initialized && typeof document !== 'undefined') {
        initialized = true
        setTimeout(() => {
          let url = new URL(handle.frame.src, location.origin)
          let loadId = url.searchParams.get('load')
          if (loadId) {
            expectedListId = loadId
            loadingList = true
            loadController = new AbortController()
            handle.update()
            loadListFromServer(loadId, loadController.signal)
          }
        }, 0)
      }

      // Show loading state while fetching
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
            <button mix={[button({ tone: 'secondary' }), on('click', reverse)]}>
              ↺ Umkehren
            </button>
            <button mix={[button({ tone: 'primary' }), on('click', shuffle)]}>
              ⇄ Mischen
            </button>
            <button
              mix={[button({ tone: 'danger' }), on('click', clearAll)]}
              disabled={items.length === 0}
            >
              ✕ Alle löschen
            </button>
            <div
              mix={css({
                display: 'inline-flex',
                marginLeft: 'auto',
              })}
            >
              <button
                mix={[button({ tone: 'primary' }), css({ minWidth: '120px', borderTopRightRadius: 0, borderBottomRightRadius: 0 }), on('click', updateList)]}
                disabled={loadedListId === null || !description.trim() || items.length === 0 || updating}
              >
                {updating ? '⏳ Wird aktualisiert…' : '🔄 Aktualisieren'}
              </button>
              <button
                mix={[button({ tone: 'primary' }), css({ minWidth: '100px', borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeft: 'none' }), on('click', saveToStorage)]}
                disabled={!description.trim() || items.length === 0 || saving}
              >
                {saving ? '⏳ Speichern…' : '💾 Hinzufügen'}
              </button>
            </div>
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
                  handle.update()
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
                ref((el) => { newItemRef = el }),
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
                    '&::-webkit-scrollbar-thumb:hover': { backgroundColor: theme.colors.text.muted },
                  }),
                  ref((el) => { listRef = el }),
                ]}
              >
                {items.map((item, index) => (
                  <div
                    key={item.id}
                    mix={css({
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
                    })}
                  >
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

                    <div mix={css({ display: 'flex', gap: theme.space.xs })}>
                      {editingIndex === index ? (
                        <>
                          <button mix={[button({ tone: 'primary' }), on('click', saveEdit)]} title="Speichern"><Glyph name="check" width={16} height={16} /></button>
                          <button mix={[button({ tone: 'secondary' }), on('click', cancelEdit)]} title="Abbrechen"><Glyph name="close" width={16} height={16} /></button>
                        </>
                      ) : (
                        <>
                          <button mix={[button({ tone: 'secondary' }), on('click', () => startEditing(index))]} title="Bearbeiten"><Glyph name="edit" width={16} height={16} /></button>
                          <button mix={[button({ tone: 'danger' }), on('click', () => deleteItem(index))]} title="Löschen"><Glyph name="close" width={16} height={16} /></button>
                          <button mix={[button({ tone: 'secondary' }), on('click', () => moveUp(index))]} disabled={index === 0} title="Nach oben">↑</button>
                          <button mix={[button({ tone: 'secondary' }), on('click', () => moveDown(index))]} disabled={index === items.length - 1} title="Nach unten">↓</button>
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
