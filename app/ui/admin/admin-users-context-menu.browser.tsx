import { clientEntry, css, ref, type Handle } from 'remix/ui'
import * as menu from 'remix/ui/menu/primitives'
import { onMenuSelect } from 'remix/ui/menu/primitives'
import { MenuItem, MenuList } from 'remix/ui/menu'
import { Glyph } from '../theme/glyph/glyph.tsx'
import { Separator } from '../theme/separator/separator.ts'
import { theme } from '../theme/theme.ts'
import { showToast } from '../toast.ts'
import { safeNavigate } from '../../utils/frame-utils.ts'

interface GridState {
  offset: string
  sort: string
  order: string
  filter: string
  baseHref?: string
}

export const AdminUsersContextMenu = clientEntry(
  import.meta.url + '#AdminUsersContextMenu',
  function AdminUsersContextMenu(handle: Handle) {
    let rightClickedRowId: string | null = null
    let rightClickedRowDisabledAt: string | null = null

    return () => {
      let isDisabled = rightClickedRowDisabledAt !== null && rightClickedRowDisabledAt !== ''

      return (
        <menu.Context label="Benutzeraktionen">
          <div
            mix={[
              menu.contextTrigger(),
              ref((el) => {
                let table = document.querySelector('[data-users-table]')
                if (!table) return

                function onContextMenu(event: Event) {
                  let mouseEvent = event as MouseEvent
                  mouseEvent.preventDefault()

                  let target = mouseEvent.target as HTMLElement | null
                  let row = target?.closest?.('[data-row-id]') as HTMLElement | null
                  if (!row) return

                  rightClickedRowId = row.dataset.rowId ?? null
                  rightClickedRowDisabledAt = row.getAttribute('data-disabled-at')
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
                  handleToggleDisabledAction(rowId, event.item.name === 'activate')
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
            {isDisabled ? (
              <MenuItem name="activate">Aktivieren</MenuItem>
            ) : (
              <MenuItem name="deactivate">Deaktivieren</MenuItem>
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
      let dataEl = document.getElementById('users-grid-state')
      if (!dataEl) return

      try {
        let state: GridState = JSON.parse(dataEl.textContent || '{}')
        let baseHref = state.baseHref || '/admin/users'
        let params = new URLSearchParams()
        params.set('editing', rowId)
        if (state.offset) params.set('offset', state.offset)
        params.set('sort', state.sort || 'name')
        params.set('order', state.order || 'asc')
        if (state.filter) params.set('filter', state.filter)
        safeNavigate(baseHref + '?' + params.toString(), handle)
      } catch {
        safeNavigate('/admin/users?editing=' + rowId, handle)
      }
    }

    function handleToggleDisabledAction(rowId: string, activate: boolean) {
      let csrfToken =
        document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? ''

      fetch(`/admin/users/${rowId}/toggle-disabled`, {
        method: 'POST',
        headers: {
          'X-Csrf-Token': csrfToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })
        .then((r) => {
          if (!r.ok) throw new Error()
          return r.json()
        })
        .then(() => {
          handle.frame?.reload()
        })
        .catch(() => showToast(activate ? 'Fehler beim Aktivieren.' : 'Fehler beim Deaktivieren.'))
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
