import type { Handle, RemixNode } from 'remix/ui'

type NavLinkProps = {
  href?: string
  route?: { href: () => string }
  frameSrc?: string
  target?: string
  active?: boolean
  document?: boolean
  mix?: any
  style?: Record<string, string>
  children?: RemixNode
}

export function NavLink(handle: Handle<NavLinkProps>) {
  return () => {
    let { href, route, frameSrc, target: frameTarget, active, document: isDocument, mix, style, children } = handle.props
    let resolvedHref = href ?? route?.href() ?? '#'

    let extra: Record<string, string | undefined> = {}
    if (frameSrc) extra['rmx-src'] = frameSrc
    if (frameTarget) extra['rmx-target'] = frameTarget
    if (isDocument) {
      extra['rmx-document'] = ''
      extra['target'] = '_top'
    }

    return (
      <a
        href={resolvedHref}
        aria-current={active ? 'page' : undefined}
        mix={mix}
        style={style}
        {...extra}
      >
        {children}
      </a>
    )
  }
}
