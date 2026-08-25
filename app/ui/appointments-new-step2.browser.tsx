import { clientEntry, type Handle } from 'remix/ui'
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
        confirm.textContent = 'Noch keine Uhrzeit gewählt.'
      }
    } else {
      confirm.textContent = 'Noch keine Uhrzeit gewählt.'
    }
  }
}

export const AppointmentsNewStep2Live = clientEntry(
  import.meta.url + '#AppointmentsNewStep2Live',
  function AppointmentsNewStep2LiveEntry(handle: Handle) {
    let initialized = false

    return () => {
      if (!initialized && typeof document !== 'undefined') {
        initialized = true
        let form = document.querySelector('[data-wizard-form]') as HTMLFormElement | null
        if (form) {
          form.addEventListener('change', () => syncSelection(form), { signal: handle.signal })
          syncSelection(form)
        }
      }
      return null
    }
  },
)
