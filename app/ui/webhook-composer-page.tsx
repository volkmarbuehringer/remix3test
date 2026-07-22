import { css } from 'remix/ui'
import { theme } from '../ui/theme/theme.ts'
import { WebhookComposer } from '../ui/webhook-composer.browser.tsx'

export function WebhookComposerPage() {
  return () => (
    <div mix={pageStyle}>
      <h1 mix={titleStyle}>Webhook erstellen</h1>
      <p mix={descStyle}>
        Gib Schlüssel und Werte ein, um einen JSON-Payload für Hermes zu erstellen. Nach dem
        Speichern erscheint der Eintrag in der Tabelle und kann per "Resenden" an Hermes gesendet
        werden.
      </p>
      <WebhookComposer />
    </div>
  )
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
