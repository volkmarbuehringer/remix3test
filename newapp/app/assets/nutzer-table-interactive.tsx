import { clientEntry, css, on, type Handle } from 'remix/ui'
import * as menu from 'remix/ui/menu'
import { MenuItem, MenuList, onMenuSelect } from 'remix/ui/menu'
import { theme } from 'remix/ui/theme'
import { showToast } from '../ui/toast.ts'

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
    let mounted = false

    return () => {
      let tableData = readData()
      let { rows, offset, sortColumn, sortDirection, filter } = tableData

      // Attach event delegation once on mount
      let tableEl = typeof document !== 'undefined' ? document.getElementById('nutzer-table') : null
      if (!mounted && tableEl) {
        mounted = true
        attachContextMenuListeners(tableData, () => handle.update(), handle.signal)
      }

      // Show lock or unlock based on right-clicked row's current state
      let currentRow = lastRightClickedRow
      let isLocked = currentRow ? currentRow.n_l_gesperrt : false
      let isActive = currentRow ? currentRow.n_l_aktiv : true

      return (
        <menu.Context label="Nutzer Aktionen">
          {/* Hidden trigger — contextTrigger opens the MenuList when dispatched */}
          <div
            mix={[menu.contextTrigger(), hiddenTriggerStyle]}
            data-nutzer-trigger="true"
          />

          <MenuList
            mix={onMenuSelect((event) => {
              if (lastRightClickedRow) {
                handleRowAction(lastRightClickedRow, event, offset, sortColumn, sortDirection, filter)
              }
            })}
          >
            <MenuItem name="edit">✏️ Bearbeiten</MenuItem>
            <MenuItem name="reset-password">🔄 Passwort zurücksetzen</MenuItem>
            <div role="separator" />
            {isLocked
              ? <MenuItem name="unlock">🔓 Entsperren</MenuItem>
              : <MenuItem name="lock">🔒 Sperren</MenuItem>}
            {isActive
              ? <MenuItem name="deactivate">⏸️ Deaktivieren</MenuItem>
              : <MenuItem name="activate">▶️ Aktivieren</MenuItem>}
            <MenuItem name="copy-email" disabled={!currentRow?.n_email}>📋 E-Mail kopieren</MenuItem>
            <div role="separator" />
            <MenuItem name="delete" mix={css({ color: theme.colors.action.danger.background })}>🗑️ Löschen</MenuItem>
          </MenuList>
        </menu.Context>
      )
    }
  },
)

function attachContextMenuListeners(data: TableData, onRowChange?: () => void, signal?: AbortSignal) {
  if (typeof document === 'undefined') return
  let table = document.getElementById('nutzer-table')
  if (!table) return

  table.addEventListener('contextmenu', (e: Event) => {
    let event = e as MouseEvent
    let tr = (event.target as Element)?.closest?.('tr[data-row-id]') as HTMLElement | null
    if (!tr) return

    event.preventDefault()

    let rowId = tr.getAttribute('data-row-id')
    let row = data.rows.find((r) => r.n_id === rowId)
    if (!row) return

    lastRightClickedRow = row
    onRowChange?.()

    // Position hidden trigger at click coordinates and dispatch contextmenu to open menu
    let trigger = document.querySelector<HTMLElement>('[data-nutzer-trigger]')
    if (trigger) {
      trigger.style.left = event.clientX + 'px'
      trigger.style.top = event.clientY + 'px'
      trigger.dispatchEvent(
        new MouseEvent('contextmenu', {
          clientX: event.clientX,
          clientY: event.clientY,
          bubbles: true,
          cancelable: true,
        }),
      )
    }
  }, { capture: true, signal })
}

function handleRowAction(
  row: NutzerRow,
  event: { item: { name: string; value?: string | null } },
  offset: number,
  sortColumn: string,
  sortDirection: 'asc' | 'desc',
  filter: string | undefined,
) {
  let csrfToken =
    document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? ''

  switch (event.item.name) {
    case 'edit': {
      let params = new URLSearchParams()
      params.set('editing', row.n_id)
      params.set('offset', String(offset))
      params.set('sort', sortColumn)
      params.set('order', sortDirection)
      if (filter) params.set('filter', filter)
       window.location.href = '/nutzer?' + params.toString()
      break
    }
    case 'reset-password': {
      if (!confirm(`Passwort für ${row.n_name || row.n_l_login} zurücksetzen?`)) return
      fetch(`/nutzer/${row.n_id}/reset-password`, {
        method: 'POST',
        headers: { 'X-Csrf-Token': csrfToken },
      })
        .then((r) => {
          if (!r.ok) throw new Error()
          return r.json()
        })
        .then(() => {
          showToast(`Passwort für ${row.n_name || row.n_l_login} wurde zurückgesetzt.`, 'success')
          window.location.reload()
        })
        .catch(() => showToast('Fehler beim Zurücksetzen des Passworts.'))
      break
    }
    case 'lock':
    case 'unlock': {
      let newValue = event.item.name === 'lock'
      fetch(`/nutzer/${row.n_id}/toggle-lock`, {
        method: 'POST',
        headers: {
          'X-Csrf-Token': csrfToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ locked: newValue }),
      })
        .then((r) => {
          if (r.ok) window.location.reload()
          else showToast('Fehler beim Ändern des Sperrstatus.')
        })
        .catch(() => showToast('Fehler beim Ändern des Sperrstatus.'))
      break
    }
    case 'activate':
    case 'deactivate': {
      let newValue = event.item.name === 'activate'
      fetch(`/nutzer/${row.n_id}/toggle-active`, {
        method: 'POST',
        headers: {
          'X-Csrf-Token': csrfToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ active: newValue }),
      })
        .then((r) => {
          if (r.ok) window.location.reload()
          else showToast('Fehler beim Ändern des Aktiv-Status.')
        })
        .catch(() => showToast('Fehler beim Ändern des Aktiv-Status.'))
      break
    }
    case 'copy-email': {
      if (!row.n_email) return
      navigator.clipboard.writeText(row.n_email).catch((err) => console.warn('Failed to copy email:', err))
      break
    }
    case 'delete': {
      let name = row.n_name || row.n_l_login
      if (!confirm(`${name} wirklich löschen?`)) return
      fetch(`/nutzer/${row.n_id}`, {
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
          if (r.ok) window.location.reload()
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
