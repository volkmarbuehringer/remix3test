import { css, Frame, type Handle } from 'remix/component'
import { getContext } from 'remix/middleware/async-context'
import { theme } from '../ui/theme/theme.ts'
import { Layout } from './layout.tsx'

/**
 * Slot content for the shell's self-relay frame. Without a fallback the frame
 * is blocking: a non-HTML frame response would fail the whole page render.
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
 */
export function FrameShell(handle: Handle<{ name: string }>) {
  return () => (
    <Layout>
      <Frame
        name={handle.props.name}
        src={getContext().request.url}
        fallback={<div mix={frameFallbackStyle}>Inhalt wird geladen…</div>}
      />
    </Layout>
  )
}
