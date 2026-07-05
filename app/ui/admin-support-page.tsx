import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from '../ui/theme/theme.ts'
import { Glyph } from '../ui/theme/glyph.ts'
import button from '../ui/theme/button.ts'
import { routes } from '../routes.ts'
import { CsrfTokenInput } from './csrf-token-input.tsx'
import { FormLoadingState } from './form-loading-state.tsx'
import { decodeHtml } from '../utils/decode-html-entities.ts'
import type { ChatMessage } from '../data/chatlog.ts'

interface AdminSupportPageProps {
  messages: ChatMessage[]
  agentId?: string
  error?: string
}

const wrapperStyle = css({
  display: 'flex',
  flexDirection: 'column',
  height: 'calc(100vh - 260px)',
  minHeight: '400px',
  maxHeight: '700px',
  background: theme.surface.lvl0,
  borderRadius: theme.radius.xl,
  boxShadow: theme.shadow.md,
  overflow: 'hidden',
  border: `1px solid ${theme.colors.border.default}`,
})

const messagesStyle = css({
  flex: 1,
  overflowY: 'auto',
  padding: theme.space.lg,
  background: theme.surface.lvl1,
  display: 'flex',
  flexDirection: 'column',
})

const listStyle = css({ display: 'flex', flexDirection: 'column', gap: theme.space.lg })

const msgStyle = css({ display: 'flex', gap: theme.space.md, maxWidth: '85%' })
const userMsgStyle = css({ alignSelf: 'flex-end', flexDirection: 'row-reverse' })
const asstMsgStyle = css({ alignSelf: 'flex-start' })

const avatarStyle = css({
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: theme.space.xl, height: theme.space.xl,
  borderRadius: theme.radius.full, flexShrink: 0,
})
const userAvatarStyle = css({ background: theme.colors.action.primary.background, color: theme.surface.lvl0 })
const asstAvatarStyle = css({ background: theme.surface.lvl2, color: theme.colors.text.secondary })

const bubbleStyle = css({ padding: `${theme.space.md} ${theme.space.lg}`, borderRadius: theme.radius.xl })
const userBubbleStyle = css({ background: theme.colors.action.primary.background, color: theme.surface.lvl0, borderBottomRightRadius: theme.radius.md })
const asstBubbleStyle = css({ background: theme.surface.lvl2, color: theme.colors.text.primary, borderBottomLeftRadius: theme.radius.md })

const contentStyle = css({ whiteSpace: 'pre-wrap', lineHeight: theme.lineHeight.relaxed, fontSize: theme.fontSize.lg })

const metaStyle = css({ display: 'flex', justifyContent: 'flex-end', marginBottom: theme.space.sm, flexWrap: 'wrap', gap: theme.space.sm })
const labelStyle = css({ fontSize: theme.fontSize.xxs, color: 'inherit', opacity: 0.7 })
const badgeStyle = css({ marginLeft: theme.space.sm, fontSize: theme.fontSize.xxs, color: theme.colors.text.muted, background: theme.surface.lvl2, padding: `${theme.space.xs} ${theme.space.sm}`, borderRadius: theme.radius.md })
const toolCallsStyle = css({ marginTop: theme.space.sm, padding: theme.space.sm, background: theme.surface.lvl1, borderRadius: theme.radius.md, borderLeft: `4px solid ${theme.colors.action.danger.background}`, fontSize: theme.fontSize.sm })
const toolHeaderStyle = css({ fontWeight: theme.fontWeight.semibold, color: theme.colors.text.muted, marginBottom: theme.space.sm })
const toolItemStyle = css({ marginTop: theme.space.sm, color: theme.colors.text.primary })
const toolNameStyle = css({ fontWeight: theme.fontWeight.semibold, color: theme.colors.text.muted })
const preStyle = css({ margin: `${theme.space.sm} 0 0`, padding: theme.space.sm, background: theme.surface.lvl0, borderRadius: '2px', fontSize: theme.fontSize.xs, overflow: 'auto' })

const emptyStyle = css({ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: `${theme.space.xxl} ${theme.space.lg}`, minHeight: '100%' })
const emptyIconStyle = css({ color: theme.colors.text.muted, marginBottom: theme.space.lg, opacity: 0.5 })

const formStyle = css({ padding: theme.space.lg, background: theme.surface.lvl0, borderTop: `1px solid ${theme.colors.border.default}`, flexShrink: 0 })
const inputBoxStyle = css({ display: 'flex', alignItems: 'flex-end', gap: theme.space.md, padding: theme.space.md, background: theme.surface.lvl1, border: `1px solid ${theme.colors.border.default}`, borderRadius: theme.radius.xl })
const textareaStyle = css({ flex: 1, padding: theme.space.sm, border: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: theme.fontSize.lg, color: theme.colors.text.primary, resize: 'none', lineHeight: theme.lineHeight.normal, minHeight: '48px', maxHeight: '200px', outline: 'none' })
const sendBtnStyle = css({
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: '36px', height: '36px', minHeight: '36px', paddingInline: 0,
  borderRadius: theme.radius.full, flexShrink: 0,
  '&:disabled': { opacity: 0.6, cursor: 'not-allowed', transform: 'none' },
  '&.is-loading': { opacity: 0.7, cursor: 'wait' },
})

const errorBoxStyle = css({
  padding: theme.space.md,
  marginBottom: theme.space.md,
  background: theme.colors.action.danger.background,
  color: theme.colors.action.danger.foreground,
  borderRadius: theme.radius.md,
  fontSize: theme.fontSize.sm,
})

export function AdminSupportPage(handle: Handle<AdminSupportPageProps>) {
  return () => {
    let { messages, agentId, error } = handle.props
    return (
      <div mix={wrapperStyle}>
        {error && <div mix={errorBoxStyle}>{error}</div>}
        <div id="messages-container" role="log" aria-live="polite" mix={messagesStyle}>
          {messages.length === 0 ? (
            <div mix={emptyStyle}>
              <div mix={emptyIconStyle}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  <line x1="12" y1="9" x2="12" y2="15" />
                  <line x1="9" y1="12" x2="15" y2="12" />
                </svg>
              </div>
              <h2 style={{ fontSize: theme.fontSize.xxl, fontWeight: theme.fontWeight.semibold, color: theme.colors.text.primary, margin: `0 0 ${theme.space.sm}` }}>
                Support-Anfrage starten
              </h2>
              <p style={{ fontSize: theme.fontSize.lg, color: theme.colors.text.secondary, margin: `0 0 ${theme.space.lg}`, maxWidth: '350px' }}>
                Stelle Fragen zu Benutzern, Terminen und Systemdaten.
              </p>
            </div>
          ) : (
            <div mix={listStyle}>
              {[...messages].reverse().map((msg, index) => (
                <div key={index} mix={[msgStyle, msg.role === 'user' ? userMsgStyle : asstMsgStyle]}>
                  <div mix={[avatarStyle, msg.role === 'user' ? userAvatarStyle : asstAvatarStyle]}>
                    {msg.role === 'user' ? (
                      <Glyph name="user" width={18} height={18} />
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" />
                        <path d="M12 6a2 2 0 0 0-2 2v4a2 2 0 0 0 4 0V8a2 2 0 0 0-2-2z" />
                        <circle cx="12" cy="14" r="1" fill="currentColor" />
                      </svg>
                    )}
                  </div>
                  <div mix={[bubbleStyle, msg.role === 'user' ? userBubbleStyle : asstBubbleStyle]}>
                    <div mix={metaStyle}>
                      <span mix={labelStyle}>
                        {msg.role === 'user' ? 'Du' : 'Assistent'}
                        {msg.timestamp && <span mix={labelStyle}> · {new Date(msg.timestamp).toLocaleString('de-DE')}</span>}
                        {msg.elapsed && <span mix={badgeStyle}>{msg.elapsed < 1000 ? `${msg.elapsed}ms` : `${(msg.elapsed / 1000).toFixed(1)}s`}</span>}
                        {msg.toolCalls && msg.toolCalls.length > 0 && (
                          <span mix={badgeStyle}>{msg.toolCalls.map(tc => tc.name).join(', ')}</span>
                        )}
                      </span>
                    </div>
                    <div mix={contentStyle}>{decodeHtml(msg.content)}</div>
                    {msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div mix={toolCallsStyle}>
                        <div mix={toolHeaderStyle}>Verwendete Werkzeuge</div>
                        {msg.toolCalls.map((tc, idx) => (
                          <div key={idx} mix={toolItemStyle}>
                            <div mix={toolNameStyle}>{tc.name}</div>
                            {tc.input && Object.keys(tc.input).length > 0 && (
                              <pre mix={preStyle}>{JSON.stringify(tc.input, null, 2)}</pre>
                            )}
                            {tc.result !== undefined && (
                              <div>
                                <span mix={toolNameStyle}>Ergebnis:</span>
                                <pre mix={preStyle}>{typeof tc.result === 'string' ? tc.result : JSON.stringify(tc.result, null, 2)}</pre>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <form method="POST" action={routes.admin.support.action.href()} autocomplete="off" mix={formStyle}>
          <CsrfTokenInput />
          {agentId && <input type="hidden" name="conversationId" value={agentId} />}
          <div mix={inputBoxStyle}>
            <textarea
              id="message" name="message" rows={1} required maxLength={5000}
              placeholder="Frage eingeben…" mix={textareaStyle}
            />
            <button type="submit" aria-label="Frage senden" mix={[button({ tone: 'primary' }), sendBtnStyle]}>
              <Glyph name="send" width={20} height={20} />
            </button>
          </div>
        </form>
        <FormLoadingState />
      </div>
    )
  }
}
