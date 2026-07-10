import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from './theme/theme.ts'
import { routes } from '../routes.ts'
import { CsrfTokenInput } from './csrf-token-input.tsx'
import type { ChatMessage } from '../types/chatlog.ts'

interface MastraChatPageProps {
  messages: ChatMessage[]
  threadId?: string
  error?: string
  pending?: boolean
  approvalData?: { runId?: string; toolCallId?: string; threadId?: string; responseText?: string }
}

const pageStyle = css({ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 })

const formStyle = css({
  background: theme.surface.lvl0,
  borderRadius: theme.radius.lg,
  padding: theme.space.md,
  flexShrink: 0,
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
  minHeight: '60px',
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

const conversationStyle = css({
  flex: 1,
  minHeight: '50vh',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.md,
})

const messageBubbleStyle = css({
  padding: theme.space.md,
  borderRadius: theme.radius.lg,
  maxWidth: '75%',
})

const userBubbleStyle = css({
  background: theme.colors.action.primary.background,
  color: theme.colors.action.primary.foreground,
  alignSelf: 'flex-end',
  borderBottomRightRadius: '4px',
})

const assistantBubbleStyle = css({
  background: theme.surface.lvl1,
  border: `1px solid ${theme.colors.border.subtle}`,
  alignSelf: 'flex-start',
  borderBottomLeftRadius: '4px',
})

const messageContentStyle = css({
  whiteSpace: 'pre-wrap',
  lineHeight: '1.5',
  fontSize: theme.fontSize.md,
  margin: 0,
})

const messageMetaStyle = css({
  fontSize: theme.fontSize.xxs,
  color: theme.colors.text.muted,
  marginTop: theme.space.xs,
})

const errorBoxStyle = css({
  marginTop: theme.space.xl,
  padding: theme.space.md,
  background: theme.colors.action.danger.background,
  color: theme.colors.action.danger.foreground,
  borderRadius: theme.radius.md,
  fontSize: theme.fontSize.sm,
})

const approvalCardStyle = css({
  marginTop: theme.space.xl,
  padding: theme.space.lg,
  border: `2px solid ${theme.colors.action.danger.background}`,
  borderRadius: theme.radius.lg,
  background: theme.surface.lvl0,
})

const approvalWarningStyle = css({
  color: theme.colors.action.danger.background,
  fontWeight: theme.fontWeight.semibold,
  fontSize: theme.fontSize.lg,
  marginBottom: theme.space.md,
})

const approvalActionsStyle = css({
  display: 'flex',
  gap: theme.space.md,
  marginTop: theme.space.lg,
})

const approveBtnStyle = css({
  padding: '0.6rem 1.5rem',
  background: theme.colors.action.danger.background,
  color: theme.colors.action.danger.foreground,
  border: 'none',
  borderRadius: theme.radius.md,
  fontSize: '1rem',
  cursor: 'pointer',
})

const declineBtnStyle = css({
  padding: '0.6rem 1.5rem',
  background: theme.surface.lvl1,
  color: theme.colors.text.primary,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  fontSize: '1rem',
  cursor: 'pointer',
})

const threadIdStyle = css({
  marginTop: theme.space.md,
  fontSize: theme.fontSize.sm,
  color: theme.colors.text.muted,
})

export function MastraChatPage(handle: Handle<MastraChatPageProps>) {
  return () => {
    let { messages, threadId, error, pending, approvalData } = handle.props
    let showApproval = pending && approvalData?.runId
    return (
      <div mix={pageStyle}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1rem', flexShrink: 0 }}>
          Support-Agent
        </h2>
        <p style={{ color: theme.colors.text.secondary, marginBottom: '1.5rem', flexShrink: 0 }}>
          Frage zu Benutzern, Terminen und Systemdaten.
        </p>

        <div id="chat-messages" mix={conversationStyle}>
          {messages.map((msg, idx) => (
            <div
              key={idx}
              mix={[messageBubbleStyle, msg.role === 'user' ? userBubbleStyle : assistantBubbleStyle]}
            >
              <p mix={messageContentStyle}>{msg.content}</p>
              <div mix={messageMetaStyle}>
                {msg.role === 'user' ? 'Du' : 'Assistent'}
                {msg.timestamp ? ` · ${new Date(msg.timestamp).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}` : ''}
              </div>
            </div>
          ))}
          <div id="chat-end" />
        </div>

        {showApproval && (
          <div mix={approvalCardStyle}>
            <p mix={approvalWarningStyle}>Benutzerkonto löschen?</p>
            <p style={{ marginBottom: theme.space.sm }}>
              {approvalData!.responseText || 'Soll das Benutzerkonto wirklich gelöscht werden?'}
            </p>
            <p style={{ color: theme.colors.text.muted, fontSize: theme.fontSize.sm }}>
              Diese Aktion löscht alle zukünftigen Termine, deaktiviert den Login und verhindert eine erneute Registrierung mit derselben E-Mail-Adresse.
            </p>
            <div mix={approvalActionsStyle}>
              <form method="POST" action={routes.mastra.chat.approve.href()}>
                <CsrfTokenInput />
                <input type="hidden" name="runId" value={approvalData!.runId} />
                <input type="hidden" name="toolCallId" value={approvalData!.toolCallId ?? ''} />
                <input type="hidden" name="threadId" value={threadId ?? approvalData!.threadId} />
                <button type="submit" mix={approveBtnStyle}>✔ Bestätigen</button>
              </form>
              <form method="POST" action={routes.mastra.chat.decline.href()}>
                <CsrfTokenInput />
                <input type="hidden" name="runId" value={approvalData!.runId} />
                <input type="hidden" name="toolCallId" value={approvalData!.toolCallId ?? ''} />
                <input type="hidden" name="threadId" value={threadId ?? approvalData!.threadId} />
                <button type="submit" mix={declineBtnStyle}>✖ Ablehnen</button>
              </form>
            </div>
          </div>
        )}

        {!showApproval && (
          <form method="POST" action={routes.mastra.chat.action.href()} autocomplete="off" mix={formStyle}>
            <CsrfTokenInput />
            {threadId && <input type="hidden" name="threadId" value={threadId} />}
            <label mix={labelStyle} for="message">Deine Frage</label>
            <textarea id="message" name="message" rows={4} required maxLength={5000} mix={textareaStyle} />
            <div>
              <button type="submit" mix={btnStyle}>Senden</button>
            </div>
          </form>
        )}

        {threadId && <p mix={threadIdStyle}>Konversation-ID: {threadId}</p>}

        {error && <div mix={errorBoxStyle}>{error}</div>}
      </div>
    )
  }
}
