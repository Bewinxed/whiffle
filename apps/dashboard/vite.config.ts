import http from "node:http";
import path from "node:path";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import Icons from "unplugin-icons/vite";
import { defineConfig, type Plugin } from "vite";

// marked is a browser-only dependency here, so it is in the client graph and
// absent from the server one. Each build is judged on whether the module it
// actually pulled in was the shape the plugin below expects — a build that
// never loads marked has nothing to protect and nothing to complain about.
const MARKED_ESM = /[\\/]marked[\\/]lib[\\/]marked\.esm\.js$/;

/**
 * marked's probe, rewritten into a shape the bundler cannot delete.
 *
 * Safari only grew regex lookbehind in 16.4, so marked asks the engine at
 * module load whether it has it, and picks one of two patterns from the
 * answer:
 *
 *   try { return !!new RegExp("(?<=1)(?<!1)") } catch { return false }
 *
 * rolldown treats `new RegExp(...)` as side-effect-free, drops the
 * construction, and folds `!!<object>` to `true` — the detector now answers
 * "yes, always", marked takes the lookbehind branch, and the pattern throws
 * `SyntaxError: invalid group specifier name` on any Safari below 16.4 while
 * the markdown chunk is still evaluating. Only the transcript imports that
 * chunk, which is how an iPad on iPadOS 15.6 got "500 — Internal Error" on one
 * screen while the rest of the dashboard behaved.
 *
 * oxc's MINIFIER has since learned to keep these probes when a `build.target`
 * says the pattern might not compile (oxc#24712, and `build.target` below is
 * set for that reason among others), but the fold also happens without the
 * minifier — an unminified build shows `try { return true } catch` too — so
 * the target alone does not save it. Reading `.source` off the result is what
 * does: the value is no longer a bare constructed object the bundler can
 * reason away, and it survives both DCE and minification.
 *
 * Deliberately fails the build when the expected source is missing, rather
 * than passing silently: a version of marked this no longer matches is a
 * version whose probe may be intact, may be spelled differently, or may be
 * getting folded again with nothing to show for it. Loud is recoverable —
 * look at the new source and update the pattern here, or delete this plugin
 * once rolldown stops folding it. Silent is another iPad bug reported weeks
 * later.
 */
const markedLookbehindProbe = (): Plugin => {
  const FOLDABLE = 'try{return!!new RegExp("(?<=1)(?<!1)")}catch{return!1}';
  const SURVIVES =
    'try{return new RegExp("(?<=1)(?<!1)").source.length>0}catch{return!1}';
  let seen = false;
  let rewrote = false;
  return {
    name: "whiffle:marked-lookbehind-probe",
    apply: "build",
    buildStart() {
      seen = false;
      rewrote = false;
    },
    transform(code, id) {
      if (!MARKED_ESM.test(id)) {
        return null;
      }
      seen = true;
      if (!code.includes(FOLDABLE)) {
        return null;
      }
      rewrote = true;
      return { code: code.replaceAll(FOLDABLE, SURVIVES), map: null };
    },
    buildEnd() {
      if (seen && !rewrote) {
        this.error(
          "whiffle:marked-lookbehind-probe found nothing to rewrite. marked's " +
            "lookbehind feature detection is no longer spelled\n\n  " +
            `${FOLDABLE}\n\n` +
            "so this plugin is not protecting it any more. Check how the " +
            "current marked writes that probe (search its lib/marked.esm.js " +
            'for "(?<=1)(?<!1)"), then either update FOLDABLE/SURVIVES here or ' +
            "drop this plugin if the bundler has stopped folding it. Shipping " +
            "as-is breaks the transcript on Safari below 16.4."
        );
      }
    },
  };
};

/**
 * Proxies the dashboard's `/ws` upgrade to the hub, by hand.
 *
 * Vite's built-in `server.proxy['/ws'] { ws: true }` stopped upgrading the
 * socket under rolldown-vite — the handshake returns 404/no-101 and the
 * dashboard reads the hub as unreachable even while it is up. Rather than fight
 * the proxy internals, this claims the `/ws` upgrade itself: it opens an Upgrade
 * request to the hub, replays the hub's 101 back to the browser, and pipes the
 * two raw sockets together. HMR (a different path / the `vite-hmr` protocol) is
 * never `/ws`, so returning early leaves it entirely to Vite.
 *
 * Also the whole fix for a stray upgrade killing the dev server: `http.Server`
 * drops a socket's error handling the moment it emits `upgrade`, so an upgrade
 * no listener claims is left with no `error` handler and the eventual reset is a
 * process-level throw. Attaching an error listener to every upgrade socket keeps
 * that reset from taking the server (and every dashboard socket) down with it.
 */
const hubWsProxy = (): Plugin => ({
  name: "whiffle:hub-ws-proxy",
  configureServer(server) {
    const target = new URL(
      process.env.WHIFFLE_HUB_URL || "http://localhost:3456"
    );
    server.httpServer?.on("upgrade", (req, socket, head) => {
      socket.on("error", (error: NodeJS.ErrnoException) => {
        server.config.logger.warn(
          `[whiffle] websocket socket error on ${req.url}: ${error.code ?? error.message}`,
          { timestamp: true }
        );
      });
      // Only /ws is ours; HMR's upgrade is left for Vite to answer.
      if (!req.url?.startsWith("/ws")) {
        return;
      }
      const proxyReq = http.request({
        host: target.hostname,
        port: target.port,
        path: req.url,
        method: req.method,
        headers: req.headers,
      });
      proxyReq.on("upgrade", (proxyRes, proxySocket, proxyHead) => {
        const lines = ["HTTP/1.1 101 Switching Protocols"];
        for (let i = 0; i < proxyRes.rawHeaders.length; i += 2) {
          lines.push(
            `${proxyRes.rawHeaders[i]}: ${proxyRes.rawHeaders[i + 1]}`
          );
        }
        socket.write(`${lines.join("\r\n")}\r\n\r\n`);
        if (proxyHead?.length) {
          socket.write(proxyHead);
        }
        if (head?.length) {
          proxySocket.write(head);
        }
        proxySocket.pipe(socket).pipe(proxySocket);
        proxySocket.on("error", () => socket.destroy());
        socket.on("error", () => proxySocket.destroy());
      });
      proxyReq.on("error", (error: NodeJS.ErrnoException) => {
        server.config.logger.warn(
          `[whiffle] hub ws proxy could not reach ${target.host}: ${error.code ?? error.message}`,
          { timestamp: true }
        );
        socket.destroy();
      });
      proxyReq.end();
    });
  },
});

export default defineConfig({
  plugins: [
    markedLookbehindProbe(),
    hubWsProxy(),
    tailwindcss(),
    sveltekit(),
    Icons({ compiler: "svelte" }),
  ],
  server: {
    port: 3000,
    host: true,
    // The dashboard is reached from the other machines on the tailnet, by name.
    // Vite refuses an unknown Host header with a 403, so the tailnet suffix is
    // named here; `.ts.net` covers this tailnet's MagicDNS names without
    // pinning the machine's own hostname into the repo.
    allowedHosts: [".ts.net", "localhost"],
    // NOTE: the /ws websocket is proxied by hubWsProxy() above, not here —
    // rolldown-vite's built-in ws proxy fails the 101 upgrade. REST /api is
    // handled by SvelteKit's own route (routes/api/[...path]).
  },
  /**
   * The browsers this dashboard is actually opened in — an iPad on iPadOS 15.6
   * among them, which is why this is spelled out rather than left to default.
   *
   * Naming a target is not only about which syntax gets lowered. oxc's
   * minifier decides whether a `new RegExp(...)` is safe to delete by asking
   * whether every configured target can compile that pattern, and with no
   * target configured it assumes the newest engine and deletes it. That is not
   * a cosmetic difference: libraries feature-detect regex support by
   * constructing a pattern inside a try/catch, and deleting the construction
   * turns `try { return !!new RegExp("(?<=1)(?<!1)") } catch { return false }`
   * into `try { return true } catch { return false }` — a detector that always
   * answers yes. `marked` does exactly this for lookbehind, which Safari only
   * grew in 16.4, so the minified bundle took the lookbehind branch and threw
   * `SyntaxError: invalid group specifier name` while the markdown chunk was
   * evaluating. Only the transcript loads that chunk, so the whole app worked
   * on an iPad except the one screen, which rendered "500 — Internal Error".
   *
   * With the target named, the same minifier keeps every such probe intact,
   * for marked and for anything else that detects a feature this way. Do not
   * replace this with `esnext`, and do not drop it: either brings the bug back
   * for every dependency at once.
   */
  build: {
    target: ["safari15.6", "chrome107", "firefox104", "edge107"],
  },
  resolve: {
    alias: {
      $lib: path.resolve("./src/lib"),
    },
  },
  optimizeDeps: {
    exclude: ["@xyflow/svelte"],
  },
  ssr: {
    // Both ship raw .svelte sources; dev SSR must compile them, not require them.
    // These publish raw .svelte sources, which dev SSR must compile rather
    // than hand to Node — externalizing any of them ends in
    // ERR_UNKNOWN_FILE_EXTENSION on the first server-rendered request.
    noExternal: ["@xyflow/svelte", "virtua", "@hugeicons/svelte", "torph"],
  },
});
