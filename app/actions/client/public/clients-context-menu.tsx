import { clientEntry, css, ref, type Handle } from 'remix/ui'
import * as menu from 'remix/ui/menu/primitives'
import { onMenuSelect } from 'remix/ui/menu/primitives'
import { MenuItem, MenuList } from 'remix/ui/menu'
import { Glyph } from '../../../ui/theme/glyph/glyph.tsx'
import { Separator } from '../../../ui/theme/separator/separator.ts'
import { theme } from '../../../ui/theme/theme.ts'
import { safeNavigate } from '../../../utils/frame-utils.ts'

interface GridState {
  offset: string
  sort: string
  order: string
  filter: string
  baseHref?: string
}

export const ClientsContextMenu = clientEntry(
  import.meta.url + '#ClientsContextMenu',
  function ClientsContextMenu(handle: Handle) {
    let rightClickedRowId: string | null = null
    let rightClickedRowStatus: string | null = null

    return () => {
      let isActive = rightClickedRowStatus === 'Active'

      return (
        <menu.Context label="Kundenaktionen">
          <div
            mix={[
              menu.contextTrigger(),
              ref((el) => {
                let table = document.querySelector('[data-clients-table]')
                if (!table) return

                function onContextMenu(event: Event) {
                  let mouseEvent = event as MouseEvent
                  mouseEvent.preventDefault()

                  let target = mouseEvent.target as HTMLElement | null
                  let row = target?.closest?.('[data-row-id]') as HTMLElement | null
                  if (!row) return

                  rightClickedRowId = row.dataset.rowId ?? null
                  rightClickedRowStatus = row.getAttribute('data-status')
                  handle.update()

                  el.style.left = mouseEvent.clientX + 'px'
                  el.style.top = mouseEvent.clientY + 'px'

                  el.dispatchEvent(
                    new MouseEvent('contextmenu', {
                      clientX: mouseEvent.clientX,
                      clientY: mouseEvent.clientY,
                      bubbles: true,
                      cancelable: true,
                    }),
                  )
                }

                table.addEventListener('contextmenu', onContextMenu)

                handle.signal.addEventListener('abort', () => {
                  table.removeEventListener('contextmenu', onContextMenu)
                })
              }),
              css({ position: 'fixed', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }),
            ]}
          />

          <MenuList
            mix={onMenuSelect((event) => {
              let rowId = rightClickedRowId
              if (!rowId) return

              switch (event.item.name) {
                case 'edit':
                  handleEditAction(rowId)
                  break
                case 'activate':
                case 'deactivate':
                  handleToggleStatusAction(rowId)
                  break
                case 'delete':
                  handleDeleteAction(rowId)
                  break
              }
            })}
          >
            <MenuItem name="edit">
              <Glyph name="edit" width={14} height={14} /> Bearbeiten
            </MenuItem>
            <Separator />
            {isActive ? (
              <MenuItem name="deactivate">Deaktivieren</MenuItem>
            ) : (
              <MenuItem name="activate">Aktivieren</MenuItem>
            )}
            <Separator />
            <MenuItem name="delete" mix={css({ color: theme.colors.action.danger.background })}>
              <Glyph name="trash" width={14} height={14} /> Löschen
            </MenuItem>
          </MenuList>
        </menu.Context>
      )
    }

    function handleEditAction(rowId: string) {
      let dataEl = document.getElementById('clients-grid-state')
      if (!dataEl) return

      try {
        let state: GridState = JSON.parse(dataEl.textContent || '{}')
        let baseHref = state.baseHref || '/admin/clients'
        let params = new URLSearchParams()
        params.set('editing', rowId)
        if (state.offset) params.set('offset', state.offset)
        params.set('sort', state.sort || 'id')
        params.set('order', state.order || 'asc')
        if (state.filter) params.set('filter', state.filter)
        safeNavigate(baseHref + '?' + params.toString(), handle)
      } catch {
        safeNavigate('/admin/clients?editing=' + rowId, handle)
      }
    }

    function handleToggleStatusAction(rowId: string) {
      let form = document.querySelector<HTMLFormElement>(`form[data-toggle-form="${rowId}"]`)
      if (form) {
        form.requestSubmit()
      }
    }

    function handleDeleteAction(rowId: string) {
      if (!confirm('Wirklich löschen?')) return

      let form = document.querySelector<HTMLFormElement>(`form[data-delete-form="${rowId}"]`)
      if (form) {
        form.requestSubmit()
      }
    }
  },
)
