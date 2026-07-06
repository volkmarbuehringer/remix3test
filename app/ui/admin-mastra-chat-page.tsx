import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from './theme/theme.ts'
import { routes } from '../routes.ts'
import { CsrfTokenInput } from './csrf-token-input.tsx'

interface MastraChatPageProps {
  response?: string
  threadId?: string
  error?: string
}

const pageStyle = css({ maxWidth: '800px', margin: '0 auto' })

const formStyle = css({
  background: theme.surface.lvl0,
  borderRadius: theme.radius.lg,
  padding: theme.space.xl,
  border: `1px solid ${theme.colors.border.default}`,
  boxShadow: theme.shadow.sm,
})

const labelStyle = css({
  display: 'block',
  fontSize: theme.fontSize.lg,
  fontWeight: theme.fontWeight.semibold,
  marginBottom: theme.space.md,
  color: theme.colors.text.primary,
})

const textareaStyle = css({
  width: '100%',
  minHeight: '100px',
  padding: theme.space.md,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  fontFamily: 'inherit',
  fontSize: theme.fontSize.lg,
  color: theme.colors.text.primary,
  background: theme.surface.lvl1,
  resize: 'vertical',
  outline: 'none',
  boxSizing: 'border-box',
})

const btnStyle = css({
  display: 'inline-block',
  padding: '0.6rem 1.5rem',
  marginTop: theme.space.md,
  background: theme.colors.action.primary.background,
  color: theme.colors.action.primary.foreground,
  border: 'none',
  borderRadius: theme.radius.md,
  fontSize: '1rem',
  cursor: 'pointer',
  '&:hover': { background: theme.colors.action.primary.backgroundHover },
})

const resultStyle = css({
  marginTop: theme.space.xl,
  background: theme.surface.lvl0,
  borderRadius: theme.radius.lg,
  padding: theme.space.xl,
  border: `1px solid ${theme.colors.border.default}`,
  boxShadow: theme.shadow.sm,
})

const resultLabelStyle = css({
  fontSize: theme.fontSize.sm,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.secondary,
  marginBottom: theme.space.sm,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
})

const resultTextStyle = css({
  whiteSpace: 'pre-wrap',
  lineHeight: '1.6',
  fontSize: theme.fontSize.lg,
  color: theme.colors.text.primary,
})

const errorBoxStyle = css({
  marginTop: theme.space.xl,
  padding: theme.space.md,
  background: theme.colors.action.danger.background,
  color: theme.colors.action.danger.foreground,
  borderRadius: theme.radius.md,
  fontSize: theme.fontSize.sm,
})

export function MastraChatPage(handle: Handle<MastraChatPageProps>) {
  return () => {
    let { response, threadId, error } = handle.props
    return (
      <div mix={pageStyle}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem' }}>
          Support-Agent
        </h2>
        <p style={{ color: theme.colors.text.secondary, marginBottom: '1.5rem' }}>
          Frage zu Benutzern, Terminen und Systemdaten.
        </p>

        <form method="POST" action={routes.mastra.chat.action.href()} autocomplete="off" mix={formStyle}>
          <CsrfTokenInput />
          {threadId && <input type="hidden" name="threadId" value={threadId} />}
          <label mix={labelStyle} for="message">Deine Frage</label>
          <textarea id="message" name="message" rows={4} required maxLength={5000} mix={textareaStyle} />
          <div>
            <button type="submit" mix={btnStyle}>Senden</button>
          </div>
        </form>

        {response && (
          <div mix={resultStyle}>
            <div mix={resultLabelStyle}>Antwort</div>
            <div mix={resultTextStyle}>{response}</div>
            {threadId && (
              <p style={{ marginTop: '0.75rem', fontSize: theme.fontSize.sm, color: theme.colors.text.muted }}>
                Konversation-ID: {threadId}
              </p>
            )}
          </div>
        )}

        {error && <div mix={errorBoxStyle}>{error}</div>}
      </div>
    )
  }
}
