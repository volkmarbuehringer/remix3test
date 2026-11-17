import { afterEach, describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import { createRoot, on, type Handle } from 'remix/component'
import { renderToString } from 'remix/component/server'

// ---------------------------------------------------------------------------
// #12294 regression guard: a text/checkbox edit made before a control hydrates
// must survive hydration and be replayed once its handlers are attached, so
// app state (search filters, autosave, pending UI) catches up with what the
// user sees instead of being overwritten by the server-rendered value.
//
// The component is a plain (non-clientEntry) tree hydrated through
// createRoot(container).render(); the server HTML comes from renderToString().
// The untouched control proves the replay is scoped to edited controls.
// ---------------------------------------------------------------------------

interface ReplayProbeProps {
  log: string[]
}

function ReplayProbe(handle: Handle<ReplayProbeProps>) {
  return () => (
    <form>
      <input
        name="text"
        defaultValue="server-text"
        mix={[
          on('input', (event) => {
            let input = event.currentTarget as HTMLInputElement
            handle.props.log.push(`text:input:${input.value}`)
          }),
          on('change', (event) => {
            let input = event.currentTarget as HTMLInputElement
            handle.props.log.push(`text:change:${input.value}`)
          }),
        ]}
      />
      <input
        name="untouched"
        defaultValue="same"
        mix={[
          on('input', () => {
            handle.props.log.push('untouched:input')
          }),
          on('change', () => {
            handle.props.log.push('untouched:change')
          }),
        ]}
      />
      <input
        type="checkbox"
        name="done"
        mix={[
          on('input', () => {
            handle.props.log.push('done:input')
          }),
          on('change', (event) => {
            let input = event.currentTarget as HTMLInputElement
            handle.props.log.push(`done:change:${input.checked}`)
          }),
        ]}
      />
    </form>
  )
}

let cleanup: (() => void) | null = null

afterEach(() => {
  cleanup?.()
  cleanup = null
})

describe('pre-hydration form edits', () => {
  it('keeps and replays edits made before hydration', async () => {
    let log: string[] = []
    let html = await renderToString(<ReplayProbe log={log} />)
    let container = document.createElement('div')
    container.innerHTML = html
    document.body.append(container)

    let text = container.querySelector<HTMLInputElement>('input[name="text"]')
    let untouched = container.querySelector<HTMLInputElement>('input[name="untouched"]')
    let done = container.querySelector<HTMLInputElement>('input[name="done"]')
    assert.ok(text && untouched && done, 'server HTML has all three controls')

    // What a user would have done before the control hydrated.
    text.value = 'typed before hydration'
    done.checked = true

    let root = createRoot(container)
    cleanup = () => {
      root.dispose()
      container.remove()
    }
    root.render(<ReplayProbe log={log} />)
    root.flush()

    assert.equal(text.value, 'typed before hydration', 'typed text survives hydration')
    assert.equal(done.checked, true, 'toggled checkbox survives hydration')
    assert.equal(untouched.value, 'same', 'the untouched control keeps its server value')
    assert.deepEqual(log, [
      'text:input:typed before hydration',
      'text:change:typed before hydration',
      'done:input',
      'done:change:true',
    ])
  })
})
