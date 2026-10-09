import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'

import { VerwaltungDashboardContent } from './verwaltung-page.tsx'
import { routes } from '../routes.ts'

// The dashboard is server-rendered, but the content component takes its stats
// as a prop, so mounting it here gives deterministic coverage of the copy,
// alert, and link targets without racing the shared test database.

const STATS = {
  appointmentsPending: 3,
  appointmentsExpired: 4,
  offerings: 5,
  resources: 6,
  offeringConfigs: 7,
  offeringsPast: 2,
}

const OFFERINGS_PAST_URL = routes.verwaltung.offerings.index.href() + '?status=expired'
const CREATE_URL = routes.verwaltung.appointments.index.href() + '?creating=true'

let cleanup: (() => void) | null = null

afterEach(() => {
  cleanup?.()
  cleanup = null
})

function renderDashboard(stats: typeof STATS = STATS) {
  let result = render(<VerwaltungDashboardContent stats={stats} />)
  cleanup = result.cleanup
  return result
}

describe('VerwaltungDashboardContent', () => {
  it('labels upcoming appointments as Kommende, not Ausstehende', () => {
    let { container } = renderDashboard()

    assert.ok(
      container.textContent?.includes('Kommende Termine'),
      'should label upcoming appointments',
    )
    assert.ok(
      !container.textContent?.includes('Ausstehende Termine'),
      'should not use the old pending label',
    )
  })

  it('surfaces past offerings as a cleanup call to action', () => {
    let { container } = renderDashboard()

    assert.ok(
      container.textContent?.includes('2 vergangene Buchungszeiträume'),
      'alert should name the count',
    )
    let link = container.querySelector(`a[href="${OFFERINGS_PAST_URL}"]`)
    assert.ok(link, 'alert should link to the expired offerings view')
    assert.equal(link!.textContent?.trim(), 'Aufräumen')
  })

  it('hides the cleanup call to action when there is nothing past', () => {
    let { container } = renderDashboard({ ...STATS, offeringsPast: 0 })

    assert.ok(!container.textContent?.includes('aufgeräumt'), 'alert should not render')
    assert.equal(container.querySelector(`a[href="${OFFERINGS_PAST_URL}"]`), null)
  })

  it('points quick-create at the in-section admin form', () => {
    let { container } = renderDashboard()

    let cta = Array.from(container.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('Neuer Termin'),
    )
    assert.ok(cta, 'quick-create action should render')
    assert.equal(cta!.getAttribute('href'), CREATE_URL)
  })

  it('exposes the export hub anchor used by the section nav', () => {
    let { container } = renderDashboard()

    let hub = container.querySelector('#exporte')
    assert.ok(hub, 'export hub anchor should exist')
    assert.ok(
      hub!.textContent?.includes('Exporte & Berichte'),
      'hub should contain the export card',
    )
  })
})
