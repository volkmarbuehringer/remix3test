import { clientEntry, css, on, type Handle, type SerializableProps } from 'remix/ui'
import { Button } from 'remix/ui/button'
import { GridStateHiddenInputs } from '../ui/grid-state-hidden.tsx'

const smallBtnStyle = css({
  minHeight: '1.75rem',
  paddingInline: '0.5rem',
  fontSize: '0.75rem',
})

interface DelButtonProps extends SerializableProps {
  action: string
  offset: string
  sort: string
  order: string
  filterValue: string
}

export const DelButton = clientEntry(
  import.meta.url,
  function DelButton(handle: Handle<DelButtonProps>) {
    return () => {
      let { action, offset, sort, order, filterValue } = handle.props

      return (
        <form method="POST" action={action} mix={on('submit', async (event, signal) => {
          event.preventDefault()
          if (!confirm('Delete this row?')) return
          let form = event.currentTarget as HTMLFormElement
          let formData = new FormData(form)
          formData.set('_method', 'DELETE')
          let csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
          if (csrfToken) formData.set('_csrf', csrfToken)
          try {
            await fetch(action, {
              method: 'POST',
              body: formData,
              redirect: 'manual',
              signal,
            })
            await handle.frame?.reload()
          } catch {
            // frame reload handles error state
          }
        })}>
          <GridStateHiddenInputs state={{ offset, sort, order, filter: filterValue }} />
          <Button type="submit" tone="danger" mix={[smallBtnStyle]}>Del</Button>
        </form>
      )
    }
  },
)
