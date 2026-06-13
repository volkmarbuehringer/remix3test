import { clientEntry, css, ref, type Handle } from 'remix/ui'

export const ConfirmDelete = clientEntry(
  import.meta.url + '#ConfirmDelete',
  function ConfirmDelete(handle: Handle) {
    return () => (
      <div
        mix={[
          css({ display: 'none' }),
          ref((el) => {
            document.addEventListener('click', (e) => {
              let target = e.target as HTMLElement
              let btn = target.closest('button[type="submit"]') as HTMLButtonElement | null
              if (!btn) return
              let form = btn.closest('form[data-confirm]') as HTMLFormElement | null
              if (!form) return
              let message = form.getAttribute('data-confirm') || 'Wirklich löschen?'
              if (!confirm(message)) {
                e.preventDefault()
                e.stopPropagation()
              }
            }, { capture: true, signal: handle.signal })
          }),
        ]}
      />
    )
  },
)
