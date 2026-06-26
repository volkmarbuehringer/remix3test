import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from '../lib/theme.ts'
import { Glyph } from '../lib/glyph.ts'
import button from '../lib/button.ts'
import { routes } from '../routes.ts'
import { ScrollToTop } from './scroll-to-top.tsx'
import { FormLoadingState } from './form-loading-state.tsx'
import { AiAgentResultToggle } from '../assets/ai-agent-result-toggle.tsx'
import { CsrfTokenInput } from './csrf-token-input.tsx'
import type { ChatMessage } from '../lib/chatlog.ts'

interface AgentPageProps {
  messages: ChatMessage[]
  agentId?: string
}

function decode(text: string): string {
  let result = text
  result = result
    .replace(/&#39;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&#x27;/gi, "'")
  result = result.replace(/&#34;/g, '"').replace(/&quot;/g, '"')
  result = result.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  return result
}

const chatWrapperStyle = css({
  '& *': { boxSizing: 'border-box' },
  display: 'flex',
  flexDirection: 'column',
  height: 'calc(100vh - 200px)',
  minHeight: '500px',
  maxHeight: '800px',
  background: theme.surface.lvl0,
  borderRadius: theme.radius.xl,
  boxShadow: theme.shadow.md,
  overflow: 'hidden',
  border: `1px solid ${theme.colors.border.default}`,
})

const chatMessagesStyle = css({
  flex: 1,
  overflowY: 'auto',
  padding: theme.space.lg,
  background: theme.surface.lvl1,
  display: 'flex',
  flexDirection: 'column',
})

const messagesListStyle = css({ display: 'flex', flexDirection: 'column', gap: theme.space.lg })

const messageStyle = css({ display: 'flex', gap: theme.space.md, maxWidth: '85%' })
const userMessageStyle = css({ alignSelf: 'flex-end', flexDirection: 'row-reverse' })
const assistantMessageStyle = css({ alignSelf: 'flex-start' })

const messageAvatarStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: theme.space.xl,
  height: theme.space.xl,
  borderRadius: theme.radius.full,
  flexShrink: 0,
})
const userAvatarStyle = css({
  background: theme.colors.action.primary.background,
  color: theme.surface.lvl0,
})
const assistantAvatarStyle = css({
  background: theme.surface.lvl2,
  color: theme.colors.text.secondary,
})

const messageBubbleStyle = css({
  padding: `${theme.space.md} ${theme.space.lg}`,
  borderRadius: theme.radius.xl,
})
const userBubbleStyle = css({
  background: theme.colors.action.primary.background,
  color: theme.surface.lvl0,
  borderBottomRightRadius: theme.radius.md,
})
const assistantBubbleStyle = css({
  background: theme.surface.lvl2,
  color: theme.colors.text.primary,
  borderBottomLeftRadius: theme.radius.md,
})

const messageContentStyle = css({
  whiteSpace: 'pre-wrap',
  lineHeight: theme.lineHeight.relaxed,
  fontSize: theme.fontSize.lg,
})

const messageMetaStyle = css({
  display: 'flex',
  justifyContent: 'flex-end',
  marginBottom: theme.space.sm,
  flexWrap: 'wrap',
  gap: theme.space.sm,
})
const messageLabelStyle = css({ fontSize: theme.fontSize.xxs, color: 'inherit', opacity: 0.7 })

const elapsedBadgeStyle = css({
  marginLeft: theme.space.sm,
  fontSize: theme.fontSize.xxs,
  color: theme.colors.text.muted,
  background: theme.surface.lvl2,
  padding: `${theme.space.xs} ${theme.space.sm}`,
  borderRadius: theme.radius.md,
})

const toolBadgeStyle = css({
  marginLeft: theme.space.sm,
  fontSize: theme.fontSize.xxs,
  color: theme.colors.text.muted,
})

const toolCallsStyle = css({
  marginTop: theme.space.sm,
  padding: theme.space.sm,
  background: theme.surface.lvl1,
  borderRadius: theme.radius.md,
  borderLeft: `4px solid ${theme.colors.action.danger.background}`,
  fontSize: theme.fontSize.sm,
})
const toolHeaderStyle = css({
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.muted,
  marginBottom: theme.space.sm,
})
const toolItemStyle = css({ marginTop: theme.space.sm, color: theme.colors.text.primary })
const toolNameStyle = css({ fontWeight: theme.fontWeight.semibold, color: theme.colors.text.muted })
const toolInputStyle = css({
  margin: `${theme.space.sm} 0 0`,
  padding: theme.space.sm,
  background: theme.surface.lvl0,
  borderRadius: '2px',
  fontSize: theme.fontSize.xs,
  overflow: 'auto',
})
const toolResultStyle = css({
  marginTop: theme.space.sm,
  padding: theme.space.sm,
  background: theme.surface.lvl1,
  borderRadius: '2px',
})
const toolResultLabelStyle = css({
  fontWeight: theme.fontWeight.semibold,
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.muted,
})
const toolResultContentStyle = css({
  margin: `${theme.space.sm} 0 0`,
  padding: theme.space.sm,
  background: theme.surface.lvl0,
  borderRadius: '2px',
  fontSize: theme.fontSize.xs,
  overflow: 'auto',
})
const tokenBadgeStyle = css({
  marginLeft: theme.space.sm,
  fontSize: theme.fontSize.xxs,
  color: theme.colors.action.primary.background,
})

const emptyStateStyle = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  padding: `${theme.space.xxl} ${theme.space.lg}`,
  minHeight: '100%',
  '& h2': {
    fontSize: theme.fontSize.xxl,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text.primary,
    margin: `0 0 ${theme.space.sm}`,
  },
  '& p': {
    fontSize: theme.fontSize.lg,
    color: theme.colors.text.secondary,
    margin: `0 0 ${theme.space.lg}`,
    maxWidth: '300px',
  },
})

const emptyIconStyle = css({
  color: theme.colors.text.muted,
  marginBottom: theme.space.lg,
  opacity: 0.5,
})

const chatFormStyle = css({
  padding: `${theme.space.lg}`,
  background: theme.surface.lvl0,
  borderTop: `1px solid ${theme.colors.border.default}`,
  flexShrink: 0,
})
const inputContainerStyle = css({
  display: 'flex',
  alignItems: 'flex-end',
  gap: theme.space.md,
  padding: theme.space.md,
  background: theme.surface.lvl1,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.xl,
  transition: `border-color 0.15s ease, box-shadow 0.15s ease`,
  '&:focus-within': {
    borderColor: theme.colors.action.primary.background,
    boxShadow: `0 0 0 3px ${theme.colors.focus.ring}33`,
  },
})
const messageInputStyle = css({
  flex: 1,
  padding: theme.space.sm,
  border: 'none',
  background: 'transparent',
  fontFamily: 'inherit',
  fontSize: theme.fontSize.lg,
  color: theme.colors.text.primary,
  resize: 'none',
  lineHeight: theme.lineHeight.normal,
  minHeight: '48px',
  maxHeight: '200px',
  outline: 'none',
  '&::placeholder': { color: theme.colors.text.muted },
})
const sendButtonStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '36px',
  height: '36px',
  minHeight: '36px',
  paddingInline: 0,
  borderRadius: theme.radius.full,
  transition: 'all 0.15s ease',
  flexShrink: 0,
  '&:hover': { transform: 'scale(1.05)' },
  '&:active': { transform: 'scale(0.95)' },
  '&:disabled': { opacity: 0.6, cursor: 'not-allowed', transform: 'none' },
  '&.is-loading': { opacity: 0.7, cursor: 'wait' },
  '&.is-loading svg': { animation: 'spin 1s linear infinite' },
  '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } },
})

export function AgentPage(handle: Handle<AgentPageProps>) {
  return () => {
    let { messages, agentId } = handle.props
    return (
      <>
        <div mix={chatWrapperStyle}>
          <div id="messages-container" role="log" aria-live="polite" mix={chatMessagesStyle}>
            {messages.length === 0 ? (
              <div mix={emptyStateStyle}>
                <div mix={emptyIconStyle}>
                  <svg
                    width="64"
                    height="64"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" />
                    <path d="M12 6a2 2 0 0 0-2 2v4a2 2 0 0 0 4 0V8a2 2 0 0 0-2-2z" />
                    <circle cx="12" cy="14" r="1" fill="currentColor" />
                  </svg>
                </div>
                <h2>Unterhaltung beginnen</h2>
                <p>Sende eine Nachricht, um mit dem KI-Agenten zu chatten.</p>
              </div>
            ) : (
              <div mix={messagesListStyle}>
                {[...messages].reverse().map((msg, index) => (
                  <div
                    key={index}
                    mix={[
                      messageStyle,
                      msg.role === 'user' ? userMessageStyle : assistantMessageStyle,
                    ]}
                  >
                    <div
                      mix={[
                        messageAvatarStyle,
                        msg.role === 'user' ? userAvatarStyle : assistantAvatarStyle,
                      ]}
                    >
                      {msg.role === 'user' ? (
                        <Glyph name="user" width={18} height={18} />
                      ) : (
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" />
                          <path d="M12 6a2 2 0 0 0-2 2v4a2 2 0 0 0 4 0V8a2 2 0 0 0-2-2z" />
                          <circle cx="12" cy="14" r="1" fill="currentColor" />
                        </svg>
                      )}
                    </div>
                    <div
                      mix={[
                        messageBubbleStyle,
                        msg.role === 'user' ? userBubbleStyle : assistantBubbleStyle,
                      ]}
                    >
                      <div mix={messageMetaStyle}>
                        <span mix={messageLabelStyle}>
                          {msg.role === 'user' ? 'Du' : 'Assistent'}
                          {msg.timestamp && <span mix={messageLabelStyle}> · {new Date(msg.timestamp).toLocaleString('de-DE')}</span>}
                          {msg.elapsed && (
                            <span mix={elapsedBadgeStyle}>
                              {msg.elapsed < 1000
                                ? `${msg.elapsed}ms`
                                : `${(msg.elapsed / 1000).toFixed(1)}s`}
                            </span>
                          )}
                          {msg.tokens && (
                            <span mix={tokenBadgeStyle}>{msg.tokens.total} tokens</span>
                          )}
                          {msg.toolCalls && msg.toolCalls.length > 0 && (
                            <span mix={toolBadgeStyle}>
                              {msg.toolCalls.map((tc) => tc.name).join(', ')}
                            </span>
                          )}
                        </span>
                      </div>
                      <div mix={messageContentStyle}>{decode(msg.content)}</div>
                      {msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0 && (
                        <div mix={toolCallsStyle}>
                          <div mix={toolHeaderStyle}>Verwendete Werkzeuge</div>
                          {msg.toolCalls.map((tc, idx) => (
                            <div key={idx} mix={toolItemStyle}>
                              <div mix={toolNameStyle}>{tc.name}</div>
                              {tc.input && Object.keys(tc.input).length > 0 && (
                                <pre mix={toolInputStyle}>{JSON.stringify(tc.input, null, 2)}</pre>
                              )}
                              {tc.result !== undefined && (
                                <div mix={toolResultStyle}>
                                  <span mix={toolResultLabelStyle}>Ergebnis:</span>
                                  <pre mix={toolResultContentStyle}>
                                    {JSON.stringify(tc.result, null, 2)}
                                  </pre>
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

          <form
            method="POST"
            action={routes.ai.agent.action.href()}
            id="agent-form"
            autocomplete="off"
            mix={chatFormStyle}
          >
            <CsrfTokenInput />
            {agentId && <input type="hidden" name="conversationId" value={agentId} />}
            <div mix={inputContainerStyle}>
              <textarea
                id="message"
                name="message"
                rows={1}
                required
                maxLength={5000}
                placeholder="Nachricht eingeben…"
                mix={messageInputStyle}
              />
              <button
                type="submit"
                aria-label="Nachricht senden"
                mix={[button({ tone: 'primary' }), sendButtonStyle]}
              >
                <Glyph name="send" width={20} height={20} />
              </button>
            </div>
          </form>
          <AiAgentResultToggle />
          <ScrollToTop />
          <FormLoadingState />
        </div>
      </>
    )
  }
}
