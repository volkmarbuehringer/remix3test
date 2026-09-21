import type { Handle } from 'remix/ui'
import { css, Frame } from 'remix/ui'
import { theme } from './theme/theme.ts'
import { routes, frames } from '../routes.ts'
import { SupportAgentStream } from '../assets/streams/public/support-agent-stream.tsx'
import { MarkdownText } from './markdown-text.tsx'
import type { ChatMessage } from '../types/chatlog.ts'
import { AgentChatShell, ChatComposer, MessageBubble } from './agent-chat/shell.tsx'

const headerStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.space.md,
  padding: '0.75rem 1rem',
  background: theme.surface.lvl0,
  borderBottom: `1px solid ${theme.colors.border.default}`,
  flexShrink: 0,
})

const headerTitleWrapStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.125rem',
  minWidth: 0,
})

const headingStyle = css({
  margin: 0,
  fontSize: theme.fontSize.md,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
})

const headerSubStyle = css({
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.muted,
})

const newButtonStyle = css({
  flexShrink: 0,
  padding: '0.375rem 0.875rem',
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  background: theme.surface.lvl1,
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.medium,
  cursor: 'pointer',
  '&:hover': {
    background: theme.surface.lvl2,
    color: theme.colors.text.primary,
  },
})

const mainStyle = css({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
  gap: '0.5rem',
  padding: '0.5rem 1rem',
})

const previewStyle = css({
  flex: 1,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.lg,
  overflow: 'hidden',
  background: theme.surface.lvl0,
  '&[hidden]': { display: 'none' },
})

const previewHeaderStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.space.sm,
  padding: '0.375rem 0.75rem',
  background: theme.surface.lvl1,
  borderBottom: `1px solid ${theme.colors.border.subtle}`,
  flexShrink: 0,
})

const previewPathStyle = css({
  fontFamily: theme.fontFamily.mono,
  fontSize: theme.fontSize.xxs,
  color: theme.colors.text.muted,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
})

const previewCloseStyle = css({
  flexShrink: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '1.5rem',
  height: '1.5rem',
  padding: 0,
  border: 'none',
  borderRadius: theme.radius.md,
  background: 'transparent',
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.sm,
  cursor: 'pointer',
  '&:hover': {
    background: theme.surface.lvl2,
    color: theme.colors.text.primary,
  },
})

const frameContainerStyle = css({
  flex: 1,
  minHeight: 0,
})

const chatMessagesStyle = css({
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  padding: '0.5rem 0.25rem',
  fontSize: '0.8125rem',
  color: theme.colors.text.secondary,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
})

const recentThreadsStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.375rem',
  padding: '0.75rem',
  border: `1px solid ${theme.colors.border.subtle}`,
  borderRadius: theme.radius.md,
  background: theme.surface.lvl1,
  alignSelf: 'stretch',
})

const recentTitleStyle = css({
  fontSize: theme.fontSize.xs,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.secondary,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
})

const recentLinkStyle = css({
  fontSize: theme.fontSize.sm,
  color: theme.colors.text.secondary,
  textDecoration: 'none',
  padding: '0.25rem 0.375rem',
  borderRadius: theme.radius.sm,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  '&:hover': {
    background: theme.surface.lvl2,
    color: theme.colors.action.primary.background,
  },
})

const hintStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.125rem',
  padding: '0.375rem 1rem',
  fontSize: '0.75rem',
  color: theme.colors.text.muted,
  background: theme.surface.lvl0,
  borderTop: `1px solid ${theme.colors.border.subtle}`,
  lineHeight: '1.4',
  flexShrink: 0,
})

// ── Empty state (panel placeholder + frame fallback) ────────────────

export const SUPPORT_AGENT_EXAMPLES = [
  { label: 'Benutzer suchen', prompt: 'Suche den Benutzer mit der E-Mail admin@newapp.com.' },
  { label: 'Termine heute', prompt: 'Welche Termine gibt es heute?' },
  { label: 'Statistik', prompt: 'Zeige mir die aktuellen Systemstatistiken.' },
  { label: 'Angebote', prompt: 'Welche Angebote gibt es diese Woche?' },
] as const

const emptyStateStyle = css({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.75rem',
  height: '100%',
  padding: '2rem',
  textAlign: 'center',
})

const emptyTitleStyle = css({
  fontSize: theme.fontSize.lg,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
})

const emptySubStyle = css({
  fontSize: theme.fontSize.sm,
  color: theme.colors.text.muted,
  maxWidth: '32rem',
  lineHeight: theme.lineHeight.relaxed,
})

const emptyGridStyle = css({
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  gap: '0.5rem',
  marginTop: '0.5rem',
})

const exampleChipStyle = css({
  padding: '0.375rem 0.875rem',
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.full,
  background: theme.surface.lvl1,
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.xs,
  cursor: 'pointer',
  '&:hover': {
    background: theme.colors.action.primary.background,
    color: theme.colors.action.primary.foreground,
    borderColor: theme.colors.action.primary.background,
  },
})

export function SupportAgentEmptyState(handle: Handle<{}>) {
  return () => (
    <div mix={emptyStateStyle}>
      <div mix={emptyTitleStyle}>Womit kann ich helfen?</div>
      <div mix={emptySubStyle}>
        Ich beantworte Fragen zu Benutzern, Terminen, Ressourcen, Angeboten, Wetter und Statistiken
        — nur Lesen, keine Kontoänderungen.
      </div>
      <div mix={emptyGridStyle}>
        {SUPPORT_AGENT_EXAMPLES.map((example) => (
          <button
            key={example.label}
            type="button"
            data-support-prompt={example.prompt}
            mix={exampleChipStyle}
          >
            {example.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────

export type SupportRecentThread = { threadId: string; title: string }

interface SupportAgentPageProps {
  /** Thread whose transcript is open, when resumed from the chatlog. */
  threadId?: string | undefined
  /** Server-rendered transcript of the resumed thread. */
  messages?: ChatMessage[]
  /** This admin's most recent support conversations, for quick resume. */
  recentThreads?: SupportRecentThread[]
}

export function SupportAgentPage(handle: Handle<SupportAgentPageProps>) {
  return () => {
    let { threadId, messages = [], recentThreads = [] } = handle.props
    let hasMessages = messages.length > 0
    return (
      <AgentChatShell
        variant="fullHeight"
        header={
          <div mix={headerStyle}>
            <div mix={headerTitleWrapStyle}>
              <h2 mix={headingStyle}>Support-Agent</h2>
              <span mix={headerSubStyle}>Nur Lesen · keine Kontoänderungen</span>
            </div>
            <button id="support-agent-new" type="button" mix={newButtonStyle}>
              Neue Unterhaltung
            </button>
          </div>
        }
        hint={
          <div mix={hintStyle}>
            <span>Enter zum Senden · Shift+Enter für eine neue Zeile</span>
            <span>
              Beantwortet Fragen zu Benutzern, Terminen, Ressourcen, Angeboten, Wetter und
              Statistiken — nur Lesen, keine Kontoänderungen.
            </span>
          </div>
        }
        composer={
          <ChatComposer
            variant="inline"
            formId="support-agent-form"
            textareaId="support-agent-input"
            textarea={{
              name: 'message',
              rows: 3,
              ariaLabel: 'Nachricht an den Support-Agenten',
              placeholder: 'Frage zu Benutzern, Terminen und Systemdaten...',
            }}
            submitId="support-agent-submit"
            submitLabel="Senden"
          />
        }
        stream={<SupportAgentStream />}
      >
        <div mix={mainStyle}>
          <div id="support-agent-preview" hidden aria-hidden="true" mix={previewStyle}>
            <div mix={previewHeaderStyle}>
              <span id="support-agent-preview-path" mix={previewPathStyle} />
              <button
                id="support-agent-preview-close"
                type="button"
                aria-label="Vorschau schließen"
                mix={previewCloseStyle}
              >
                ✕
              </button>
            </div>
            <div
              id="support-agent-frame-container"
              data-active-frame={frames.supportAgentPanel}
              mix={frameContainerStyle}
            >
              <Frame
                name={frames.supportAgentPanel}
                src={routes.admin.supportAgent.panel.href()}
                fallback={<SupportAgentEmptyState />}
              />
            </div>
          </div>

          <div
            id="chat-messages"
            role="log"
            aria-live="polite"
            aria-relevant="additions text"
            aria-label="Verlauf der Unterhaltung mit dem Support-Agenten"
            {...(threadId ? { 'data-thread-id': threadId } : {})}
            mix={chatMessagesStyle}
          >
            {messages.map((message, index) => (
              <MessageBubble key={index} role={message.role} variant="support">
                {message.role === 'assistant' ? (
                  <MarkdownText text={message.content} />
                ) : (
                  message.content
                )}
              </MessageBubble>
            ))}
            {!hasMessages && recentThreads.length > 0 ? (
              <div mix={recentThreadsStyle}>
                <div mix={recentTitleStyle}>Letzte Unterhaltungen</div>
                {recentThreads.map((thread) => (
                  <a
                    key={thread.threadId}
                    href={
                      routes.admin.supportAgent.index.href() +
                      '?threadId=' +
                      encodeURIComponent(thread.threadId)
                    }
                    data-support-thread={thread.threadId}
                    data-rmx-document
                    mix={recentLinkStyle}
                  >
                    {thread.title || 'Unterhaltung'}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </AgentChatShell>
    )
  }
}
