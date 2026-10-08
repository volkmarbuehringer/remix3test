import { css } from 'remix/component'
import type { CSSMixinDescriptor, Handle, Props, RemixNode } from 'remix/component'

import * as menu from '@remix-run/ui/menu'
import type { SearchValue } from './typeahead.ts'
import { CheckIcon } from './icons.tsx'
import { popoverSurfaceStyle } from './popover-styles.ts'
import { componentStyleValues as styles } from './style-values.ts'

const menuPopoverCss: CSSMixinDescriptor = css({
  '&[data-menu-submenu="true"][data-anchor-placement^="right"]': {
    marginLeft: `calc(${styles.space.xs} * -1)`,
  },
  '&[data-menu-submenu="true"][data-anchor-placement^="left"]': {
    marginLeft: styles.space.xs,
  },
  '&[data-close-animation="none"]:not(:popover-open)': {
    transition: 'none',
    transitionBehavior: 'normal',
  },
})

const menuListCss: CSSMixinDescriptor = css({
  display: 'flex',
  flexDirection: 'column',
  flex: '1 1 auto',
  minHeight: 0,
  paddingBlock: styles.space.xs,
  paddingInline: styles.space.none,
  overflow: 'auto',
  overscrollBehavior: 'contain',
  outline: 'none',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  '--rmx-ui-item-inset': `calc(${styles.space.sm} + ${styles.space.xs})`,
  '--rmx-ui-item-indicator-gap': 'var(--rmx-menu-item-slot-gap)',
  '--rmx-ui-item-indicator-width': 'var(--rmx-menu-item-slot-width)',
  '--rmx-menu-item-slot-gap': styles.space.none,
  '--rmx-menu-item-slot-width': styles.space.none,
  '&:has(> [role="menuitemcheckbox"])': {
    '--rmx-menu-item-slot-gap': styles.space.xs,
    '--rmx-menu-item-slot-width': styles.fontSize.md,
  },
  '&:has(> [role="menuitemradio"])': {
    '--rmx-menu-item-slot-gap': styles.space.xs,
    '--rmx-menu-item-slot-width': styles.fontSize.md,
  },
})

const menuItemCss: CSSMixinDescriptor = css({
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  minWidth: 0,
  minHeight: styles.control.height.md,
  boxSizing: 'border-box',
  position: 'relative',
  isolation: 'isolate',
  paddingInline: `calc(${styles.space.sm} + ${styles.space.xs})`,
  color: styles.colors.text.primary,
  fontFamily: styles.fontFamily.sans,
  fontSize: styles.fontSize.sm,
  fontWeight: styles.fontWeight.normal,
  lineHeight: styles.lineHeight.normal,
  textAlign: 'left',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  '--rmx-menu-item-indicator-opacity': '0',
  '&::before': {
    content: '""',
    position: 'absolute',
    insetBlock: 0,
    insetInline: styles.space.xs,
    borderRadius: styles.radius.md,
    backgroundColor: 'transparent',
    pointerEvents: 'none',
    zIndex: -1,
  },
  '&:focus': {
    outline: 'none',
  },
  '&[data-highlighted="true"]': {
    color: styles.colors.action.primary.foreground,
  },
  '&[data-highlighted="true"]::before': {
    backgroundColor: styles.colors.action.primary.background,
  },
  '&[aria-haspopup="menu"][aria-expanded="true"]:not(:focus)': {
    color: styles.colors.text.primary,
  },
  '&[aria-haspopup="menu"][aria-expanded="true"]:not(:focus)::before': {
    backgroundColor: styles.surface.lvl2,
  },
  '&[data-submenu-state="selecting"], &[data-submenu-state="dismissing"]': {
    color: styles.colors.text.primary,
  },
  '&[data-submenu-state="selecting"]::before, &[data-submenu-state="dismissing"]::before': {
    backgroundColor: styles.surface.lvl2,
  },
  '&[data-menu-flash="true"]': {
    color: styles.colors.text.primary,
  },
  '&[data-menu-flash="true"]::before': {
    backgroundColor: 'transparent',
  },
  '&[aria-disabled="true"]': {
    opacity: 0.5,
  },
  '&[aria-checked="true"], &[aria-selected="true"]': {
    '--rmx-menu-item-indicator-opacity': '1',
  },
})

const menuItemSlotCss: CSSMixinDescriptor = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: '0 0 var(--rmx-menu-item-slot-width)',
  width: 'var(--rmx-menu-item-slot-width)',
  minWidth: 0,
  marginInlineEnd: 'var(--rmx-menu-item-slot-gap)',
  overflow: 'hidden',
})

const menuItemLabelCss: CSSMixinDescriptor = css({
  display: 'inline-flex',
  alignItems: 'center',
  flex: '1 1 auto',
  minWidth: 0,
})

const menuItemIndicatorCss: CSSMixinDescriptor = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: styles.fontSize.md,
  height: styles.fontSize.md,
  color: 'currentColor',
  flexShrink: 0,
  '& > svg': {
    display: 'block',
    width: '100%',
    height: '100%',
  },
  opacity: 'var(--rmx-menu-item-indicator-opacity)',
})

const popoverStyle = menuPopoverCss
export const listStyle = menuListCss
export const itemStyle = menuItemCss
const itemSlotStyle = menuItemSlotCss
const itemLabelStyle = menuItemLabelCss
const itemIndicatorStyle = menuItemIndicatorCss

interface MenuListProps extends Props<'div'> {}

interface MenuItemProps extends Omit<Props<'div'>, 'children' | 'name' | 'type' | 'value'> {
  checked?: boolean
  children?: RemixNode
  disabled?: boolean
  label?: string
  name: string
  searchValue?: SearchValue
  type?: 'checkbox' | 'radio'
  value?: string
}

export function MenuList(handle: Handle<MenuListProps>): () => RemixNode {
  return () => {
    let { children, mix, ...divProps } = handle.props

    return (
      <div mix={[popoverSurfaceStyle, popoverStyle, menu.popover()]}>
        <div {...divProps} mix={[listStyle, menu.list(), mix]}>
          {children}
        </div>
      </div>
    )
  }
}

export function MenuItem(handle: Handle<MenuItemProps>): () => RemixNode {
  return () => {
    let { checked, children, disabled, label, mix, name, searchValue, type, value, ...divProps } =
      handle.props

    return (
      <div
        {...divProps}
        mix={[
          itemStyle,
          menu.item({
            name,
            ...(checked !== undefined ? { checked } : {}),
            ...(disabled !== undefined ? { disabled } : {}),
            ...(label !== undefined ? { label } : {}),
            ...(searchValue !== undefined ? { searchValue } : {}),
            ...(type !== undefined ? { type } : {}),
            ...(value !== undefined ? { value } : {}),
          }),
          mix,
        ]}
      >
        <span mix={itemSlotStyle}>
          <CheckIcon mix={itemIndicatorStyle} />
        </span>
        <span mix={itemLabelStyle}>{children ?? label}</span>
      </div>
    )
  }
}
