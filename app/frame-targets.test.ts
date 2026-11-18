import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from './test-router.ts'
import { frames, routes } from './routes.ts'
import { readSessionId, sessionStorage } from './middleware/session.ts'
import { createAuthCookieWithCsrfForUser } from '../test/utils.ts'

// ---------------------------------------------------------------------------
// Frame-target fragment contract (guide 06 §"Use a frame for route-owned UI").
//
// A `<Frame>` region is a route, and the route must render only that region —
// not the app's document shell — when the request carries its `X-Remix-Target`.
// A route that forgets to branch still returns 200 HTML, so the browser would
// reconcile a full `<html>` document into the frame and the runtime would throw
// (`Node.insertBefore` on a document) instead of showing the region.
//
// Every named target in `frames` is exercised here, plus one dynamic
// `user-detail-*` name. Assert the response is HTML and has no `<html>` element;
// the admin/list shells legitimately include their sidebar, so only the document
// tag is a violation. The frame-specific content is asserted separately by the
// owning route tests (e.g. `admin-fragments.test.ts`).
// ---------------------------------------------------------------------------

const frameTargets: Array<{ name: string; url: string }> = [
  { name: frames.adminContent, url: routes.admin.users.index.href() },
  { name: frames.listsContent, url: routes.admin.lists.index.href() },
  { name: frames.adminStats, url: routes.admin.fragments.stats.href() },
  { name: frames.adminRecentActivity, url: routes.admin.fragments.recentActivity.href() },
  {
    name: frames.adminChatlogDetail,
    url: routes.admin.chatlog.fragments.detail.href({ id: '1' }),
  },
  { name: frames.appointmentContent, url: routes.appointment.index.href() },
  { name: frames.appointmentsNewContent, url: routes.appointmentsNew.index.href() },
  { name: frames.appointTypes, url: routes.appointment.types.index.href() },
  { name: frames.settingsPanel, url: routes.settings.index.href() },
  { name: frames.notificationsContent, url: routes.notifications.index.href() },
  { name: frames.agentEventsPanel, url: routes.admin.agentEvents.panel.href() },
  { name: frames.supportAgentPanel, url: routes.admin.supportAgent.panel.href() },
  { name: 'user-detail-1', url: routes.admin.fragments.userDetail.href({ userId: '1' }) },
]

/**
 * Dual-render fragment paths that own the one-shot PRG flash (the in-frame
 * redirect destinations, the two list shells, and the appointment grid). A
 * renderer that forgets to wrap its content in `FlashFragment` returns a
 * fragment without the message, which the old per-renderer
 * `<FlashBanner compact />` convention allowed silently.
 */
const flashFragmentTargets: Array<{ name: string; url: string }> = [
  { name: frames.adminContent, url: routes.admin.users.index.href() },
  { name: frames.listsContent, url: routes.admin.lists.index.href() },
  { name: frames.listsContent, url: routes.lists.index.href() },
  { name: frames.settingsPanel, url: routes.settings.index.href() },
  { name: frames.appointmentsNewContent, url: routes.appointmentsNew.index.href() },
  { name: frames.appointmentContent, url: routes.appointment.index.href() },
  // The admin shell's content-only branch (a page embedded in an agent panel).
  { name: frames.supportAgentPanel, url: routes.admin.users.index.href() },
  // A Verwaltung page accepts all three content-frame targets.
  { name: frames.agentEventsPanel, url: routes.verwaltung.offerings.index.href() },
]

/** A fresh admin cookie whose session already carries a one-shot flash. */
async function cookieWithFlash(message: string): Promise<string> {
  let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
  assert.ok(auth?.cookie, 'admin session must be created')
  let sid = await readSessionId(auth.cookie)
  assert.ok(sid, 'the admin cookie must carry a session id')
  let session = await sessionStorage.read(sid)
  session.flash('success', message)
  await sessionStorage.save(session)
  return auth.cookie
}

describe('frame targets render fragments, not documents', () => {
  it('returns no <html> document shell for any named frame target', async () => {
    let auth = await createAuthCookieWithCsrfForUser('admin@newapp.com')
    assert.ok(auth?.cookie, 'admin session must be created')

    for (let { name, url } of frameTargets) {
      let response = await router.fetch(new URL(url, 'http://localhost'), {
        headers: {
          'X-Remix-Frame': 'true',
          'X-Remix-Target': name,
          Cookie: auth!.cookie,
        },
      })

      assert.equal(response.status, 200, `${name} (${url}) should render a fragment`)
      assert.match(
        response.headers.get('Content-Type') ?? '',
        /text\/html/,
        `${name} should answer HTML`,
      )

      let html = await response.text()
      assert.doesNotMatch(html, /<html[\s>]/i, `${name} must not include the document shell`)
    }
  })

  it('surfaces a session flash in every fragment render path exactly once', async () => {
    for (let { name, url } of flashFragmentTargets) {
      let message = `frame-flash:${name}:${url}`
      let cookie = await cookieWithFlash(message)

      let response = await router.fetch(new URL(url, 'http://localhost'), {
        headers: {
          'X-Remix-Frame': 'true',
          'X-Remix-Target': name,
          Cookie: cookie,
        },
      })

      assert.equal(response.status, 200, `${name} (${url}) should render a fragment`)
      let html = await response.text()
      assert.doesNotMatch(html, /<html[\s>]/i, `${name} (${url}) must be a fragment`)
      assert.equal(
        html.split(message).length - 1,
        1,
        `${name} (${url}) must surface the one-shot flash exactly once`,
      )
    }
  })
})
