import { css } from 'remix/component'

/**
 * Shared geometry for the two frame-traversal reproductions. The e2e suites
 * assert scroll offsets, so both fixtures must keep the same row height and
 * panel placement; keeping them here prevents the reproductions from drifting.
 */
export const listItems = Array.from({ length: 48 }, (_, index) => index + 1)

export const rowStyle = css({
  minHeight: 76,
  display: 'flex',
  alignItems: 'center',
  border: '1px solid rgba(0,0,0,0.12)',
  borderRadius: 10,
  padding: '0 18px',
  background: 'rgba(0,0,0,0.03)',
})

export const panelStyle = css({
  position: 'sticky',
  top: 12,
  zIndex: 1,
  padding: 14,
  marginBottom: 12,
  background: '#151c35',
  color: '#ffffff',
  borderRadius: 10,
  boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
})
