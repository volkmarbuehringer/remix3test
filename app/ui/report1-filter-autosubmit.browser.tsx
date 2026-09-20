import { clientEntry, type Handle } from 'remix/ui'

/**
 * Progressive enhancement for the Monatsauswertung filter bar.
 *
 * The year/month/user controls are plain GET-form selects. Without this entry an
 * admin has to change a control and then press "Auswertung erstellen"; with it,
 * changing any select immediately re-runs the report. The entry renders nothing:
 * it attaches one delegated `change` listener on the document, scoped to the form
 * marked `data-report1-filters`. The submit button stays in the form so the no-JS
 * path still works.
 *
 * Registration follows the vendor guidance for listeners outside the rendered
 * tree (`remix/guides/05-interactivity.md`): schedule the browser-only setup
 * after the client commit, and pass `handle.signal` so the listener is removed
 * when the component disconnects instead of stacking up on soft navigations.
 */
export const Report1FilterAutoSubmit = clientEntry(
  import.meta.url + '#Report1FilterAutoSubmit',
  function Report1FilterAutoSubmit(handle: Handle) {
    handle.queueTask(() => {
      document.addEventListener(
        'change',
        (event) => {
          let target = event.target as HTMLElement | null
          let select = target?.closest('select')
          if (!select) return

          let form = select.closest('form[data-report1-filters]') as HTMLFormElement | null
          form?.requestSubmit()
        },
        { signal: handle.signal },
      )
    })

    return () => null
  },
)
