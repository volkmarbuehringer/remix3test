import { afterEach, describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import type { FrameCommitContext, ResolveFrameOptions } from 'remix/component'

import { frames, routes } from '../routes.ts'
import {
  ADMIN_LISTS_TRANSITION_NAME,
  ADMIN_LISTS_TRANSITION_SELECTOR,
} from '../utils/frame-transition.ts'
import {
  commitFrameWithViewTransition,
  createAdminListsPanelCommit,
  shouldAnimateAdminListsPanel,
} from './frame-transition.browser.ts'

// ---------------------------------------------------------------------------
// Admin lists frame View Transition
//
// The decision and the commit wrapper are pure enough to test with a fake
// `document.startViewTransition`: the platform is stubbed like
// `theme-toggle.test.browser.tsx` / `lists-view-transition.test.browser.tsx`.
// Covered here: the one animated flow (grid ⇄ edit/create panel), every
// fallback (no API, reduced motion, aborted update, missing region, refused
// start), name cleanup, and the no-stall contract (rendering starts before the
// animation finishes).
// ---------------------------------------------------------------------------

type ViewTransitionLike = {
  ready: Promise<void>
  finished: Promise<void>
  skipTransition(): void
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void | Promise<void>) => ViewTransitionLike
}

type FrameTransition = NonNullable<ResolveFrameOptions['transition']>

let restoreViewTransition: (() => void) | null = null
let restoreMatchMedia: (() => void) | null = null
let regions: HTMLElement[] = []

function installViewTransition(
  impl: ((update: () => void | Promise<void>) => ViewTransitionLike) | undefined,
): void {
  let doc = document as ViewTransitionDocument
  let hadOwn = Object.prototype.hasOwnProperty.call(doc, 'startViewTransition')
  let original = doc.startViewTransition
  Object.defineProperty(doc, 'startViewTransition', {
    configurable: true,
    writable: true,
    value: impl,
  })
  restoreViewTransition = () => {
    if (hadOwn) {
      Object.defineProperty(doc, 'startViewTransition', {
        configurable: true,
        writable: true,
        value: original,
      })
    } else {
      Reflect.deleteProperty(doc, 'startViewTransition')
    }
  }
}

function stubReducedMotion(reduce: boolean): void {
  let original = window.matchMedia
  window.matchMedia = ((query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
  restoreMatchMedia = () => {
    window.matchMedia = original
  }
}

function mountRegion(value = 'admin-lists'): HTMLElement {
  let region = document.createElement('div')
  region.setAttribute('data-frame-transition-region', value)
  document.body.append(region)
  regions.push(region)
  return region
}

function listsUrl(query = ''): string {
  return new URL(routes.admin.lists.index.href() + query, window.location.origin).href
}

function frameTransition(from: string, navigationType: FrameTransition['navigationType'] = 'push') {
  return { from: { url: from }, navigationType } as FrameTransition
}

function listsOptions(transition: FrameTransition): ResolveFrameOptions {
  return { target: frames.adminContent, transition }
}

function commitContext(to: string, signal = new AbortController().signal): FrameCommitContext {
  return { to, response: new Response('<div>content</div>'), signal }
}

/** A fake platform transition whose snapshot callbacks run asynchronously. */
function installManualTransition() {
  let started = 0
  let skipped = 0
  let namesAtStart: string[] = []
  let finish!: () => void
  let finished = new Promise<void>((resolve) => {
    finish = resolve
  })

  installViewTransition((update) => {
    started++
    namesAtStart.push(
      document.querySelector<HTMLElement>(ADMIN_LISTS_TRANSITION_SELECTOR)?.style
        .viewTransitionName ?? '',
    )
    // The real platform runs the update callback after the old snapshot.
    queueMicrotask(() => void update())
    return {
      ready: Promise.resolve(),
      finished,
      skipTransition: () => {
        skipped++
        finish()
      },
    }
  })

  return {
    get started() {
      return started
    },
    get skipped() {
      return skipped
    },
    namesAtStart,
    finish,
  }
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

afterEach(() => {
  restoreViewTransition?.()
  restoreViewTransition = null
  restoreMatchMedia?.()
  restoreMatchMedia = null
  for (let region of regions) region.remove()
  regions = []
  document.documentElement.removeAttribute('data-frame-transition')
})

describe('shouldAnimateAdminListsPanel', () => {
  let grid = listsUrl()
  let editor = listsUrl('?editing=5&offset=0&sort=updated_at&order=desc')
  let creating = listsUrl('?creating=true')
  let page2 = listsUrl('?offset=10')
  let users = new URL(routes.admin.users.index.href(), window.location.origin).href

  it('animates opening and closing the panel', () => {
    assert.equal(
      shouldAnimateAdminListsPanel(listsOptions(frameTransition(grid)), editor),
      true,
      'grid → row editor',
    )
    assert.equal(
      shouldAnimateAdminListsPanel(listsOptions(frameTransition(editor)), grid),
      true,
      'editor → grid',
    )
    assert.equal(
      shouldAnimateAdminListsPanel(listsOptions(frameTransition(grid)), creating),
      true,
      'grid → create panel',
    )
  })

  it('leaves pagination and panel-to-panel moves unanimated', () => {
    assert.equal(
      shouldAnimateAdminListsPanel(listsOptions(frameTransition(grid)), page2),
      false,
      'a grid page swap stays instant',
    )
    assert.equal(
      shouldAnimateAdminListsPanel(
        listsOptions(frameTransition(editor)),
        listsUrl('?editing=6&offset=0&sort=updated_at&order=desc'),
      ),
      false,
      'switching rows keeps the panel layout',
    )
  })

  it('requires the admin-content target, a navigation transition, and the lists route', () => {
    assert.equal(
      shouldAnimateAdminListsPanel(
        { target: frames.listsContent, transition: frameTransition(grid) },
        editor,
      ),
      false,
    )
    assert.equal(shouldAnimateAdminListsPanel({ target: frames.adminContent }, editor), false)
    assert.equal(
      shouldAnimateAdminListsPanel(listsOptions(frameTransition(grid, 'reload')), editor),
      false,
    )
    assert.equal(
      shouldAnimateAdminListsPanel(listsOptions(frameTransition(users)), users + '?editing=5'),
      false,
    )
  })
})

describe('createAdminListsPanelCommit', () => {
  it('only attaches a commit for a navigation-driven admin-content load', () => {
    assert.equal(createAdminListsPanelCommit(undefined), undefined)
    assert.equal(
      createAdminListsPanelCommit({
        target: frames.listsContent,
        transition: frameTransition('/'),
      }),
      undefined,
    )
    assert.equal(createAdminListsPanelCommit({ target: frames.adminContent }), undefined)
    assert.ok(createAdminListsPanelCommit(listsOptions(frameTransition(listsUrl()))))
  })

  it('commits normally on a flow that must not animate', async () => {
    let fake = installManualTransition()
    mountRegion()
    let commit = createAdminListsPanelCommit(listsOptions(frameTransition(listsUrl())))!
    let commits = 0

    await commit(
      async () => {
        commits++
      },
      commitContext(listsUrl('?offset=10')),
    )

    assert.equal(commits, 1)
    assert.equal(fake.started, 0)
  })
})

describe('commitFrameWithViewTransition', () => {
  it('commits once without starting a transition when the platform has no API', async () => {
    installViewTransition(undefined)
    let region = mountRegion()
    let commits = 0

    await commitFrameWithViewTransition(async () => {
      commits++
      assert.equal(region.style.viewTransitionName, '', 'no name without a transition')
    }, new AbortController().signal)

    assert.equal(commits, 1)
    assert.equal(document.documentElement.hasAttribute('data-frame-transition'), false)
  })

  it('honors prefers-reduced-motion', async () => {
    let fake = installManualTransition()
    stubReducedMotion(true)
    mountRegion()
    let commits = 0

    await commitFrameWithViewTransition(async () => {
      commits++
    }, new AbortController().signal)

    assert.equal(fake.started, 0, 'reduced motion must not start a transition')
    assert.equal(commits, 1)
  })

  it('does not start for an already-aborted update', async () => {
    let fake = installManualTransition()
    mountRegion()
    let controller = new AbortController()
    controller.abort(new DOMException('superseded', 'AbortError'))
    let commits = 0

    await commitFrameWithViewTransition(async () => {
      commits++
    }, controller.signal)

    assert.equal(fake.started, 0)
    assert.equal(commits, 1)
  })

  it('names the region for the snapshots and removes the name when it settles', async () => {
    let fake = installManualTransition()
    let region = mountRegion()
    let commits = 0

    let running = commitFrameWithViewTransition(async () => {
      commits++
    }, new AbortController().signal)

    await flush()
    assert.equal(fake.started, 1)
    assert.equal(commits, 1, 'rendering starts before the animation finishes')
    assert.equal(fake.namesAtStart[0], ADMIN_LISTS_TRANSITION_NAME, 'the old snapshot is named')
    assert.equal(region.style.viewTransitionName, ADMIN_LISTS_TRANSITION_NAME)
    assert.ok(
      document.documentElement.hasAttribute('data-frame-transition'),
      'the scoped-root rule is gated while the transition runs',
    )

    fake.finish()
    await running

    assert.equal(region.style.viewTransitionName, '')
    assert.equal(document.documentElement.hasAttribute('data-frame-transition'), false)
  })

  it('does not wait for the animation before rendering', async () => {
    // `finished` never resolves on its own: the commit must already have happened.
    installViewTransition((update) => {
      queueMicrotask(() => void update())
      return {
        ready: Promise.resolve(),
        finished: new Promise<void>(() => {}),
        skipTransition: () => {},
      }
    })
    let controller = new AbortController()
    mountRegion()
    let commits = 0

    void commitFrameWithViewTransition(async () => {
      commits++
    }, controller.signal)

    await flush()
    assert.equal(commits, 1, 'a post-commit animation must not gate rendering')

    // Abort settles the pending `finished` through skipTransition in the real
    // platform; here the promise never resolves, so do not await `running`.
    controller.abort(new DOMException('navigation finished', 'AbortError'))
    assert.equal(controller.signal.aborted, true)
  })

  it('skips the animation when the update is superseded', async () => {
    let fake = installManualTransition()
    let controller = new AbortController()
    mountRegion()

    let running = commitFrameWithViewTransition(async () => {}, controller.signal)
    await flush()
    assert.equal(fake.skipped, 0)

    controller.abort(new DOMException('superseded', 'AbortError'))
    await running

    assert.equal(fake.skipped, 1, 'an aborted update must skip the running transition')
  })

  it('falls back when the platform refuses to start and leaves no names behind', async () => {
    installViewTransition(() => {
      throw new DOMException('a transition is already running', 'InvalidStateError')
    })
    let region = mountRegion()
    let commits = 0

    await commitFrameWithViewTransition(async () => {
      commits++
    }, new AbortController().signal)

    assert.equal(commits, 1, 'the commit must still run exactly once')
    assert.equal(region.style.viewTransitionName, '')
    assert.equal(document.documentElement.hasAttribute('data-frame-transition'), false)
  })

  it('falls back when the region is missing or ambiguous', async () => {
    let fake = installManualTransition()
    let commits = 0

    await commitFrameWithViewTransition(async () => {
      commits++
    }, new AbortController().signal)

    assert.equal(fake.started, 0, 'no region to animate')

    mountRegion()
    mountRegion()
    await commitFrameWithViewTransition(async () => {
      commits++
    }, new AbortController().signal)

    assert.equal(fake.started, 0, 'two regions would create duplicate transition names')
    assert.equal(commits, 2)
  })
})
