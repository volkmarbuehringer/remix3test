import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from '../../ui/theme/theme.ts'
import { createController } from 'remix/router'
import { redirect } from 'remix/response/redirect'

import { routes } from '../../routes.ts'
import { requireAuth } from '../../middleware/auth.ts'
import { getCurrentUser } from '../../utils/context.ts'
import { getPageSize } from '../../utils/get-page-size.ts'
import { parseId } from '../../utils/ids.ts'
import { Layout } from '../../ui/layout.tsx'
import { PageSection, panelCss } from '../../ui/page-primitives.tsx'
import { CsrfTokenInput } from '../../ui/csrf-token-input.tsx'
import { notificationsChannel } from '../../utils/notifications-sse.ts'
import {
  listUserNotifications,
  markRead,
  markAllRead,
  unreadCount as countUnread,
} from '../../data/notifications.ts'
import type { Notification } from '../../data/schema.ts'

const DEFAULT_PAGE_SIZE = 15

function readOffset(url: URL): number {
  let raw = url.searchParams.get('offset')
  let n = raw === null ? NaN : Number(raw)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0
}

export default createController(routes.notifications, {
  middleware: [requireAuth()],
  actions: {
    async index(context) {
      let user = getCurrentUser()
      let pageSize = getPageSize(context.session, DEFAULT_PAGE_SIZE)
      let offset = readOffset(context.url)
      let { rows, hasMore } = await listUserNotifications(context.db, user.id, {
        pageSize,
        offset,
      })
      return context.render(
        <NotificationsPage
          notifications={rows}
          offset={offset}
          pageSize={pageSize}
          hasMore={hasMore}
        />,
      )
    },

    events(context) {
      let user = getCurrentUser()
      return notificationsChannel.subscribe(context.request, String(user.id))
    },

    async unreadCount(context) {
      let user = getCurrentUser()
      let count = await countUnread(context.db, user.id)
      return context.json({ count })
    },

    async markRead(context) {
      let user = getCurrentUser()
      let id = parseId(context.params.id)
      if (id != null) {
        await markRead(context.db, user.id, id)
      }
      return redirect(backUrl(context.url, routes.notifications.index.href()))
    },

    async markAllRead(context) {
      let user = getCurrentUser()
      await markAllRead(context.db, user.id)
      return redirect(backUrl(context.url, routes.notifications.index.href()))
    },
  },
})

function backUrl(url: URL, base: string): string {
  let offset = readOffset(url)
  return offset > 0 ? `${base}?offset=${offset}` : base
}

// ── Notifications inbox page ──

const TYPE_LABELS: Record<string, string> = {
  confirmation: 'Bestätigung',
  reminder: 'Erinnerung',
  cancellation: 'Storno',
}

type NotificationsPageProps = {
  notifications: Notification[]
  offset: number
  pageSize: number
  hasMore: boolean
}

function NotificationsPage(handle: Handle<NotificationsPageProps>) {
  return () => {
    let { notifications, offset, pageSize, hasMore } = handle.props
    let base = routes.notifications.index.href()
    let prevHref = offset > 0 ? `${base}?offset=${Math.max(0, offset - pageSize)}` : base
    let nextHref = `${base}?offset=${offset + pageSize}`

    return (
      <Layout title="Benachrichtigungen">
        <PageSection
          title="Benachrichtigungen"
          description="Bestätigungen, Erinnerungen und Stornierungen zu Ihren Terminen."
        >
          <div mix={panelCss}>
            {notifications.length === 0 ? (
              <p mix={emptyCss}>Keine Benachrichtigungen.</p>
            ) : (
              <>
                <div mix={toolbarCss}>
                  <form action={routes.notifications.markAllRead.href()} method="POST">
                    <CsrfTokenInput />
                    <input type="hidden" name="_action" value="mark-all-read" />
                    <button type="submit" mix={markAllBtnCss}>
                      Alle als gelesen markieren
                    </button>
                  </form>
                </div>

                <ul mix={listCss} data-notifications-list>
                  {notifications.map((n) => (
                    <li
                      key={n.id}
                      mix={[itemCss, n.read_at == null ? unreadCss : readCss]}
                      data-notification-id={n.id}
                    >
                      <div mix={itemMainCss}>
                        <span mix={badgeCss}>{TYPE_LABELS[n.type] ?? n.type}</span>
                        <div mix={itemTextCss}>
                          <strong mix={titleCss}>{n.title}</strong>
                          <span mix={bodyCss}>{n.body}</span>
                          <span mix={timeCss}>{formatTimestamp(n.created_at)}</span>
                        </div>
                      </div>
                      <div mix={itemActionsCss}>
                        {n.appointment_id != null ? (
                          <a href={routes.appointment.index.href()} mix={linkCss}>
                            Zum Termin
                          </a>
                        ) : null}
                        {n.read_at == null ? (
                          <form
                            action={routes.notifications.markRead.href({ id: n.id })}
                            method="POST"
                          >
                            <CsrfTokenInput />
                            <input type="hidden" name="_action" value="mark-read" />
                            <button type="submit" mix={readBtnCss}>
                              Als gelesen
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>

                <div mix={paginationCss}>
                  {offset > 0 ? (
                    <a href={prevHref} mix={pageLinkCss}>
                      Zurück
                    </a>
                  ) : (
                    <span />
                  )}
                  {hasMore ? (
                    <a href={nextHref} mix={pageLinkCss}>
                      Weiter
                    </a>
                  ) : (
                    <span />
                  )}
                </div>
              </>
            )}
          </div>
        </PageSection>
      </Layout>
    )
  }
}

function formatTimestamp(ms: number): string {
  let d = new Date(ms)
  let date = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  let time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  return `${date}, ${time} Uhr`
}

// ── Styles ──

const emptyCss = css({
  color: theme.colors.text.muted,
  padding: '1.5rem 0',
})

const toolbarCss = css({
  display: 'flex',
  justifyContent: 'flex-end',
  marginBottom: '1rem',
})

const markAllBtnCss = css({
  padding: '0.5rem 0.9rem',
  borderRadius: theme.radius.sm,
  border: `1px solid ${theme.colors.border.subtle}`,
  background: theme.surface.lvl1,
  color: theme.colors.text.primary,
  cursor: 'pointer',
})

const listCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  padding: 0,
  margin: 0,
  listStyle: 'none',
})

const itemCss = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '1rem',
  padding: '0.85rem 1rem',
  borderRadius: theme.radius.sm,
  border: `1px solid ${theme.colors.border.subtle}`,
  background: theme.surface.lvl1,
})

const unreadCss = css({
  background: theme.surface.lvl2,
})

const readCss = css({
  opacity: 0.7,
})

const itemMainCss = css({
  display: 'flex',
  alignItems: 'flex-start',
  gap: '0.75rem',
  minWidth: 0,
})

const badgeCss = css({
  flexShrink: 0,
  padding: '0.15rem 0.5rem',
  borderRadius: theme.radius.sm,
  fontSize: theme.fontSize.xs,
  fontWeight: 600,
  background: theme.colors.border.subtle,
  color: theme.colors.text.primary,
})

const itemTextCss = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.15rem',
  minWidth: 0,
})

const titleCss = css({
  fontSize: theme.fontSize.sm,
  fontWeight: 600,
  color: theme.colors.text.primary,
})

const bodyCss = css({
  fontSize: theme.fontSize.sm,
  color: theme.colors.text.secondary,
})

const timeCss = css({
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.muted,
})

const itemActionsCss = css({
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  flexShrink: 0,
})

const linkCss = css({
  fontSize: theme.fontSize.sm,
  color: theme.colors.text.primary,
  textDecoration: 'underline',
})

const readBtnCss = css({
  padding: '0.35rem 0.7rem',
  borderRadius: theme.radius.sm,
  border: `1px solid ${theme.colors.border.subtle}`,
  background: theme.surface.lvl0,
  color: theme.colors.text.primary,
  cursor: 'pointer',
  fontSize: theme.fontSize.sm,
})

const paginationCss = css({
  display: 'flex',
  justifyContent: 'space-between',
  marginTop: '1rem',
})

const pageLinkCss = css({
  padding: '0.5rem 0.9rem',
  borderRadius: theme.radius.sm,
  border: `1px solid ${theme.colors.border.subtle}`,
  color: theme.colors.text.primary,
  textDecoration: 'none',
})
