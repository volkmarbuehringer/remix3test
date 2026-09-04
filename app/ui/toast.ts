import { theme } from '../ui/theme/theme.ts'

const TOAST_DURATION = 3500

const surface = theme.surface as Record<string, string>

function getContainer(): HTMLDivElement {
  let el = document.getElementById('__toast-root')
  if (el) return el as HTMLDivElement
  el = document.createElement('div')
  el.id = '__toast-root'
  el.style.position = 'fixed'
  el.style.top = '16px'
  el.style.left = '50%'
  el.style.transform = 'translateX(-50%)'
  el.style.zIndex = '9999'
  el.style.display = 'flex'
  el.style.flexDirection = 'column'
  el.style.gap = '8px'
  el.style.pointerEvents = 'none'
  document.body.appendChild(el)
  return el as HTMLDivElement
}

export function showToast(message: string, type: 'error' | 'success' = 'error') {
  let container = getContainer()
  let toast = document.createElement('div')
  toast.textContent = message
  toast.style.backgroundColor = type === 'error' ? surface.dangerBg! : surface.successBg!
  toast.style.color = type === 'error' ? surface.dangerText! : surface.successText!
  toast.style.padding = `${theme.space.sm} ${theme.space.lg}`
  toast.style.borderRadius = theme.radius.md
  toast.style.fontSize = theme.fontSize.sm
  toast.style.fontWeight = theme.fontWeight.medium
  toast.style.boxShadow = theme.shadow.md
  toast.style.pointerEvents = 'auto'
  toast.style.textAlign = 'center'
  toast.style.border = `1px solid ${type === 'error' ? surface.dangerBorder : surface.successBorder}`
  toast.style.opacity = '0'
  toast.style.transition = 'opacity 0.2s ease-out'
  container.appendChild(toast)

  requestAnimationFrame(() => {
    toast.style.opacity = '1'
  })

  setTimeout(() => {
    toast.style.opacity = '0'
    setTimeout(() => toast.remove(), 300)
  }, TOAST_DURATION)
}
