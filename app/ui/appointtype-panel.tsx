import { clientEntry, css, on, ref, type Handle, type SerializableProps } from 'remix/ui'
import { theme } from '../lib/theme.ts'
import { Glyph } from '../lib/glyph.ts'
import { Separator } from '../lib/separator.ts'
import * as menu from 'remix/ui/menu'
import { onMenuSelect } from 'remix/ui/menu'
import { MenuItem, MenuList } from 'remix/components/menu'

import { getTypeDragState, setTypeDragState, getPanelDropActive } from '../lib/appointtype-drag.ts'
import type { AppointType } from '../data/schema.ts'
import { showToast } from './toast.ts'

// ── Props ──

interface AppointTypePanelProps extends SerializableProps {
  csrfToken: string
}

// ── Type for client-side data reading ──

interface PanelData {
  types: AppointType[]
  csrfToken: string
  appointmentTypesHref: string
}

function readData(): PanelData {
  if (typeof document === 'undefined') return { types: [], csrfToken: '', appointmentTypesHref: '' }
  try {
    let el = document.getElementById('appointtype-data')
    if (!el) return { types: [], csrfToken: '', appointmentTypesHref: '' }
    return JSON.parse(el.textContent || '{}')
  } catch {
    return { types: [], csrfToken: '', appointmentTypesHref: '' }
  }
}

// ── Component ──

export const AppointTypePanel = clientEntry(
  import.meta.url + '#AppointTypePanel',
  function AppointTypePanel(handle: Handle<AppointTypePanelProps>) {
    let addInput: HTMLInputElement | null = null
    let editInputs = new Map<number, HTMLInputElement>()

    let adding = false
    let editingId: number | null = null
    let lastRightClickedType: AppointType | null = null
    let typesBaseHref = ''

    return () => {
      let { types, csrfToken, appointmentTypesHref } = readData()
      typesBaseHref = appointmentTypesHref

      let isDropActive = getPanelDropActive()

      return (
        <div data-types-panel="true" mix={[panelStyle, isDropActive ? panelDropActiveStyle : undefined]}>
          <div mix={headerStyle}>
            <span mix={headerTitleStyle}>Termintypen</span>
          </div>

          <menu.Context label="Type Actions">
            <div mix={listStyle}>
              {types.map((t) => (
                <div
                  key={t.id}
                  data-type-id={t.id}
                  mix={[
                    typeItemStyle,
                    editingId === t.id ? editingItemStyle : undefined,
                    on('click', () => startRename(t)),
                    on('pointerdown', (e) => handlePointerDown(t, e)),
                    on('pointerup', () => handlePointerUp()),
                    menu.contextTrigger(),
                    on('contextmenu', () => { lastRightClickedType = t }),
                  ]}
                >
                  {editingId === t.id ? (
                    <input
                      aria-label="Typnamen bearbeiten"
                      type="text"
                      defaultValue={t.title}
                      mix={[
                        inputStyle,
                        ref((el) => {
                          if (el) {
                            editInputs.set(t.id, el)
                            el.focus()
                            el.select()
                          } else {
                            editInputs.delete(t.id)
                          }
                        }),
                        on('keydown', (e) => {
                          if (e.key === 'Escape') { cancelRename(); return }
                          if (e.key === 'Enter') { commitRename(t, csrfToken); return }
                        }),
                        on('blur', () => commitRename(t, csrfToken)),
                      ]}
                    />
                  ) : (
                    <span mix={typeTitleStyle}>{t.title}</span>
                  )}
                </div>
              ))}

              {adding ? (
                <div mix={addRowStyle}>
                  <input
                    aria-label="Neuer Typname"
                    type="text"
                    placeholder="Typname..."
                    mix={[
                      inputStyle,
                      ref((el) => {
                        addInput = el
                        if (el) { el.focus() }
                      }),
                      on('keydown', (e) => {
                        if (e.key === 'Escape') { cancelAdd(); return }
                        if (e.key === 'Enter') { commitAdd(csrfToken); return }
                      }),
                      on('blur', () => commitAdd(csrfToken)),
                    ]}
                  />
                </div>
              ) : null}
            </div>

            {!adding ? (
              <button
                mix={[
                  addButtonStyle,
                  on('click', () => { adding = true; handle.update() }),
                ]}
              >
                + Typ hinzufügen
              </button>
            ) : null}

            <MenuList
              mix={onMenuSelect((event) => {
                if (lastRightClickedType) {
                  handleAction(lastRightClickedType, event, csrfToken)
                }
              })}
            >
              <MenuItem name="edit"><Glyph name="edit" width={14} height={14} /> Bearbeiten</MenuItem>
              <Separator />
              <MenuItem name="delete" mix={css({ color: theme.colors.action.danger.background })}><Glyph name="trash" width={14} height={14} /> Löschen</MenuItem>
            </MenuList>
          </menu.Context>
        </div>
      )
    }

    // ── Add handlers ──

    function cancelAdd() {
      adding = false
      handle.update()
    }

    async function commitAdd(csrfToken: string) {
      if (!adding) return
      let title = addInput?.value?.trim() ?? ''
      if (!title) { cancelAdd(); return }

      adding = false
      handle.update()

      try {
        let response = await fetch(typesBaseHref, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Csrf-Token': csrfToken,
          },
          body: JSON.stringify({ title }),
          signal: handle.signal,
        })
        if (response.ok) {
          await handle.frame?.reload()
        } else {
          showToast('Fehler beim Speichern.')
        }
      } catch {
        showToast('Fehler beim Speichern.')
      }
    }

    // ── Rename handlers ──

    function startRename(type: AppointType) {
      if (editingId !== null || adding) return
      editingId = type.id
      handle.update()
    }

    function cancelRename() {
      editingId = null
      handle.update()
    }

    function getEditValue(typeId: number): string {
      let input = editInputs.get(typeId)
      return input ? input.value.trim() : ''
    }

    function commitRename(type: AppointType, csrfToken: string) {
      if (editingId !== type.id) return

      let newTitle = getEditValue(type.id)
      if (!newTitle || newTitle === type.title) {
        editingId = null
        handle.update()
        return
      }

      let id = type.id
      editingId = null
      handle.update()

      fetch(`${typesBaseHref}/${id}`, {
        method: 'PUT',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Csrf-Token': csrfToken,
        },
        body: JSON.stringify({ title: newTitle }),
        signal: handle.signal,
      })
        .then((r) => {
          if (r.ok) handle.frame?.reload()
          else showToast('Fehler beim Speichern.')
        })
        .catch(() => showToast('Fehler beim Speichern.'))
    }

    // ── Context menu handler ──

    function handleAction(
      type: AppointType,
      event: { item: { name: string; value?: string | null } },
      csrfToken: string,
    ) {
      switch (event.item.name) {
        case 'edit': {
          editingId = type.id
          handle.update()
          break
        }
        case 'delete': {
          if (!confirm(`"${type.title}" wirklich löschen?`)) return
          fetch(`${typesBaseHref}/${type.id}`, {
            method: 'DELETE',
            headers: {
              'Accept': 'application/json',
              'X-Csrf-Token': csrfToken,
            },
          })
            .then((r) => {
              if (r.ok) handle.frame?.reload()
              else showToast('Fehler beim Löschen.')
            })
            .catch(() => showToast('Fehler beim Löschen.'))
          break
        }
      }
    }

    // ── Drag handlers ──

    function handlePointerDown(type: AppointType, event: PointerEvent) {
      if (editingId !== null || adding) return
      if (event.button !== 0) return

      setTypeDragState({ active: true, typeId: type.id, title: type.title })
    }

    function handlePointerUp() {
      // The grid's pointerup handler commits the drop and clears state.
      // If the pointerup happens outside the grid (e.g. quick click on type),
      // the grid's handler won't fire, so clear here.
      if (getTypeDragState()) {
        setTypeDragState(null)
      }
    }
  },
)

// ── Styles ──

const panelStyle = css({
  backgroundColor: theme.surface.lvl0,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.xl,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
})

const headerStyle = css({
  alignItems: 'center',
  display: 'flex',
  padding: `${theme.space.sm} ${theme.space.md}`,
  borderBottom: `1px solid ${theme.colors.border.subtle}`,
})

const headerTitleStyle = css({
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
})

const listStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '1px',
  padding: `${theme.space.xs} ${theme.space.sm}`,
  minHeight: '80px',
  maxHeight: '200px',
  overflowY: 'auto',
})

const typeItemStyle = css({
  alignItems: 'center',
  borderRadius: theme.radius.md,
  cursor: 'grab',
  display: 'flex',
  fontSize: theme.fontSize.sm,
  minHeight: '32px',
  padding: `0 ${theme.space.sm}`,
  userSelect: 'none',
  '&:hover': {
    backgroundColor: theme.surface.lvl2,
  },
})

const editingItemStyle = css({
  backgroundColor: theme.surface.lvl2,
  cursor: 'auto',
})

const typeTitleStyle = css({
  color: theme.colors.text.primary,
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
})

const inputStyle = css({
  background: theme.surface.lvl0,
  border: `1px solid ${theme.colors.focus.ring}`,
  borderRadius: theme.radius.sm,
  color: theme.colors.text.primary,
  flex: 1,
  font: 'inherit',
  fontSize: theme.fontSize.sm,
  minHeight: '28px',
  outline: 'none',
  padding: `0 ${theme.space.xs}`,
  width: '100%',
})

const addRowStyle = css({
  padding: `0 ${theme.space.xs}`,
})

const addButtonStyle = css({
  background: 'none',
  border: 0,
  borderTop: `1px solid ${theme.colors.border.subtle}`,
  color: theme.colors.action.primary.background,
  cursor: 'pointer',
  font: 'inherit',
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.semibold,
  padding: `${theme.space.sm} ${theme.space.md}`,
  textAlign: 'left',
  '&:hover': {
    backgroundColor: theme.surface.lvl2,
  },
})

const panelDropActiveStyle = css({
  borderColor: theme.colors.action.primary.background,
  boxShadow: `0 0 0 2px ${theme.colors.focus.ring}`,
  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
})
