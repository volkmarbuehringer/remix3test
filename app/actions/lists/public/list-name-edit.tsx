import { clientEntry, css, ref, type Handle } from 'remix/ui'

export const ListNameEdit = clientEntry(
  import.meta.url + '#ListNameEdit',
  function ListNameEdit(handle: Handle) {
    return () => (
      <div
        mix={[
          css({ display: 'none' }),
          ref((el) => {
            let activeInput: HTMLInputElement | null = null
            let originalSpan: HTMLElement | null = null
            let originalText = ''
            let currentListId: number | null = null
            let renameController: AbortController | null = null
            let errorTimer: ReturnType<typeof setTimeout> | null = null

            function cancelEdit() {
              if (errorTimer) clearTimeout(errorTimer)
              if (activeInput && originalSpan) {
                originalSpan.style.display = ''
                activeInput.remove()
              }
              renameController = null
              activeInput = null
              originalSpan = null
              originalText = ''
              currentListId = null
            }

            function finishEdit(newDescription: string) {
              if (!activeInput || !originalSpan || currentListId === null) {
                return
              }
              let trimmed = newDescription.trim()
              if (!trimmed || trimmed === originalText) {
                cancelEdit()
                return
              }

              renameController?.abort()
              renameController = new AbortController()
              let signal = renameController.signal
              let listId = currentListId
              let span = originalSpan

              let csrfToken = document
                .querySelector('meta[name="csrf-token"]')
                ?.getAttribute('content')
              let headers: Record<string, string> = { 'Content-Type': 'application/json' }
              if (csrfToken) headers['X-Csrf-Token'] = csrfToken

              let entryEl = span.closest('[data-list-id]') as HTMLElement | null
              let updatedAt = entryEl?.getAttribute('data-updated-at')
              if (updatedAt) headers['If-Match'] = updatedAt

              fetch(`/lists/${listId}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({ title: trimmed }),
                signal,
              })
                .then((response) => {
                  if (signal.aborted) return
                  if (response.ok) {
                    // Reload the frame so the sidebar and the editor both
                    // re-render from the server with the new title. Any pending
                    // editor edits are flushed by the list's beforeunload beacon.
                    handle.frame.reload().catch(() => {})
                  } else if (response.status === 409) {
                    // Conflict — briefly flash red and abort
                    span.style.color = ''
                    span.style.color = 'var(--color-danger, #e53e3e)'
                    errorTimer = setTimeout(() => {
                      span.style.color = ''
                    }, 2000)
                  }
                  cancelEdit()
                })
                .catch((err) => {
                  if (err instanceof DOMException && err.name === 'AbortError') return
                  cancelEdit()
                  span.style.color = ''
                  span.style.color = 'var(--color-danger, #e53e3e)'
                  errorTimer = setTimeout(() => {
                    span.style.color = ''
                  }, 2000)
                })
            }

            function startEditing(entry: HTMLElement) {
              if (activeInput) return
              let nameSpan = entry.querySelector('[data-list-name]') as HTMLElement | null
              if (!nameSpan) return
              let entryId = entry.getAttribute('data-list-id')
              if (!entryId) return

              let parsedId = Number(entryId)
              if (!Number.isFinite(parsedId)) return

              originalSpan = nameSpan
              originalText = nameSpan.textContent || ''
              currentListId = parsedId

              let input = document.createElement('input')
              input.type = 'text'
              input.value = originalText
              input.maxLength = 200
              input.style.cssText = `
                font: inherit;
                color: inherit;
                background: transparent;
                border: none;
                border-bottom: 1px solid;
                padding: 0;
                margin: 0;
                outline: none;
                width: 100%;
              `

              input.addEventListener('keydown', (ke: KeyboardEvent) => {
                if (ke.key === 'Escape') {
                  ke.preventDefault()
                  cancelEdit()
                } else if (ke.key === 'Enter') {
                  ke.preventDefault()
                  finishEdit(input.value)
                }
              })

              input.addEventListener('blur', () => {
                finishEdit(input.value)
              })

              nameSpan.style.display = 'none'
              nameSpan.parentNode?.insertBefore(input, nameSpan.nextSibling)
              input.focus()
              input.select()
              activeInput = input
            }

            document.addEventListener(
              'click',
              (e) => {
                let target = e.target as HTMLElement
                let renameBtn = target.closest('[data-list-rename-btn]') as HTMLElement | null
                if (!renameBtn) return
                e.preventDefault()
                e.stopPropagation()
                let entry = renameBtn.closest('[data-list-id]') as HTMLElement | null
                if (entry) startEditing(entry)
              },
              { capture: true, signal: handle.signal },
            )

            return () => {
              if (errorTimer) clearTimeout(errorTimer)
              renameController?.abort()
              if (activeInput && originalSpan) {
                originalSpan.style.display = ''
                activeInput.remove()
              }
            }
          }),
        ]}
      />
    )
  },
)
