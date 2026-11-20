import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { initializeAppDatabase } from '../../../db.ts'
import { supportTools } from './support-tools.ts'
// Side-effect: registers the Mastra instance so tools can execute
import '../index.ts'

/** Invoke a tool's `execute` with plain-object input (mastra types it richly). */
async function execTool(
  tool: object,
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  let execute = (tool as { execute: (input: unknown, context: unknown) => Promise<unknown> })
    .execute
  return (await execute(input, {})) as Record<string, unknown>
}

describe('getOfferingsForDate', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  it('rejects a non-calendar ISO date instead of querying the rolled-over day', async () => {
    // 2027-02-31 rolls over to 2027-03-03 in V8; the tool echoed the submitted
    // date while returning the other day's offerings. It must return an error.
    let result = await execTool(supportTools.getOfferingsForDate, { date: '2027-02-31' })

    assert.equal(typeof result.error, 'string', 'non-calendar date must return an error')
    assert.equal(result.count, undefined, 'no query result may be returned')
  })

  it('rejects non-calendar dates in the other date-based tools', async () => {
    let cases = [
      ['searchAppointmentsByDateRange', { startDate: '2027-02-31', endDate: '2027-03-05' }],
      ['getAdminStats', { startDate: '2027-02-31', endDate: '2027-03-05' }],
      ['lookupHoliday', { date: '2027-02-31' }],
      [
        'generatePdfReport',
        { reportType: 'appointment-list', startDate: '2027-02-31', endDate: '2027-03-05' },
      ],
    ] as const

    for (let [name, input] of cases) {
      let result = await execTool(supportTools[name], input)
      assert.equal(typeof result.error, 'string', `${name} must reject non-calendar dates`)
    }
  })

  it('accepts a real calendar date and a millisecond timestamp', async () => {
    let date = new Date().toISOString().slice(0, 10)
    let byDate = await execTool(supportTools.getOfferingsForDate, { date })
    assert.equal(byDate.error, undefined)
    assert.equal(typeof byDate.count, 'number')
    assert.equal(byDate.date, date)

    let timestamp = String(Date.now())
    let byTimestamp = await execTool(supportTools.getOfferingsForDate, { date: timestamp })
    assert.equal(byTimestamp.error, undefined)
    assert.equal(typeof byTimestamp.count, 'number')
  })
})
