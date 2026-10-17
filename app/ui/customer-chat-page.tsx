import type { Handle } from 'remix/component'
import { css } from 'remix/component'
import { theme } from './theme/theme.ts'
import { routes } from '../routes.ts'
import { CustomerChatStream } from '../assets/streams/public/customer-chat-stream.tsx'
import { MAX_MESSAGE_LENGTH } from '../utils/message-limits.ts'
import type { ChatMessage } from '../types/chatlog.ts'
import { AgentChatShell, ChatComposer, MessageBubble } from './agent-chat/shell.tsx'
import { ChatApprovalForm } from './agent-chat/approval-form.tsx'
import { ChatQuestionForm } from './agent-chat/question-form.tsx'

const headingStyle = css({
  fontSize: '1.5rem',
  fontWeight: 600,
  marginBottom: '0.5rem',
})

const subtitleStyle = css({
  color: theme.colors.text.secondary,
  marginBottom: '1.5rem',
})

const chatAreaStyle = css({
  minHeight: '40vh',
  maxHeight: '60vh',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  marginBottom: '1rem',
  padding: '0.75rem',
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.lg,
  background: theme.surface.lvl0,
})

const newButtonStyle = css({
  padding: '0.5rem 1rem',
  background: theme.colors.action.secondary.background,
  color: theme.colors.action.secondary.foreground,
  border: `1px solid ${theme.colors.action.secondary.border}`,
  borderRadius: theme.radius.md,
  fontSize: '0.875rem',
  cursor: 'pointer',
  textDecoration: 'none',
  display: 'inline-block',
})

// Right-aligned action row above the composer in the chat header.
const newChatRowStyle = css({
  display: 'flex',
  justifyContent: 'flex-end',
  marginBottom: '0.75rem',
})

interface PendingApproval {
  runId: string
  toolCallId?: string | null | undefined
  threadId?: string | null | undefined
  args?: Record<string, unknown> | null | undefined
}

interface PendingQuestion {
  runId: string
  toolCallId?: string | null | undefined
  threadId?: string | null | undefined
  question: string
  options?: { label: string; description?: string }[] | null | undefined
  selectionMode: string
}

interface CustomerChatPageProps {
  threadId?: string | undefined
  messages?: ChatMessage[]
  /**
   * A suspended tool call resolved server-side (the no-JS gate). When set, the
   * page renders a native approve/decline form so the decision does not depend
   * on the stream client; the client still upgrades that form to SSE.
   */
  pendingApproval?: PendingApproval | null | undefined
  /**
   * A suspended `ask_user` question resolved server-side (the no-JS gate), with
   * the same native-form treatment as `pendingApproval`.
   */
  pendingQuestion?: PendingQuestion | null | undefined
}

export function CustomerChatPage(handle: Handle<CustomerChatPageProps>) {
  return () => {
    let { threadId, messages = [], pendingApproval, pendingQuestion } = handle.props
    return (
      <AgentChatShell
        variant="centered"
        header={
          <>
            <h2 mix={headingStyle}>Beratung</h2>
            <p mix={subtitleStyle}>
              Beschreibe dein Anliegen — ich finde die passende Ressource für dich.
            </p>

            <div mix={newChatRowStyle}>
              <a id="chat-new" href={`${routes.chat.index.href()}?new=1`} mix={newButtonStyle}>
                Neue Unterhaltung
              </a>
            </div>
          </>
        }
        composer={
          <ChatComposer
            variant="stacked"
            formId="chat-form"
            formAction={routes.chat.action.href()}
            formMethod="POST"
            formAutoComplete="off"
            textareaId="msg"
            textarea={{
              name: 'message',
              rows: 3,
              required: true,
              maxLength: MAX_MESSAGE_LENGTH,
              ariaDescribedBy: 'chat-counter',
            }}
            submitId="chat-submit"
            submitLabel="Senden"
            label={{ htmlFor: 'msg', text: 'Dein Anliegen' }}
            counter={{ id: 'chat-counter', initial: `0 / ${MAX_MESSAGE_LENGTH}` }}
            hint={<>Enter sendet · Shift+Enter fügt eine neue Zeile ein.</>}
          />
        }
        stream={<CustomerChatStream />}
      >
        <div
          id="chat-messages"
          role="log"
          aria-live="polite"
          {...(threadId ? { 'data-thread-id': threadId } : {})}
          mix={chatAreaStyle}
        >
          {messages.map((m, i) => (
            <MessageBubble key={i} role={m.role} variant="customer">
              {m.content}
            </MessageBubble>
          ))}
          {pendingApproval ? (
            <ChatApprovalForm
              runId={pendingApproval.runId}
              toolCallId={pendingApproval.toolCallId}
              threadId={pendingApproval.threadId ?? threadId}
              args={pendingApproval.args}
            />
          ) : null}
          {pendingQuestion ? (
            <ChatQuestionForm
              runId={pendingQuestion.runId}
              toolCallId={pendingQuestion.toolCallId}
              threadId={pendingQuestion.threadId ?? threadId}
              question={pendingQuestion.question}
              options={pendingQuestion.options}
              selectionMode={pendingQuestion.selectionMode}
            />
          ) : null}
          <div id="chat-end" />
        </div>
      </AgentChatShell>
    )
  }
}
