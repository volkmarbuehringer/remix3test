import { clientEntry, css, on, type Handle, type SerializableProps } from 'remix/ui'
import { Button } from 'remix/ui/button'
import { Glyph } from 'remix/ui/glyph'
import { theme } from 'remix/ui/theme'

interface AdminActionButtonProps extends SerializableProps {
  action: string
  method: string
  label: string
  pendingLabel: string
  confirmMsg?: string
  compact?: boolean
}

const compactBtnStyle = css({
  minHeight: '28px',
  height: '28px',
  width: '28px',
  paddingInline: '0',
})

export const AdminActionButton = clientEntry(
  import.meta.url + '#AdminActionButton',
  function AdminActionButton(handle: Handle<AdminActionButtonProps>) {
    let pending = false

    return () => {
      let { action, method, label, pendingLabel, confirmMsg, compact } = handle.props

      let clickHandler = on<HTMLButtonElement>('click', async (event, signal) => {
        if (confirmMsg && !confirm(confirmMsg)) return
        if (pending) return

        pending = true
        handle.update()

        let form = event.currentTarget.closest('form')
        if (!form) {
          pending = false
          handle.update()
          return
        }
        let formData = new FormData(form)

        try {
          await fetch(action, {
            method: method || 'POST',
            body: formData,
            redirect: 'manual',
          })

          if (signal.aborted) return
          await handle.frame.reload()

          pending = false
          handle.update()
        } catch {
          pending = false
          handle.update()
        }
      })

      return (
        <Button
          type="button"
          tone={confirmMsg ? 'danger' : 'secondary'}
          disabled={pending}
          aria-label={compact ? (pending ? pendingLabel : label) : undefined}
          title={compact ? (pending ? pendingLabel : label) : undefined}
          mix={compact ? [compactBtnStyle, clickHandler, css({ opacity: pending ? 0.6 : undefined })] : [clickHandler, css({ opacity: pending ? 0.6 : undefined })]}
        >
          {compact ? (
            <Glyph name={pending ? 'spinner' : 'trash'} width={16} height={16} />
          ) : pending ? (
            pendingLabel
          ) : (
            label
          )}
        </Button>
      )
    }
  },
)
