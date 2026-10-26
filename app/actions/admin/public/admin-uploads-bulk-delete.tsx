import { clientEntry, css, ref, type Handle } from 'remix/component'
import { requestConfirmDecision } from '../../../ui/confirm-delete.browser.tsx'
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
 * Listener lifetime: a Frame navigation replaces the server-rendered form/table,
 * but this entry's hidden host node can be reused (so `ref` does not fire) and the
 * `ref` can run before the new form is inserted. `init()` therefore resolves the
 * current nodes on every frame `reloadComplete` — aborting the previous
 * attachment first — so selection keeps working after sort/paginate/filter/delete.
 */
export const UploadBulkDelete = clientEntry(
  import.meta.url + '#UploadBulkDelete',
  function UploadBulkDelete(handle: Handle) {
    let controller: AbortController | null = null

    function init() {
      let form = document.querySelector<HTMLFormElement>('[data-bulk-delete-form]')
      let table = document.querySelector<HTMLElement>('[data-uploads-table]')
      let group = document.querySelector<HTMLElement>('[data-bulk-group]')
      let filterForm = document.querySelector<HTMLFormElement>('[data-uploads-filter]')
      if (!form || !table) return
      let selectAll = table.querySelector<HTMLInputElement>('input[data-select-all]')
      let countEl = form.querySelector<HTMLElement>('[data-selected-count]')
      let submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')
      let clearBtn = document.querySelector<HTMLButtonElement>('[data-clear-selection]')
      if (!selectAll || !countEl || !submit) return

      // Only replace the working attachment once the new DOM is confirmed
      // present. Aborting first would let a transient init (hidden host inserted
      // before the form, or a mid-replacement frame) tear down live listeners and
      // attach none, leaving selection dead and the button stuck disabled.
      controller?.abort()
      let ac = new AbortController()
      controller = ac

      ensureSelectionScope(table.getAttribute('data-selection-scope') ?? '')

      function rowCheckboxes(): HTMLInputElement[] {
        return Array.from(table!.querySelectorAll<HTMLInputElement>('input[name="ids"]'))
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
        // Swap the search/filter toolbar for the bulk actions while rows are
        // selected: the toolbar is server-rendered (so bulk delete still works
        // without JS) but stays out of the way with an empty selection, and the
        // swap keeps the row height stable instead of pushing the grid down.
        // Reveal the group before mutating the live region, otherwise the first
        // "1 ausgewählt" is announced while the region is still hidden.
        if (group) group.hidden = n === 0
        if (filterForm) filterForm.hidden = n > 0
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

      // Ids frozen when the user confirmed. The dialog names N files, so exactly
      // those must be deleted even if the selection changes while it is open —
      // the grid behind the modal is still reachable by keyboard/AT. Also the
      // payload onFormData writes; replaced by the next confirmation.
      let confirmedIds: number[] | null = null
      // Set while re-submitting after the confirmation dialog was accepted, so
      // the second submit pass goes straight through instead of asking again.
      let confirmed = false

      /**
       * Rewrite the outgoing payload to exactly the confirmed ids.
       *
       * The row checkboxes are associated with this form
       * (`form="bulk-delete-form"`) and submit themselves, so a row checked
       * while the dialog was open would otherwise be deleted too. The browser
       * builds the payload from the live form in the `formdata` event — which
       * runs *after* `requestSubmit()` returns (verified in Chromium) — so the
       * ids are replaced here instead of mutating the checkboxes around the
       * submit call. This also carries rows selected on other pages.
       *
       * The event can fire more than once for one submission (Chromium builds
       * the payload again when the frame runtime replays the navigation), so
       * every payload is rewritten while the scope is set; the scope is only
       * set immediately before a confirmed submit and is overwritten by the
       * next confirmation.
       */
      function onFormData(event: FormDataEvent) {
        if (!confirmedIds) return
        event.formData.delete('ids')
        for (let id of confirmedIds) event.formData.append('ids', String(id))
      }

      /** Submit exactly the ids the confirmation named. */
      function submitConfirmed() {
        // A frame reload may have replaced the form while the dialog was open;
        // the detached form cannot submit, so leave the selection untouched.
        if (!form!.isConnected || !confirmedIds) return

        confirmed = true
        try {
          form!.requestSubmit(submit)
        } finally {
          confirmed = false
        }

        // The confirmed rows are gone; anything selected elsewhere (e.g. a row
        // checked while the dialog was open) stays selected for the next action.
        deselectIds(confirmedIds)
      }

      function onSubmit(event: Event) {
        if (confirmed) {
          // Second pass: onFormData writes the confirmed ids into the payload,
          // so let the frame runtime submit.
          return
        }

        let ids = selectedIds()
        let n = ids.length
        if (n === 0) {
          event.preventDefault()
          return
        }

        let message = n === 1 ? '1 Datei wirklich löschen?' : `${n} Dateien wirklich löschen?`

        // Prefer the page's styled confirm dialog so a bulk delete looks the
        // same as deleting a single row. It is not mounted in headless browser
        // tests, so fall back to the native dialog there.
        let decision = requestConfirmDecision({ message, confirmLabel: 'Löschen' })
        if (decision === null) {
          // The native fallback is synchronous, so let an accepted submit
          // continue in this pass. Re-submitting with requestSubmit() from
          // inside a submit listener is ignored (the form is already firing
          // submission events), which would silently cancel the delete.
          if (confirm(message)) {
            confirmedIds = ids
            deselectIds(ids)
          } else {
            event.preventDefault()
          }
          return
        }

        event.preventDefault()
        let confirmedByUser = (accepted: boolean) => {
          if (!accepted) return
          confirmedIds = ids
          submitConfirmed()
        }
        void decision.then(confirmedByUser)
      }

      function onClear() {
        clearSelection()
        for (let cb of rowCheckboxes()) cb.checked = false
        selectAll!.checked = false
        selectAll!.indeterminate = false
        update()
        // The clear control lives inside the toolbar that `update()` just hid;
        // return focus to the search field it was swapped out for instead of
        // dropping it on <body>.
        filterForm?.querySelector<HTMLInputElement>('input[name="filter"]')?.focus()
      }

      selectAll.addEventListener('change', onSelectAllChange, { signal: ac.signal })
      for (let cb of rowCheckboxes()) {
        cb.addEventListener('change', onRowChange, { signal: ac.signal })
      }
      form.addEventListener('submit', onSubmit, { signal: ac.signal })
      form.addEventListener('formdata', onFormData, { signal: ac.signal })
      clearBtn?.addEventListener('click', onClear, { signal: ac.signal })

      // When an individual row is deleted via its own form, drop it from the
      // cross-page selection store — otherwise the "N ausgewählt" count keeps
      // a phantom id that bulk actions then submit. The per-row delete only
      // re-renders after a confirmed submit, so this cleanup only runs when
      // the row is actually being removed.
      for (let delForm of table!.querySelectorAll<HTMLFormElement>('form[data-delete-form]')) {
        let rowId = Number(delForm.getAttribute('data-delete-form'))
        if (Number.isNaN(rowId)) continue
        delForm.addEventListener('submit', () => deselectIds([rowId]), { signal: ac.signal })
      }

      syncRows()
      update()

      // Hydration signal for e2e: the clientEntry attaches listeners
      // asynchronously after the table renders, so tests wait for this
      // attribute before interacting to avoid a hydration race.
      form.dataset.bulkDeleteReady = 'true'
    }

    if (typeof document !== 'undefined') {
      handle.frame.addEventListener('reloadComplete', init, { signal: handle.signal })
    }
    handle.signal.addEventListener('abort', () => {
      controller?.abort()
      controller = null
    })

    return () => (
      <div
        mix={[
          css({ display: 'none' }),
          // Re-run on every insertion; the frame's reloadComplete re-runs it too.
          // Cleanup is owned by the controller created inside init (and
          // handle.signal on disposal), not by this insertion's node removal.
          ref(() => {
            init()
          }),
        ]}
      />
    )
  },
)
