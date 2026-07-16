import type { Handle } from 'remix/ui'

const CONTAINER_IDS = ['support-agent-frame-container', 'route-agent-frame-container'] as const

function getActiveFrame(handle: Handle): string | null {
  for (const id of CONTAINER_IDS) {
    const container = document.getElementById(id)
    if (container) {
      return container.getAttribute('data-active-frame')
    }
  }
  return null
}

export function safeReload(handle: Handle): void {
  const frameName = getActiveFrame(handle)
  if (frameName) {
    const frame = handle.frames.get(frameName)
    if (frame) {
      frame.reload()
      return
    }
  }
  window.location.reload()
}

export function safeNavigate(href: string, handle: Handle): void {
  const frameName = getActiveFrame(handle)
  if (frameName) {
    const frame = handle.frames.get(frameName)
    if (frame) {
      frame.src = href
      frame.reload()
      return
    }
  }
  window.location.href = href
}
