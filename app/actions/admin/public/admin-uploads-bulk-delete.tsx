import { clientEntry, css, ref, type Handle } from 'remix/ui'
import {
  ensureSelectionScope,
  isSelected,
  selectIds,
  deselectIds,
  selectedIds,
  selectedCount,
  clearSelection,
} from '../../../utils/upload-selection.ts'

/**
 * ClientEntry that wires the uploads multirow delete form (`data-bulk-delete-form`):
 *
 * - the header "select all" checkbox toggles every row checkbox on the page,
 * - the bulk action button label reflects the selected count and is disabled when
 *   nothing is selected,
 * - selection is kept in a shared, id-based store (`upload-selection.ts`) so it
 *   survives page changes, and on submit every selected id (across pages) is
 *   injected into the form as a hidden input,
 * - on submit it confirms with the live count and blocks the submission when the
 *   user cancels (mirroring the ConfirmDelete capture-phase pattern, but scoped
 *   to the bulk form),
 * - a "Auswahl aufheben" control clears the whole selection.
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
          ref((_el) => {
            let formNode = document.querySelector<HTMLFormElement>('[data-bulk-delete-form]')
            let tableNode = document.querySelector<HTMLElement>('[data-uploads-table]')
            if (!formNode || !tableNode) return
            let form = formNode
            let table = tableNode
            let selectAll = table.querySelector<HTMLInputElement>('input[data-select-all]')
            let countEl = form.querySelector<HTMLElement>('[data-selected-count]')
            let submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')
            let clearBtn = document.querySelector<HTMLButtonElement>('[data-clear-selection]')
            if (!selectAll || !countEl || !submit) return

            let scope = table.getAttribute('data-selection-scope') ?? ''
            ensureSelectionScope(scope)

            function rowCheckboxes(): HTMLInputElement[] {
              return Array.from(table.querySelectorAll<HTMLInputElement>('input[name="ids"]'))
            }

            function syncRows() {
              // Reflect the store's selection onto the visible checkboxes, then
              // derive the header checkbox state from the visible page.
              for (let cb of rowCheckboxes()) {
                cb.checked = isSelected(Number(cb.value))
              }
              let visible = rowCheckboxes()
              let all = visible.length > 0 && visible.every((cb) => isSelected(Number(cb.value)))
              let some = visible.length > 0 && visible.some((cb) => isSelected(Number(cb.value)))
              selectAll!.checked = all
              selectAll!.indeterminate = !all && some
            }

            function update() {
              let n = selectedCount()
              countEl!.textContent = `${n} ausgewählt`
              submit!.disabled = n === 0
              if (clearBtn) clearBtn.hidden = n === 0
            }

            function onSelectAllChange() {
              let checked = selectAll!.checked
              let visibleIds = rowCheckboxes().map((cb) => Number(cb.value))
              if (checked) selectIds(visibleIds)
              else deselectIds(visibleIds)
              syncRows()
              update()
            }

            function onRowChange(changeEvent: Event) {
              let cb = changeEvent.target as HTMLInputElement
              let id = Number(cb.value)
              if (cb.checked) selectIds([id])
              else deselectIds([id])
              syncRows()
              update()
            }

            function onSubmit(event: Event) {
              let ids = selectedIds()
              let n = ids.length
              if (n === 0) {
                event.preventDefault()
                return
              }
              if (!confirm(`${n} Dateien wirklich löschen?`)) {
                event.preventDefault()
                return
              }

              // Carry every selected id (across pages) into the form. Clear any
              // ids injected by a previous submit to avoid dupes.
              form.querySelectorAll('input[data-bulk-delete-id]').forEach((el) => el.remove())
              for (let id of ids) {
                let hidden = document.createElement('input')
                hidden.type = 'hidden'
                hidden.name = 'ids'
                hidden.value = String(id)
                hidden.dataset.bulkDeleteId = 'true'
                form.appendChild(hidden)
              }
              // The submitted rows are being deleted, so drop them from the store.
              clearSelection()
            }

            function onClear() {
              clearSelection()
              for (let cb of rowCheckboxes()) cb.checked = false
              selectAll!.checked = false
              selectAll!.indeterminate = false
              update()
            }

            selectAll.addEventListener('change', onSelectAllChange)
            for (let cb of rowCheckboxes()) {
              cb.addEventListener('change', onRowChange)
            }
            form.addEventListener('submit', onSubmit)
            clearBtn?.addEventListener('click', onClear)

            // When an individual row is deleted via its own form, drop it from the
            // cross-page selection store — otherwise the "N ausgewählt" count keeps
            // a phantom id that bulk actions then submit. The per-row delete only
            // re-renders after a confirmed submit, so this cleanup only runs when
            // the row is actually being removed.
            let deleteCleanups = new Map<HTMLFormElement, () => void>()
            for (let delForm of table.querySelectorAll<HTMLFormElement>('form[data-delete-form]')) {
              let rowId = Number(delForm.getAttribute('data-delete-form'))
              if (Number.isNaN(rowId)) continue
              let cleanup = () => deselectIds([rowId])
              deleteCleanups.set(delForm, cleanup)
              delForm.addEventListener('submit', cleanup)
            }

            syncRows()
            update()

            // Hydration signal for e2e: the clientEntry attaches listeners
            // asynchronously after the table renders, so tests wait for this
            // attribute before interacting to avoid a hydration race.
            form.dataset.bulkDeleteReady = 'true'

            handle.signal.addEventListener('abort', () => {
              selectAll.removeEventListener('change', onSelectAllChange)
              for (let cb of rowCheckboxes()) {
                cb.removeEventListener('change', onRowChange)
              }
              form.removeEventListener('submit', onSubmit)
              clearBtn?.removeEventListener('click', onClear)
              for (let [delForm, cleanup] of deleteCleanups) {
                delForm.removeEventListener('submit', cleanup)
              }
            })
          }),
        ]}
      />
    )
  },
)
