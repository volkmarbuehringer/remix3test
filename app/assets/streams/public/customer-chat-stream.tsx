import { clientEntry, css, ref, type Handle } from 'remix/component'

import { setupAutoGrowTextarea } from '../../../ui/auto-grow-textarea.ts'
import { createCustomerChatController } from './customer-chat-controller.ts'
import { createCustomerChatRenderer } from './customer-chat-render.ts'

export const CustomerChatStream = clientEntry(
  import.meta.url + '#CustomerChatStream',
  function CustomerChatStream(handle: Handle) {
    let ac = new AbortController()
    let lifecycleSignal = (handle.signal ?? ac.signal) as AbortSignal
    if (handle.signal) {
      handle.signal.addEventListener('abort', () => ac.abort(), { once: true })
    }

    let autoGrowReset: (() => void) | null = null

    // The DOM render path (bubbles, tool cards, the busy indicator, gate
    // cards, focus) lives in customer-chat-render.ts; this entry owns the
    // event wiring and composer handlers and talks to it through the
    // delegate interface.
    let delegate = createCustomerChatRenderer()

    let controller = createCustomerChatController(delegate, {
      lifecycleSignal,
      reconnectHref: '/chat/reconnect',
    })

    // ── Composer ──────────────────────────────────────────────

    /** Keeps the visible counter in sync with the textarea's own maxLength. */
    function updateCounter() {
      let counter = document.getElementById('chat-counter')
      let textarea = document.getElementById('msg') as HTMLTextAreaElement | null
      if (counter && textarea) {
        counter.textContent = `${textarea.value.length} / ${textarea.maxLength}`
      }
    }

    function handleTextareaKeydown(e: KeyboardEvent) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        let form = document.getElementById('chat-form') as HTMLFormElement | null
        form?.requestSubmit()
      }
    }

    // ── Event handlers ────────────────────────────────────────

    async function handleFormSubmit(e: Event) {
      e.preventDefault()
      let form = e.target as HTMLFormElement
      if (!form) return

      let formData = new FormData(form)
      let message = formData.get('message')?.toString().trim()
      if (!message) return

      // Which conversation a turn belongs to is decided by the page that is on
      // screen, not by this entry's captured state. "Neue Unterhaltung" is an
      // in-app navigation: the runtime reconciles the page and REUSES the form
      // element, so this listener — with the previous page's thread still in
      // its closure — can serve the fresh page. The URL wins over the closure:
      // `?new=1` always starts a new thread, and otherwise the rendered chat
      // area is the source of truth.
      let startingFresh = controller.threadFromPageWins()
      if (!startingFresh) controller.setThreadOnForm(formData)

      delegate.appendMessage(message, 'user')
      let textarea = document.getElementById('msg') as HTMLTextAreaElement | null
      if (textarea) textarea.value = ''
      autoGrowReset?.()
      updateCounter()
      controller.beginTurn()
      await controller.submit('/chat', formData)
    }

    function handleCancel() {
      controller.abort()
      delegate.setBusy(false)
      delegate.setFormEnabled(true)
      delegate.focusComposer()
    }

    function handleSlotCancel() {
      controller.abort()
      let picker = document.getElementById('chat-slot-picker')
      if (picker) picker.remove()
      delegate.setBusy(false)
      delegate.setFormEnabled(true)
      delegate.focusComposer()
    }

    async function handleSlotClick(e: Event) {
      let btn = e.target as HTMLButtonElement
      let raw = btn.dataset.slot
      if (!raw) return

      let slot: {
        resourceId: number
        dateEpochMs: number
        startMin: number
        label: string
        resourceName: string
      }
      try {
        slot = JSON.parse(raw)
      } catch {
        return
      }

      let dayStr = new Date(slot.dateEpochMs).toLocaleDateString('de-DE', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
      })
      let message = `Ich möchte den Termin am ${dayStr} um ${slot.label} bei ${slot.resourceName} buchen.`
      delegate.appendMessage(message, 'user')

      let formData = new FormData()
      controller.setThreadOnForm(formData)
      formData.set('message', message)

      controller.beginTurn()
      await controller.submit('/chat', formData)
    }

    let submittingOtherResource = false

    async function handleOtherResource() {
      if (submittingOtherResource) return
      submittingOtherResource = true
      let message = 'Ich möchte eine andere Ressource ausprobieren.'
      delegate.appendMessage(message, 'user')

      let formData = new FormData()
      controller.setThreadOnForm(formData)
      formData.set('message', message)

      controller.beginTurn()
      await controller.submit('/chat', formData)
      submittingOtherResource = false
    }

    async function handleApproval(action: 'approve' | 'decline', form: HTMLFormElement) {
      // Carry the form's hidden runId/toolCallId/threadId into the streamed
      // request. The SSE path authenticates with the X-Sse-Request header, so
      // the native CSRF token is not part of this transport.
      let body = new FormData(form)
      body.delete('_csrf')

      delegate.hideApproval()
      controller.beginTurn()

      await controller.submit('/chat/' + action, body)
    }

    async function handleAnswer(form: HTMLFormElement) {
      // Carry the form's hidden runId/toolCallId/selectionMode and the named
      // answer control(s) into the streamed request. The SSE path authenticates
      // with the X-Sse-Request header, so the native CSRF token is dropped.
      let body = new FormData(form)
      body.delete('_csrf')
      let answers = body
        .getAll('answer')
        .map(String)
        .filter((value) => value.length > 0)
      if (answers.length === 0) return

      controller.beginTurn()

      await controller.submit('/chat/answer', body)
    }

    return () => (
      <div
        mix={[
          css({ display: 'none' }),
          ref((el) => {
            let form = document.getElementById('chat-form') as HTMLFormElement | null
            if (form) {
              form.addEventListener('submit', handleFormSubmit, { signal: lifecycleSignal })
            }

            let textarea = document.getElementById('msg') as HTMLTextAreaElement | null
            if (textarea) {
              textarea.addEventListener('keydown', handleTextareaKeydown, {
                signal: lifecycleSignal,
              })
              textarea.addEventListener('input', updateCounter, { signal: lifecycleSignal })
              autoGrowReset = setupAutoGrowTextarea(textarea, { signal: lifecycleSignal }).reset
              updateCounter()
            }

            let chatArea = document.getElementById('chat-messages')
            // Adopt the resumed thread id that the server rendered (see
            // customer-chat-page.tsx data-thread-id), or null for a fresh thread.
            controller.adoptThreadFromDom()
            if (chatArea) {
              chatArea.addEventListener(
                'click',
                (e) => {
                  let target = e.target as HTMLElement
                  if (target.id === 'chat-cancel') {
                    handleCancel()
                  } else if (target.classList.contains('slot-btn')) {
                    void handleSlotClick(e)
                  } else if (target.classList.contains('slot-other-resource-btn')) {
                    void handleOtherResource()
                  } else if (target.classList.contains('slot-close-btn')) {
                    handleSlotCancel()
                  }
                },
                { signal: lifecycleSignal },
              )

              // Upgrade the native gate forms to the SSE transport. The
              // elements stay real forms, so a no-JS submit still posts to
              // /chat/approve, /chat/decline or /chat/answer via the form action.
              chatArea.addEventListener(
                'submit',
                (e) => {
                  let gateForm = e.target
                  if (!(gateForm instanceof HTMLFormElement)) return
                  if (gateForm.id === 'chat-approval') {
                    e.preventDefault()
                    let submitter = (e as SubmitEvent).submitter as HTMLButtonElement | null
                    void handleApproval(
                      submitter?.value === 'decline' ? 'decline' : 'approve',
                      gateForm,
                    )
                  } else if (gateForm.id === 'chat-question') {
                    e.preventDefault()
                    void handleAnswer(gateForm)
                  }
                },
                { signal: lifecycleSignal },
              )
            }

            // Re-surface a gate that survived a reload / dropped stream.
            void controller.reconnect()
          }),
        ]}
      />
    )
  },
)
