import { clientEntry, css, ref, type Handle } from 'remix/ui'
import * as menu from 'remix/ui/menu/primitives'
import { onMenuSelect } from 'remix/ui/menu/primitives'
import { MenuItem, MenuList } from 'remix/ui/menu'
import { Glyph } from '../lib/glyph.ts'
import { Separator } from '../lib/separator.ts'
import { theme } from '../lib/theme.ts'

// ── Types ──

interface GridState {
  offset: string
  sort: string
  order: string
  filter: string
  baseHref?: string
}

/**
 * ClientEntry that adds a right-click context menu to admin offerings table rows.
 *
 * Uses a hidden trigger element with `menu.contextTrigger()` positioned at the
 * mouse coordinates of the right-click. Event delegation on the table container
 * captures `contextmenu` events from server-rendered rows and dispatches a
 * synthetic event to the hidden trigger.
 */
export const AdminOfferingsContextMenu = clientEntry(
  import.meta.url + '#AdminOfferingsContextMenu',
  function AdminOfferingsContextMenu(handle: Handle) {
    let rightClickedRowId: string | null = null

    return () => (
      <menu.Context label="Angebotsaktionen">
        {/*
          Hidden trigger element — positioned at right-click coordinates.
          Uses `opacity: 0` (not `display: none`) so the synthetic `contextmenu`
          event dispatches correctly and `getBoundingClientRect()` works.
        */}
        <div
          mix={[
            menu.contextTrigger(),
            ref((el) => {
              let table = document.querySelector('[data-offerings-table]')
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
      let dataEl = document.getElementById('offerings-grid-state')
      if (!dataEl) return

      try {
        let state: GridState = JSON.parse(dataEl.textContent || '{}')
        let baseHref = state.baseHref || '/verwaltung/offerings'
        let params = new URLSearchParams()
        params.set('editing', rowId)
        if (state.offset) params.set('offset', state.offset)
        params.set('sort', state.sort || 'ao.id')
        params.set('order', state.order || 'asc')
        if (state.filter) params.set('filter', state.filter)
        window.location.href = baseHref + '?' + params.toString()
      } catch {
        window.location.href = '/verwaltung/offerings?editing=' + rowId
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
