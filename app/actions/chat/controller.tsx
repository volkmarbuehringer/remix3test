import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'
import { requireAuth } from '../../middleware/auth.ts'
import { routes } from '../../routes.ts'
import { mastra } from '../mastra/index.ts'
import { getCurrentUser } from '../../utils/context.ts'
import { createRateLimiter } from '../../utils/rate-limiter.ts'
import { recallChatMessages } from '../../utils/mastra-memory.ts'
import { runWithUserId } from '../mastra/tools/customer-tools.ts'
import { validateThreadId } from '../../utils/thread-id.ts'
import { formatMinOption } from '../../utils/date-utils.ts'
import { Layout } from '../../ui/layout.tsx'
import { CustomerChatPage } from '../../ui/customer-chat-page.tsx'
import type { AppContext } from '../../types/context.ts'
import type { ChatMessage } from '../../types/chatlog.ts'

const messageField = f.field(s.string())
const messageSchema = f.object({
  message: messageField,
  threadId: f.field(s.optional(s.string())),
})

const MAX_MESSAGE_LENGTH = 5000
const MAX_TITLE_LENGTH = 200
const AGENT_TIMEOUT_MS = 60_000
export const chatRateLimiter = createRateLimiter({ windowMs: 3000, perUser: true })
export const bookingRateLimiter = createRateLimiter({ windowMs: 10000, perUser: true })

export interface SlotItem {
  date_epoch_ms: number
  date_display: string
  start_min: number
  end_min: number
}

export interface PendingBookingData {
  slots: SlotItem[]
  resource_id: number
  resource_name: string
  title: string
}

export interface BookingPageInfo {
  currentPage: number
  totalDays: number
}

function safeTitle(raw: string): string {
  return raw.slice(0, MAX_TITLE_LENGTH).replace(/[\r\n]+/g, ' ')
}

// Test-only agent injection point — setter is a no-op outside test env
let _testAgent:
  | {
      generate: (
        message: string,
        opts?: Record<string, unknown>,
      ) => Promise<{ text: string; toolCalls?: unknown[]; toolResults?: unknown[] }>
    }
  | undefined
export function __setTestCustomerAgent(agent: typeof _testAgent) {
  if (process.env.NODE_ENV === 'test') {
    _testAgent = agent
  }
}
export function __getTestCustomerAgent() {
  return _testAgent
}

export const customerChat = createController<typeof routes.chat, AppContext>(
  routes.chat,
  {
    middleware: [requireAuth()],
    actions: {
      async index(context) {
        let user = getCurrentUser()
        let threadId = context.url.searchParams.get('threadId') ?? undefined
        if (threadId && !validateThreadId(threadId)) threadId = undefined
        let error = context.url.searchParams.get('error') ?? undefined
        let chatMessages: ChatMessage[] = []
        if (threadId) {
          try {
            let agent = mastra.getAgent('customerAgent')
            chatMessages = await recallChatMessages(agent, threadId, String(user.id))
          } catch (error) {
            if (process.env.NODE_ENV !== 'test') {
              console.error('[CustomerChat] recall failed for ' + threadId + ': ' + String(error))
            }
          }
        }

        let pendingBooking: PendingBookingData | undefined
        let bookingResult: string | undefined
        let session = context.session
        if (session) {
          let raw = session.get('pendingBooking') as string | undefined
          if (raw) {
            try {
              pendingBooking = JSON.parse(raw) as PendingBookingData
            } catch (e) {
              if (process.env.NODE_ENV !== 'test') {
                console.error('[CustomerChat] pendingBooking parse failed: ' + String(e))
              }
            }
          }
        }

        // Handle cancel — clear pendingBooking and redirect
        if (context.url.searchParams.get('cancel') === '1') {
          session?.unset('pendingBooking')
          let cancelUrl = routes.chat.index.href()
          if (threadId) {
            cancelUrl += '?threadId=' + encodeURIComponent(threadId)
          }
          return redirect(cancelUrl)
        }

        // Read bookingResult after cancel check to avoid consuming it on cancel redirect
        if (session) {
          bookingResult = session.get('bookingResult') as string | undefined
          if (bookingResult) {
            session.unset('bookingResult')
          }
        }

        // Compute pagination state from available slots
        let bookingPage: BookingPageInfo = { currentPage: 0, totalDays: 0 }
        if (pendingBooking && pendingBooking.slots.length > 0) {
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
          bookingPage.totalDays = dayKeys.length
          let rawPage = parseInt(context.url.searchParams.get('page') ?? '', 10)
          if (!Number.isFinite(rawPage) || rawPage < 0) rawPage = 0
          if (rawPage >= bookingPage.totalDays) rawPage = bookingPage.totalDays - 1
          bookingPage.currentPage = rawPage
        }

        return context.render(
          <Layout>
            <CustomerChatPage
              messages={chatMessages}
              threadId={threadId}
              error={error}
              pendingBooking={pendingBooking}
              bookingResult={bookingResult}
              bookingPage={bookingPage}
            />
          </Layout>,
        )
      },

      async action(context) {
        let user = getCurrentUser()

        let _action = (context.formData.get('_action') as string | undefined) ?? 'message'

        if (_action === 'confirm_booking') {
          if (!bookingRateLimiter.attempt(user.id)) {
            return redirect(
              routes.chat.index.href() +
                '?error=' +
                encodeURIComponent(
                  'Bitte warte einen Moment, bevor du eine weitere Buchung auslöst.',
                ),
            )
          }
          let formData = context.formData

          let resourceIdRaw = formData.get('resource_id') as string | null
          let dayStartRaw = (formData.get('day_start') as string) ?? ''
          let title = safeTitle((formData.get('title') as string) ?? '')
          let threadId = (formData.get('threadId') as string) || crypto.randomUUID()
          if (!validateThreadId(threadId)) threadId = crypto.randomUUID()

          let errorUrl = (msg: string): string =>
            routes.chat.index.href() +
              '?threadId=' + encodeURIComponent(threadId) +
              '&error=' + encodeURIComponent(msg)

          if (!resourceIdRaw || !dayStartRaw) {
            return redirect(errorUrl('Fehlende Buchungsdaten.'))
          }

          let parts = dayStartRaw.split(':')
          if (parts.length !== 2) {
            return redirect(errorUrl('Ungültige Buchungsdaten.'))
          }
          let date = Number(parts[0])
          let startMin = Number(parts[1])
          let resourceId = Number(resourceIdRaw)

          if (!Number.isFinite(resourceId) || !Number.isFinite(date) || !Number.isFinite(startMin)) {
            return redirect(errorUrl('Ungültige Buchungsdaten.'))
          }

          // Validate submitted slot matches what the agent offered
          let session = context.session
          let pending: PendingBookingData | undefined
          if (session) {
            let pendingRaw = session.get('pendingBooking') as string | undefined
            if (pendingRaw) {
              try {
                pending = JSON.parse(pendingRaw) as PendingBookingData
              } catch (e) {
                if (process.env.NODE_ENV !== 'test') {
                  console.error('[CustomerChat] pendingBooking parse failed in confirm_booking: ' + String(e))
                }
                session.unset('pendingBooking')
              }
            }
          }
          if (!pending) {
            return redirect(errorUrl('Bitte fordere zuerst freie Termine an.'))
          }
          let isValidSlot = pending.slots.some(
            slot => slot.date_epoch_ms === date && slot.start_min === startMin,
          )
          if (!isValidSlot || pending.resource_id !== resourceId) {
            session?.unset('pendingBooking')
            return redirect(errorUrl('Diese Terminauswahl ist nicht mehr gültig.'))
          }

          let messageText: string
          let bookingSucceeded = false
          let slotToRemove: { date: number; startMin: number } | undefined
          try {
            let wf = mastra.getWorkflow('bookingWorkflow')
            if (!wf) {
              messageText = 'Buchung aktuell nicht verfügbar.'
            } else {
              let run = await wf.createRun()
              let wfResult = await run.start({
                inputData: { resourceId, date, startMin, title, userId: user.id },
              })

              if (wfResult.status === 'success' && wfResult.result?.success === true) {
                bookingSucceeded = true
                slotToRemove = { date, startMin }
                let dateStr = new Date(date).toLocaleDateString('de-DE', {
                  weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
                })
                let timeStr = formatMinOption(startMin)
                messageText = 'Termin #' + String(wfResult.result.id) + ' wurde für ' + dateStr + ' um ' + timeStr + ' Uhr gebucht.'
              } else if (wfResult.status === 'success' && wfResult.result?.error === 'collision') {
                slotToRemove = { date, startMin }
                messageText = 'Dieser Zeitraum ist leider nicht mehr frei. Bitte versuche es mit einem anderen Slot.'
              } else {
                messageText = 'Bei der Buchung ist ein Fehler aufgetreten. Bitte versuche es erneut.'
              }
            }
          } catch (err) {
            if (process.env.NODE_ENV !== 'test') {
              console.error('[booking] workflow failed:', err)
            }
            messageText = 'Bei der Buchung ist ein Fehler aufgetreten. Bitte versuche es erneut.'
          }

          if (session) {
            session.set('bookingResult', messageText)
            if (slotToRemove) {
              let remaining = pending.slots.filter(
                slot => !(slot.date_epoch_ms === slotToRemove.date && slot.start_min === slotToRemove.startMin),
              )
              if (remaining.length > 0) {
                session.set('pendingBooking', JSON.stringify({ ...pending, slots: remaining }))
              } else {
                session.unset('pendingBooking')
              }
            }
          }

          return redirect(
            routes.chat.index.href() +
              '?threadId=' +
              encodeURIComponent(threadId) +
              '#chat-end',
          )
        }

        let parsed = s.parseSafe(messageSchema, context.formData)
        if (!parsed.success) {
          return redirect(
            routes.chat.index.href() +
              '?error=' +
              encodeURIComponent('Bitte gib eine Nachricht ein.'),
          )
        }

        let message = parsed.value.message
        if (!message || message.trim().length === 0) {
          return redirect(
            routes.chat.index.href() +
              '?error=' +
              encodeURIComponent('Bitte gib eine Nachricht ein.'),
          )
        }
        if (message.length > MAX_MESSAGE_LENGTH) {
          return redirect(
            routes.chat.index.href() +
              '?error=' +
              encodeURIComponent(`Nachricht zu lang (maximal ${MAX_MESSAGE_LENGTH} Zeichen).`),
          )
        }

        if (!chatRateLimiter.attempt(user.id)) {
          return redirect(
            routes.chat.index.href() +
              '?error=' +
              encodeURIComponent(
                'Bitte warte einen Moment, bevor du eine weitere Nachricht sendest.',
              ),
          )
        }

        let threadId = parsed.value.threadId
        if (threadId && !validateThreadId(threadId)) {
          return redirect(
            routes.chat.index.href() +
              '?error=' +
              encodeURIComponent('Ungültiges Thread-ID-Format.'),
          )
        }

        if (!threadId) {
          threadId = crypto.randomUUID()
        }

        // Clear stale booking data from previous turns — agent will re-set it if it finds slots
        let session = context.session
        if (session) {
          session.unset('pendingBooking')
        }

        let abortController = new AbortController()
        let timeout = setTimeout(() => abortController.abort(), AGENT_TIMEOUT_MS)

        try {
          let agent =
            process.env.NODE_ENV === 'test' && _testAgent
              ? _testAgent
              : mastra.getAgent('customerAgent')

          let result = await runWithUserId(user.id, () => agent.generate(message, {
            maxSteps: 5,
            abortSignal: abortController.signal,
            memory: {
              thread: threadId,
              resource: String(user.id),
            },
          }))

          let responseText = result.text ?? ''
          if (!responseText.trim()) {
            return redirect(
              routes.chat.index.href() +
                '?error=' +
                encodeURIComponent('Keine Antwort erhalten. Bitte versuche es erneut.'),
            )
          }

          // Process tool results from the agent run
          let toolRes = (result.toolResults ?? []) as unknown[]
          let lastSlotResult: Record<string, unknown> | undefined
          let workflowResult: Record<string, unknown> | undefined
          let workflowToolName: string | undefined

          for (let tr of toolRes) {
            let entry = tr as Record<string, unknown> | undefined
            let payload = (entry?.payload as Record<string, unknown> | undefined) ?? entry
            let toolName = payload?.toolName as string | undefined

            if (toolName === 'find_next_available_slots' || toolName === 'findNextAvailableSlots') {
              let trResult = payload?.result as Record<string, unknown> | undefined
              if (trResult?.slots && Array.isArray(trResult.slots) && (trResult.slots as unknown[]).length > 0) {
                lastSlotResult = trResult
              }
            }

            if (toolName === 'trigger_booking_workflow' || toolName === 'triggerBookingWorkflow' ||
                toolName === 'cancel_booking' || toolName === 'cancelBooking') {
              let trResult = payload?.result as Record<string, unknown> | undefined
              if (trResult) {
                workflowResult = trResult
                workflowToolName = toolName
              }
            }
          }

          // Store pending booking slots in session for the old booking form
          if (lastSlotResult && session) {
            let slots = lastSlotResult.slots as unknown[]
            if (slots.length > 60) {
              slots = slots.slice(0, 60)
            }
            session.set('pendingBooking', JSON.stringify({
              slots,
              resource_id: lastSlotResult.resource_id,
              resource_name: lastSlotResult.resource_name,
              title: lastSlotResult.title ?? '',
            }))
          }

          // Store workflow trigger result in session for display
          if (workflowResult && session) {
            let msg: string
            if (workflowToolName === 'cancel_booking' || workflowToolName === 'cancelBooking') {
              if (workflowResult.success) {
                msg = 'Termin #' + String(workflowResult.appointmentId ?? '') + ' wurde storniert.'
              } else {
                let err = String(workflowResult.error ?? 'unknown')
                if (err === 'not_owner') msg = 'Dieser Termin gehört Ihnen nicht und kann nicht storniert werden.'
                else if (err === 'already_cancelled') msg = 'Dieser Termin wurde bereits storniert.'
                else msg = 'Bei der Stornierung ist ein Fehler aufgetreten.'
              }
            } else {
              if (workflowResult.success) {
                msg = 'Termin #' + String(workflowResult.appointmentId ?? '') + ' wurde erfolgreich gebucht.'
                // Booking succeeded via workflow — clear the pending slot form
                session.unset('pendingBooking')
              } else {
                let err = String(workflowResult.error ?? 'unknown')
                if (err === 'collision') msg = 'Dieser Zeitraum ist leider nicht mehr frei. Bitte versuche es mit einem anderen Slot.'
                else msg = 'Bei der Buchung ist ein Fehler aufgetreten. Bitte versuche es erneut.'
              }
            }
            session.set('bookingResult', msg)
          }

          let url =
            routes.chat.index.href() +
            '?threadId=' +
            encodeURIComponent(threadId) +
            '#chat-end'
          return redirect(url)
        } catch (error) {
          if (
            error instanceof Error &&
            (error.name === 'AbortError' ||
              error.name === 'TimeoutError' ||
              /abort/i.test(error.message))
          ) {
            return redirect(
              routes.chat.index.href() +
                '?error=' +
                encodeURIComponent(
                  'Die Anfrage hat zu lange gedauert. Bitte versuche es erneut.',
                ),
            )
          }
          return redirect(
            routes.chat.index.href() +
              '?error=' +
              encodeURIComponent(
                'Bei der Verarbeitung ist ein Fehler aufgetreten. Bitte versuche es erneut.',
              ),
          )
        } finally {
          clearTimeout(timeout)
        }
      },
    },
  },
)
