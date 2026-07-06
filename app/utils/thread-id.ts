const THREAD_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/

export function validateThreadId(id: string | undefined | null): id is string {
  return typeof id === 'string' && THREAD_ID_RE.test(id)
}
