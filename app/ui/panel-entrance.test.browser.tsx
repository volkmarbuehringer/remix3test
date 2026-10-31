import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'

import { panelEntrance } from './mixins/panel-entrance.ts'

describe('panelEntrance', () => {
  it('applies the app-panel-enter animation', () => {
    let result = render(<div data-panel-entrance mix={panelEntrance} />)
    let panel = result.$('[data-panel-entrance]') as HTMLElement
    assert.equal(getComputedStyle(panel).animationName, 'app-panel-enter')
    result.cleanup()
  })
})
