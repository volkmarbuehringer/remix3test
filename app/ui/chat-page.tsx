import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from 'remix/ui/theme'
import { Button } from 'remix/ui/button'
import { routes } from '../routes.ts'
import { ScrollToTop } from './scroll-to-top.tsx'
import { FormLoadingState } from './form-loading-state.tsx'
import { CsrfTokenInput } from './csrf-token-input.tsx'
import type { ChatMessage } from '../lib/chatlog.ts'

interface ChatPageProps {
  messages: ChatMessage[]
  chatId?: string
  error?: string
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
  '@media (max-width: 640px)': {
    height: 'calc(100vh - 160px)',
    minHeight: '400px',
    borderRadius: theme.radius.lg,
  },
})

const chatMessagesStyle = css({
  borderTop: `1px solid ${theme.colors.border.default}`,
  flex: '1',
  overflowY: 'auto',
  padding: theme.space.lg,
  background: theme.surface.lvl1,
  '&::-webkit-scrollbar': { width: '6px' },
  '&::-webkit-scrollbar-track': { background: 'transparent' },
  '&::-webkit-scrollbar-thumb': {
    background: theme.colors.border.default,
    borderRadius: theme.radius.full,
  },
})

const messagesListStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.lg,
})

const messageStyle = css({
  display: 'flex',
  gap: theme.space.md,
  maxWidth: '85%',
  '@media (max-width: 640px)': { maxWidth: '90%' },
})

const userMessageStyle = css({
  alignSelf: 'flex-end',
  flexDirection: 'row-reverse',
})

const assistantMessageStyle = css({
  alignSelf: 'flex-start',
})

const messageAvatarStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '36px',
  height: '36px',
  borderRadius: theme.radius.full,
  flexShrink: '0',
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
  marginTop: theme.space.sm,
})

const messageLabelStyle = css({
  fontSize: theme.fontSize.xxs,
  color: 'inherit',
  opacity: '0.7',
})

const elapsedBadgeStyle = css({
  marginLeft: theme.space.sm,
  fontSize: theme.fontSize.xxxs,
  color: theme.colors.text.muted,
  background: theme.surface.lvl2,
  padding: `${theme.space.xs} ${theme.space.sm}`,
  borderRadius: theme.radius.md,
})

const errorBannerStyle = css({
  padding: `${theme.space.md} ${theme.space.lg}`,
  background: (theme.surface as Record<string, string>).dangerBg,
  color: (theme.surface as Record<string, string>).dangerText,
  border: `1px solid ${(theme.surface as Record<string, string>).dangerBorder}`,
  borderRadius: theme.radius.lg,
  marginBottom: theme.space.md,
  fontSize: theme.fontSize.lg,
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  '[data-theme="dark"] &': {
    background: (theme.surface as Record<string, string>).dangerBg,
    color: (theme.surface as Record<string, string>).dangerText,
    border: `1px solid ${(theme.surface as Record<string, string>).dangerBorder}`,
  },
})

const tokenBadgeStyle = css({
  marginLeft: theme.space.sm,
  fontSize: theme.fontSize.xxxs,
  color: theme.colors.action.primary.background,
  background: theme.colors.focus.ring,
  padding: `${theme.space.xs} ${theme.space.sm}`,
  borderRadius: theme.radius.md,
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
  opacity: '0.5',
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
  '@keyframes spin': {
    from: { transform: 'rotate(0deg)' },
    to: { transform: 'rotate(360deg)' },
  },
})

export function ChatPage(handle: Handle<ChatPageProps>) {
  return () => {
    let { messages, chatId, error } = handle.props
    return (
    <>
      {error && (
        <div role="alert" mix={errorBannerStyle}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{error}</span>
        </div>
      )}
      <div mix={chatWrapperStyle}>
        <div id="messages-container" role="log" aria-live="polite" mix={chatMessagesStyle}>
          {messages.length === 0 ? (
            <div mix={emptyStateStyle}>
              <div mix={emptyIconStyle}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
              </div>
              <h2>Unterhaltung beginnen</h2>
              <p>Sende eine Nachricht, um mit dem KI-Assistenten zu chatten.</p>
            </div>
          ) : (
            <div mix={messagesListStyle}>
              {[...messages].reverse().map((msg, index) => (
                <div key={index} mix={[messageStyle, msg.role === 'user' ? userMessageStyle : assistantMessageStyle]}>
                  <div mix={[messageAvatarStyle, msg.role === 'user' ? userAvatarStyle : assistantAvatarStyle]}>
                    {msg.role === 'user' ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" />
                        <path d="M12 6a2 2 0 0 0-2 2v4a2 2 0 0 0 4 0V8a2 2 0 0 0-2-2z" />
                        <circle cx="12" cy="14" r="1" fill="currentColor" />
                      </svg>
                    )}
                  </div>
                  <div mix={[messageBubbleStyle, msg.role === 'user' ? userBubbleStyle : assistantBubbleStyle]}>
                    <div mix={messageContentStyle}>{msg.content}</div>
                    <div mix={messageMetaStyle}>
                      <span mix={messageLabelStyle}>
                        {msg.role === 'user' ? 'Du' : 'Assistent'}
                        {msg.elapsed && (
                          <span mix={elapsedBadgeStyle}>
                            {msg.elapsed < 1000 ? `${msg.elapsed}ms` : `${(msg.elapsed / 1000).toFixed(1)}s`}
                          </span>
                        )}
                        {msg.tokens && (
                          <span mix={tokenBadgeStyle}>
                            {msg.tokens.total} tokens
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <form method="POST" action={routes.ai.chat.action.href()} id="chat-form" autocomplete="off" mix={chatFormStyle}>
          <CsrfTokenInput />
          {chatId && <input type="hidden" name="conversationId" value={chatId} />}
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
            <Button type="submit" tone="primary" aria-label="Nachricht senden" mix={sendButtonStyle}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </Button>
          </div>
        </form>
        <ScrollToTop />
        <FormLoadingState />
      </div>
    </>
  )
  }
}
