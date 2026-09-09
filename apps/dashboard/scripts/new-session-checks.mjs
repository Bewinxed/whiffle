// biome-ignore-all lint/performance/noAwaitInLoops: Browser interactions and measurements are sequential.
import assert from "node:assert/strict";
import { homedir } from "node:os";
import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath: `${homedir()}/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(7000);
const base = process.argv[2] || "http://localhost:5173";
const errors = [];
const frames = [];
let failures = 0;
let fsDelay = 0;
const levels = ["low", "medium", "high", "xhigh", "max"];
const machines = ["check-online", "check-pi"].map((machineId) => ({
  machineId,
  hostname: machineId === "check-online" ? "check-host" : "pi-host",
  status: "online",
  os: "linux",
  auth: "authenticated",
  lastSeenAt: null,
  harnesses: ["claude", "opencode", "pi"].map((harness) => ({
    harness,
    installed: machineId !== "check-pi" || harness === "pi",
    capabilities: {
      permissionModes: ["default", "plan", "acceptEdits", "bypassPermissions"],
      effort: true,
    },
  })),
}));
const projects = machines.map(({ machineId, hostname }) => ({
  id: `project-${machineId}`,
  machineId,
  cwd: "/home/check/project",
  name: `${hostname} project`,
}));
page.on("pageerror", (error) => errors.push(error.message));
await page.routeWebSocket(
  (url) => url.pathname !== "/ws/dashboard",
  () => {
    /* Keep Vite HMR isolated during each browser check. */
  }
);
// No dashboard socket reaches the hub. Spawn frames are captured locally.
await page.routeWebSocket("**/ws/dashboard", (socket) => {
  socket.onMessage(async (message) => {
    const frame = JSON.parse(String(message));
    frames.push(frame);
    if (!["fs", "control"].includes(frame.verb)) {
      return;
    }
    const { payload } = frame;
    if (fsDelay) {
      await new Promise((resolve) => setTimeout(resolve, fsDelay));
    }
    const ok = !payload.path?.startsWith("/definitely");
    const result =
      payload.method === "listRepos"
        ? [{ nameWithOwner: "checks/repo", visibility: "PUBLIC" }]
        : [
            { name: "project", kind: "dir" },
            { name: "work", kind: "dir" },
          ];
    socket.send(
      JSON.stringify({
        verb: "frames",
        payload: {
          kind: "control_result",
          requestId: payload.requestId,
          ok,
          result,
          error: ok ? undefined : "ENOENT: directory does not exist",
        },
      })
    );
  });
});
await page.route("**/api/**", async (route) => {
  const request = route.request();
  const path = new URL(request.url()).pathname;
  let json = {};
  if (path === "/api/agents") {
    json = machines;
  } else if (path === "/api/projects") {
    json =
      request.method() === "GET"
        ? projects
        : { id: "created-project", ...request.postDataJSON() };
  } else if (path.endsWith("/inspect")) {
    json = { mcp: [], skills: [], plugins: [], memory: null };
  } else if (path === "/api/usage/limits") {
    json = { machines: [] };
  } else if (["/api/instances", "/api/pending"].includes(path)) {
    json = [];
  } else if (request.method() !== "GET") {
    return route.fulfill({
      status: 403,
      json: { error: "Acceptance script blocks writes" },
    });
  }
  await route.fulfill({ json });
});
await page.addInitScript(
  ({ levels: effortLevels }) => {
    const swap = new URL(location.href).searchParams.has("swap");
    const rows = swap
      ? Array.from({ length: 9 }, (_, index) => ({
          value: `claude-opus-5-${index}`,
        }))
      : [
          {
            value: "default",
            resolvedModel: "claude-opus-5[1m]",
            displayName: "Default (recommended)",
          },
          { value: "opus", resolvedModel: "claude-opus-5[1m]" },
          {
            value: "claude-opus-5[1m]",
            supportedEffortLevels: effortLevels,
            supportsEffort: true,
          },
          { value: "sonnet", resolvedModel: "claude-sonnet-5" },
          { value: "claude-fable-5-1" },
        ];
    localStorage.setItem(
      "whiffle-models:by-harness",
      JSON.stringify(
        ["claude", "opencode", "pi"].flatMap((harness) =>
          rows.map((row) => ({
            ...row,
            harness,
            supportedEffortLevels:
              harness === "pi" ? [] : row.supportedEffortLevels,
            supportsEffort: harness !== "pi" && row.supportsEffort,
          }))
        )
      )
    );
    localStorage.setItem("whiffle-models:recent", "[]");
    localStorage.removeItem("whiffle-models:use");
    if (new URL(location.href).searchParams.has("dates")) {
      const dated = JSON.parse(
        localStorage.getItem("whiffle-models:by-harness")
      );
      for (const row of dated) {
        if (row.value === "claude-opus-5[1m]") {
          row.released = "2026-09-05T12:00:00Z";
        }
      }
      localStorage.setItem("whiffle-models:by-harness", JSON.stringify(dated));
      localStorage.setItem(
        "whiffle-models:use",
        JSON.stringify({
          claude: {
            lastSpawnAt: "2026-09-07T12:00:00Z",
            lastUsedAt: { "claude-opus-5[1m]": "2026-09-07T12:00:00Z" },
          },
        })
      );
    }
    localStorage.setItem(
      "whiffle-spawn-prefs",
      JSON.stringify({
        harness: "claude",
        permissionMode: "default",
        model: "",
        effort: null,
        machineId: "check-online",
        cwd: "/home/check/project",
      })
    );
  },
  { levels }
);

const dialog = page.locator(".session-card");
const start = page.locator("#session-start");
const pop = (name) => page.locator(`#session-${name}-popover`);
const trigger = (name) => page.locator(`#session-${name}`);
async function open(query = "") {
  await page.goto(`${base}/motion/new-session${query}`);
  await page.locator("main button", { hasText: "New session" }).click();
  await dialog.waitFor();
  await page.waitForTimeout(1000);
}
async function show(name) {
  await trigger(name).click();
  await pop(name).waitFor();
  await page.waitForTimeout(500);
}
async function dismiss(name) {
  await page.keyboard.press("Escape");
  await pop(name).waitFor({ state: "hidden" });
  assert.equal(await dialog.isVisible(), true);
  assert.equal(
    await trigger(name).evaluate((node) => node === document.activeElement),
    true
  );
}
async function check(label, run) {
  if (process.env.NS_CHECK && !label.includes(process.env.NS_CHECK)) {
    return;
  }
  try {
    await run();
    console.log(`PASS ${label}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${label}: ${error.message}`);
  }
}
const spawns = () => frames.filter((frame) => frame.verb === "spawn");
const rect = () => dialog.boundingBox();

await check("centered composer, prompt focus, fixed 40px bar", async () => {
  await open();
  const box = await rect();
  assert.ok(Math.abs(box.x + box.width / 2 - 720) < 1);
  assert.ok(Math.abs(box.y + box.height / 2 - 450) < 1);
  assert.equal(box.width, 640);
  assert.equal(
    await page
      .locator(".composer-bar")
      .evaluate((el) => el.getBoundingClientRect().height),
    40
  );
  assert.equal(
    await page
      .locator("textarea")
      .evaluate((el) => el === document.activeElement),
    true
  );
  assert.equal(await page.locator("textarea").getAttribute("rows"), "8");
  await page.addScriptTag({
    path: `${homedir()}/.claude/skills/ui-observer/observer.browser.js`,
  });
  const observations = await page.evaluate(
    () =>
      globalThis.__uiObserver({ scopeSel: ".composer-bar", maxDepth: 2 })
        .observations
  );
  console.log("OBSERVER desktop", JSON.stringify(observations));
  await page.screenshot({ path: "/tmp/ns-rest.png" });
});
await check(
  "model naming, dedupe, all harness logos, no layout shift",
  async () => {
    await open();
    const before = await rect();
    const action = await start.boundingBox();
    await show("model");
    for (const harness of ["claude", "opencode", "pi"]) {
      assert.equal(
        await pop("model")
          .locator(`.agent-tile [data-harness-logo="${harness}"] svg`)
          .count(),
        1
      );
    }
    assert.equal(await pop("model").getByRole("option").count(), 3);
    assert.equal(await pop("model").locator(".meta").count(), 0);
    assert.equal(await pop("model").locator(".default-tag").count(), 1);
    assert.equal(
      await pop("model").getByText("Opus 5 · 1M", { exact: true }).count(),
      1
    );
    assert.equal(
      await pop("model").getByText("Fable 5.1", { exact: true }).count(),
      1
    );
    await page.screenshot({ path: "/tmp/ns-model.png" });
    for (const name of ["OpenCode", "pi", "Claude"]) {
      await pop("model").getByRole("radio", { name, exact: true }).click();
      await page.waitForTimeout(1100);
      assert.deepEqual(await rect(), before);
      assert.deepEqual(await start.boundingBox(), action);
    }
    await dismiss("model");
  }
);
await check("known release metadata relative to last use", async () => {
  await open("?dates=1");
  await show("model");
  assert.equal(
    await pop("model").locator("time").textContent(),
    "2d before last use"
  );
  assert.equal(await pop("model").locator(".default-tag").count(), 1);
});
await check("mode radio rows, bypass tint and options switches", async () => {
  await open();
  await show("mode");
  assert.equal(await pop("mode").getByRole("radio").count(), 4);
  await page.screenshot({ path: "/tmp/ns-mode.png" });
  await pop("mode").getByRole("radio", { name: "Bypass all" }).click();
  assert.equal(await trigger("mode").getAttribute("data-attention"), "true");
  await show("options");
  assert.equal(await pop("options").getByRole("switch").count(), 2);
  await pop("options")
    .getByRole("switch", { name: "Scratch", exact: true })
    .click();
  await page.screenshot({ path: "/tmp/ns-options.png" });
  await dismiss("options");
});
await check(
  "stagger both ways at 3 x stagger + 60ms after list entry",
  async () => {
    await open("?swap=1");
    await show("model");
    for (const name of ["pi", "Claude"]) {
      const values = await page.evaluate(
        (nextName) =>
          new Promise((resolve) => {
            const list = document.querySelector(
              '#session-model-popover [role="listbox"]'
            );
            const observer = new MutationObserver(() => {
              if (list.getAttribute("aria-label") !== `${nextName} models`) {
                return;
              }
              observer.disconnect();
              setTimeout(
                () =>
                  resolve(
                    [0, 3, 8].map((index) =>
                      Number(
                        getComputedStyle(
                          list.querySelector(`[data-index="${index}"]`)
                        ).opacity
                      )
                    )
                  ),
                3 * 18 + 60
              );
            });
            observer.observe(list, { attributes: true });
            document
              .querySelector(
                `#session-model-popover [data-value="${nextName.toLowerCase()}"]`
              )
              .click();
          }),
        name
      );
      console.log(`STAGGER ${name}: ${JSON.stringify(values)}`);
      assert.ok(
        values[0] > values[1] && values[1] > values[2],
        JSON.stringify(values)
      );
      await page.waitForTimeout(650);
    }
  }
);
await check("contained popovers desktop and mobile", async () => {
  for (const [width, height] of [
    [1440, 900],
    [1024, 640],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    await open();
    const box = await rect();
    assert.ok(Math.abs(box.y + box.height / 2 - height / 2) < 1);
    assert.ok(box.x >= 0 && box.x + box.width <= width);
    assert.ok(
      await page
        .locator(".composer-pill")
        .evaluateAll((nodes) =>
          nodes.every((node) => node.getBoundingClientRect().width >= 24)
        )
    );
    for (const name of ["model", "location", "mode", "options"]) {
      await show(name);
      const bounds = await pop(name).boundingBox();
      assert.ok(
        bounds.x >= 7 &&
          bounds.y >= 7 &&
          bounds.x + bounds.width <= width - 7 &&
          bounds.y + bounds.height <= height - 7,
        `${name}: ${JSON.stringify(bounds)}`
      );
      await dismiss(name);
    }
    if (width === 390) {
      await page.addScriptTag({
        path: `${homedir()}/.claude/skills/ui-observer/observer.browser.js`,
      });
      console.log(
        "OBSERVER mobile",
        JSON.stringify(
          await page.evaluate(
            () =>
              globalThis.__uiObserver({
                scopeSel: ".composer-bar",
                maxDepth: 2,
              }).observations
          )
        )
      );
      await page.locator("textarea").focus();
      await page.screenshot({ path: "/tmp/ns-mobile.png" });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
});
await check(
  "keyboard canonical, typed, untouched and scratch payloads intercepted",
  async () => {
    for (const model of ["default", "foo/bar-9", null]) {
      await open();
      if (model) {
        await show("model");
        await page.getByPlaceholder("Search, or type a model id").fill(model);
        await page.keyboard.press("Enter");
        await pop("model").waitFor({ state: "hidden" });
      }
      if (!model) {
        await show("options");
        await page
          .getByRole("switch", { name: "Scratch", exact: true })
          .click();
        await dismiss("options");
      }
      await page.locator("textarea").fill("Check payload");
      const count = spawns().length;
      await page.keyboard.press("Control+Enter");
      await page.waitForTimeout(500);
      assert.equal(spawns().length, count + 1);
      const { payload } = spawns().at(-1);
      console.log(`PAYLOAD ${JSON.stringify(payload)}`);
      const sent = frames.findLast(
        (frame) =>
          frame.verb === "send" && frame.instanceId === payload.instanceId
      );
      assert.ok(JSON.stringify(sent.payload.message).includes("Check payload"));
      assert.equal(
        payload.model,
        model === "default" ? "claude-opus-5[1m]" : (model ?? undefined)
      );
      if (!model) {
        assert.equal("effort" in payload, false);
        assert.equal(payload.scratch.baseCwd, "/home/check/project");
      }
    }
  }
);
await check("popover gating, invalid directory and cancellation", async () => {
  await open();
  await show("location");
  assert.equal(await start.isDisabled(), true);
  const count = spawns().length;
  await page
    .getByPlaceholder("Search machines, projects, or type a path")
    .fill("/definitely/missing");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(800);
  assert.equal(await pop("location").getByRole("alert").count(), 1);
  await page.keyboard.press("Control+Enter");
  assert.equal(spawns().length, count);
  await dismiss("location");
  fsDelay = 500;
  await start.click();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(800);
  fsDelay = 0;
  assert.equal(spawns().length, count);
});
await check("keyboard order and effort detent centering", async () => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open();
  await page.locator("textarea").focus();
  for (const id of ["session-model", "session-location", "session-mode"]) {
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.activeElement.id), id);
  }
  await page.keyboard.press("Tab");
  const slider = page.getByRole("slider", { name: "Effort", exact: true });
  assert.equal(
    await slider.evaluate((node) => node === document.activeElement),
    true
  );
  await page.keyboard.press("Home");
  for (const level of levels) {
    await page.waitForTimeout(400);
    assert.equal(await slider.getAttribute("aria-valuetext"), level);
    const thumb = await page.locator(".effort-thumb").boundingBox();
    const detent = await page.locator(`[data-effort="${level}"]`).boundingBox();
    assert.ok(
      Math.abs(thumb.x + thumb.width / 2 - detent.x - detent.width / 2) <= 1
    );
    assert.equal(thumb.width, 18);
    await page.keyboard.press("ArrowRight");
  }
});
await check("bootstrap payload and installed harness fallback", async () => {
  await open();
  await show("options");
  await page.getByRole("switch", { name: "Bootstrap", exact: true }).click();
  await pop("location").waitFor();
  await pop("location")
    .locator(".directories .row")
    .filter({ hasText: "checks/repo" })
    .click();
  await page.waitForTimeout(800);
  const count = spawns().length;
  await start.click();
  await page.waitForTimeout(500);
  assert.equal(spawns().length, count + 1);
  assert.deepEqual(spawns().at(-1).payload.bootstrap, {
    repo: "checks/repo",
    baseDir: "/home/check/project",
  });
  assert.equal(spawns().at(-1).payload.cwd, "/home/check/project/repo");
  await open();
  await show("location");
  await page
    .getByPlaceholder("Search machines, projects, or type a path")
    .fill("pi-host");
  await pop("location")
    .locator(".directories .row")
    .filter({ hasText: "pi-host project" })
    .click();
  await show("model");
  assert.equal(
    await pop("model")
      .getByRole("radio", { name: "pi", exact: true })
      .getAttribute("aria-checked"),
    "true"
  );
  assert.equal(
    await pop("model")
      .getByRole("radio", { name: "Claude", exact: true })
      .isDisabled(),
    true
  );
  assert.equal(
    await pop("model")
      .getByRole("radio", { name: "OpenCode", exact: true })
      .isDisabled(),
    true
  );
});
await check("polish light and dark desktop and mobile", async () => {
  for (const scheme of ["light", "dark"]) {
    await page.emulateMedia({
      colorScheme: scheme,
      reducedMotion: "no-preference",
    });
    for (const [width, height] of [
      [1440, 900],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height });
      await open();
      await page.evaluate(
        (dark) => document.documentElement.classList.toggle("dark", dark),
        scheme === "dark"
      );
      const facts = await page.evaluate(() => {
        const card = document.querySelector(".session-card");
        const bar = document.querySelector(".composer-bar");
        const bounds = bar.getBoundingClientRect();
        const track = document.querySelector(".effort .track");
        return {
          well: getComputedStyle(document.querySelector("textarea"))
            .backgroundColor,
          card: getComputedStyle(card).backgroundColor,
          shadow: getComputedStyle(card).boxShadow,
          track: {
            width: track.getBoundingClientRect().width,
            height: track.getBoundingClientRect().height,
            color: getComputedStyle(track).backgroundColor,
          },
          effortWidth: document.querySelector(".effort").getBoundingClientRect()
            .width,
          icons: [...document.querySelectorAll(".detent svg")].map((svg) => ({
            width: svg.getBoundingClientRect().width,
            height: svg.getBoundingClientRect().height,
            ink: getComputedStyle(svg).color,
          })),
          defaultThumb: Boolean(
            document.querySelector(".effort-thumb.default-value")
          ),
          escapes: [...bar.children]
            .filter((node) => {
              const r = node.getBoundingClientRect();
              return r.left < bounds.left - 1 || r.right > bounds.right + 1;
            })
            .map((node) => node.id || node.className),
        };
      });
      console.log(`POLISH ${scheme} ${width}: ${JSON.stringify(facts)}`);
      assert.notEqual(facts.well, facts.card);
      assert.notEqual(facts.shadow, "none");
      assert.equal(facts.track.height, 4);
      assert.equal(facts.effortWidth, 150);
      assert.equal(facts.defaultThumb, true);
      assert.deepEqual(facts.escapes, []);
      assert.ok(
        facts.icons.every((icon) => icon.width === 16 && icon.height === 16)
      );
      await page.screenshot({
        path: `/tmp/ns-polish-${scheme}-${width}-rest.png`,
      });
      const primary = {
        "light-1440": "/tmp/ns-rest.png",
        "dark-1440": "/tmp/ns-dark.png",
        "light-390": "/tmp/ns-mobile.png",
      }[`${scheme}-${width}`];
      if (primary) {
        await page.screenshot({ path: primary });
      }
      for (const name of ["model", "location", "mode", "options"]) {
        await show(name);
        assert.equal(await start.isDisabled(), true);
        assert.ok(
          await start.evaluate(
            (node) => Number(getComputedStyle(node).opacity) < 1
          )
        );
        const switches = await pop(name)
          .getByRole("switch")
          .evaluateAll((nodes) =>
            nodes.map((node) => ({
              track: getComputedStyle(node).backgroundColor,
              thumb: getComputedStyle(
                node.querySelector('[data-slot="switch-thumb"]')
              ).backgroundColor,
              surface: getComputedStyle(node.closest(".composer-popover"))
                .backgroundColor,
            }))
          );
        assert.ok(
          switches.every(
            (control) =>
              control.track !== control.surface &&
              control.thumb !== control.track
          ),
          JSON.stringify(switches)
        );
        const bounds = await pop(name).boundingBox();
        assert.ok(
          bounds.x >= 7 &&
            bounds.y >= 7 &&
            bounds.x + bounds.width <= width - 7 &&
            bounds.y + bounds.height <= height - 7
        );
        console.log(
          `POLISH POPOVER ${scheme} ${width} ${name}: ${JSON.stringify(bounds)}`
        );
        await page.screenshot({
          path: `/tmp/ns-polish-${scheme}-${width}-${name}.png`,
        });
        if (scheme === "light" && width === 1440 && name !== "location") {
          await page.screenshot({ path: `/tmp/ns-${name}.png` });
        }
        await dismiss(name);
      }
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: "light" });
});
await check("reduced motion endpoints", async () => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open();
  assert.equal(
    await dialog.evaluate((el) => getComputedStyle(el).opacity),
    "1"
  );
  await show("model");
  await pop("model").getByRole("radio", { name: "pi", exact: true }).click();
  await page.waitForTimeout(50);
  assert.equal(
    await page.getByRole("listbox", { name: "pi models" }).count(),
    1
  );
  const durations = await page.evaluate(() =>
    document
      .getAnimations()
      .map((animation) => Number(animation.effect.getTiming().duration))
  );
  assert.ok(
    durations.every((duration) => duration <= 1),
    JSON.stringify(durations)
  );
});
if (errors.length) {
  failures += 1;
  console.error(`PAGE ERRORS ${JSON.stringify(errors)}`);
}
await browser.close();
console.log(
  `RESULT ${failures ? "FAIL" : "PASS"}: ${failures} failed checks; ${errors.length} page errors; ${spawns().length} intercepted spawns; zero real sessions`
);
process.exitCode = failures ? 1 : 0;
