import type { FramePayload, PreviewSource } from "@whiffle/core";
import {
  type PreviewSocket,
  previewWebSocket,
  proxyHeaders,
  upgradePreview,
} from "@whiffle/core/preview-proxy";
import { PREVIEW_PORT } from "./config";

/**
 * The preview listener is one origin for every preview, and the browser picks
 * which one it sees with a single `whiffle_preview` cookie. Cookies are shared
 * across ports on a host, so that is one active preview per browser: opening a
 * second session's preview points every open preview iframe in that browser at
 * the second app until one of them is shown again. The pane says so when it
 * happens (PreviewPane.svelte, `BroadcastChannel("whiffle-preview")`).
 */
export const previewTargets = new Map<
  string,
  {
    machineId: string;
    address: string;
    port: number;
    source: PreviewSource;
  }
>();

export function previewFrame(
  instanceId: string,
  state: "open" | "closed",
  source?: PreviewSource
): Extract<FramePayload, { kind: "preview" }> {
  return {
    kind: "preview",
    instanceId,
    state,
    previewPort: PREVIEW_PORT,
    open: `/__whiffle/open/${encodeURIComponent(instanceId)}`,
    source,
  };
}

export function startPreviewListener(hostname: string) {
  return Bun.serve<PreviewSocket>({
    hostname,
    port: PREVIEW_PORT,
    websocket: previewWebSocket,
    async fetch(request, server) {
      const url = new URL(request.url);
      if (
        request.method === "GET" &&
        url.pathname.startsWith("/__whiffle/open/")
      ) {
        const instanceId = decodeURIComponent(
          url.pathname.slice("/__whiffle/open/".length)
        );
        if (!previewTargets.has(instanceId)) {
          return new Response("No preview for this session.", { status: 404 });
        }
        return new Response(null, {
          status: 302,
          headers: {
            "set-cookie": `whiffle_preview=${encodeURIComponent(instanceId)}; Path=/; SameSite=Lax; HttpOnly`,
            location: "/",
            "cache-control": "no-store",
          },
        });
      }
      const cookie = request.headers
        .get("cookie")
        ?.split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith("whiffle_preview="));
      const target = cookie
        ? previewTargets.get(
            decodeURIComponent(cookie.slice("whiffle_preview=".length))
          )
        : undefined;
      if (!target) {
        return new Response("No preview selected.", { status: 404 });
      }
      const address = target.address.includes(":")
        ? `[${target.address}]`
        : target.address;
      const upstream = `${address}:${target.port}${url.pathname}${url.search}`;
      const headers = proxyHeaders(request.headers);
      if (request.headers.get("upgrade")?.toLowerCase() === "websocket") {
        return upgradePreview(request, server, `ws://${upstream}`, headers)
          ? undefined
          : new Response("WebSocket upgrade failed", { status: 400 });
      }
      const response = await fetch(`http://${upstream}`, {
        method: request.method,
        headers,
        body: request.body,
        redirect: "manual",
      });
      const downstream = proxyHeaders(response.headers);
      // Same as the daemon hop: the body is already decoded here.
      if (downstream.has("content-encoding")) {
        downstream.delete("content-encoding");
        downstream.delete("content-length");
      }
      return new Response(response.body, {
        status: response.status,
        headers: downstream,
      });
    },
    error() {
      return new Response("Preview upstream unavailable", { status: 502 });
    },
  });
}
