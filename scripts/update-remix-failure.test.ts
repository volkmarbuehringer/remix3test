import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { createTail, formatStepFailure, StepFailure } from './update-remix-failure.ts'

describe('update-remix failure reporting', () => {
  it('keeps the last lines across chunk boundaries', () => {
    let tail = createTail(3)
    tail.push('a\nb\n')
    tail.push('c\nd')
    assert.equal(tail.text(), 'b\nc\nd')

    tail.push('\ne\nf\ng')
    assert.equal(tail.text(), 'e\nf\ng')
  })

  it('keeps a trailing partial line without a newline', () => {
    let tail = createTail(2)
    tail.push('one\ntwo\nthree')
    assert.equal(tail.text(), 'two\nthree')
  })

  it('formats a failed step with its last output and hint', () => {
    let failure = new StepFailure('npm run typecheck', 2, 'first\nsecond\n', 'Fix it, then re-run.')

    assert.deepEqual(formatStepFailure(failure), [
      'Failed step: npm run typecheck (exit 2)',
      'Last output:',
      '  first',
      '  second',
      '',
      'Fix it, then re-run.',
    ])
    assert.equal(failure.message, 'npm run typecheck exited 2')
  })

  it('omits the exit status for a gate failure without a process', () => {
    let failure = new StepFailure('analysis doc check', null, 'stale range')

    assert.deepEqual(formatStepFailure(failure), [
      'Failed step: analysis doc check',
      'Last output:',
      '  stale range',
    ])
    assert.equal(failure.message, 'analysis doc check failed')
  })

  it('prints only the last 20 lines of a long tail', () => {
    let tail = Array.from({ length: 25 }, (_, index) => `line ${index + 1}`).join('\n')
    let lines = formatStepFailure(new StepFailure('npm test', 1, tail))

    assert.equal(lines.length, 22)
    assert.equal(lines[0], 'Failed step: npm test (exit 1)')
    assert.equal(lines[1], 'Last output:')
    assert.equal(lines[2], '  line 6')
    assert.equal(lines.at(-1), '  line 25')
  })
})
