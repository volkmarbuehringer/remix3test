import { clientEntry, css, ref, type Handle } from 'remix/ui'

/**
 * ClientEntry that wires the uploads multirow delete form (`data-bulk-delete-form`):
 *
 * - the header "select all" checkbox toggles every row checkbox on the page,
 * - the bulk action button label reflects the selected count and is disabled when
 *   nothing is selected,
 * - on submit it confirms with the live count ("N Dateien wirklich löschen?") and
 *   blocks the submission when the user cancels (mirroring the ConfirmDelete
 *   capture-phase pattern, but scoped to the bulk form).
 *
 * Selection/state is read live from the DOM on each change so it survives the
 * frame re-render, and all listeners are removed on abort.
 */
export const UploadBulkDelete = clientEntry(
  import.meta.url + '#UploadBulkDelete',
  function UploadBulkDelete(handle: Handle) {
    return () => (
      <div
        mix={[
          css({ display: 'none' }),
          ref((el) => {
            let form = document.querySelector<HTMLFormElement>('[data-bulk-delete-form]')
            if (!form) return

            // The row checkboxes are outside the form element (associated to it
            // via the HTML `form` attribute, so the per-row delete forms are not
            // nested), so query them at the table scope.
            let selectAll = document.querySelector<HTMLInputElement>(
              '[data-uploads-table] input[data-select-all]',
            )
            let rows = document.querySelectorAll<HTMLInputElement>(
              '[data-uploads-table] input[name="ids"]',
            )
            let countEl = form.querySelector<HTMLElement>('[data-selected-count]')
            let submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')

            function selectedCount(): number {
              return Array.from(rows).filter((cb) => cb.checked).length
            }

            function update() {
              let n = selectedCount()
              if (countEl) countEl.textContent = `${n} ausgewählt`
              if (submit) submit.disabled = n === 0
            }

            function onSelectAllChange() {
              let checked = selectAll?.checked ?? false
              rows.forEach((cb) => {
                cb.checked = checked
              })
              update()
            }

            function onRowChange() {
              if (selectAll) {
                let all =
                  rows.length > 0 && Array.from(rows).every((cb) => cb.checked)
                selectAll.checked = all
              }
              update()
            }

            function onSubmit(event: Event) {
              let n = selectedCount()
              if (n === 0) {
                event.preventDefault()
                return
              }
              if (!confirm(`${n} Dateien wirklich löschen?`)) {
                event.preventDefault()
              }
            }

            selectAll?.addEventListener('change', onSelectAllChange)
            rows.forEach((cb) => cb.addEventListener('change', onRowChange))
            form.addEventListener('submit', onSubmit)
            update()

            handle.signal.addEventListener('abort', () => {
              selectAll?.removeEventListener('change', onSelectAllChange)
              rows.forEach((cb) => cb.removeEventListener('change', onRowChange))
              form.removeEventListener('submit', onSubmit)
            })
          }),
        ]}
      />
    )
  },
)
