// biome-ignore-all lint/performance/useTopLevelRegex: fixture build hooks are registered once per test.
import { expect, test } from "bun:test";
import { dirname, resolve } from "node:path";
import { chromium } from "playwright-core";
import { compile, compileModule } from "svelte/compiler";

test("thinking steps controlled state, inheritance, pending and streaming identity", async () => {
  const fixture = `<script>
    import { ThinkingSteps, ThinkingStepsHeader, ThinkingStepsContent, ThinkingStep, ThinkingStepDetails } from './index';
    import Provider from '../thinking-indicator/size-provider.svelte';
    let size = $state('compact');
    let open = $state(false);
    let accept = $state(false);
    let description = $state('First');
    let pending = $state(true);
  </script>
  <button id="control" onclick={() => { accept = true; open = true; size = 'default'; }}>Control</button>
  <button id="append" onclick={() => { description += ' second'; pending = false; }}>Append</button>
  <Provider {size}>
    <ThinkingSteps id="controlled" {open} onOpenChange={(next) => { if (accept) open = next; }}>
      <ThinkingStepsHeader>Reasoning</ThinkingStepsHeader>
      <ThinkingStepsContent>
        <ThinkingStep icon="search" label="Actual label" {description} status="active" />
        <ThinkingStep label="Waiting" status={pending ? 'pending' : 'complete'} />
        <ThinkingStepDetails summary="Details" details={['One', 'Two']} />
      </ThinkingStepsContent>
    </ThinkingSteps>
    <ThinkingSteps id="default" size="default">
      <ThinkingStepsHeader />
      <ThinkingStepsContent><ThinkingStep label="Done" /></ThinkingStepsContent>
    </ThinkingSteps>
  </Provider>`;
  const result = await Bun.build({
    entrypoints: ["steps-test-entry"],
    target: "browser",
    conditions: ["browser"],
    plugins: [
      {
        name: "svelte-fixture",
        setup(build) {
          build.onResolve({ filter: /^steps-test-entry$/ }, () => ({
            path: `${import.meta.dir}/entry.ts`,
          }));
          build.onLoad({ filter: /\/entry\.ts$/ }, () => ({
            contents:
              "import { mount } from 'svelte'; import Fixture from './fixture.svelte'; mount(Fixture, { target: document.body });",
            loader: "js",
            resolveDir: import.meta.dir,
          }));
          build.onResolve({ filter: /fixture\.svelte$/ }, () => ({
            path: `${import.meta.dir}/fixture.svelte`,
          }));
          build.onLoad({ filter: /fixture\.svelte$/ }, () => ({
            contents: compile(fixture, {
              filename: `${import.meta.dir}/fixture.svelte`,
              generate: "client",
              css: "injected",
            }).js.code,
            loader: "js",
            resolveDir: import.meta.dir,
          }));
          build.onResolve({ filter: /^\$lib\/icons$/ }, () => ({
            path: `${import.meta.dir}/icons.ts`,
          }));
          build.onLoad({ filter: /\/icons\.ts$/ }, () => ({
            contents:
              "export { default as IconChevronRight, default as IconSearch, default as IconGlobe, default as IconCheck } from './chevron.svelte';",
            loader: "js",
            resolveDir: import.meta.dir,
          }));
          build.onResolve({ filter: /chevron\.svelte$/ }, () => ({
            path: `${import.meta.dir}/chevron.svelte`,
          }));
          build.onLoad({ filter: /chevron\.svelte$/ }, async () => {
            const solar = await import("@iconify-json/solar/icons.json");
            return {
              contents: compile(
                `<svg viewBox="0 0 24 24">${solar.default.icons["alt-arrow-right-linear"].body}</svg>`,
                { filename: "chevron.svelte", generate: "client" }
              ).js.code,
              loader: "js",
              resolveDir: import.meta.dir,
            };
          });
          build.onResolve({ filter: /^\$lib\// }, ({ path }) => ({
            path: resolve(import.meta.dir, "../../..", path.slice(5)),
          }));
          build.onLoad({ filter: /\.svelte$/ }, async ({ path }) => ({
            contents: compile(await Bun.file(path).text(), {
              filename: path,
              generate: "client",
              css: "injected",
            }).js.code,
            loader: "js",
            resolveDir: dirname(path),
          }));
          build.onLoad({ filter: /\.svelte\.[jt]s$/ }, async ({ path }) => ({
            contents: compileModule(
              new Bun.Transpiler({ loader: "ts" }).transformSync(
                await Bun.file(path).text()
              ),
              { filename: path, generate: "client" }
            ).js.code,
            loader: "js",
            resolveDir: dirname(path),
          }));
        },
      },
    ],
  });
  if (!result.success) {
    throw new AggregateError(
      result.logs,
      "Failed to compile thinking steps fixture"
    );
  }
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ reducedMotion: "reduce" });
    page.setDefaultTimeout(5000);
    page.on("pageerror", (error) => console.error(error));
    await page.setContent(
      "<style>:root { --text-sm:12.5px; --text-xs:11px; --leading-body:1.4; --weight-body:400; --space-1:4px; --space-2:7px; --ink-muted:#777; --ink-body:#444; }</style>"
    );
    await page.addScriptTag({
      content: await result.outputs[0].text(),
      type: "module",
    });
    const header = page.locator(
      '#controlled > [data-slot="thinking-steps-header"]'
    );
    await header.waitFor();
    expect(await header.getAttribute("aria-expanded")).toBe("false");
    await header.click();
    expect(await header.getAttribute("aria-expanded")).toBe("false");
    expect(await page.locator("#controlled").getAttribute("data-size")).toBe(
      "compact"
    );
    expect(await page.locator("#default").getAttribute("data-size")).toBe(
      "default"
    );
    expect(
      await page
        .locator('#default > [data-slot="thinking-steps-header"]')
        .getAttribute("aria-expanded")
    ).toBe("true");
    await page.locator("#control").click();
    expect(await header.getAttribute("aria-expanded")).toBe("true");
    expect(
      await page.locator('#controlled [data-slot="thinking-step"]').count()
    ).toBe(1);
    expect(
      await page
        .locator('#controlled [data-slot="thinking-step"] .icon svg')
        .count()
    ).toBe(1);
    expect(
      await page
        .locator('#controlled [data-slot="thinking-step"]')
        .getAttribute("data-size")
    ).toBe("default");
    await page.evaluate(() => {
      (window as any).firstWord = document.querySelector(
        "#controlled .description .w"
      );
    });
    await page.locator("#append").click();
    expect(
      await page.locator('#controlled [data-slot="thinking-step"]').count()
    ).toBe(2);
    expect(await page.locator("#controlled .description").textContent()).toBe(
      "First second"
    );
    expect(
      await page.evaluate(
        () =>
          (window as any).firstWord ===
          document.querySelector("#controlled .description .w")
      )
    ).toBe(true);
    await page.getByRole("button", { name: "Details", exact: true }).click();
    expect(await page.getByText("One", { exact: true }).isVisible()).toBe(true);
    await header.click();
    expect(await header.getAttribute("aria-expanded")).toBe("false");
    await page
      .getByText("Actual label", { exact: true })
      .waitFor({ state: "hidden" });
    expect(
      await page.getByText("Actual label", { exact: true }).isVisible()
    ).toBe(false);
  } finally {
    await browser.close();
  }
}, 30_000);
