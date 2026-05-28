import type { Handle } from 'remix/ui'
import { css } from 'remix/ui'
import { theme } from 'remix/ui/theme'

interface StatsFragmentProps {
  serverTime: string
  serverDate: string
  uptime: string
  nodeVersion: string
}

const cardStyle = css({
  background: theme.surface.lvl0,
  borderRadius: theme.radius.lg,
  padding: '1.5rem',
  border: `1px solid ${theme.colors.border.default}`,
  boxShadow: theme.shadow.sm,
})

const titleStyle = css({
  fontSize: '1.25rem',
  fontWeight: 600,
  margin: '0 0 1rem',
  color: theme.colors.text.primary,
})

const statGridStyle = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  gap: theme.space.md,
})

const statItemStyle = css({
  padding: theme.space.md,
  background: theme.surface.lvl1,
  borderRadius: theme.radius.md,
  border: `1px solid ${theme.colors.border.subtle}`,
})

const statLabelStyle = css({
  fontSize: theme.fontSize.xs,
  color: theme.colors.text.muted,
  marginBottom: theme.space.xs,
})

const statValueStyle = css({
  fontSize: theme.fontSize.lg,
  fontWeight: theme.fontWeight.semibold,
  color: theme.colors.text.primary,
  fontVariantNumeric: 'tabular-nums',
})

export function StatsFragment(handle: Handle<StatsFragmentProps>) {
  return () => {
    let { serverTime, serverDate, uptime, nodeVersion } = handle.props
    return (
    <div mix={cardStyle}>
      <h2 mix={titleStyle}>Server Stats</h2>
      <div mix={statGridStyle}>
        <div mix={statItemStyle}>
          <div mix={statLabelStyle}>Server Time</div>
          <div mix={statValueStyle}>{serverTime}</div>
        </div>
        <div mix={statItemStyle}>
          <div mix={statLabelStyle}>Date</div>
          <div mix={statValueStyle}>{serverDate}</div>
        </div>
        <div mix={statItemStyle}>
          <div mix={statLabelStyle}>Uptime</div>
          <div mix={statValueStyle}>{uptime}</div>
        </div>
        <div mix={statItemStyle}>
          <div mix={statLabelStyle}>Node</div>
          <div mix={statValueStyle}>{nodeVersion}</div>
        </div>
      </div>
    </div>
  )
  }
}
