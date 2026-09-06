import { clientEntry, css, ref, type Handle } from 'remix/ui'
import * as menu from 'remix/ui/menu/primitives'
import { onMenuSelect } from 'remix/ui/menu/primitives'
import { MenuItem, MenuList } from 'remix/ui/menu'
import { Glyph } from '../../../ui/theme/glyph/glyph.tsx'
import { Separator } from '../../../ui/theme/separator/separator.ts'
import { theme } from '../../../ui/theme/theme.ts'

/**
 * ClientEntry that adds a right-click context menu to the admin uploads table
 * rows. The only action is "Löschen" (delete), which submits the per-row
 * delete form that is already rendered server-side (identified by
 * `data-delete-form`), so it reuses the same CSRF + grid-state machinery as the
 * visible trash button.
 *
 * Uses a hidden trigger element with `menu.contextTrigger()` positioned at the
 * mouse coordinates of the right-click. Event delegation on the table container
 * captures `contextmenu` events from server-rendered rows and dispatches a
 * synthetic event to the hidden trigger.
 */
export const AdminUploadsContextMenu = clientEntry(
  import.meta.url + '#AdminUploadsContextMenu',
  function AdminUploadsContextMenu(handle: Handle) {
    let rightClickedRowId: string | null = null
    let rightClickedFilename: string | null = null

    return () => (
      <menu.Context label="Dateiaktionen">
        {/*
          Hidden trigger element — positioned at right-click coordinates.
          Uses `opacity: 0` (not `display: none`) so the synthetic `contextmenu`
          event dispatches correctly and `getBoundingClientRect()` works.
        */}
        <div
          mix={[
            menu.contextTrigger(),
            ref((el) => {
              let table = document.querySelector('[data-uploads-table]')
              if (!table) return

              function onContextMenu(event: Event) {
                let mouseEvent = event as MouseEvent
                mouseEvent.preventDefault()

                let target = mouseEvent.target as HTMLElement | null
                let row = target?.closest?.('[data-row-id]') as HTMLElement | null
                if (!row) return

                rightClickedRowId = row.dataset.rowId ?? null
                rightClickedFilename = row.getAttribute('data-upload-filename') ?? null

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

            if (event.item.name === 'download') {
              handleDownloadAction(rowId)
            } else if (event.item.name === 'delete') {
              handleDeleteAction(rowId)
            }
          })}
        >
          <MenuItem name="download">
            <Glyph name="download" width={14} height={14} /> Herunterladen
          </MenuItem>
          <Separator />
          <MenuItem name="delete" mix={css({ color: theme.colors.action.danger.background })}>
            <Glyph name="trash" width={14} height={14} /> Löschen
          </MenuItem>
        </MenuList>
      </menu.Context>
    )

    function handleDownloadAction(rowId: string) {
      // Reuse the row's existing download link so the frame runtime handles it
      // exactly as the visible icon button does (attachment avoidance etc.).
      let link = document.querySelector<HTMLAnchorElement>(
        `[data-row-id="${rowId}"] a[data-download-link]`,
      )
      if (link) {
        link.click()
      }
    }

    function handleDeleteAction(rowId: string) {
      let filename = rightClickedFilename
      let message = filename ? `Datei "${filename}" wirklich löschen?` : 'Wirklich löschen?'
      if (!confirm(message)) return

      let form = document.querySelector<HTMLFormElement>(`form[data-delete-form="${rowId}"]`)
      if (form) {
        form.requestSubmit()
      }
    }
  },
)
