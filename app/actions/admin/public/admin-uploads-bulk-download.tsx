import { clientEntry, css, ref, type Handle } from 'remix/ui'
import {
  ensureSelectionScope,
  isSelected,
  selectIds,
  deselectIds,
  selectedIds,
  selectedCount,
} from '../../../utils/upload-selection.ts'

/**
 * ClientEntry that wires the uploads multirow download form (`data-bulk-download-form`):
 *
 * - the submit button is disabled when nothing is selected and enabled as soon as
 *   a row checkbox is checked,
 * - selection is kept in the shared, id-based store (`upload-selection.ts`) so it
 *   survives page changes, and on submit every selected id (across pages) is
 *   copied into the form as hidden inputs, because the row checkboxes are
 *   associated to the bulk-delete form (via the HTML `form` attribute) and would
 *   otherwise not be submitted with this form.
 *
 * The form carries `data-rmx-document`, so the browser performs a native document
 * navigation and the ZIP attachment response is downloaded instead of being
 * swallowed by the frame runtime. The store updates in this clientEntry are
 * idempotent with the bulk-delete clientEntry (which shares the same store), so
 * the two can wire the same checkboxes independently.
 */
export const UploadBulkDownload = clientEntry(
  import.meta.url + '#UploadBulkDownload',
  function UploadBulkDownload(handle: Handle) {
    return () => (
      <div
        mix={[
          css({ display: 'none' }),
          ref((_el) => {
            let formNode = document.querySelector<HTMLFormElement>('[data-bulk-download-form]')
            let tableNode = document.querySelector<HTMLElement>('[data-uploads-table]')
            if (!formNode || !tableNode) return
            let form = formNode
            let table = tableNode
            let selectAll = table.querySelector<HTMLInputElement>('input[data-select-all]')
            let submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!

            let scope = table.getAttribute('data-selection-scope') ?? ''
            ensureSelectionScope(scope)

            function rowCheckboxes(): HTMLInputElement[] {
              return Array.from(table.querySelectorAll<HTMLInputElement>('input[name="ids"]'))
            }

            function update() {
              submit.disabled = selectedCount() === 0
            }

            function onSelectAllChange() {
              let checked = selectAll?.checked ?? false
              let visibleIds = rowCheckboxes().map((cb) => Number(cb.value))
              if (checked) selectIds(visibleIds)
              else deselectIds(visibleIds)
              update()
            }

            function onRowChange(changeEvent: Event) {
              let cb = changeEvent.target as HTMLInputElement
              let id = Number(cb.value)
              if (cb.checked) selectIds([id])
              else deselectIds([id])
              update()
            }

            function onSubmit() {
              // Drop hidden inputs injected by a previous submit, then copy every
              // selected id (across pages) into this form so the native
              // submission carries them.
              form.querySelectorAll('input[data-bulk-download-id]').forEach((el) => el.remove())
              for (let id of selectedIds()) {
                let hidden = document.createElement('input')
                hidden.type = 'hidden'
                hidden.name = 'ids'
                hidden.value = String(id)
                hidden.dataset.bulkDownloadId = 'true'
                form.appendChild(hidden)
              }
            }

            // Reflect the store onto the visible checkboxes (restores selection
            // after a page change) without overwriting idempotent store state.
            for (let cb of rowCheckboxes()) {
              cb.checked = isSelected(Number(cb.value))
              cb.addEventListener('change', onRowChange)
            }
            selectAll?.addEventListener('change', onSelectAllChange)
            form.addEventListener('submit', onSubmit)
            update()

            // Hydration signal for e2e: the clientEntry attaches listeners
            // asynchronously after the table renders, so tests wait for this
            // attribute before interacting to avoid a hydration race.
            form.dataset.bulkDownloadReady = 'true'

            handle.signal.addEventListener('abort', () => {
              for (let cb of rowCheckboxes()) {
                cb.removeEventListener('change', onRowChange)
              }
              selectAll?.removeEventListener('change', onSelectAllChange)
              form.removeEventListener('submit', onSubmit)
            })
          }),
        ]}
      />
    )
  },
)
