import type { Handle, RemixNode, MixValue, ElementProps } from 'remix/ui'

type NavLinkProps = {
  href?: string | undefined
  route?: { href: () => string } | undefined
  frameSrc?: string
  target?: string
  active?: boolean
  document?: boolean
  mix?: MixValue<HTMLAnchorElement, ElementProps>
  style?: Record<string, string>
  dataTooltip?: string
  children?: RemixNode
}

export function NavLink(handle: Handle<NavLinkProps>) {
  return () => {
    let {
      href,
      route,
      frameSrc,
      target: frameTarget,
      active,
      document: isDocument,
      mix,
      style,
      dataTooltip,
      children,
    } = handle.props
    let resolvedHref = href ?? route?.href() ?? '#'

    let extra: Record<string, string | undefined> = {}
    if (frameSrc) extra['data-rmx-src'] = frameSrc
    if (frameTarget) extra['data-rmx-target'] = frameTarget
    if (isDocument) {
      extra['data-rmx-document'] = ''
      extra['target'] = '_top'
    }
    if (dataTooltip) extra['data-tooltip'] = dataTooltip

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
