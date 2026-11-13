// Browser-test DOM helpers that need MutationObserver rather than polling.
// Predicate waits now use `t.waitFor()` from `remix/test`; `nextDomMutation()`
// remains for waits that depend on mutation ordering, which polling cannot
// express. Mirrors the vendor helper in `@remix-run/component`
// `src/test/utils.ts` (#12198).

const domMutations: MutationObserverInit = {
  attributes: true,
  characterData: true,
  childList: true,
  subtree: true,
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
