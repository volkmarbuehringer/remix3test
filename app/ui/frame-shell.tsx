import { Frame, type Handle } from 'remix/component'
import { getContext } from 'remix/middleware/async-context'

import { FrameFallback } from './frame-fallback.browser.tsx'
import { Layout } from './layout.tsx'

/**
 * Document shell for a full GET of a framed section: a self-relay `<Frame>`
 * loads the page content through its own GET (carrying `X-Remix-Target: name`).
 * Both shells render it blocking by default, so the content is part of the
 * initial HTML and a JavaScript-disabled browser sees the page; shared here so
 * the shell handling cannot drift between them.
 *
 * Callers must only render this on the full-document GET path; frame requests
 * must return the fragment directly and non-GET responses must render inline
 * (POST validation state is lost to the frame's separate GET).
 *
 * `blocking` drops the fallback: the frame awaits its content and renders it
 * inline, so a JavaScript-disabled browser sees the page (no `<template>` swap
 * and no client runtime). A blocking frame must render HTML on every response,
 * including error paths, or the whole outer page render fails — only opt in for
 * a page whose frame GET is guaranteed to answer HTML. This shell defaults to
 * blocking; pass `blocking={false}` to stream the content behind
 * `FrameFallback` instead.
 */
export function FrameShell(handle: Handle<{ name: string; blocking?: boolean | undefined }>) {
  return () => {
    let blocking = handle.props.blocking ?? true
    return (
      <Layout>
        <Frame
          name={handle.props.name}
          src={getContext().request.url}
          {...(blocking
            ? {}
            : {
                fallback: <FrameFallback label="Inhalt wird geladen…" name={handle.props.name} />,
              })}
        />
      </Layout>
    )
  }
}
