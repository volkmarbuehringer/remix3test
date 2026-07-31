import type { RemixNode, Handle } from 'remix/ui'
import { css, Frame } from 'remix/ui'
import { getContext } from 'remix/middleware/async-context'
import { theme } from '../ui/theme/theme.ts'

import { Layout } from './layout.tsx'
import { Breadcrumbs, getBreadcrumbs } from './breadcrumbs.tsx'
import { NavLink } from './nav-link.tsx'
import type { BaseNavItem } from './nav.ts'

// ── Types ──────────────────────────────────────────────────────

type NavItem<ID extends string> = BaseNavItem & {
  id: ID
  route?: { href: () => string }
  /** When false, the link forces a full-page navigation instead of frame-based. */
  iframeNav?: boolean
}

export type NavGroup<ID extends string> = {
  label?: string
  items: NavItem<ID>[]
}

export type SidebarLayoutConfig<ID extends string> = {
  /** The frame target name used for X-Remix-Target header matching. */
  frameTarget: string
  /** Additional frame targets that also trigger frame-only rendering. */
  acceptFrameTargets?: string[]
  /** Frame targets that render only the page content, without the sidebar shell. */
  contentOnlyTargets?: string[]
  /** Navigation groups to render in the sidebar. */
  navGroups: NavGroup<ID>[]
  /** Function that returns an icon RemixNode for a given nav item ID. */
  navIcon: (id: ID) => RemixNode
  /** Icon to display in the sidebar header. */
  headerIcon: RemixNode
  /** Label text for the sidebar header (e.g. "Admin" or "AI"). */
  headerLabel: string
  /** Optional extra content rendered below the navigation (e.g. AdminViewToggle). */
  sidebarExtras?: RemixNode
}

// ── Factory ─────────────────────────────────────────────────────

export function createSidebarLayout<ID extends string>(config: SidebarLayoutConfig<ID>) {
  let {
    frameTarget,
    acceptFrameTargets,
    contentOnlyTargets,
    navGroups,
    navIcon,
    headerIcon,
    headerLabel,
    sidebarExtras,
  } = config

  let acceptedTargets = acceptFrameTargets
    ? new Set([frameTarget, ...acceptFrameTargets])
    : new Set([frameTarget])

  let contentOnlyTargetSet = new Set(contentOnlyTargets ?? [])

  function isFrameRequest(): boolean {
    let target = getContext().request.headers.get('X-Remix-Target')
    return target != null && acceptedTargets.has(target)
  }

  type PageProps = {
    activeItem: ID
    children?: RemixNode
  }

  function ShellOrFragment(handle: Handle<PageProps>) {
    return () => {
      let { activeItem, children } = handle.props
      let target = getContext().request.headers.get('X-Remix-Target')
      if (target != null && contentOnlyTargetSet.has(target)) {
        return children
      }
      if (isFrameRequest()) {
        return <LayoutComponent activeItem={activeItem}>{children}</LayoutComponent>
      }
      if (getContext().request.method !== 'GET') {
        return (
          <Layout>
            <LayoutComponent activeItem={activeItem}>{children}</LayoutComponent>
          </Layout>
        )
      }
      return (
        <Layout>
          <Frame name={frameTarget} src={getContext().request.url} />
        </Layout>
      )
    }
  }

  function LayoutComponent(handle: Handle<PageProps>) {
    return () => {
      let { activeItem, children } = handle.props
      return (
        <div mix={shellStyle}>
          <aside mix={sidebarStyle}>
            <div mix={sidebarHeaderStyle}>
              <span mix={headerIconWrapStyle}>{headerIcon}</span>
              <span>{headerLabel}</span>
            </div>
            <div mix={headerDividerStyle} />
            <nav mix={navStyle}>
              {navGroups.map((group) => (
                <div key={group.label ?? '__root'}>
                  {group.label && <p mix={groupLabelStyle}>{group.label}</p>}
                  {group.items.map((item) => (
                    <NavLink
                      key={item.id}
                      href={item.href}
                      route={item.route}
                      {...(item.iframeNav === false ? { document: true } : { target: frameTarget })}
                      active={activeItem === item.id}
                      mix={[navLinkStyle, activeItem === item.id && navActiveStyle].filter(Boolean)}
                    >
                      <span mix={navIconStyle}>{navIcon(item.id)}</span>
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              ))}
            </nav>
            {sidebarExtras && (
              <>
                <div mix={headerDividerStyle} />
                {sidebarExtras}
              </>
            )}
          </aside>
          <section mix={contentStyle}>
            <Breadcrumbs items={getBreadcrumbs(new URL(getContext().request.url).pathname)} />
            {children}
          </section>
        </div>
      )
    }
  }

  function renderPage(
    render: (node: RemixNode, init?: ResponseInit) => Response,
    activeItem: ID,
    content: RemixNode,
    init?: ResponseInit,
  ) {
    return render(<ShellOrFragment activeItem={activeItem}>{content}</ShellOrFragment>, init)
  }

  return { renderPage, Layout: LayoutComponent, isFrameRequest }
}

// ── Shared styles ──────────────────────────────────────────────
// Re-exported for use by custom layouts (e.g. lists-layout.tsx)

export const shellStyle = css({
  display: 'grid',
  gridTemplateColumns: '220px minmax(0, 1fr)',
  gap: '1.25rem',
  alignItems: 'start',
})

export const sidebarStyle = css({
  position: 'sticky',
  top: '1.5rem',
  border: `1px solid ${theme.colors.border.default}`,
  borderRadius: theme.radius.xl,
  background: theme.surface.lvl1,
  padding: theme.space.lg,
  boxShadow: theme.shadow.sm,
})

export const sidebarHeaderStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  color: theme.colors.text.secondary,
  fontSize: theme.fontSize.xs,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  fontWeight: theme.fontWeight.semibold,
})

export const headerIconWrapStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  opacity: 0.65,
})

export const headerDividerStyle = css({
  margin: '0.625rem 0 0.75rem',
  height: '1px',
  background: theme.colors.border.subtle,
})

export const navStyle = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.125rem',
})

export const navLinkStyle = css({
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  color: theme.colors.text.secondary,
  textDecoration: 'none',
  fontSize: theme.fontSize.sm,
  padding: `${theme.space.sm} ${theme.space.md}`,
  borderRadius: theme.radius.md,
  borderLeft: '3px solid transparent',
  transition: 'background-color 150ms ease, color 150ms ease, border-left-color 150ms ease',
  '&:hover': {
    background: theme.surface.lvl3,
    color: theme.colors.text.primary,
    borderLeftColor: theme.colors.border.strong,
  },
})

export const navIconStyle = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
})

export const navActiveStyle = css({
  color: theme.colors.text.primary,
  fontWeight: theme.fontWeight.semibold,
  background: theme.surface.lvl2,
  borderLeftColor: theme.colors.action.primary.background,
})

export const groupLabelStyle = css({
  margin: '1rem 0 0.25rem',
  padding: `0 ${theme.space.md}`,
  color: theme.colors.text.muted,
  fontSize: theme.fontSize.xs,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  fontWeight: theme.fontWeight.semibold,
})

export const contentStyle = css({
  minWidth: 0,
  alignSelf: 'stretch',
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
})
