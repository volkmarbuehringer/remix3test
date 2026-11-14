import { clientEntry, type Handle } from 'remix/component'
import { formatMinOption, formatDateDE } from '../utils/date-utils.ts'

function syncSelection(form: HTMLFormElement): void {
  let confirm = form.querySelector('[data-wizard-confirm]') as HTMLElement | null
  let submit = form.querySelector('[data-wizard-submit]') as HTMLButtonElement | null
  let checked = form.querySelector<HTMLInputElement>('input[name="day_start"]:checked')
  if (submit) submit.disabled = !checked
  if (confirm) {
    if (checked?.value) {
      let [dayMsRaw, minRaw] = checked.value.split(':')
      let dayMs = Number(dayMsRaw)
      let min = Number(minRaw)
      if (Number.isFinite(dayMs) && Number.isFinite(min)) {
        confirm.textContent = `${formatDateDE(dayMs)} – ${formatMinOption(min)} Uhr`
      } else {
        confirm.textContent = 'Bitte wählen Sie eine Uhrzeit.'
      }
    } else {
      confirm.textContent = 'Bitte wählen Sie eine Uhrzeit.'
    }
  }
}

// A delegated document-level listener, because the wizard form is re-rendered
// in place on frame navigation, which can replace the form node; a listener
// bound to the old node would be dropped with it. Scheduled after the client
// commit and scoped to `handle.signal` so a frame swap removes the old entry's
// listener before the replacement entry installs its own (guide 05 §"DOM
// references, global events, and cleanup").
function syncCurrentSelection(): void {
  let form = document.querySelector('[data-wizard-form]')
  if (form instanceof HTMLFormElement) syncSelection(form)
}

export const AppointmentsNewStep2Live = clientEntry(
  import.meta.url + '#AppointmentsNewStep2Live',
  function AppointmentsNewStep2LiveEntry(handle: Handle) {
    handle.queueTask(() => {
      if (typeof document === 'undefined') return
      document.addEventListener(
        'change',
        (event) => {
          let target = event.target
          if (!(target instanceof HTMLElement)) return
          let form = target.closest('[data-wizard-form]')
          if (form instanceof HTMLFormElement) syncSelection(form)
        },
        { signal: handle.signal },
      )
    })

    return () => {
      // The factory closure survives frame DOM swaps, so re-sync on every render
      // rather than only on first mount — otherwise a post-swap validation error
      // leaves the submit button enabled with no time selected.
      handle.queueTask(syncCurrentSelection)
      return null
    }
  },
)
