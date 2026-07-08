import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from './theme/theme.ts'
import { routes } from '../routes.ts'
import { CsrfTokenInput } from './csrf-token-input.tsx'
import type { ChatMessage } from '../types/chatlog.ts'
import type { PendingBookingData, SlotItem } from '../actions/chat/controller.tsx'
import { formatMinOption } from '../utils/date-utils.ts'

const MAX_MESSAGE_LENGTH = 5000

interface CustomerChatPageProps {
  messages: ChatMessage[]
  threadId?: string
  error?: string
  pendingBooking?: PendingBookingData
  bookingResult?: string
}

const containerStyle = css({
  maxWidth: '800px',
  margin: '0 auto',
  padding: '1rem',
})

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

const formStyle = css({
  background: theme.surface.lvl0,
  borderRadius: theme.radius.lg,
  padding: '1rem',
})

const labelStyle = css({
  display: 'block',
  fontSize: '1rem',
  fontWeight: 600,
  marginBottom: '0.5rem',
  color: theme.colors.text.primary,
})

const textareaStyle = css({
  width: '100%',
  minHeight: '50px',
  padding: '0.75rem',
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.md,
  fontFamily: 'inherit',
  fontSize: '1rem',
  color: theme.colors.text.primary,
  background: theme.surface.lvl1,
  resize: 'vertical',
  outline: 'none',
  boxSizing: 'border-box',
})

const buttonStyle = css({
  padding: '0.6rem 1.5rem',
  background: theme.colors.action.primary.background,
  color: theme.colors.action.primary.foreground,
  border: 'none',
  borderRadius: theme.radius.md,
  fontSize: '1rem',
  cursor: 'pointer',
})

const threadIdStyle = css({
  marginTop: '0.75rem',
  fontSize: '0.75rem',
  color: theme.colors.text.muted,
})

const errorBoxStyle = css({
  marginTop: '1rem',
  padding: '0.75rem',
  background: theme.colors.action.danger.background,
  color: theme.colors.action.danger.foreground,
  borderRadius: theme.radius.md,
  fontSize: '0.875rem',
})

const bookingCardStyle = css({
  padding: '1rem',
  background: theme.surface.lvl1,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.lg,
  marginBottom: '1rem',
  maxHeight: '40vh',
  overflowY: 'auto',
})

const bookingCardTitle = css({
  fontSize: '1rem',
  fontWeight: 600,
  marginBottom: '0.75rem',
  color: theme.colors.text.primary,
})

const dayGroupStyle = css({
  marginBottom: '0.75rem',
})

const dayHeaderStyle = css({
  fontSize: '0.9rem',
  fontWeight: 600,
  marginBottom: '0.25rem',
  color: theme.colors.text.primary,
})

const slotLabelStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.25rem 0.5rem 0.25rem 1.25rem',
  marginBottom: '0.15rem',
  borderRadius: theme.radius.md,
  cursor: 'pointer',
  fontSize: '0.9rem',
})

const bookButtonStyle = css({
  marginTop: '0.75rem',
  padding: '0.6rem 1.5rem',
  background: theme.colors.action.primary.background,
  color: theme.colors.action.primary.foreground,
  border: 'none',
  borderRadius: theme.radius.md,
  fontSize: '1rem',
  cursor: 'pointer',
  width: '100%',
})

const bookingResultStyle = css({
  padding: '0.75rem',
  background: theme.surface.lvl1,
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.lg,
  color: theme.colors.text.primary,
  lineHeight: 1.5,
  whiteSpace: 'pre-wrap',
})

export function CustomerChatPage(handle: Handle<CustomerChatPageProps>) {
  return () => {
    let { messages, threadId, error, pendingBooking, bookingResult } = handle.props
    return (
      <div mix={containerStyle}>
        <h2 mix={headingStyle}>Beratung</h2>
        <p mix={subtitleStyle}>
          Beschreibe dein Anliegen — ich finde die passende Ressource für dich.
        </p>

        <div id="chat-messages" mix={chatAreaStyle}>
          {messages.map((msg, idx) => (
            <div
              key={idx}
              style={{
                padding: '0.75rem',
                borderRadius: theme.radius.lg,
                maxWidth: '75%',
                background:
                  msg.role === 'user'
                    ? theme.colors.action.primary.background
                    : theme.surface.lvl1,
                color:
                  msg.role === 'user'
                    ? theme.colors.action.primary.foreground
                    : theme.colors.text.primary,
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                borderBottomLeftRadius: msg.role === 'user' ? theme.radius.lg : '4px',
                borderBottomRightRadius: msg.role === 'user' ? '4px' : theme.radius.lg,
              }}
            >
              <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                {msg.content}
              </p>
              <div
                style={{
                  fontSize: theme.fontSize.xxs,
                  color: theme.colors.text.muted,
                  marginTop: '0.25rem',
                }}
              >
                {msg.role === 'user' ? 'Du' : 'Berater'}
                {msg.timestamp
                  ? ' · ' +
                    new Date(msg.timestamp).toLocaleTimeString('de-DE', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : ''}
              </div>
            </div>
          ))}

          {bookingResult && <div mix={bookingResultStyle}>{bookingResult}</div>}

          <div id="chat-end" />
        </div>

        {pendingBooking && pendingBooking.slots.length > 0 && (
          <form method="POST" action={routes.chat.action.href()} mix={bookingCardStyle}>
            <CsrfTokenInput />
            <input type="hidden" name="_action" value="confirm_booking" />
            <input type="hidden" name="title" value={pendingBooking.title} />
            <input type="hidden" name="resource_id" value={String(pendingBooking.resource_id)} />
            {threadId && <input type="hidden" name="threadId" value={threadId} />}
            <p mix={bookingCardTitle}>{pendingBooking.resource_name}</p>
            {(() => {
              let sorted = [...pendingBooking.slots].sort(
                (a, b) => a.date_epoch_ms - b.date_epoch_ms || a.start_min - b.start_min,
              )
              let groups = new Map<number, SlotItem[]>()
              for (let slot of sorted) {
                let day = slot.date_epoch_ms
                if (!groups.has(day)) groups.set(day, [])
                groups.get(day)!.push(slot)
              }
              let dayKeys = [...groups.keys()]
              let globalIdx = 0
              return dayKeys.map((dayMs) => {
                let daySlots = groups.get(dayMs)!
                return (
                  <fieldset key={dayMs} mix={dayGroupStyle} style={{ border: 'none', padding: 0, margin: 0 }}>
                    <legend mix={dayHeaderStyle}>{daySlots[0].date_display}</legend>
                    {daySlots.map((slot) => {
                      let idx = globalIdx++
                      return (
                        <label key={`${dayMs}-${slot.start_min}`} mix={slotLabelStyle}>
                          <input
                            type="radio"
                            name="day_start"
                            value={`${slot.date_epoch_ms}:${slot.start_min}`}
                            defaultChecked={idx === 0}
                            required
                            aria-label={`${daySlots[0].date_display}, ${formatMinOption(slot.start_min)}–${formatMinOption(slot.end_min)} Uhr`}
                          />
                          {formatMinOption(slot.start_min)}–{formatMinOption(slot.end_min)} Uhr
                        </label>
                      )
                    })}
                  </fieldset>
                )
              })
            })()}
            <button type="submit" mix={bookButtonStyle}>
              Termin buchen
            </button>
          </form>
        )}

        <form
          method="POST"
          action={routes.chat.action.href()}
          autoComplete="off"
          mix={formStyle}
        >
          <CsrfTokenInput />
          {threadId && <input type="hidden" name="threadId" value={threadId} />}
          <label htmlFor="msg" mix={labelStyle}>
            Dein Anliegen
          </label>
          <textarea
            id="msg"
            name="message"
            rows={3}
            required
            maxLength={MAX_MESSAGE_LENGTH}
            mix={textareaStyle}
          />
          <div style={{ marginTop: '0.75rem' }}>
            <button type="submit" mix={buttonStyle}>
              Senden
            </button>
          </div>
        </form>

        {threadId && <p mix={threadIdStyle}>Konversation-ID: {threadId}</p>}

        {error && <div mix={errorBoxStyle}>{error}</div>}
      </div>
    )
  }
}
