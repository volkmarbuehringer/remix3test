import type { FrameContent, ResolveFrameOptions } from "remix/ui";
import { run } from "remix/ui";
import { spring } from "remix/ui/animation";
import { Accept, SuperHeaders } from "remix/headers";

import { routes } from "../routes.ts";
import { agentPrefillMap } from "../ui/agent-prefill-store.browser.ts";

const app = run({
  async loadModule(moduleUrl, exportName) {
    let mod = await import(moduleUrl);
    let exp = (mod as Record<string, unknown>)[exportName];
    if (typeof exp !== "function") {
      throw new Error(
        `Export "${exportName}" from "${moduleUrl}" is not a function`,
      );
    }
    return exp;
  },
  async resolveFrame(src, options) {
    return resolveFrameResponse(new URL(src, window.location.href), options);
  },
});

if (import.meta.hot) {
  import.meta.hot.on("server:update", async () => {
    try {
      await app.ready();
      await app.frames.top.reload();
    } catch (error) {
      console.error("Error reloading top frame on server update", error);
      window.location.reload();
    }
  });
}

async function resolveFrameResponse(
  url: URL,
  options?: ResolveFrameOptions,
): Promise<FrameContent | Response> {
  let headers = new SuperHeaders();
  headers.accept = new Accept("text/html");
  headers.set("X-Remix-Frame", "true");

  if (options?.target) {
    headers.set("X-Remix-Target", options.target);
  }

  let prefillKey = url.pathname + url.search;
  let prefill = agentPrefillMap.get(prefillKey);
  if (prefill) {
    let encoded = new TextEncoder().encode(JSON.stringify(prefill));
    let binary = String.fromCharCode(...new Uint8Array(encoded));
    headers.set("X-Agent-Prefill", btoa(binary));
  }

  let response = await fetch(url, {
    cache: "no-store",
    headers,
    method: options?.method,
    body: getRequestBody(options?.formData, options?.method, options?.encType),
    signal: options?.signal,
  });

  if (prefill && response.ok) {
    agentPrefillMap.delete(prefillKey);
  }

  if (response.status === 401) {
    window.location.assign(routes.auth.login.index.href());
    return new Promise<never>(() => {});
  }

  if (!response.ok) {
    let { ErrorCard, actionLinkCss } = await import("./error-card.browser.tsx");
    return (
      <ErrorCard
        eyebrow="Unexpected Error"
        title="Reload required"
        message="An unexpected error occurred. Please reload the page to try again."
        action={
          <a rmx-document href={window.location.href} mix={actionLinkCss}>
            Reload
          </a>
        }
      />
    );
  }

  return response;
}

function getRequestBody(
  formData?: FormData,
  method?: string,
  encType?: string,
): BodyInit | undefined {
  if (!formData || method?.toLowerCase() === "get") return;
  if (encType !== "application/x-www-form-urlencoded") return formData;

  let body = new URLSearchParams();
  for (let [name, value] of formData) {
    body.append(name, typeof value === "string" ? value : value.name);
  }
  return body;
}

app.addEventListener("error", async (event) => {
  app.dispose();
  let errorCard = import("./error-card.browser.tsx");
  await fadeOutBody();

  let message =
    "message" in event.error ? event.error.message : "Unknown error";
  try {
    let { renderFatalError } = await errorCard;
    renderFatalError(message);
  } catch {
    document.body.textContent = `Fatal error: ${message}`;
  }
});

async function fadeOutBody() {
  let animation = document.body.animate(
    [
      { opacity: 1, transform: "translateY(0) scale(1)" },
      { opacity: 0, transform: "translateY(10px) scale(0.985)" },
    ],
    { ...spring("snappy") },
  );

  await animation.finished;
  document.body.innerHTML = "";
}
