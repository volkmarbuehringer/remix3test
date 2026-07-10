import { clientEntry, css, type Handle } from 'remix/ui'
import { theme } from '../ui/theme/theme.ts'

interface GridState {
  csrfToken: string
}

export const ClientGridInlineEdit = clientEntry(
  import.meta.url + '#ClientGridInlineEdit',
  function ClientGridInlineEdit(handle: Handle) {
    let activeInput: HTMLInputElement | null = null
    let activeCell: HTMLTableCellElement | null = null
    let activeRowId: number | null = null
    let originalValue = ''
    let errorEl: HTMLDivElement | null = null
    let saving = false
    let currentTable: HTMLElement | null = null
    let attachController: AbortController | null = null

    handle.signal.addEventListener('abort', () => {
      cleanup()
      attachController?.abort()
    })

    function cleanup() {
      activeInput = null
      activeCell = null
      activeRowId = null
      originalValue = ''
      errorEl = null
      saving = false
    }

    function onCellClick(e: Event) {
      if (saving) return
      let target = e.target as HTMLElement
      let cell = target.closest<HTMLTableCellElement>('[data-inline-edit]')
      if (!cell) return
      if (activeCell) {
        commitEdit()
        return
      }
      startEdit(cell)
    }

    function onCellKeydown(e: KeyboardEvent) {
      if (e.key !== 'Enter' && e.key !== ' ') return
      let cell = (e.target as HTMLElement).closest<HTMLTableCellElement>('[data-inline-edit]')
      if (!cell) return
      e.preventDefault()
      if (activeCell) {
        commitEdit()
        return
      }
      startEdit(cell)
    }

    return () => {
      let table =
        typeof document !== 'undefined'
          ? document.querySelector<HTMLElement>('#client-grid-content table')
          : null
      if (table && table !== currentTable) {
        attachController?.abort()
        attachController = new AbortController()
        currentTable = table

        table.addEventListener('click', onCellClick)
        table.addEventListener('keydown', onCellKeydown)

        attachController.signal.addEventListener('abort', () => {
          table.removeEventListener('click', onCellClick)
          table.removeEventListener('keydown', onCellKeydown)
        })
      }

      return <div mix={css({ display: 'none' })} />
    }

    function readCsrfToken(): string {
      try {
        let el = document.getElementById('client-grid-state')
        if (el) {
          let state: GridState = JSON.parse(el.textContent || '{}')
          if (state.csrfToken) return state.csrfToken
        }
      } catch (e) {
        console.warn('Failed to read CSRF token from script tag', e)
      }
      return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? ''
    }

    function startEdit(cell: HTMLTableCellElement) {
      if (saving) return
      let row = cell.closest<HTMLTableRowElement>('[data-row-id]')
      if (!row) return

      activeRowId = Number(row.getAttribute('data-row-id'))
      if (!activeRowId) return

      originalValue = cell.textContent?.trim() ?? ''
      activeCell = cell

      let input = document.createElement('input')
      input.type = 'email'
      input.value = originalValue
      input.style.cssText = `width:100%;box-sizing:border-box;padding:2px 4px;font-size:inherit;font-family:inherit;border:1px solid ${theme.colors.action.primary.background};border-radius:4px;outline:none;background:${theme.surface.lvl0};color:${theme.colors.text.primary};`
      input.addEventListener('keydown', onInputKeydown)
      input.addEventListener('blur', onInputBlur)

      cell.textContent = ''
      cell.appendChild(input)
      activeInput = input
      input.focus()
      input.select()
    }

    function onInputKeydown(e: KeyboardEvent) {
      if (e.key === 'Enter') {
        e.preventDefault()
        commitEdit()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        cancelEdit()
      }
    }

    function onInputBlur() {
      if (!saving) commitEdit()
    }

    function commitEdit() {
      if (!activeInput || !activeCell || !activeRowId) return
      let newValue = activeInput.value.trim()
      if (!newValue || newValue === originalValue) {
        revertCell()
        return
      }
      saving = true
      let csrfToken = readCsrfToken()
      let rowId = activeRowId

      fetch(`/admin/client/${rowId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Csrf-Token': csrfToken,
        },
        body: JSON.stringify({ email: newValue }),
      })
        .then(async (res) => {
          if (res.ok) {
            cleanup()
            handle.frame.reload().catch(() => {})
          } else {
            let data = await res.json().catch(() => ({ error: 'Save failed' }))
            saving = false
            showError(data.error || 'Save failed')
          }
        })
        .catch(() => {
          saving = false
          showError('Network error')
        })
    }

    function cancelEdit() {
      revertCell()
    }

    function revertCell() {
      if (activeCell && activeInput) {
        activeCell.textContent = originalValue
      }
      removeError()
      cleanup()
    }

    function showError(msg: string) {
      removeError()
      if (!activeCell || !activeInput) return
      let err = document.createElement('div')
      err.textContent = msg
      err.style.cssText = `color:${theme.colors.action.danger.background};font-size:0.7rem;margin-top:2px;line-height:1.2;`
      activeCell.appendChild(err)
      errorEl = err
      activeInput.focus()
    }

    function removeError() {
      if (errorEl && errorEl.parentNode) {
        errorEl.parentNode.removeChild(errorEl)
      }
      errorEl = null
    }
  },
)
