// Mobile UX validation for /appointments/new before/after the responsive work.
// Standalone script: drives a real Chromium, logs in as the seeded customer,
// and measures whether the create wizard's two-column grid and the data table
// overflow / get clipped at phone viewports. Writes screenshots + metrics to tmp/.
//
// Usage: node --env-file-if-exists=.env scripts/validate-appointments-mobile.mjs <baseUrl> <label>
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const baseUrl = process.argv[2] ?? 'http://localhost:44111'
const label = process.argv[3] ?? 'before'
const headless = process.env.HEAD !== '1'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'tmp', `appt-mobile-${label}`)
mkdirSync(outDir, { recursive: true })

const customerEmail = process.env.SEED_USER_EMAIL || 'user@newapp.com'
const customerPassword =
  process.env.SEED_USER_PASSWORD || process.env.SEED_USER_PASSWORD_DEFAULT || undefined
if (!customerPassword) {
  throw new Error(
    'SEED_USER_PASSWORD is required (load it from .env) to run the mobile validation.',
  )
}

function metricsScript() {
  const vw = window.innerWidth
  const docOverflow = document.documentElement.scrollWidth - vw
  // Any element that renders past the right edge (would be clipped by overflow:hidden)
  const offscreenRight = []
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) continue
    const st = getComputedStyle(el)
    if (st.display === 'none' || st.visibility === 'hidden') continue
    if (r.right > vw + 2) {
      offscreenRight.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className && el.className.toString().slice(0, 40)) || '',
        text: (el.textContent || '').trim().slice(0, 40),
        width: Math.round(r.width),
        right: Math.round(r.right),
      })
    }
  }
  // The two-column grid: its children widths
  const grid = document.querySelector('[data-two-col]') || null
  let gridChildren = []
  if (grid) {
    for (const child of grid.children) {
      const r = child.getBoundingClientRect()
      gridChildren.push({
        width: Math.round(r.width),
        left: Math.round(r.left),
        right: Math.round(r.right),
      })
    }
  }
  return {
    viewportWidth: vw,
    docScrollWidth: document.documentElement.scrollWidth,
    docOverflowRight: docOverflow,
    hasHorizontalOverflow: docOverflow > 2,
    offscreenRightCount: offscreenRight.length,
    offscreenRight: offscreenRight.slice(0, 12),
    gridChildren,
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function run() {
  const browser = await chromium.launch({ headless })
  const results = {}
  const screenshots = []

  for (const [vw, vh] of [
    [375, 812],
    [390, 844],
  ]) {
    const tag = `${vw}px`
    const context = await browser.newContext({
      viewport: { width: vw, height: vh },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 1,
    })
    const page = await context.newPage()
    // ---- Login ----
    await page.goto(`${baseUrl}/auth/login`, { waitUntil: 'domcontentloaded', timeout: 15000 })
    await page.fill('input[name="email"]', customerEmail)
    await page.fill('input[name="password"]', customerPassword)
    await page.click('button[type="submit"]')
    // Login redirects to / on success; the listen path opens an SSE keep-alive
    // so never wait for networkidle — just wait for the URL to change.
    let loggedIn = false
    try {
      await page
        .waitForURL((u) => u.pathname === '/' && !u.pathname.startsWith('/auth'), {
          timeout: 8000,
        })
        .then(() => (loggedIn = true))
    } catch {
      loggedIn = false
    }
    console.log(`[${vw}px] login ok=${loggedIn}`)

    // ---- List view ----
    await page.goto(`${baseUrl}/appointments/new`, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    })
    await page.waitForSelector('[data-appointments-table]', { timeout: 8000 }).catch(() => {})
    await sleep(200)
    const listMetrics = await page.evaluate(metricsScript)
    const listShot = join(outDir, `list-${tag}.png`)
    await page.screenshot({ path: listShot, fullPage: true })
    screenshots.push(listShot)

    // Row count from the table
    const rowCount = await page
      .locator('table tbody tr')
      .count()
      .catch(() => 0)
    const emptyText = await page
      .locator('div', { hasText: 'Keine Termine' })
      .count()
      .catch(() => 0)

    // ---- Create flow: step 1 (resource cards in two-column grid) ----
    await page.goto(`${baseUrl}/appointments/new?creating=true`, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    })
    await page.waitForSelector('[data-appointments-table]', { timeout: 8000 }).catch(() => {})
    await sleep(300)
    // Tag the two-column grid so metricsScript can inspect it
    await page.evaluate(() => {
      const grid = Array.from(document.querySelectorAll('div')).find(
        (el) => getComputedStyle(el).display === 'grid' && el.childElementCount === 2,
      )
      if (grid) grid.setAttribute('data-two-col', '1')
    })
    const step1Metrics = await page.evaluate(metricsScript)
    const step1Shot = join(outDir, `step1-${tag}.png`)
    await page.screenshot({ path: step1Shot, fullPage: true })
    screenshots.push(step1Shot)

    // ---- Create flow: step 2 (if a resource is offered) ----
    let step2Metrics = null
    let step2Shot = null
    const firstCard = page.locator('a[href*="resource_id="]').first()
    if ((await firstCard.count()) > 0) {
      const clicked = await firstCard
        .click()
        .then(() => true)
        .catch(() => false)
      if (clicked) {
        await sleep(200)
        await page.waitForSelector('[data-wizard-form]', { timeout: 8000 }).catch(() => {})
        await sleep(300)
        step2Metrics = await page.evaluate(metricsScript)
        step2Shot = join(outDir, `step2-${tag}.png`)
        await page.screenshot({ path: step2Shot, fullPage: true })
        screenshots.push(step2Shot)
      }
    }

    results[tag] = {
      list: { ...listMetrics, rowCount, emptyText },
      step1: step1Metrics,
      step2: step2Metrics,
    }
    await context.close()
  }

  await browser.close()

  const summaryPath = join(outDir, 'results.json')
  writeFileSync(summaryPath, JSON.stringify(results, null, 2))
  console.log('Wrote', summaryPath)
  console.log(JSON.stringify(results, null, 2))
}

run().catch((err) => {
  console.error('VALIDATION_FAILED:', err)
  process.exit(1)
})
