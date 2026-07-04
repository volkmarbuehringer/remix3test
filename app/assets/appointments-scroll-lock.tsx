import { clientEntry, type Handle } from 'remix/ui'
import { lockScroll } from '../utils/scroll-lock.ts'

function hasPanel(searchParams: string): boolean {
  let params = new URLSearchParams(searchParams)
  return !!(params.get('editing') || params.get('deleting') || params.get('creating') === 'true')
}

export const AppointmentsScrollLock = clientEntry(
  import.meta.url + '#AppointmentsScrollLock',
  function AppointmentsScrollLockEntry(handle: Handle) {
    let initialized = false
    let unlockScroll: (() => void) | null = null

    function update() {
      if (unlockScroll) {
        unlockScroll()
        unlockScroll = null
      }
      if (hasPanel(location.search)) {
        unlockScroll = lockScroll()
      }
    }

    handle.signal.addEventListener('abort', () => {
      if (unlockScroll) unlockScroll()
      unlockScroll = null
    })

    return () => {
      if (!initialized && typeof document !== 'undefined') {
        initialized = true

        update()

        addEventListener('popstate', update, { signal: handle.signal })
      }

      return null
    }
  },
)
