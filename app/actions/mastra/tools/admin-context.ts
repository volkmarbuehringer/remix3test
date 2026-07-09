import { AsyncLocalStorage } from 'node:async_hooks'

const adminIdStorage = new AsyncLocalStorage<number>()

export function runWithAdminId<T>(id: number, fn: () => T): T {
  return adminIdStorage.run(id, fn)
}

export function requireAdminId(): number {
  let id = adminIdStorage.getStore()
  if (id === undefined) throw new Error('Not authenticated as admin')
  return id
}
