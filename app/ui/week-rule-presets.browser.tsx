import { clientEntry, css, ref, type Handle } from 'remix/component'

const hiddenStyle = css({ display: 'none' })

/** Weekdays that the "Mo–Fr" preset selects. */
const WEEKDAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']

interface DayRow {
  key: string
  toggle: HTMLInputElement | null
  start: HTMLSelectElement | null
  end: HTMLSelectElement | null
}

function dayRows(form: HTMLFormElement): DayRow[] {
  return Array.from(form.querySelectorAll<HTMLElement>('[data-week-day]')).map((row) => ({
    key: row.dataset.weekDay ?? '',
    toggle: row.querySelector<HTMLInputElement>('input[type="checkbox"]'),
    start: row.querySelector<HTMLSelectElement>('[data-week-start]'),
    end: row.querySelector<HTMLSelectElement>('[data-week-end]'),
  }))
}

function notify(el: Element): void {
  // "input" first: the app's dirty-form guard and any future live previews
  // listen to both, and a programmatic change would otherwise be invisible.
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

function setChecked(toggle: HTMLInputElement | null, checked: boolean): void {
  if (!toggle || toggle.checked === checked) return
  toggle.checked = checked
  notify(toggle)
}

function setTime(select: HTMLSelectElement | null, value: string): void {
  if (!select || select.value === value) return
  select.value = value
  notify(select)
}

/**
 * Quick presets for the weekly rule editor.
 *
 * A configuration is usually "Mo–Fr, same hours" or "every day, same hours".
 * Without presets that means seven checkbox clicks plus up to fourteen select
 * changes — and copying one day's hours to the rest by hand. The presets are
 * server-rendered buttons that only become visible once this entry has wired
 * them, so a no-JS visitor never sees controls that do nothing.
 *
 * Rendered inside the panel form; the buttons live in the `[data-week-presets]`
 * container.
 */
export const WeekRulePresets = clientEntry(
  import.meta.url + '#WeekRulePresets',
  function WeekRulePresetsEntry(_handle: Handle) {
    return () => (
      <span
        data-week-presets-entry="true"
        mix={[
          hiddenStyle,
          ref((el, signal) => {
            if (!el || typeof document === 'undefined') return
            let form = el.closest('form')
            if (!form) return
            let bar = form.querySelector<HTMLElement>('[data-week-presets]')
            if (!bar) return
            let status = bar.querySelector<HTMLElement>('[data-week-preset-status]')
            let copyButton = bar.querySelector<HTMLButtonElement>('[data-week-preset="copy"]')

            /** "Zeiten übertragen" only makes sense with at least one active day. */
            function syncCopyButton(): void {
              if (!copyButton) return
              copyButton.disabled = !dayRows(form!).some((row) => row.toggle?.checked)
            }

            function announce(message: string): void {
              if (status) status.textContent = message
            }

            function apply(preset: string): void {
              let rows = dayRows(form!)
              if (preset === 'weekdays' || preset === 'all') {
                let enabled = preset === 'all' ? rows.map((row) => row.key) : WEEKDAY_KEYS
                for (let row of rows) setChecked(row.toggle, enabled.includes(row.key))
                announce(preset === 'all' ? 'Alle Tage aktiviert' : 'Mo–Fr aktiviert')
              } else if (preset === 'none') {
                for (let row of rows) setChecked(row.toggle, false)
                announce('Alle Tage deaktiviert')
              } else if (preset === 'copy') {
                // First active day in week order is the template, so a user who
                // only checked Wednesday copies Wednesday's hours everywhere.
                let source = rows.find((row) => row.toggle?.checked)
                if (!source?.start || !source.end) return
                let start = source.start.value
                let end = source.end.value
                for (let row of rows) {
                  if (!row.toggle?.checked || row.key === source.key) continue
                  setTime(row.start, start)
                  setTime(row.end, end)
                }
                announce('Zeiten auf alle aktiven Tage übertragen')
              }
              syncCopyButton()
            }

            bar.addEventListener(
              'click',
              (event) => {
                let button = (event.target as Element | null)?.closest<HTMLButtonElement>(
                  '[data-week-preset]',
                )
                if (!button || !bar.contains(button) || button.disabled) return
                let preset = button.dataset.weekPreset
                if (!preset) return
                // Buttons live inside the form; never let a preset submit it.
                event.preventDefault()
                apply(preset)
              },
              { signal },
            )

            // Keep the copy button in sync with manual checkbox changes too.
            form.addEventListener('change', syncCopyButton, { signal })

            syncCopyButton()
            bar.setAttribute('data-week-presets-ready', 'true')
          }),
        ]}
      />
    )
  },
)
