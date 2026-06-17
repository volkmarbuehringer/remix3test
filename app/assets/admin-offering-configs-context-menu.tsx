import { clientEntry, css, ref, type Handle } from 'remix/ui'
import * as menu from 'remix/ui/menu'
import { onMenuSelect } from 'remix/ui/menu'
import { MenuItem, MenuList } from 'remix/components/menu'
import { Glyph } from '../lib/glyph.ts'
import { Separator } from '../lib/separator.ts'
import { theme } from '../lib/theme.ts'

interface GridState {
  offset: string
  sort: string
  order: string
  filter: string
  baseHref?: string
}

export const AdminOfferingConfigsContextMenu = clientEntry(
  import.meta.url + '#AdminOfferingConfigsContextMenu',
  function AdminOfferingConfigsContextMenu(handle: Handle) {
    let rightClickedRowId: string | null = null

    return () => (
      <menu.Context label="Konfigurationsaktionen">
        <div
          mix={[
            menu.contextTrigger(),
            ref((el) => {
              let table = document.querySelector('[data-offering-configs-table]')
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
              css({ position: 'fixed', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }),
            ]}
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
          <MenuItem name="edit"><Glyph name="edit" width={14} height={14} /> Bearbeiten</MenuItem>
          <Separator />
          <MenuItem name="delete" mix={css({ color: theme.colors.action.danger.background })}><Glyph name="trash" width={14} height={14} /> Löschen</MenuItem>
        </MenuList>
      </menu.Context>
    )

    function handleEditAction(rowId: string) {
      let dataEl = document.getElementById('offering-configs-grid-state')
      if (!dataEl) return

      try {
        let state: GridState = JSON.parse(dataEl.textContent || '{}')
        let baseHref = state.baseHref || '/verwaltung/offering-configs'
        let params = new URLSearchParams()
        params.set('editing', rowId)
        if (state.offset) params.set('offset', state.offset)
        params.set('sort', state.sort || 'resource_description')
        params.set('order', state.order || 'asc')
        if (state.filter) params.set('filter', state.filter)
        window.location.href = baseHref + '?' + params.toString()
      } catch {
        window.location.href = '/verwaltung/offering-configs?editing=' + rowId
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
