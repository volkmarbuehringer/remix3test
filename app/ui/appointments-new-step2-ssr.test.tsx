import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import { renderToString } from 'remix/component/server'

import { Step2 } from './appointments-new-step2.tsx'

// ---------------------------------------------------------------------------
// Server-rendered markup contracts for wizard step 2.
//
// The controller test for a missing day_start depends on the seeded offerings
// (a concurrent suite can empty the week), so this pins the always-rendered
// error wiring without the database.
// ---------------------------------------------------------------------------

const DAY_MS = Date.UTC(2026, 5, 10)

describe('appointments-new step 2 markup', () => {
  it('links the time group and title input to their error messages', async () => {
    let html = await renderToString(
      <Step2
        resourceId="1"
        weekStart={Date.UTC(2026, 5, 8)}
        daysWithSlots={[
          {
            day: DAY_MS,
            dateStr: '2026-06-10',
            slots: [540],
            ranges: [{ startMin: 480, endMin: 720 }],
          },
        ]}
        gridState={{ offset: '', sort: '', order: '', filter: '' }}
        fieldErrors={{
          day_start: 'Bitte wählen Sie eine Uhrzeit aus.',
          title: 'Titel zu lang.',
        }}
        formError="Bitte prüfen Sie die Eingaben."
      />,
    )

    assert.ok(html.includes('aria-invalid="true"'), 'invalid controls are marked')
    assert.ok(
      html.includes('aria-describedby="wiz-day-start-error"') &&
        html.includes('id="wiz-day-start-error"'),
      'the time group is linked to its error',
    )
    assert.ok(
      html.includes('aria-describedby="wiz-title-error"') && html.includes('id="wiz-title-error"'),
      'the title input is linked to its error',
    )
    assert.ok(html.includes('role="alert"'), 'error regions are announced')
    assert.ok(
      /<fieldset[^>]*tabindex="-1"/.test(html),
      'the invalid time group is focusable so FormErrorFocus can land on it',
    )
    assert.ok(html.includes('data-form-error'), 'the form-level error banner is a focus fallback')
  })
})
