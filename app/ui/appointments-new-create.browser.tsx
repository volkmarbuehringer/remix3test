import { clientEntry, type Handle } from 'remix/ui'

// On mobile the create/delete panel is stacked below the list (the two-column
// grid collapses to a single column), so after a step change or "Neu" tap the
// panel sits below the fold. This scrolls the panel into view on small screens
// so the user lands on the form instead of the top of the list.
export const CreatePanelScrollLive = clientEntry(
  import.meta.url + '#CreatePanelScrollLive',
  function CreatePanelScrollLiveEntry(handle: Handle) {
    let ran = false
    return () => {
      if (ran || typeof document === 'undefined') return
      ran = true
      let panel = document.querySelector<HTMLElement>('[data-create-panel]')
      if (panel && window.matchMedia('(max-width: 768px)').matches) {
        panel.style.scrollMarginTop = '4.5rem'
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
  },
)
