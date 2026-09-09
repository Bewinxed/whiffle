// biome-ignore-all lint/performance/noAwaitInLoops: Each measurement depends on the preceding browser interaction in the same page.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const base = process.argv[2] || "http://localhost:5173";
const browser = await chromium.launch({
  executablePath: `${homedir()}/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(5000);
const workspaceRoot = fileURLToPath(new URL("../../../", import.meta.url));
const frames = [];
const reads = [];
let fsDelay = 0;
let projectDelay = 0;
let invalidFs = "";
let fixture = "normal";
let reduced = false;
const instantSamples = [];
const levels = ["low", "medium", "high", "xhigh", "max"];
const namingRows = [
  {
    value: "default",
    resolvedModel: "claude-opus-5[1m]",
    displayName: "Default (recommended)",
  },
  { value: "opus", resolvedModel: "claude-opus-5[1m]" },
  {
    value: "claude-opus-5[1m]",
    supportsEffort: true,
    supportedEffortLevels: levels,
  },
  { value: "sonnet", resolvedModel: "claude-sonnet-5" },
  { value: "claude-fable-5-1" },
];
const machines = [
  {
    machineId: "check-online",
    hostname: "check-host",
    status: "online",
    os: "linux",
    auth: "authenticated",
    lastSeenAt: null,
  },
  {
    machineId: "check-offline",
    hostname: "offline-host",
    status: "offline",
    os: "linux",
    auth: "authenticated",
    lastSeenAt: null,
  },
  {
    machineId: "check-pi",
    hostname: "pi-host",
    status: "online",
    os: "linux",
    auth: "authenticated",
    lastSeenAt: null,
  },
].map((machine) => ({
  ...machine,
  harnesses: ["claude", "opencode", "pi"].map((harness) => ({
    harness,
    installed: machine.machineId !== "check-pi" || harness === "pi",
    capabilities: {
      permissionModes: ["default", "plan", "acceptEdits", "bypassPermissions"],
      effort: true,
    },
  })),
}));
const projects = machines.map((machine) => ({
  id: `project-${machine.machineId}`,
  machineId: machine.machineId,
  cwd: "/home/check/project",
  name: `${machine.hostname} project`,
}));
await page.addInitScript(
  ({ catalog }) => {
    const kind = new URL(location.href).searchParams.get("fixture");
    const rows =
      kind === "swap"
        ? Array.from({ length: 9 }, (_, index) => ({
            value: `claude-opus-5-${index}`,
          }))
        : catalog;
    localStorage.setItem(
      "whiffle-models:by-harness",
      JSON.stringify(
        ["claude", "opencode", "pi"].flatMap((harness) =>
          rows.map((row) => ({ ...row, harness }))
        )
      )
    );
    localStorage.setItem("whiffle-models:recent", "[]");
    localStorage.removeItem("whiffle-models:use");
    localStorage.setItem(
      "whiffle-spawn-prefs",
      JSON.stringify({
        harness: "claude",
        permissionMode: "default",
        model: "",
        effort: null,
      })
    );
  },
  { catalog: namingRows }
);
// The dashboard socket never connects to a server: every outgoing frame stays in this process.
await page.routeWebSocket("**/ws/dashboard", (socket) => {
  socket.onMessage(async (message) => {
    const frame = JSON.parse(String(message));
    frames.push(frame);
    if (frame.verb !== "fs" && frame.verb !== "control") {
      return;
    }
    const { payload } = frame;
    let result = [];
    let ok = true;
    if (frame.verb === "fs") {
      reads.push({
        kind: "fs",
        machineId: frame.machineId,
        path: payload.path,
      });
      const delay = fsDelay;
      if (delay) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      ok =
        !payload.path.startsWith("/definitely") && payload.path !== invalidFs;
      result = [
        { name: "work", kind: "dir" },
        { name: "project", kind: "dir" },
      ];
    } else if (payload.method === "listRepos") {
      result = [
        {
          nameWithOwner: "checks/repo",
          visibility: "PUBLIC",
          description: "Verification repository",
        },
      ];
    }
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
  let json;
  if (path === "/api/agents") {
    json = machines;
  } else if (path === "/api/projects" && request.method() === "POST") {
    const body = request.postDataJSON();
    reads.push({ kind: "createProject", ...body });
    if (projectDelay) {
      await new Promise((resolve) => setTimeout(resolve, projectDelay));
    }
    json = { id: "created-check-project", ...body };
  } else if (path === "/api/projects") {
    json = projects;
  } else if (path.endsWith("/inspect")) {
    reads.push({ kind: "inspect", path: request.postDataJSON().cwd });
    // inspectConfig deliberately succeeds even for nonexistent paths, as the real machine does.
    json = { mcp: [], skills: [], plugins: [], memory: null };
  } else if (path === "/api/usage/limits") {
    json = { machines: [] };
  } else if (["/api/instances", "/api/pending"].includes(path)) {
    json = [];
  } else if (["/api/handoffs", "/api/queues"].includes(path)) {
    json = {};
  } else if (request.method() === "GET") {
    await route.continue();
    return;
  } else {
    await route.fulfill({
      status: 403,
      json: { error: "Acceptance script blocks writes" },
    });
    return;
  }
  await route.fulfill({ json });
});
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const dialog = page.locator(".session-card");
const model = page.locator("#session-model");
const location = page.locator("#session-location");
let failures = 0;
async function check(number, label, run) {
  try {
    console.log(`PASS ${number} ${label}: ${JSON.stringify(await run())}`);
  } catch (error) {
    failures += 1;
    console.log(`FAIL ${number} ${label}: ${error.message}`);
  }
}
async function open(query = "") {
  const target = new URL(`${base}/motion/new-session${query}`);
  target.searchParams.set("fixture", fixture);
  await page.goto(target.href);
  if (page.viewportSize().width >= 481) {
    await page.locator(".dialkit-panel-inner").first().waitFor();
  }
  const hideTimeline = page.getByRole("button", {
    name: "Hide timeline",
    exact: true,
  });
  if (await hideTimeline.count()) {
    await hideTimeline.click();
  }
  const expanded = page.locator(
    '.dialkit-panel-inner[data-collapsed="false"] .dialkit-panel-header [role="button"]'
  );
  while (await expanded.count()) {
    await expanded.first().click();
  }
  await page.waitForTimeout(400);
  await page.waitForFunction(
    () =>
      document.querySelector("#session-agent") ||
      document.body.textContent.includes("check-host")
  );
  await page.locator("main button", { hasText: "New session" }).click();
  await dialog.waitFor();
  if (reduced) {
    const instant = await page.evaluate(() => {
      const card = document.querySelector(".session-card");
      const css = getComputedStyle(card);
      const track = document.querySelector("#session-agent");
      const thumb = track.querySelector(".thumb").getBoundingClientRect();
      const selected = track
        .querySelector('[aria-checked="true"]')
        .getBoundingClientRect();
      return {
        opacity: Number(css.opacity),
        transform: css.transform,
        inert: card.inert,
        activeAnimations: document
          .getAnimations()
          .filter(
            (animation) =>
              animation.playState === "running" || animation.pending
          ).length,
        thumbDelta: Math.abs(thumb.x - selected.x),
        rowOpacities: [...card.querySelectorAll(".ledger > div")].map((row) =>
          Number(getComputedStyle(row).opacity)
        ),
      };
    });
    instantSamples.push(instant);
    assert.equal(instant.opacity, 1, JSON.stringify(instant));
    assert.equal(instant.transform, "none", JSON.stringify(instant));
    assert.equal(instant.inert, false, JSON.stringify(instant));
    assert.equal(instant.activeAnimations, 0, JSON.stringify(instant));
    assert.ok(
      instant.thumbDelta <= 1 &&
        instant.rowOpacities.every((opacity) => opacity === 1),
      JSON.stringify(instant)
    );
  }
  await page.waitForTimeout(800);
}
async function dismiss() {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(180);
}
function rect() {
  return dialog.evaluate((element) =>
    JSON.stringify(element.getBoundingClientRect().toJSON())
  );
}
async function toggle(locator) {
  assert.ok(
    await locator.isEnabled(),
    `Fixture control disabled: ${await locator.textContent()}`
  );
  const before = await locator.getAttribute("aria-checked");
  await locator.click();
  await page.waitForTimeout(650);
  assert.notEqual(
    await locator.getAttribute("aria-checked"),
    before,
    "Control did not change value"
  );
}

async function stillness() {
  let actions = 0;
  for (const [width, height] of [
    [1440, 900],
    [1024, 768],
  ]) {
    await page.setViewportSize({ width, height });
    await open();
    const before = await rect();
    const measure = async (action) => {
      const after = await rect();
      actions += 1;
      assert.equal(
        after,
        before,
        `${width} ${action}: before=${before}, after=${after}`
      );
    };
    for (const trigger of [model, location]) {
      await trigger.click();
      await page.waitForTimeout(650);
      await measure(await trigger.getAttribute("id"));
      if (trigger === location) {
        await page
          .getByRole("radio", { name: "Repository", exact: true })
          .click();
        assert.equal(
          await page
            .getByRole("radio", { name: "Repository", exact: true })
            .getAttribute("aria-checked"),
          "true"
        );
        await measure("Repository");
        await page
          .getByRole("radio", { name: "Directory", exact: true })
          .click();
      }
      await dismiss();
      await measure("popover closed");
    }
    for (const name of ["OpenCode", "pi", "Claude"]) {
      await toggle(page.getByRole("radio", { name, exact: true }));
      await measure(name);
    }
    await model.click();
    await page
      .getByPlaceholder("Search, or type a model id")
      .fill("foo/no-effort-scale-9");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(650);
    await measure("model without effort");
    await toggle(page.getByRole("radio", { name: "Bypass all", exact: true }));
    await measure("Bypass all");
    for (const name of [
      "Side quest",
      "Worktree",
      "Save as project",
      "Clone repo",
    ]) {
      await toggle(dialog.getByRole("switch", { name, exact: true }));
      if (name === "Clone repo") {
        await dismiss();
      }
      await measure(name);
    }
    const projectId = await page.evaluate(async () => {
      const { whiffle } = await import("/src/lib/whiffle/client.svelte.ts");
      return whiffle.projects[0]?.id;
    });
    assert.ok(
      projectId,
      "Live fleet has no project for prefill lock/edit check"
    );
    await open(`?projectId=${encodeURIComponent(projectId)}`);
    const locked = await rect();
    await dialog.getByRole("button", { name: "Edit", exact: true }).click();
    assert.equal(await rect(), locked, "Prefill edit changes the card rect");
    await location.click();
    await page
      .getByPlaceholder("Search machines, projects, or type a path")
      .fill("offline-host project");
    await page
      .locator('.position [role="option"]')
      .filter({ hasText: "offline-host project" })
      .click();
    await page.waitForTimeout(650);
    assert.ok(
      (await dialog.locator("footer").innerText()).includes(
        "offline-host is offline"
      )
    );
    assert.equal(
      await rect(),
      locked,
      "Offline reading changes card dimensions"
    );
    actions += 1;
  }
  return { actions, maxRectDelta: 0 };
}

async function containment() {
  const measurements = [];
  for (const [width, height] of [
    [1440, 900],
    [1024, 640],
    [768, 1024],
    [390, 844],
    [320, 568],
  ]) {
    await page.setViewportSize({ width, height });
    await open();
    for (const scroll of ["top", "bottom"]) {
      await dialog.evaluate((element, edge) => {
        element.scrollTop = edge === "top" ? 0 : element.scrollHeight;
      }, scroll);
      for (const trigger of [model, location]) {
        await trigger.click();
        await page.waitForTimeout(650);
        const box = await page.locator(".position > .panel").boundingBox();
        assert.ok(box, "Popover has no rendered bounds");
        const margins = [
          box.x,
          box.y,
          width - box.x - box.width,
          height - box.y - box.height,
        ];
        measurements.push({ width, height, scroll, margins });
        if (width <= 480) {
          assert.deepEqual(
            box,
            { x: 0, y: 0, width, height },
            JSON.stringify(measurements.at(-1))
          );
        } else {
          assert.ok(
            margins.every((value) => value >= 7.99),
            JSON.stringify(measurements.at(-1))
          );
        }
        await dismiss();
      }
    }
  }
  return {
    popovers: measurements.length,
    desktopMinMargin: Math.min(
      ...measurements
        .filter((row) => row.width > 480)
        .flatMap((row) => row.margins)
    ),
    mobileFullViewport: measurements.filter((row) => row.width <= 480).length,
  };
}

async function centering() {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open();
  const measured = await dialog.evaluate((root) =>
    [
      ...root.querySelectorAll(
        '[role="radio"], [role="switch"], #session-model, #session-location, .actions button'
      ),
    ].map((control) => {
      const parent = control.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(control);
      const visible = [...range.getClientRects()].filter(
        (box) =>
          box.width &&
          box.height &&
          box.left >= parent.left &&
          box.right <= parent.right &&
          box.top >= parent.top &&
          box.bottom <= parent.bottom
      );
      const left = Math.min(...visible.map((box) => box.left));
      const right = Math.max(...visible.map((box) => box.right));
      const top = Math.min(...visible.map((box) => box.top));
      const bottom = Math.max(...visible.map((box) => box.bottom));
      return {
        name: control.textContent.trim(),
        dx: Math.abs((left + right - parent.left - parent.right) / 2),
        dy: Math.abs((top + bottom - parent.top - parent.bottom) / 2),
      };
    })
  );
  const misses = measured.filter((row) => row.dx > 1 || row.dy > 1);
  assert.deepEqual(misses, [], JSON.stringify(misses));
  const slider = dialog.locator('[role="slider"]');
  const positions = [];
  assert.equal(await slider.getAttribute("aria-disabled"), "false");
  await slider.focus();
  await page.keyboard.press("Home");
  for (let index = 0; index < 5; index += 1) {
    await page.waitForTimeout(650);
    positions.push(
      await slider.evaluate((element) => {
        const thumb = element.querySelector(".thumb")?.getBoundingClientRect();
        const tick = element
          .querySelectorAll(".tick")
          [
            Number(element.getAttribute("aria-valuenow"))
          ]?.getBoundingClientRect();
        return thumb && tick
          ? {
              index: Number(element.getAttribute("aria-valuenow")),
              x: thumb.x + thumb.width / 2,
              delta: Math.abs(
                thumb.x + thumb.width / 2 - tick.x - tick.width / 2
              ),
            }
          : null;
      })
    );
    await page.keyboard.press("ArrowRight");
  }
  assert.ok(
    positions.every((position) => position !== null && position.delta <= 1),
    `thumb/tick deltas=${JSON.stringify(positions)}`
  );
  assert.equal(new Set(positions.map((position) => position.index)).size, 5);
  assert.equal(new Set(positions.map((position) => position.x)).size, 5);
  return {
    controls: measured.length,
    maxX: Math.max(...measured.map((row) => row.dx)),
    maxY: Math.max(...measured.map((row) => row.dy)),
    thumbDeltas: positions,
  };
}

await check(1, "Stillness", stillness);
await check(2, "Containment", containment);
await check(3, "Centering", centering);

await check(4, "Radii", async () => {
  await open();
  await model.click();
  await page.waitForTimeout(650);
  const radii = await page.evaluate(() => {
    const radius = (selector) =>
      Number.parseFloat(
        getComputedStyle(document.querySelector(selector)).borderTopLeftRadius
      );
    return {
      card: radius(".session-card"),
      well: radius(".session-card textarea"),
      ledger: radius(".session-card .ledger"),
      model: radius("#session-model"),
      location: radius("#session-location"),
      agent: radius("#session-agent"),
      permissions: radius("#session-permissions"),
      thumb: radius("#session-agent .thumb"),
      popover: radius(".position > .panel"),
    };
  });
  assert.deepEqual(radii, {
    card: 14,
    well: 7,
    ledger: 7,
    model: 7,
    location: 7,
    agent: 7,
    permissions: 7,
    thumb: 5,
    popover: 12,
  });
  await dismiss();
  return radii;
});

await check(5, "Stagger Both Ways", async () => {
  fixture = "swap";
  try {
    await open();
    await model.click();
    await page.waitForTimeout(650);
    const measurements = [];
    for (const [name, sign] of [
      ["pi", 1],
      ["Claude", -1],
    ]) {
      const result = await page.evaluate(
        async ({ name: targetName, sign: travelSign }) => {
          const button = [
            ...document.querySelectorAll('#session-agent [role="radio"]'),
          ].find((node) => node.textContent.trim() === targetName);
          button.click();
          // At 3 × stagger + 60ms (114ms), row0 > row3 > row8; row8 may be 0.
          // All rows must settle by 600ms from the harness change; travel signs must match in both directions.
          await new Promise((resolve) => setTimeout(resolve, 214));
          const rows = [
            ...document.querySelectorAll('.position [role="option"]'),
          ];
          const sample = [0, 3, 8].map((index) => {
            const node = rows[index];
            if (!node) {
              return null;
            }
            const css = getComputedStyle(node);
            return {
              opacity: Number(css.opacity),
              x: new DOMMatrix(css.transform).m41,
            };
          });
          await new Promise((resolve) => setTimeout(resolve, 386));
          const final = [
            ...document.querySelectorAll('.position [role="option"]'),
          ].map((node) => Number(getComputedStyle(node).opacity));
          return {
            name: targetName,
            sign: travelSign,
            count: rows.length,
            at114: sample,
            minAt600: Math.min(...final),
          };
        },
        { name, sign }
      );
      measurements.push(result);
    }
    for (const result of measurements) {
      assert.ok(
        result.count >= 9,
        `Need nine fixture rows per harness; measurements=${JSON.stringify(measurements)}`
      );
      const [a, b, c] = result.at114;
      assert.ok(
        a.opacity > b.opacity && b.opacity > c.opacity,
        JSON.stringify(result)
      );
      assert.ok(
        result.at114.every((row) => Math.sign(row.x) === result.sign),
        JSON.stringify(result)
      );
      assert.equal(result.minAt600, 1, JSON.stringify(result));
    }
    return measurements;
  } finally {
    fixture = "normal";
  }
});

await check(6, "Naming", async () => {
  await open();
  await model.click();
  await page.waitForTimeout(650);
  const rows = await page
    .locator('.position [role="option"]')
    .allTextContents();
  const names = await page
    .locator('.position [role="option"] .name')
    .allTextContents();
  assert.ok(
    rows.every((text) => !text.includes("Default (recommended)")),
    JSON.stringify(rows)
  );
  assert.ok(
    names.includes("Opus 5 · 1M"),
    `fixture names=${JSON.stringify(names)}`
  );
  assert.equal(names.filter((name) => name === "Opus 5 · 1M").length, 1);
  assert.deepEqual(
    [...names].sort(),
    ["Opus 5 · 1M", "Sonnet 5", "Fable 5.1"].sort()
  );
  assert.ok(rows[names.indexOf("Opus 5 · 1M")].includes("default"));
  return {
    names,
    rows: rows.length,
    canonicalOpusRows: 1,
    defaultTag: true,
    legacyDefaultRows: 0,
  };
});

async function until(condition) {
  const deadline = Date.now() + 5000;
  while (!(await condition())) {
    assert.ok(Date.now() < deadline, "Timed out waiting for fixture response");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
const spawns = () => frames.filter((frame) => frame.verb === "spawn");
async function choosePath(path = "/home/check/work") {
  await location.click();
  await page
    .getByPlaceholder("Search machines, projects, or type a path")
    .fill(path);
  await page.keyboard.press("Enter");
  await until(
    async () => (await location.getAttribute("aria-expanded")) === "false"
  );
  await until(
    async () =>
      await dialog
        .getByRole("button", { name: "Start session", exact: true })
        .isEnabled()
  );
}
async function selectModel(query) {
  await model.click();
  await page.getByPlaceholder("Search, or type a model id").fill(query);
  await page.keyboard.press("Enter");
  await until(
    async () => (await model.getAttribute("aria-expanded")) === "false"
  );
}
await check(7, "Submitted Frames", async () => {
  const measured = [];
  for (const [query, expected] of [
    ["default", "claude-opus-5[1m]"],
    ["foo/bar-9", "foo/bar-9"],
    [null, null],
  ]) {
    await open();
    await choosePath();
    if (query) {
      await selectModel(query);
    }
    const before = spawns().length;
    await dialog.locator("textarea").focus();
    await page.keyboard.press("Control+Enter");
    await until(() => spawns().length === before + 1);
    const frame = spawns().at(-1);
    if (expected) {
      assert.equal(frame.payload.model, expected);
    } else {
      assert.equal(Object.hasOwn(frame.payload, "model"), false);
    }
    assert.equal(Object.hasOwn(frame.payload, "effort"), false);
    measured.push({
      query,
      model: frame.payload.model ?? "omitted",
      effort: "omitted",
      shortcut: "Control+Enter",
      intercepted: true,
    });
    await page.keyboard.press("Escape");
  }
  return measured;
});

async function keyboard() {
  await open();
  const sequence = [];
  for (let index = 0; index < 15; index += 1) {
    sequence.push(
      await page.evaluate(() => {
        const node = document.activeElement;
        if (node.tagName === "TEXTAREA") {
          return "Prompt";
        }
        return (
          node.closest("[data-ledger-row]")?.getAttribute("data-ledger-row") ??
          node.getAttribute("aria-label") ??
          node.textContent.trim()
        );
      })
    );
    await page.keyboard.press("Tab");
    if (await page.locator("textarea:focus").count()) {
      break;
    }
  }
  assert.equal(sequence[0], "Prompt", JSON.stringify(sequence));
  const order = [
    "Prompt",
    "Agent",
    "Model",
    "Location",
    "Permissions",
    "Effort",
    "Options",
  ];
  assert.ok(
    order.every(
      (name, index) =>
        sequence.indexOf(name) >= 0 &&
        (index === 0 ||
          sequence.indexOf(name) > sequence.indexOf(order[index - 1]))
    ),
    JSON.stringify(sequence)
  );
  assert.equal(sequence.at(-1), "Close new session", JSON.stringify(sequence));
  await model.click();
  await page.waitForTimeout(650);
  await dismiss();
  assert.equal(await dialog.count(), 1, "Esc closed the parent dialog");
  assert.equal(await model.getAttribute("aria-expanded"), "false");
  await dismiss();
  assert.equal(await dialog.count(), 0);
  assert.equal(
    await page.locator("main button:focus", { hasText: "New session" }).count(),
    1,
    "Focus did not return to opener"
  );
  return {
    sequence,
    popoverEscape: true,
    dialogEscape: true,
    restoredFocus: true,
  };
}
await check(8, "Keyboard", keyboard);

await check(9, "Invalid Location", async () => {
  await open();
  await choosePath();
  const before = spawns().length;
  await location.click();
  await page
    .getByPlaceholder("Search machines, projects, or type a path")
    .fill("/definitely/missing");
  await page.keyboard.press("Enter");
  await page.locator('.position [role="alert"]').waitFor();
  const message = await page.locator('.position [role="alert"]').innerText();
  assert.ok(message.includes("That directory can't be read on check-host."));
  await page.keyboard.press("Control+Enter");
  await page.waitForTimeout(150);
  assert.equal(spawns().length, before);
  assert.equal(
    await location.evaluate((element) => document.activeElement === element),
    true
  );
  return {
    path: "/definitely/missing",
    spawnFrames: 0,
    reading: message,
    focusedLocation: true,
  };
});

await check("9a", "Repository Base Verification", async () => {
  await open();
  await choosePath();
  invalidFs = "/home/check/work";
  const before = spawns().length;
  const readStart = reads.length;
  try {
    await dialog
      .getByRole("switch", { name: "Clone repo", exact: true })
      .click();
    await page
      .locator('.position [role="option"]')
      .filter({ hasText: "checks/repo" })
      .click();
    await until(async () =>
      (await dialog.locator("footer").innerText()).includes(
        "That directory can't be read"
      )
    );
    assert.equal(
      await dialog
        .getByRole("button", { name: "Start session", exact: true })
        .isEnabled(),
      false
    );
    await page.keyboard.press("Control+Enter");
    assert.equal(spawns().length, before);
    const baseReads = reads
      .slice(readStart)
      .filter((entry) => entry.path === invalidFs);
    assert.ok(
      baseReads.some((entry) => entry.kind === "inspect") &&
        baseReads.some((entry) => entry.kind === "fs")
    );
    return {
      baseDirectory: invalidFs,
      reads: baseReads,
      spawnFrames: 0,
      startDisabled: true,
    };
  } finally {
    invalidFs = "";
  }
});

await check("9b", "Submission Snapshot And Cancellation", async () => {
  await open();
  await choosePath();
  fsDelay = 350;
  const before = spawns().length;
  try {
    await page.keyboard.press("Control+Enter");
    assert.equal(await dialog.evaluate((element) => element.inert), true);
    await page.evaluate(() =>
      [...document.querySelectorAll('#session-agent [role="radio"]')]
        .find((element) => element.textContent.trim() === "pi")
        .click()
    );
    await until(() => spawns().length === before + 1);
    assert.equal(spawns().at(-1).payload.harness, "claude");
    await page.keyboard.press("Escape");
    await open();
    await choosePath();
    const cancelBefore = spawns().length;
    await page.keyboard.press("Control+Enter");
    await page.keyboard.press("Escape");
    await page.locator("main button", { hasText: "New session" }).click();
    await page.waitForTimeout(500);
    assert.equal(spawns().length, cancelBefore);
  } finally {
    fsDelay = 0;
  }
  await open();
  await choosePath();
  await dialog
    .getByRole("switch", { name: "Save as project", exact: true })
    .click();
  projectDelay = 350;
  const projectBefore = reads.filter(
    (entry) => entry.kind === "createProject"
  ).length;
  const cancelBefore = spawns().length;
  try {
    await page.keyboard.press("Control+Enter");
    await until(
      () =>
        reads.filter((entry) => entry.kind === "createProject").length >
        projectBefore
    );
    await page.keyboard.press("Escape");
    await page.locator("main button", { hasText: "New session" }).click();
    await page.waitForTimeout(500);
    assert.equal(spawns().length, cancelBefore);
    assert.equal(await dialog.count(), 1);
  } finally {
    projectDelay = 0;
  }
  return {
    busyInert: true,
    capturedHarness: "claude",
    lateVerificationSpawns: 0,
    lateProjectSpawns: 0,
    reopenedDialogPreserved: true,
  };
});

await check("9c", "Harness Availability", async () => {
  await open("?projectId=project-check-pi");
  assert.equal(
    await page
      .getByRole("radio", { name: "pi", exact: true })
      .getAttribute("aria-checked"),
    "true"
  );
  assert.equal(
    await page.getByRole("radio", { name: "Claude", exact: true }).isEnabled(),
    false
  );
  assert.equal(
    await page
      .getByRole("radio", { name: "OpenCode", exact: true })
      .isEnabled(),
    false
  );
  const reason = await page
    .getByRole("radio", { name: "Claude", exact: true })
    .getAttribute("aria-describedby");
  assert.equal(
    await page.locator(`[id="${reason}"]`).innerText(),
    "Not installed on pi-host"
  );
  return {
    selected: "pi",
    disabled: ["Claude", "OpenCode"],
    reason: "Not installed on pi-host",
  };
});

await check(10, "Reduced Motion", async () => {
  reduced = true;
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open();
  await model.click();
  await page.waitForTimeout(100);
  const result = await page.evaluate(() => {
    const nodes = [
      ...document.querySelectorAll(
        ".session-card, .session-card *, .position, .position *"
      ),
    ];
    const milliseconds = (value) =>
      value.split(",").map((part) => Number.parseFloat(part) * 1000);
    const durations = nodes.flatMap((node) => {
      const css = getComputedStyle(node);
      return [
        ...milliseconds(css.transitionDuration),
        ...milliseconds(css.animationDuration),
      ];
    });
    const card = document.querySelector(".session-card");
    return {
      maxDurationMs: Math.max(...durations),
      opacity: Number(getComputedStyle(card).opacity),
      transform: getComputedStyle(card).transform,
      inert: card.inert,
    };
  });
  assert.ok(result.maxDurationMs <= 1.001, JSON.stringify(result));
  assert.equal(result.opacity, 1);
  assert.equal(result.transform, "none");
  assert.equal(result.inert, false);
  return result;
});

await check("10.1", "Reduced Stillness", stillness);
await check("10.2", "Reduced Containment", containment);
await check("10.3", "Reduced Centering", centering);
await check("10.8", "Reduced Keyboard", keyboard);
console.log(
  `Reduced immediate samples: ${instantSamples.length}; active WAAPI animations=0; all sampled springs at end state`
);

await check("10.tokens", "Token Gates", () => {
  const outcomes = [
    ["python3", ["mocks/literalcheck.py"]],
    ["node", ["mocks/typecheck.mjs"]],
  ].map(([command, args]) => {
    const result = spawnSync(command, args, {
      cwd: workspaceRoot,
      encoding: "utf8",
      timeout: 120_000,
    });
    const entry = {
      command: `${command} ${args.join(" ")}`,
      exitCode: result.status,
      error: result.error?.message,
    };
    console.log(`Token gate: ${JSON.stringify(entry)}`);
    if (result.status !== 0) {
      console.log(result.stdout, result.stderr);
    }
    return entry;
  });
  assert.ok(
    outcomes.every((entry) => entry.exitCode === 0),
    JSON.stringify(outcomes)
  );
  return outcomes;
});

console.log(`Runtime errors: ${JSON.stringify(errors)}`);
if (errors.length) {
  failures += 1;
}
await browser.close();
process.exitCode = failures ? 1 : 0;
