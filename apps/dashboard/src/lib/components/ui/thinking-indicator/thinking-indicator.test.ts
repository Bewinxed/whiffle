import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { chromium } from "playwright-core";
import { compile } from "svelte/compiler";

const entryRequest = /^indicator-test-entry$/;
const entryFile = /\/entry\.ts$/;
const fixtureFile = /fixture\.svelte$/;
const utilsRequest = /^\$lib\/utils\.js$/;
const svelteFile = /\.svelte$/;

test("indicator sizing, accessibility, native motion and reduced motion", async () => {
  const result = await Bun.build({
    entrypoints: ["indicator-test-entry"],
    target: "browser",
    conditions: ["browser"],
    plugins: [
      {
        name: "svelte-test",
        setup(build) {
          build.onResolve({ filter: entryRequest }, () => ({
            path: `${import.meta.dir}/entry.ts`,
          }));
          build.onLoad({ filter: entryFile }, () => ({
            contents: `import { mount } from 'svelte'; import Fixture from './fixture.svelte'; mount(Fixture, { target: document.body });`,
            loader: "js",
            resolveDir: import.meta.dir,
          }));
          build.onResolve({ filter: fixtureFile }, () => ({
            path: `${import.meta.dir}/fixture.svelte`,
          }));
          build.onLoad({ filter: fixtureFile }, () => ({
            contents: compile(
              `<script>
            import Indicator from './thinking-indicator.svelte';
            import Provider from './size-provider.svelte';
            let size = $state('compact');
          </script>
          <button onclick={() => size = size === 'compact' ? 'default' : 'compact'}>Toggle</button>
          <Provider {size}>
            <Indicator id="inherited" class="custom px-0" title="Working" />
            <Indicator id="explicit" size="default" showIcon={false} />
          </Provider>
          <Indicator id="fallback" />`,
              {
                filename: `${import.meta.dir}/fixture.svelte`,
                generate: "client",
                css: "injected",
              }
            ).js.code,
            loader: "js",
            resolveDir: import.meta.dir,
          }));
          build.onResolve({ filter: utilsRequest }, () => ({
            path: resolve(import.meta.dir, "../../../utils.ts"),
          }));
          build.onLoad({ filter: svelteFile }, async ({ path }) => ({
            contents: compile(await Bun.file(path).text(), {
              filename: path,
              generate: "client",
              css: "injected",
            }).js.code,
            loader: "js",
            resolveDir: import.meta.dir,
          }));
        },
      },
    ],
  });
  expect(result.success).toBe(true);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ reducedMotion: "no-preference" });
    await page.setContent(
      "<style>:root { font-family: monospace; --foreground: #111; --muted-foreground: #888; }.sr-only { position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); }</style>"
    );
    await page.addScriptTag({
      content: await result.outputs[0].text(),
      type: "module",
    });
    await page.locator("#inherited animate").waitFor({ state: "attached" });
    expect(
      await page
        .locator("#inherited .labels")
        .evaluate((element) => getComputedStyle(element).fontFamily)
    ).toBe("monospace");
    expect(await page.locator("#inherited").getAttribute("data-size")).toBe(
      "compact"
    );
    expect(await page.locator("#explicit").getAttribute("data-size")).toBe(
      "default"
    );
    expect(await page.locator("#fallback").getAttribute("data-size")).toBe(
      "default"
    );
    expect(await page.locator("#explicit svg").count()).toBe(0);
    expect(await page.locator("#inherited svg").getAttribute("width")).toBe(
      "18"
    );
    expect(await page.locator("#inherited").getAttribute("class")).toContain(
      "custom px-0"
    );
    expect(await page.locator("#inherited").getAttribute("title")).toBe(
      "Working"
    );
    expect(await page.locator("#inherited").getAttribute("role")).toBe(
      "status"
    );
    expect(await page.locator("#inherited .sr-only").textContent()).toBe(
      "Thinking…"
    );
    expect(
      await page.locator("#inherited .labels").getAttribute("aria-hidden")
    ).toBe("true");
    const morph = page.locator("#inherited animate");
    expect(await morph.getAttribute("dur")).toBe("6s");
    expect((await morph.getAttribute("values"))?.split(";")).toHaveLength(5);
    const widths: number[] = [];
    for (let index = 0; index < 4; index += 1) {
      // biome-ignore lint/performance/noAwaitInLoops: each sample seeks the same animation timeline.
      const state = await page
        .locator("#inherited .labels")
        .evaluate((element, step) => {
          for (const animation of element.getAnimations({ subtree: true })) {
            animation.pause();
            animation.currentTime = step * 4000 + 1000;
          }
          return {
            width: element.getBoundingClientRect().width,
            visible: Array.from(element.children)
              .filter((child) => Number(getComputedStyle(child).opacity) > 0.99)
              .map((child) => child.textContent?.trim()),
          };
        }, index);
      widths.push(state.width);
      expect(state.visible).toEqual([
        ["Thinking", "Moonwalking", "Planning", "Refining"][index],
      ]);
    }
    expect(new Set(widths).size).toBe(1);
    await page.getByRole("button").click();
    expect(await page.locator("#inherited").getAttribute("data-size")).toBe(
      "default"
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.locator("#inherited animate").waitFor({ state: "detached" });
    expect(
      await page
        .locator("#inherited .labels")
        .evaluate((element) => element.getAnimations({ subtree: true }).length)
    ).toBe(0);
    expect(
      await page
        .locator("#inherited .first")
        .evaluate((element) => getComputedStyle(element).opacity)
    ).toBe("1");
    expect(
      await page
        .locator("#inherited .shimmer")
        .first()
        .evaluate((element) => getComputedStyle(element).color)
    ).not.toBe("rgba(0, 0, 0, 0)");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.locator("#inherited animate").waitFor({ state: "attached" });
  } finally {
    await browser.close();
  }
}, 30_000);
