import type { Handle } from 'remix/ui'

const CONTAINER_IDS = ['support-agent-frame-container'] as const

function getActiveFrame(handle: Handle): string | null {
  for (let id of CONTAINER_IDS) {
    let container = document.getElementById(id)
    if (container) {
      return container.getAttribute('data-active-frame')
    }
  }
  return null
}

export function safeNavigate(href: string, handle: Handle): void {
  let frameName = getActiveFrame(handle)
  if (frameName) {
    let frame = handle.frames.get(frameName)
    if (frame) {
      frame.src = href
      frame.reload()
      return
    }
  }
  window.location.href = href
}
