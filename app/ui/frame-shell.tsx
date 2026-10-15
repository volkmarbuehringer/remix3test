import { css, Frame, type Handle } from 'remix/component'
import { getContext } from 'remix/middleware/async-context'
import { theme } from '../ui/theme/theme.ts'
import { Layout } from './layout.tsx'

/**
 * Slot content for the shell's self-relay frame. It makes the frame
 * non-blocking: the fallback streams first and the resolved content follows in
 * a `<template>` that only the client runtime swaps in.
 */
const frameFallbackStyle = css({
  padding: '1.5rem',
  background: theme.surface.lvl0,
  borderRadius: theme.radius.lg,
  border: `1px solid ${theme.colors.border.default}`,
  color: theme.colors.text.muted,
  fontSize: theme.fontSize.sm,
})

/**
 * Document shell for a full GET of a framed section: the shell streams first
 * and a self-relay `<Frame>` loads the page content through its own GET
 * (carrying `X-Remix-Target: name`). Shared by the sidebar and lists shells so
 * the frame fallback cannot drift between them.
 *
 * Callers must only render this on the full-document GET path; frame requests
 * must return the fragment directly and non-GET responses must render inline
 * (POST validation state is lost to the frame's separate GET).
 *
 * `blocking` drops the fallback: the frame awaits its content and renders it
 * inline, so a JavaScript-disabled browser sees the page (no `<template>` swap
 * and no client runtime). A blocking frame must render HTML on every response,
 * including error paths, or the whole outer page render fails — only opt in for
 * a page whose frame GET is guaranteed to answer HTML.
 */
export function FrameShell(handle: Handle<{ name: string; blocking?: boolean | undefined }>) {
  return () => (
    <Layout>
      <Frame
        name={handle.props.name}
        src={getContext().request.url}
        {...(handle.props.blocking
          ? {}
          : { fallback: <div mix={frameFallbackStyle}>Inhalt wird geladen…</div> })}
      />
    </Layout>
  )
}
