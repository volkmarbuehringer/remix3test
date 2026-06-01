import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from 'remix/ui/theme'

interface UserDetailFragmentProps {
  userId: number
  name: string
  role: string
}

const detailStyle = css({
  background: theme.surface.lvl2,
  borderRadius: theme.radius.md,
  padding: theme.space.md,
  border: `1px solid ${theme.colors.border.subtle}`,
  fontSize: theme.fontSize.sm,
})

const rowStyle = css({
  display: 'flex',
  gap: theme.space.sm,
  marginBottom: theme.space.xs,
  '&:last-child': { marginBottom: 0 },
})

const labelStyle = css({
  color: theme.colors.text.muted,
  fontWeight: theme.fontWeight.medium,
  minWidth: '60px',
})

const valueStyle = css({
  color: theme.colors.text.primary,
})

export function UserDetailFragment(handle: Handle<UserDetailFragmentProps>) {
  return () => {
    let { userId, name, role } = handle.props
    return (
    <div mix={detailStyle}>
      <div mix={rowStyle}>
        <span mix={labelStyle}>Benutzer-ID</span>
        <span mix={valueStyle}>{userId}</span>
      </div>
      <div mix={rowStyle}>
        <span mix={labelStyle}>Name</span>
        <span mix={valueStyle}>{name}</span>
      </div>
      <div mix={rowStyle}>
        <span mix={labelStyle}>Rolle</span>
        <span mix={valueStyle}>{role}</span>
      </div>
    </div>
  )
  }
}
