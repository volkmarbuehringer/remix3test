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
  toast.style.transform = 'translateY(-4px)'
  toast.style.transition = 'opacity 0.2s ease-out, transform 0.2s ease-out'
  container.appendChild(toast)

  requestAnimationFrame(() => {
    toast.style.opacity = '1'
    toast.style.transform = 'translateY(0)'
  })

  setTimeout(() => {
    toast.style.opacity = '0'
    toast.style.transform = 'translateY(-4px)'
    // Remove on the transition's own end instead of a hard-coded timer. The
    // fallback covers prefers-reduced-motion (the document shell's global
    // `transition: none !important` beats the inline style, so transitionend
    // never fires there) and elements that somehow never transition.
    let removed = false
    let finish = () => {
      if (removed) return
      removed = true
      toast.remove()
    }
    toast.addEventListener('transitionend', finish, { once: true })
    setTimeout(finish, 300)
  }, TOAST_DURATION)
}
