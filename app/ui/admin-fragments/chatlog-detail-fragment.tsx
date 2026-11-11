import type { Handle } from 'remix/component'
import { css, Fragment } from 'remix/component'
import { theme } from '../../ui/theme/theme.ts'
import { Glyph } from '../../ui/theme/glyph/glyph.tsx'
import type { ChatMessage } from '../../types/chatlog.ts'
import { decodeHtml } from '../../utils/decode-html-entities.ts'
import { routes } from '../../routes.ts'
import { RestfulForm } from '../restful-form.tsx'

interface ChatlogDetailFragmentProps {
  conversationId: string
  messages: ChatMessage[]
  error?: string
  /** Where the dismiss control points when JS is unavailable. */
  closeHref?: string
  /** Id of the list row to return focus to when the pane is dismissed. */
  returnId?: string
  /**
   * Entry URL that resumes this conversation in the support-agent chat. Only
   * present for conversations owned by the current admin; customer and legacy
   * conversations offer {@link claimAction} instead.
   */
  continueHref?: string | undefined
  /**
   * POST target that reassigns a customer/legacy conversation to the current
   * admin, after which it opens in the support-agent chat.
   */
  claimAction?: string | undefined
  /** List URL to return to when an adoption is refused or fails. */
  claimReturnTo?: string | undefined
}

const detailStyle = css({
  background: theme.surface.lvl0,
  borderRadius: theme.radius.lg,
  padding: '1.25rem',
  border: `1px solid ${theme.colors.border.default}`,
  boxShadow: theme.shadow.sm,
})

const headerStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm,
  marginBottom: theme.space.md,
  paddingBottom: theme.space.sm,
  borderBottom: `1px solid ${theme.colors.border.subtle}`,
})

/** Title row: the conversation title keeps the full width while the close
 *  control stays pinned to the panel's top-right corner, like the edit panels. */
const headerTopStyle = css({
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: theme.space.sm,
})

const titleStyle = css({
  fontSize: theme.fontSize.md,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
  margin: 0,
  minWidth: 0,
})

const headerMetaStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.space.sm,
})

/** Header close control, matching the editor panels' icon close button. */
const closeButtonStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '1.75rem',
  height: '1.75rem',
  flexShrink: 0,
  borderRadius: theme.radius.sm,
  color: theme.colors.text.muted,
  textDecoration: 'none',
  '&:hover': { background: theme.surface.lvl3, color: theme.colors.text.primary },
  '&:focus-visible': {
    outline: '2px solid ' + theme.colors.focus.ring,
    outlineOffset: '1px',
  },
})

const continueLinkStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  padding: `3px ${theme.space.sm}`,
  borderRadius: theme.radius.md,
  background: theme.colors.action.primary.background,
  color: theme.colors.action.primary.foreground,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  textDecoration: 'none',
  '&:hover': { opacity: 0.9 },
})

const claimFormStyle = css({ margin: 0, display: 'inline-flex' })

const claimButtonStyle = css({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  padding: `3px ${theme.space.sm}`,
  borderRadius: theme.radius.md,
  border: 'none',
  background: theme.colors.action.primary.background,
  color: theme.colors.action.primary.foreground,
  font: 'inherit',
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  cursor: 'pointer',
  '&:hover': { opacity: 0.9 },
})

const errorStyle = css({
  color: theme.colors.action.danger.background,
  fontSize: theme.fontSize.sm,
  padding: theme.space.md,
  background: theme.surface.lvl1,
  borderRadius: theme.radius.md,
})

const messageListStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm,
  maxHeight: '60vh',
  overflowY: 'auto',
})

const dayHeaderStyle = css({
  alignSelf: 'stretch',
  textAlign: 'center',
  fontSize: theme.fontSize.xxs,
  color: theme.colors.text.muted,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  margin: '4px 0',
})

const messageItemStyle = css({
  padding: theme.space.sm,
  borderRadius: theme.radius.md,
})

const userMessageStyle = css({
  background: theme.colors.action.primary.background,
  color: theme.colors.action.primary.foreground,
  alignSelf: 'flex-end',
})

const assistantMessageStyle = css({
  background: theme.surface.lvl1,
  border: `1px solid ${theme.colors.border.subtle}`,
})

const messageLabelStyle = css({
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  marginBottom: '4px',
  opacity: 0.8,
})

const messageContentStyle = css({
  fontSize: theme.fontSize.sm,
  lineHeight: theme.lineHeight.relaxed,
  margin: 0,
  whiteSpace: 'pre-wrap',
})

const messageMetaStyle = css({
  fontSize: theme.fontSize.xxs,
  marginTop: '4px',
  opacity: 0.6,
})

const emptyStyle = css({
  color: theme.colors.text.muted,
  fontSize: theme.fontSize.sm,
  textAlign: 'center',
  padding: theme.space.xl,
})

/** Derives a human-readable title from the conversation's opening question. */
function conversationTitle(messages: ChatMessage[]): string {
  let firstUser = messages.find((m) => m.role === 'user')
  if (!firstUser) return 'Konversation'
  let text = decodeHtml(firstUser.content).replace(/\s+/g, ' ').trim()
  if (!text) return 'Konversation'
  return text.length > 64 ? text.slice(0, 64) + '…' : text
}

/** `11.09.2026` — used for the per-day separators in the transcript. */
function formatDay(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/** `14:32` — the time shown under every message. */
function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isSameDay(a: number, b: number): boolean {
  let first = new Date(a)
  let second = new Date(b)
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  )
}

export function ChatlogDetailFragment(handle: Handle<ChatlogDetailFragmentProps>) {
  return () => {
    let { messages, error, closeHref, returnId, continueHref, claimAction, claimReturnTo } =
      handle.props
    let displayTitle = conversationTitle(messages)
    let hasError = Boolean(error)
    // The pane renders the transcript oldest-first, so a conversation reads the
    // way it happened. Messages arrive in that order already; a day separator is
    // inserted whenever the calendar day changes.
    let showEmpty = !hasError && messages.length === 0

    return (
      <div
        mix={detailStyle}
        data-chatlog-detail="true"
        data-chatlog-missing={hasError || showEmpty}
      >
        <div mix={headerStyle}>
          <div mix={headerTopStyle}>
            <h3 mix={titleStyle}>{displayTitle}</h3>
            <a
              href={closeHref ?? routes.admin.chatlog.index.href()}
              data-chatlog-close="true"
              data-chatlog-return={returnId ?? ''}
              aria-label="Konversation schließen"
              title="Schließen"
              mix={closeButtonStyle}
            >
              <Glyph name="close" width={14} height={14} />
            </a>
          </div>
          <div mix={headerMetaStyle}>
            <span mix={css({ fontSize: theme.fontSize.xxs, color: theme.colors.text.muted })}>
              {messages.length === 1 ? '1 Nachricht' : `${messages.length} Nachrichten`}
            </span>
            {continueHref ? (
              <a
                href={continueHref}
                data-rmx-document
                data-chatlog-continue="true"
                mix={continueLinkStyle}
              >
                <Glyph name="chat" width={13} height={13} /> Im Chat fortsetzen
              </a>
            ) : claimAction ? (
              <RestfulForm
                method="POST"
                action={claimAction}
                data-rmx-document
                data-confirm="Die Konversation wird dir zugewiesen und im Support-Chat geöffnet. Der bisherige Besitzer sieht sie danach nicht mehr."
                data-confirm-title="Konversation übernehmen"
                data-confirm-label="Übernehmen"
                data-confirm-tone="primary"
                mix={claimFormStyle}
              >
                <input type="hidden" name="_return" value={claimReturnTo ?? ''} />
                <button
                  type="submit"
                  data-chatlog-claim="true"
                  mix={claimButtonStyle}
                  title="Konversation übernehmen und im Support-Chat fortsetzen"
                >
                  <Glyph name="chat" width={13} height={13} /> Übernehmen & fortsetzen
                </button>
              </RestfulForm>
            ) : null}
          </div>
        </div>

        {hasError ? (
          <div mix={errorStyle}>{error}</div>
        ) : showEmpty ? (
          <div mix={emptyStyle}>Diese Konversation enthält keine Nachrichten.</div>
        ) : (
          <div mix={messageListStyle}>
            {messages.map((msg, idx) => {
              let previous = idx > 0 ? messages[idx - 1] : undefined
              let showDay =
                msg.timestamp > 0 &&
                (previous === undefined || !isSameDay(previous.timestamp, msg.timestamp))
              return (
                <Fragment key={idx}>
                  {showDay ? <div mix={dayHeaderStyle}>{formatDay(msg.timestamp)}</div> : null}
                  <div
                    mix={[
                      messageItemStyle,
                      msg.role === 'user' ? userMessageStyle : assistantMessageStyle,
                    ]}
                  >
                    <div mix={messageLabelStyle}>
                      {msg.role === 'user' ? 'Nutzer' : 'Assistent'}
                    </div>
                    <p mix={messageContentStyle}>{decodeHtml(msg.content)}</p>
                    <div mix={messageMetaStyle}>
                      {msg.timestamp ? formatTime(msg.timestamp) : ''}
                    </div>
                  </div>
                </Fragment>
              )
            })}
          </div>
        )}
      </div>
    )
  }
}
