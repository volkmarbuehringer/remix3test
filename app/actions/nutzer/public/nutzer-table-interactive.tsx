import { clientEntry, css, on, ref, type Handle } from 'remix/ui'
import * as menu from 'remix/ui/menu/primitives'
import { onMenuSelect } from 'remix/ui/menu/primitives'
import { MenuItem, MenuList } from 'remix/ui/menu'
import { Glyph } from '../../../ui/theme/glyph/glyph.tsx'
import { Separator } from '../../../ui/theme/separator/separator.ts'
import { theme } from '../../../ui/theme/theme.ts'
import { showToast } from '../../../ui/toast.ts'
import { safeNavigate, safeReload } from '../../../utils/frame-utils.ts'

interface NutzerRow {
  n_id: string
  n_name: string | null
  n_l_login: string
  n_l_aktiv: boolean
  n_l_gesperrt: boolean
  n_email: string | null
}

let lastRightClickedRow: NutzerRow | null = null

export const NutzerTableInteractive = clientEntry(
  import.meta.url + '#NutzerTableInteractive',
  function NutzerTableInteractive(handle: Handle) {
    return () => {
      let tableData = readData()
      let { rows, offset, sortColumn, sortDirection, filter } = tableData

      // Show lock or unlock based on right-clicked row's current state
      let currentRow = lastRightClickedRow
      let isLocked = currentRow ? currentRow.n_l_gesperrt : false
      let isActive = currentRow ? currentRow.n_l_aktiv : true

      return (
        <menu.Context label="Nutzer Aktionen">
          {/* Hidden trigger — contextTrigger opens the MenuList when dispatched */}
          <div
            mix={[
              menu.contextTrigger(),
              hiddenTriggerStyle,
              ref((el, signal) => {
                let table = document.getElementById('nutzer-table')
                if (!table) return

                function onContextMenu(event: Event) {
                  let mouseEvent = event as MouseEvent
                  let tr = (mouseEvent.target as Element)?.closest?.(
                    'tr[data-row-id]',
                  ) as HTMLElement | null
                  if (!tr) return

                  mouseEvent.preventDefault()

                  let rowId = tr.getAttribute('data-row-id')
                  let freshData = readData()
                  let row = freshData.rows.find((r) => r.n_id === rowId)
                  if (!row) return

                  lastRightClickedRow = row
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

                table.addEventListener('contextmenu', onContextMenu, { capture: true })
                signal.addEventListener('abort', () => {
                  table.removeEventListener('contextmenu', onContextMenu)
                })
              }),
            ]}
            data-nutzer-trigger="true"
          />

          <MenuList
            mix={onMenuSelect((event) => {
              if (lastRightClickedRow) {
                handleRowAction(
                  lastRightClickedRow,
                  event,
                  offset,
                  sortColumn,
                  sortDirection,
                  filter,
                  handle,
                )
              }
            })}
          >
            <MenuItem name="edit">
              <Glyph name="edit" width={14} height={14} /> Bearbeiten
            </MenuItem>
            <MenuItem name="reset-password">
              <Glyph name="chevronRight" width={14} height={14} /> Passwort zurücksetzen
            </MenuItem>
            <Separator />
            {isLocked ? (
              <MenuItem name="unlock">Entsperren</MenuItem>
            ) : (
              <MenuItem name="lock">Sperren</MenuItem>
            )}
            {isActive ? (
              <MenuItem name="deactivate">Deaktivieren</MenuItem>
            ) : (
              <MenuItem name="activate">Aktivieren</MenuItem>
            )}
            <MenuItem name="copy-email" disabled={!currentRow?.n_email}>
              <Glyph name="copy" width={14} height={14} /> E-Mail kopieren
            </MenuItem>
            <Separator />
            <MenuItem name="delete" mix={css({ color: theme.colors.action.danger.background })}>
              <Glyph name="trash" width={14} height={14} /> Löschen
            </MenuItem>
          </MenuList>
        </menu.Context>
      )
    }
  },
)

function handleRowAction(
  row: NutzerRow,
  event: { item: { name: string; value?: string | null } },
  offset: number,
  sortColumn: string,
  sortDirection: 'asc' | 'desc',
  filter: string | undefined,
  handle: Handle,
) {
  let csrfToken = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? ''

  switch (event.item.name) {
    case 'edit': {
      let params = new URLSearchParams()
      params.set('editing', row.n_id)
      params.set('offset', String(offset))
      params.set('sort', sortColumn)
      params.set('order', sortDirection)
      if (filter) params.set('filter', filter)
      safeNavigate('/admin/nutzer?' + params.toString(), handle)
      break
    }
    case 'reset-password': {
      if (!confirm(`Passwort für ${row.n_name || row.n_l_login} zurücksetzen?`)) return
      fetch(`/admin/nutzer/${row.n_id}/reset-password`, {
        method: 'POST',
        headers: { 'X-Csrf-Token': csrfToken },
      })
        .then((r) => {
          if (!r.ok) throw new Error()
          return r.json()
        })
        .then(() => {
          showToast(`Passwort für ${row.n_name || row.n_l_login} wurde zurückgesetzt.`, 'success')
          safeReload(handle)
        })
        .catch(() => showToast('Fehler beim Zurücksetzen des Passworts.'))
      break
    }
    case 'lock':
    case 'unlock': {
      let newValue = event.item.name === 'lock'
      fetch(`/admin/nutzer/${row.n_id}/toggle-lock`, {
        method: 'POST',
        headers: {
          'X-Csrf-Token': csrfToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ locked: newValue }),
      })
        .then((r) => {
          if (r.ok) safeReload(handle)
          else showToast('Fehler beim Ändern des Sperrstatus.')
        })
        .catch(() => showToast('Fehler beim Ändern des Sperrstatus.'))
      break
    }
    case 'activate':
    case 'deactivate': {
      let newValue = event.item.name === 'activate'
      fetch(`/admin/nutzer/${row.n_id}/toggle-active`, {
        method: 'POST',
        headers: {
          'X-Csrf-Token': csrfToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ active: newValue }),
      })
        .then((r) => {
          if (r.ok) safeReload(handle)
          else showToast('Fehler beim Ändern des Aktiv-Status.')
        })
        .catch(() => showToast('Fehler beim Ändern des Aktiv-Status.'))
      break
    }
    case 'copy-email': {
      if (!row.n_email) return
      navigator.clipboard
        .writeText(row.n_email)
        .catch((err) => console.warn('Failed to copy email:', err))
      break
    }
    case 'delete': {
      let name = row.n_name || row.n_l_login
      if (!confirm(`${name} wirklich löschen?`)) return
      fetch(`/admin/nutzer/${row.n_id}`, {
        method: 'POST',
        headers: {
          'X-Csrf-Token': csrfToken,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          _method: 'DELETE',
          _offset: String(offset),
          _sort: sortColumn,
          _order: sortDirection,
          ...(filter ? { _filter: filter } : {}),
        }).toString(),
      })
        .then((r) => {
          if (r.ok) safeReload(handle)
          else showToast('Fehler beim Löschen.')
        })
        .catch(() => showToast('Fehler beim Löschen.'))
      break
    }
  }
}

// ── Data loading ──

interface TableData {
  rows: NutzerRow[]
  offset: number
  hasMore: boolean
  prevOffset: number
  nextOffset: number
  sortColumn: string
  sortDirection: 'asc' | 'desc'
  filter: string | undefined
}

function readData(): TableData {
  try {
    let el = document.getElementById('nutzer-table-data')
    if (!el) return defaultData()
    return JSON.parse(el.textContent || '{}')
  } catch {
    return defaultData()
  }
}

function defaultData(): TableData {
  return {
    rows: [],
    offset: 0,
    hasMore: false,
    prevOffset: 0,
    nextOffset: 15,
    sortColumn: 'n_name',
    sortDirection: 'asc',
    filter: undefined,
  }
}

const hiddenTriggerStyle = css({
  position: 'fixed',
  width: 0,
  height: 0,
  opacity: 0,
  pointerEvents: 'none',
})
