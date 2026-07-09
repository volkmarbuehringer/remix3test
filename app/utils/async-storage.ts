import { AsyncLocalStorage } from 'node:async_hooks'

export function createAsyncStorage(label: string) {
  let storage = new AsyncLocalStorage<number>()

  function runWithId<T>(id: number, fn: () => T): T {
    return storage.run(id, fn)
  }

  function requireId(): number {
    let id = storage.getStore()
    if (id === undefined) throw new Error(`Not authenticated as ${label}`)
    return id
  }

  return { runWithId, requireId, storage }
}
