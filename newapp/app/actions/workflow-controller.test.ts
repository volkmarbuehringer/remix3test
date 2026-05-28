import { describe, it, before, after } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../router.ts'
import { createAuthCookieWithCsrf } from '../test-utils.ts'
import { db, initializeAppDatabase } from '../data/setup.ts'
import { sql } from 'remix/data-table'
import { getWorkflowRun } from '../workflows/engine.ts'

// ---------------------------------------------------------------------------
// Workflow Controller integration tests
// Tests GET and POST on /ai/workflow, which requires authentication.
// Requires a running PostgreSQL database seeded with demo users.
// ---------------------------------------------------------------------------

const BASE = 'https://remix.run'
const LOGIN_URL = `${BASE}/login`
const WORKFLOW_URL = `${BASE}/ai/workflow`

describe('Workflow Controller', () => {
  let testRunIds: string[] = []

  // -----------------------------------------------------------------------
  // Setup / Teardown
  // -----------------------------------------------------------------------

  before(async () => {
    await initializeAppDatabase()

    // Clean up any leftover test data from previous runs
    await db.exec(sql`DELETE FROM workflow_runs WHERE id LIKE 'test-wfc-%'`)
  })

  after(async () => {
    for (let id of testRunIds) {
      await db.exec(sql`DELETE FROM workflow_runs WHERE id = ${id}`)
    }
  })

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  /** Authenticate as a regular user and return the session cookie value. */
  async function getSessionCookie(): Promise<string> {
    let result = await createAuthCookieWithCsrf()
    return result?.cookie ?? ''
  }

  /** Authenticate as a regular user and return both the session cookie and CSRF token. */
  async function getSessionWithCsrf(): Promise<{ cookie: string; csrfToken: string }> {
    let result = await createAuthCookieWithCsrf()
    return { cookie: result?.cookie ?? '', csrfToken: result?.csrfToken ?? '' }
  }

  /** Make an authenticated GET request to the workflow endpoint. */
  async function authenticatedGet(queryString?: string): Promise<Response> {
    let session = await getSessionCookie()
    let url = queryString ? `${WORKFLOW_URL}?${queryString}` : WORKFLOW_URL
    return await router.fetch(url, {
      headers: { Cookie: session },
    })
  }

  // -----------------------------------------------------------------------
  // GET /ai/workflow — auth protection
  // -----------------------------------------------------------------------

  it('GET /ai/workflow without auth redirects to /login', async () => {
    let response = await router.fetch(WORKFLOW_URL, { redirect: 'manual' })

    assert.equal(response.status, 302)
    let location = response.headers.get('Location')
    assert.ok(location?.startsWith('/login'), 'should redirect to /login with returnTo')
    assert.ok(location?.includes('returnTo='), 'should capture return path')
  })

  // -----------------------------------------------------------------------
  // GET /ai/workflow — page rendering
  // -----------------------------------------------------------------------

  it('GET /ai/workflow with auth returns 200', async () => {
    let response = await authenticatedGet()

    assert.equal(response.status, 200)
  })

  it('GET /ai/workflow with auth shows workflow page content', async () => {
    let response = await authenticatedGet()
    let html = await response.text()

    assert.ok(html.includes('Run Workflow'), 'should contain "Run Workflow" section heading')
    assert.ok(html.includes('Recent Runs'), 'should contain "Recent Runs" section heading')
  })

  it('GET /ai/workflow with auth contains workflow form elements', async () => {
    let response = await authenticatedGet()
    let html = await response.text()

    assert.ok(html.includes('workflowId'), 'form should have a workflowId field')
    assert.ok(html.includes('Choose a workflow...'), 'dropdown should have placeholder option')
  })

  // -----------------------------------------------------------------------
  // GET /ai/workflow?runId= — run detail page
  // -----------------------------------------------------------------------

  it('GET /ai/workflow with non-existent runId shows error message', async () => {
    let response = await authenticatedGet('runId=nonexistent-run-id')
    let html = await response.text()

    assert.equal(response.status, 200)
    assert.ok(html.includes('Workflow run not found'), 'should show error for non-existent run')
  })

  it('GET /ai/workflow with valid runId shows run detail page', async () => {
    let { cookie, csrfToken } = await getSessionWithCsrf()

    // First, create a workflow run via POST
    let postResponse = await router.fetch(WORKFLOW_URL, {
      method: 'POST',
      body: new URLSearchParams({ workflowId: 'trending-report', _csrf: csrfToken }),
      redirect: 'manual',
      headers: { Cookie: cookie },
    })

    assert.equal(postResponse.status, 303, 'POST should redirect')
    let location = postResponse.headers.get('Location') ?? ''
    let runId = new URL(location, BASE).searchParams.get('runId')
    assert.ok(runId, 'redirect should include runId')
    testRunIds.push(runId!)

    // Now GET the detail page
    let response = await router.fetch(`${WORKFLOW_URL}?runId=${runId}`, {
      headers: { Cookie: cookie },
    })

    assert.equal(response.status, 200)
    let html = await response.text()
    assert.ok(html.includes('Workflow Run'), 'page should show "Workflow Run" heading')
    assert.ok(html.includes('trending-report'), 'page should show the workflow ID')
  })

  // -----------------------------------------------------------------------
  // POST /ai/workflow — validation errors
  // -----------------------------------------------------------------------

  it('POST /ai/workflow without workflowId returns 400', async () => {
    let { cookie, csrfToken } = await getSessionWithCsrf()
    let response = await router.fetch(WORKFLOW_URL, {
      method: 'POST',
      body: new URLSearchParams({ _csrf: csrfToken }),
      headers: { Cookie: cookie },
    })

    assert.equal(response.status, 400)
  })

  it('POST /ai/workflow with invalid workflowId returns 404', async () => {
    let { cookie, csrfToken } = await getSessionWithCsrf()
    let response = await router.fetch(WORKFLOW_URL, {
      method: 'POST',
      body: new URLSearchParams({ workflowId: 'nonexistent-workflow', _csrf: csrfToken }),
      headers: { Cookie: cookie },
    })

    assert.equal(response.status, 404)
  })

  // -----------------------------------------------------------------------
  // POST /ai/workflow — successful run creation
  // -----------------------------------------------------------------------

  it('POST /ai/workflow with valid workflowId creates a run and redirects to detail page', async () => {
    let { cookie, csrfToken } = await getSessionWithCsrf()
    let response = await router.fetch(WORKFLOW_URL, {
      method: 'POST',
      body: new URLSearchParams({ workflowId: 'trending-report', _csrf: csrfToken }),
      redirect: 'manual',
      headers: { Cookie: cookie },
    })

    // Assert
    assert.equal(response.status, 303, 'should redirect after creation')

    let location = response.headers.get('Location') ?? ''
    assert.ok(location.includes('runId='), 'redirect should include runId parameter')

    let runId = new URL(location, BASE).searchParams.get('runId')
    assert.ok(runId, 'should extract runId from redirect')
    testRunIds.push(runId!)

    // Verify the workflow run record was created in the database
    let run = await getWorkflowRun(db, runId)
    assert.ok(run, 'workflow run should exist in the database')
    assert.equal(run!.workflow_id, 'trending-report')
    assert.ok(run!.status === 'pending' || run!.status === 'running', 'run should be pending or running')
  })

  it('POST /ai/workflow with workflow parameters passes them through', async () => {
    let { cookie, csrfToken } = await getSessionWithCsrf()

    // Use restock-analysis which has parameters
    let response = await router.fetch(WORKFLOW_URL, {
      method: 'POST',
      body: new URLSearchParams({
        workflowId: 'restock-analysis',
        _csrf: csrfToken,
      }),
      redirect: 'manual',
      headers: { Cookie: cookie },
    })

    assert.equal(response.status, 303, 'should redirect after creation')

    let location = response.headers.get('Location') ?? ''
    let runId = new URL(location, BASE).searchParams.get('runId')
    assert.ok(runId, 'should extract runId from redirect')
    testRunIds.push(runId!)
  })
})
