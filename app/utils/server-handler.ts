import { html } from 'remix/html-template'

/** The subset of a Remix router the runtime entrypoints depend on. */
export interface RequestRouter {
  fetch(request: Request): Response | Promise<Response>
}

/**
 * Builds the runtime-agnostic request pipeline shared by the Node and Bun
 * server entrypoints: it stamps the trusted, TCP-derived client IP and turns
 * an uncaught router error into the app's 500 page.
 *
 * The caller supplies `clientIp` from its own socket API so the value can
 * never be spoofed via request headers (see `app/utils/request-ip.ts`).
 */
export function createServerHandler(
  router: RequestRouter,
): (request: Request, clientIp: string) => Promise<Response> {
  return async function handleRequest(request, clientIp) {
    try {
      // Trust only the TCP socket address: this deployment has no trusted
      // reverse proxy, so X-Forwarded-For must not be trusted as the client IP.
      request.headers.set('X-Client-Ip', clientIp)
      return await router.fetch(request)
    } catch (error) {
      if (!(request.signal.aborted && error === request.signal.reason)) {
        console.error(error)
      }
      return new Response(
        String(
          html`<!doctype html>
            <html lang="de">
              <head>
                <meta charset="utf-8" />
                <title>Serverfehler — newapp</title>
                <style>
                  body {
                    font-family: 'JetBrains Mono', ui-monospace, monospace;
                    background: #f7fbff;
                    color: #313539;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    margin: 0;
                  }
                  .card {
                    background: #ffffff;
                    padding: 2rem;
                    border-radius: 8px;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                    text-align: center;
                    max-width: 480px;
                  }
                  h1 {
                    font-size: 1.25rem;
                    margin: 0 0 0.5rem;
                  }
                  p {
                    color: #5a5e62;
                    margin: 0;
                  }
                </style>
              </head>
              <body>
                <div class="card">
                  <h1>Serverfehler</h1>
                  <p>Bitte versuchen Sie es später erneut.</p>
                </div>
              </body>
            </html>`,
        ),
        {
          status: 500,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        },
      )
    }
  }
}
