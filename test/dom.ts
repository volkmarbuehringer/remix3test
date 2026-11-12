// Browser-test DOM waits built on MutationObserver instead of polling with a
// wall-clock timer. Mirrors the vendor helper in
// `@remix-run/component` `src/test/utils.ts` (#12198) and keeps remix-specific
// knowledge out of the app: a predicate that reads DOM state resolves on the
// next mutation that makes it true.

const domMutations: MutationObserverInit = {
  attributes: true,
  characterData: true,
  childList: true,
  subtree: true,
}

export interface WaitForDomOptions {
  /** Node whose subtree is observed. Defaults to `document`. */
  root?: Node
  /** Failure bound, not a synchronization delay. */
  timeout?: number
  /** Included in the timeout error. */
  description?: string
}

/** Resolves once `predicate` is true, re-checking after each DOM mutation. */
export function waitForDom(
  predicate: () => boolean,
  options: WaitForDomOptions = {},
): Promise<void> {
  if (predicate()) return Promise.resolve()

  let root = options.root ?? document
  let timeout = options.timeout ?? 3000
  let description = options.description ?? 'DOM condition'

  return new Promise((resolve, reject) => {
    let timer = setTimeout(() => {
      observer.disconnect()
      reject(new Error(`Timed out waiting for ${description}`))
    }, timeout)

    let observer = new MutationObserver(() => {
      if (!predicate()) return
      observer.disconnect()
      clearTimeout(timer)
      resolve()
    })
    observer.observe(root, domMutations)
  })
}

/**
 * Resolves after the next DOM mutation in `root`. Mutation observers run in
 * creation order, so an observer created here runs after observers the runtime
 * created earlier for the same mutation.
 */
export function nextDomMutation(root: Node = document): Promise<void> {
  return new Promise((resolve) => {
    let observer = new MutationObserver(() => {
      observer.disconnect()
      resolve()
    })
    observer.observe(root, domMutations)
  })
}
