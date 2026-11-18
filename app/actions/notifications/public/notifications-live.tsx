import { clientEntry, css, type Handle } from 'remix/component'

import { theme } from '../../../ui/theme/theme.ts'

type Status = 'idle' | 'saving' | 'refreshing' | 'save-failed' | 'refresh-failed'

/**
 * Keeps the notifications panel current without a navigation.
 *
 * Two inputs can change what the panel should show:
 *
 * - The per-user SSE channel pushes `new` when a row lands
 *   (`app/utils/notifications-sse.ts`). The entry lives in the `notifications-content`
 *   frame, so a reload re-renders only the panel while reconciliation keeps scroll
 *   and focus — a frame reload is not a Navigation API navigation
 *   (`app/ui/page-scroll-reset.browser.tsx`), and client entries keep their setup
 *   state across it.
 * - The panel's own POST forms (mark read / mark all read / page size) still work
 *   without JavaScript. With the runtime running they are submitted with `fetch`
 *   instead: the action runs, its 303 is not followed, and the frame reloads.
 *   That keeps the address bar and history untouched; letting the runtime
 *   navigate the form would commit `POST /notifications/<id>/read` as the page
 *   URL, and following the redirect would render the whole document only to
 *   throw it away.
 *
 * Operations are serialized: a submit that lands while a live reload is running is
 * queued instead of dropped, and only the active operation owns the status line.
 * `read` events are deliberately not subscribed: the server broadcasts them from
 * this tab's own mutation, which already queues the reload, and the bell handles
 * the cross-tab count.
 *
 * The subscription and the submit listener open once per mount in `queueTask` (a
 * no-op during SSR) and are removed through `handle.signal`. The URL is
 * intentionally mount-time config: it is the channel for the current user, and the
 * entry survives the reloads it triggers.
 */
export const NotificationsLive = clientEntry(
  import.meta.url + '#NotificationsLive',
  function NotificationsLive(handle: Handle<{ eventsUrl: string }>) {
    let status: Status = 'idle'
    // Tasks run one at a time; a rejected task must not stall the chain.
    let queue: Promise<void> = Promise.resolve()
    let reloadQueued = false
    // A form submitted twice (double click, Enter plus click) must not queue two
    // mutations; the second cancel is still handled by `onSubmit`.
    let pendingForms = new WeakSet<HTMLFormElement>()

    function setStatus(next: Status): void {
      status = next
      void handle.update()
    }

    function enqueue(task: () => Promise<void>): void {
      queue = queue.then(task).catch((error: unknown) => {
        console.error('[notifications] mutation task failed', error)
      })
    }

    async function reloadPanel(): Promise<void> {
      setStatus('refreshing')
      try {
        await handle.frame.reload()
        if (handle.signal.aborted) return
        setStatus('idle')
      } catch (error) {
        if (handle.signal.aborted) return
        console.error('[notifications] live refresh failed', error)
        setStatus('refresh-failed')
      }
    }

    function queueReload(): void {
      if (reloadQueued) return
      reloadQueued = true
      enqueue(async () => {
        reloadQueued = false
        await reloadPanel()
      })
    }

    async function submitMutation(
      form: HTMLFormElement,
      submitter: HTMLElement | null,
    ): Promise<void> {
      setStatus('saving')
      try {
        let response = await fetch(form.action, {
          method: form.method.toUpperCase(),
          body: new FormData(form, submitter),
          credentials: 'same-origin',
          // The action answers 303. Following it would render the full document
          // just to discard it; the frame reload below is the only render this
          // mutation needs. Browsers expose the unfollowed redirect as opaque.
          redirect: 'manual',
          signal: handle.signal,
        })
        if (response.type !== 'opaqueredirect' && !response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
      } catch (error) {
        if (handle.signal.aborted) return
        console.error('[notifications] mutation failed', error)
        setStatus('save-failed')
        return
      }
      if (handle.signal.aborted) return
      queueReload()
    }

    function onSubmit(event: SubmitEvent): void {
      let form = event.target
      if (!(form instanceof HTMLFormElement)) return
      if (!form.closest('[data-notifications-panel]')) return
      if (form.method.toLowerCase() !== 'post') return
      // Capture phase: cancel before the runtime's form navigation can start.
      event.preventDefault()
      if (pendingForms.has(form)) return
      pendingForms.add(form)
      let submitter = event.submitter instanceof HTMLElement ? event.submitter : null
      enqueue(async () => {
        try {
          await submitMutation(form, submitter)
        } finally {
          pendingForms.delete(form)
        }
      })
    }

    handle.queueTask(() => {
      let { eventsUrl } = handle.props
      if (eventsUrl && typeof EventSource !== 'undefined') {
        let source = new EventSource(eventsUrl)
        source.addEventListener('new', () => queueReload())
        handle.signal.addEventListener('abort', () => source.close())
      }
      document.addEventListener('submit', onSubmit, { capture: true, signal: handle.signal })
    })

    return () => {
      let text =
        status === 'saving'
          ? 'Wird gespeichert…'
          : status === 'refreshing'
            ? 'Wird aktualisiert…'
            : status === 'save-failed'
              ? 'Aktion fehlgeschlagen.'
              : status === 'refresh-failed'
                ? 'Aktualisierung fehlgeschlagen.'
                : ''
      return (
        <p data-notifications-live role="status" aria-live="polite" mix={statusCss}>
          {text}
        </p>
      )
    }
  },
)

const statusCss = css({
  margin: 0,
  fontSize: theme.fontSize.sm,
  color: theme.colors.text.muted,
})
