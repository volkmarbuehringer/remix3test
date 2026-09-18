import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from '../ui/theme/theme.ts'
import { WebhookComposer } from '../actions/admin/webhook-requests/public/webhook-composer.tsx'

interface AdminWebhookComposerPageProps {
  formError?: string | undefined
  initialPayload?: string | undefined
}

export function AdminWebhookComposerPage(handle: Handle<AdminWebhookComposerPageProps>) {
  return () => {
    let { formError, initialPayload } = handle.props
    return (
      <div mix={pageStyle}>
        <h1 mix={titleStyle}>Webhook erstellen</h1>
        <p mix={descStyle}>
          Gib Schlüssel und Werte ein, um einen JSON-Payload für Hermes zu erstellen. Nach dem
          Speichern erscheint der Eintrag in der Tabelle und kann per "Resenden" an Hermes gesendet
          werden.
        </p>
        {formError ? (
          <p role="alert" mix={errorStyle}>
            {formError}
          </p>
        ) : null}
        <WebhookComposer initialPayload={initialPayload} />
      </div>
    )
  }
}

const pageStyle = css({
  maxWidth: '700px',
  margin: '0 auto',
  padding: theme.space.xl,
})

const titleStyle = css({
  margin: `0 0 ${theme.space.sm}`,
  fontSize: theme.fontSize.xxl,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
})

const descStyle = css({
  margin: `0 0 ${theme.space.lg}`,
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.sm,
})

const errorStyle = css({
  margin: '0 0 ' + theme.space.md,
  padding: theme.space.sm,
  background: theme.colors.action.danger.background,
  color: theme.colors.action.danger.foreground,
  borderRadius: theme.radius.md,
  fontSize: theme.fontSize.sm,
})
