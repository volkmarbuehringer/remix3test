import { clientEntry, css, ref, type Handle } from 'remix/ui'

export const ListNameEdit = clientEntry(
  import.meta.url + '#ListNameEdit',
  function ListNameEdit(handle: Handle) {
    return () => (
      <div
        mix={[
          css({ display: 'none' }),
          ref((el) => {
            let pendingEntry: string | null = null
            let pendingTimer: ReturnType<typeof setTimeout> | null = null
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

              let csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
              let headers: Record<string, string> = { 'Content-Type': 'application/json' }
              if (csrfToken) headers['X-Csrf-Token'] = csrfToken

              let entryEl = span.closest('[data-list-id]') as HTMLElement | null
              let updatedAt = entryEl?.getAttribute('data-updated-at')
              if (updatedAt) headers['If-Match'] = updatedAt

              fetch(`/lists/${listId}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({ description: trimmed }),
                signal,
              }).then((response) => {
                if (signal.aborted) return
                if (response.ok) {
                  response.json().then((data) => {
                    if (signal.aborted) return
                    span.textContent = trimmed
                    let link = span.closest('[data-tooltip]')
                    if (link) link.setAttribute('data-tooltip', trimmed)
                    let deleteForm = span.closest('[data-list-id]')?.querySelector('form[data-confirm]')
                    if (deleteForm) {
                      deleteForm.setAttribute('data-confirm', `${trimmed} löschen?`)
                      let deleteBtn = deleteForm.querySelector('button[aria-label]')
                      if (deleteBtn) deleteBtn.setAttribute('aria-label', `Liste "${trimmed}" löschen`)
                    }
                    // Update data-updated-at from response
                    if (entryEl && typeof data.updated_at === 'number') {
                      entryEl.setAttribute('data-updated-at', String(data.updated_at))
                    }
                  }).catch(() => {})
                } else if (response.status === 409) {
                  // Conflict — briefly flash red and abort
                  span.style.color = ''
                  span.style.color = 'var(--color-danger, #e53e3e)'
                  errorTimer = setTimeout(() => { span.style.color = '' }, 2000)
                }
                cancelEdit()
              }).catch((err) => {
                if (err instanceof DOMException && err.name === 'AbortError') return
                cancelEdit()
                span.style.color = ''
                span.style.color = 'var(--color-danger, #e53e3e)'
                errorTimer = setTimeout(() => { span.style.color = '' }, 2000)
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
              input.maxLength = 500
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

            document.addEventListener('click', (e) => {
              let target = e.target as HTMLElement
              let entry = target.closest('[data-list-id]') as HTMLElement | null
              if (!entry) return
              if (target.closest('button, form, input, textarea')) return

              let link = target.closest('[rmx-target]') as HTMLAnchorElement | null
              if (!link) return

              let entryId = entry.getAttribute('data-list-id')
              if (!entryId) return

              e.preventDefault()
              e.stopPropagation()

              if (pendingEntry === entryId) {
                if (pendingTimer) clearTimeout(pendingTimer)
                pendingEntry = null
                pendingTimer = null
                startEditing(entry)
                return
              }

              if (pendingTimer) clearTimeout(pendingTimer)
              pendingEntry = entryId
              pendingTimer = setTimeout(() => {
                pendingEntry = null
                pendingTimer = null
                if (activeInput) return
                let href = link.getAttribute('href')
                if (href && handle.frame) {
                  handle.frame.src = href
                  handle.frame.reload().catch(() => {})
                }
              }, 350)
            }, { capture: true, signal: handle.signal })

            document.addEventListener('keydown', (e) => {
              let target = e.target as HTMLElement
              let entry = target.closest('[data-list-id]') as HTMLElement | null
              if (!entry) return
              if (e.key !== 'Enter' || e.shiftKey) return

              let link = target.closest('[rmx-target]') as HTMLAnchorElement | null
              if (!link) return

              e.preventDefault()
              e.stopPropagation()
              startEditing(entry)
            }, { signal: handle.signal })

            return () => {
              if (pendingTimer) clearTimeout(pendingTimer)
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
