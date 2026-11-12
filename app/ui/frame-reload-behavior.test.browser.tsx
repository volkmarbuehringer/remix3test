import * as assert from 'remix/assert'
import { Frame, clientEntry, createRoot, run, type FrameHandle, type Handle } from 'remix/component'
import { renderToStream } from 'remix/component/server'
import { afterEach, describe, it } from 'remix/test'

// Guards for the two #12274 frame behaviors the app depends on:
//
// - `app/assets/entry.tsx` changes a frame's `src` after an in-frame redirect
//   (`reconcileFrameRedirect`), and LazyFrame/route frames can change their
//   `src` prop. A frame that has already committed content must reload in
//   place while nested frames or client entries are still loading, instead of
//   remounting with its fallback. This is the regression test for #12274: it
//   fails on the previous `0cab1903` pin.
// - Lists/admin entries listen for `reloadStart`/`reloadComplete` to show a
//   loading state and flush pending edits. Re-entering `frame.reload()` must
//   still emit exactly one pair, or those listeners see unmatched/early
//   events. That path was already correct on `0cab1903`; this pins the
//   contract against future regressions.

function withResolvers<T>() {
  let resolve!: (value: T) => void
  let promise = new Promise<T>((res) => {
    resolve = res
  })
  return [promise, resolve] as const
}

async function drain(stream: ReadableStream<Uint8Array>): Promise<string> {
  return await new Response(stream).text()
}

async function waitFor(check: () => boolean, message: string): Promise<void> {
  let deadline = Date.now() + 2_000
  while (Date.now() < deadline) {
    if (check()) return
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  throw new Error(`Timed out waiting for ${message}`)
}

let dispose: (() => void) | null = null

afterEach(() => {
  dispose?.()
  dispose = null
  document.body.replaceChildren()
})

describe('frame reload behavior', () => {
  it('keeps committed content when src changes while a sub-frame client entry loads', async () => {
    let rootContainer = document.createElement('div')
    document.body.append(rootContainer)

    let SlowEntry = clientEntry('/assets/slow-entry.js#SlowEntry', function SlowEntry() {
      return () => <p id="slow">Slow</p>
    })
    let firstContent = await drain(
      renderToStream(
        <section id="first">
          <Frame src="/sub" />
        </section>,
        { resolveFrame: async () => await drain(renderToStream(<SlowEntry />)) },
      ),
    )
    let [slowModule, resolveSlowModule] = withResolvers<Function>()
    let [slowModuleRequested, markSlowModuleRequested] = withResolvers<void>()
    let [secondContent, resolveSecondContent] = withResolvers<string>()
    let root = createRoot(rootContainer, {
      frameInit: {
        resolveFrame(src) {
          if (src === '/first') return firstContent
          if (src === '/second') return secondContent
          throw new Error(`Unexpected frame src: ${src}`)
        },
        loadModule() {
          markSlowModuleRequested()
          return slowModule
        },
      },
    })
    dispose = () => root.dispose()

    let fallback = <p id="fallback">Loading...</p>
    root.render(<Frame src="/first" fallback={fallback} />)
    root.flush()
    await slowModuleRequested
    assert.ok(
      rootContainer.querySelector('#first'),
      'the parent frame commits before its sub-frame client entry loads',
    )

    let sawFallback = false
    let observer = new MutationObserver(() => {
      if (rootContainer.querySelector('#fallback')) sawFallback = true
    })
    observer.observe(rootContainer, { childList: true, subtree: true })

    root.render(<Frame src="/second" fallback={fallback} />)
    root.flush()
    resolveSecondContent('<p id="second">Second</p>')
    await waitFor(() => rootContainer.querySelector('#second') !== null, 'the second frame content')

    observer.disconnect()
    assert.equal(sawFallback, false, 'the fallback must not flash while the sub-frame is loading')
    assert.equal(rootContainer.querySelector('#first'), null, 'the first content is replaced')
    resolveSlowModule(SlowEntry)
  })

  it('dispatches one reloadStart and reloadComplete pair when reload is re-entered', async () => {
    let frameHandle: FrameHandle | undefined
    let events: string[] = []
    let callCount = 0
    let [firstReload, resolveFirstReload] = withResolvers<string>()
    let [secondReload, resolveSecondReload] = withResolvers<string>()

    let ReloadButton = clientEntry(
      '/assets/reload-reentry.js#ReloadReentry',
      function ReloadReentry(handle: Handle) {
        frameHandle = handle.frame
        return () => <button id="reload-reentry">Reload</button>
      },
    )

    let html = await drain(
      renderToStream(
        <main>
          <Frame src="/reload-reentry" fallback={<div id="reload-fallback">Loading…</div>} />
        </main>,
        {
          resolveFrame: async () =>
            await drain(
              renderToStream(
                <section>
                  <p id="reload-value">Initial</p>
                  <ReloadButton />
                </section>,
              ),
            ),
        },
      ),
    )
    document.body.innerHTML = html

    let app = run({
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/assets/reload-reentry.js' && exportName === 'ReloadReentry') {
          return ReloadButton
        }
        throw new Error(`Unexpected module: ${moduleUrl}#${exportName}`)
      },
      resolveFrame(src: string) {
        if (src !== '/reload-reentry') throw new Error(`Unexpected frame src: ${src}`)
        callCount++
        if (callCount === 1) return firstReload
        if (callCount === 2) return secondReload
        throw new Error(`Unexpected reload call count: ${callCount}`)
      },
    })
    dispose = () => app.dispose()
    await app.ready()

    assert.ok(frameHandle, 'the frame handle is available after hydration')
    frameHandle.addEventListener('reloadStart', () => events.push('start'))
    frameHandle.addEventListener('reloadComplete', () => events.push('complete'))

    let firstReloadPromise = frameHandle.reload()
    let secondReloadPromise = frameHandle.reload()

    resolveFirstReload('<section><p id="reload-value">Stale</p></section>')
    await firstReloadPromise
    assert.deepEqual(events, ['start'], 'the first reload has not completed')

    resolveSecondReload('<section><p id="reload-value">Fresh</p></section>')
    await secondReloadPromise
    assert.deepEqual(events, ['start', 'complete'], 'one pair for the re-entered reload')
    assert.equal(document.querySelector('#reload-value')?.textContent, 'Fresh')
  })
})
