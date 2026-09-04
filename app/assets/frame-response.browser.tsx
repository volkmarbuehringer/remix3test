import type { FrameContent, ResolveFrameOptions } from 'remix/ui'
import { Accept, SuperHeaders } from 'remix/headers'

import { routes } from '../routes.ts'
import { agentPrefillMap } from '../ui/agent-prefill-store.browser.ts'
import { ErrorCard, actionLinkCss } from './error-card.browser.tsx'

export async function resolveFrameResponse(
  url: URL,
  options?: ResolveFrameOptions,
): Promise<FrameContent | Response> {
  let headers = new SuperHeaders()
  headers.accept = new Accept('text/html')
  headers.set('X-Remix-Frame', 'true')

  if (options?.target) {
    headers.set('X-Remix-Target', options.target)
  }

  let prefillKey = url.pathname + url.search
  let prefill = agentPrefillMap.get(prefillKey)
  if (prefill) {
    let encoded = new TextEncoder().encode(JSON.stringify(prefill))
    let binary = String.fromCharCode(...new Uint8Array(encoded))
    headers.set('X-Agent-Prefill', btoa(binary))
  }

  let bodyInit = getRequestBody(options?.formData, options?.method, options?.encType)
  let response = await fetch(url, {
    cache: 'no-store',
    headers,
    ...(options?.method !== undefined ? { method: options.method } : {}),
    ...(bodyInit !== undefined ? { body: bodyInit } : {}),
    ...(options?.signal !== undefined ? { signal: options.signal } : {}),
  })

  if (prefill && response.ok) {
    agentPrefillMap.delete(prefillKey)
  }

  // A redirected response may contain document UI that is not valid for the requested subframe.
  // The destination opts into subframe rendering by returning the matching target header.
  if (response.redirected && options?.target) {
    window.location.assign(response.url)
    return new Promise<never>(() => {})
  }

  if (response.status === 401) {
    window.location.assign(routes.auth.login.index.href())
    return new Promise<never>(() => {})
  }

  if (!response.ok) {
    // The server may return a meaningful fragment for a non-2xx outcome such as
    // a form validation re-render (400) or a not-found page (404). Render the
    // response body so the actionable message is shown in the frame instead of
    // a generic crash card. Treat 5xx as a genuine server error, where the body
    // is not a usable fragment and a reload is the right recovery.
    if (response.status < 500) {
      return response
    }

    return (
      <ErrorCard
        eyebrow="Unexpected Error"
        title="Reload required"
        message="An unexpected error occurred. Please reload the page to try again."
        action={
          <a data-rmx-document href={window.location.href} mix={actionLinkCss}>
            Reload
          </a>
        }
      />
    )
  }

  return response
}

function getRequestBody(
  formData?: FormData,
  method?: string,
  encType?: string,
): BodyInit | undefined {
  if (!formData || method?.toLowerCase() === 'get') return

  if (encType === 'text/plain') {
    let body = ''
    for (let [name, value] of formData) {
      name = normalizeLineBreaks(name)
      value = normalizeLineBreaks(typeof value === 'string' ? value : value.name)
      body += `${name}=${value}\r\n`
    }
    return new Blob([body], { type: 'text/plain' })
  }

  if (encType !== 'application/x-www-form-urlencoded') return formData

  let body = new URLSearchParams()
  for (let [name, value] of formData) {
    body.append(name, typeof value === 'string' ? value : value.name)
  }
  return body
}

function normalizeLineBreaks(value: string): string {
  return value.replace(/\r\n|\r|\n/g, '\r\n')
}
