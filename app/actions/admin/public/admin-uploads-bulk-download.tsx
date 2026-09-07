import { clientEntry, css, ref, type Handle } from 'remix/ui'

/**
 * ClientEntry that wires the uploads multirow download form (`data-bulk-download-form`):
 *
 * - the submit button is disabled when nothing is selected and enabled as soon as
 *   a row checkbox is checked (sharing the same `[data-uploads-table] input[name="ids"]`
 *   checkboxes as the bulk delete form),
 * - on submit it copies the currently checked row ids into the form as hidden
 *   inputs, because the row checkboxes are associated to the bulk-delete form via
 *   the HTML `form` attribute and would otherwise not be submitted with this form.
 *
 * The form carries `data-rmx-document`, so the browser performs a native document
 * navigation and the ZIP attachment response is downloaded instead of being
 * swallowed by the frame runtime. Selection state is read live from the DOM on
 * each change so it survives the frame re-render, and all listeners are removed
 * on abort.
 */
export const UploadBulkDownload = clientEntry(
  import.meta.url + '#UploadBulkDownload',
  function UploadBulkDownload(handle: Handle) {
    return () => (
      <div
        mix={[
          css({ display: 'none' }),
          ref((el) => {
            let form = document.querySelector<HTMLFormElement>('[data-bulk-download-form]')
            if (!form) return
            let bulkForm = form

            let rows = document.querySelectorAll<HTMLInputElement>(
              '[data-uploads-table] input[name="ids"]',
            )
            // The bulk-delete clientEntry toggles every row checkbox
            // programmatically when the header "select all" is clicked, which
            // does not dispatch `change` events on the rows — so the download
            // button must also update when the select-all checkbox itself
            // changes, or it would stay disabled after a select-all.
            let selectAll = document.querySelector<HTMLInputElement>(
              '[data-uploads-table] input[data-select-all]',
            )
            let submit = bulkForm.querySelector<HTMLButtonElement>('button[type="submit"]')

            function selectedCount(): number {
              return Array.from(rows).filter((cb) => cb.checked).length
            }

            function update() {
              if (submit) submit.disabled = selectedCount() === 0
            }

            function onRowChange() {
              update()
            }

            function onSubmit() {
              // Drop hidden inputs injected by a previous submit, then copy the
              // checked row ids into this form so the native submission carries
              // them (the row checkboxes belong to the bulk-delete form).
              bulkForm.querySelectorAll('input[data-bulk-download-id]').forEach((el) => el.remove())
              rows.forEach((cb) => {
                if (cb.checked) {
                  let hidden = document.createElement('input')
                  hidden.type = 'hidden'
                  hidden.name = 'ids'
                  hidden.value = cb.value
                  hidden.dataset.bulkDownloadId = 'true'
                  bulkForm.appendChild(hidden)
                }
              })
            }

            selectAll?.addEventListener('change', onRowChange)
            rows.forEach((cb) => cb.addEventListener('change', onRowChange))
            bulkForm.addEventListener('submit', onSubmit)
            update()
            // Hydration signal for e2e: the clientEntry attaches listeners
            // asynchronously after the table renders, so tests wait for this
            // attribute before interacting to avoid a hydration race.
            bulkForm.dataset.bulkDownloadReady = 'true'

            handle.signal.addEventListener('abort', () => {
              selectAll?.removeEventListener('change', onRowChange)
              rows.forEach((cb) => cb.removeEventListener('change', onRowChange))
              bulkForm.removeEventListener('submit', onSubmit)
            })
          }),
        ]}
      />
    )
  },
)
