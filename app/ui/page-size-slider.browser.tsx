import { clientEntry, type Handle } from 'remix/component'

/**
 * Live readout for the "Einträge pro Seite" slider.
 *
 * The range input is a plain form control that posts `pageSize`; this entry
 * only mirrors its value into the <output> while the user drags, so the chosen
 * number stays visible before the form is saved. Registration follows the
 * listener guidance (queueTask after commit + `handle.signal` cleanup) so the
 * delegated listener is removed when the settings frame is torn down.
 */
export const PageSizeSlider = clientEntry(
  import.meta.url + '#PageSizeSlider',
  function PageSizeSliderEntry(handle: Handle) {
    handle.queueTask(() => {
      document.addEventListener(
        'input',
        (event) => {
          let target = event.target
          if (!(target instanceof HTMLInputElement)) return
          if (target.type !== 'range' || target.name !== 'pageSize') return
          let control = target.closest('[data-page-size-control]')
          let output = control?.querySelector('[data-page-size-output]')
          if (output) output.textContent = target.value
        },
        { signal: handle.signal },
      )
    })

    return () => null
  },
)
