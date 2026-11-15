import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from './test-router.ts'
import { frames, routes } from './routes.ts'
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
  { name: frames.agentEventsPanel, url: routes.admin.agentEvents.panel.href() },
  { name: frames.supportAgentPanel, url: routes.admin.supportAgent.panel.href() },
  { name: 'user-detail-1', url: routes.admin.fragments.userDetail.href({ userId: '1' }) },
]

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
})
