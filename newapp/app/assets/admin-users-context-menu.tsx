import { clientEntry, ref, type Handle } from 'remix/ui'
import * as menu from 'remix/ui/menu'
import { MenuItem, MenuList, onMenuSelect } from 'remix/ui/menu'

interface GridState {
  offset: string
  sort: string
  order: string
  filter: string
}

export const AdminUsersContextMenu = clientEntry(
  import.meta.url + '#AdminUsersContextMenu',
  function AdminUsersContextMenu(handle: Handle) {
    let triggerRef: HTMLDivElement | null = null
    let rightClickedRowId: string | null = null
    let mounted = false

    handle.signal.addEventListener('abort', () => {
      triggerRef = null
    })

    return () => (
      <menu.Context label="Benutzeraktionen">
        <div
          mix={[
            menu.contextTrigger(),
            ref((el) => {
              triggerRef = el
              if (mounted) return
              mounted = true

              let table = document.querySelector('[data-users-table]')
              if (!table) return

              function onContextMenu(event: Event) {
                let mouseEvent = event as MouseEvent
                mouseEvent.preventDefault()

                let target = mouseEvent.target as HTMLElement | null
                let row = target?.closest?.('[data-row-id]') as HTMLElement | null
                if (!row) return

                rightClickedRowId = row.dataset.rowId ?? null

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
          ]}
          style="position:fixed;width:0;height:0;opacity:0;pointer-events:none"
        />

        <MenuList
          mix={onMenuSelect((event) => {
            let rowId = rightClickedRowId
            if (!rowId) return

            if (event.item.name === 'edit') {
              handleEditAction(rowId)
            } else if (event.item.name === 'delete') {
              handleDeleteAction(rowId)
            }
          })}
        >
          <MenuItem name="edit">Bearbeiten</MenuItem>
          <div role="separator" />
          <MenuItem name="delete">Löschen</MenuItem>
        </MenuList>
      </menu.Context>
    )

    function handleEditAction(rowId: string) {
      let dataEl = document.getElementById('users-grid-state')
      if (!dataEl) return

      try {
        let state: GridState = JSON.parse(dataEl.textContent || '{}')
        let params = new URLSearchParams()
        params.set('editing', rowId)
        if (state.offset) params.set('offset', state.offset)
        params.set('sort', state.sort || 'name')
        params.set('order', state.order || 'asc')
        if (state.filter) params.set('filter', state.filter)
        window.location.href = '/admin/users?' + params.toString()
      } catch {
        window.location.href = '/admin/users?editing=' + rowId
      }
    }

    function handleDeleteAction(rowId: string) {
      if (!confirm('Wirklich löschen?')) return

      let form = document.querySelector<HTMLFormElement>(
        `form[data-delete-form="${rowId}"]`,
      )
      if (form) {
        form.requestSubmit()
      }
    }
  },
)
