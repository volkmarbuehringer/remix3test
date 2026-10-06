import { createElement } from 'remix/component'
import type { Handle, Props, RemixElement } from 'remix/component'

type IconProps = Omit<Props<'svg'>, 'children'>

function icon(
  handle: Handle<IconProps>,
  children: RemixElement | readonly RemixElement[],
): RemixElement {
  let hiddenByDefault =
    handle.props['aria-hidden'] === undefined &&
    handle.props['aria-label'] === undefined &&
    handle.props['aria-labelledby'] === undefined

  return createElement(
    'svg',
    {
      ...handle.props,
      'aria-hidden': hiddenByDefault ? true : handle.props['aria-hidden'],
      fill: handle.props.fill ?? 'none',
      viewBox: handle.props.viewBox ?? '0 0 16 16',
      xmlns: 'http://www.w3.org/2000/svg',
    },
    children,
  )
}

function strokedPath(d: string): RemixElement {
  return createElement('path', {
    d,
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: '1.5',
  })
}

export function CheckIcon(handle: Handle<IconProps>): () => RemixElement {
  return () => icon(handle, strokedPath('m3.5 8.25 2.75 2.75L12.5 4.75'))
}
