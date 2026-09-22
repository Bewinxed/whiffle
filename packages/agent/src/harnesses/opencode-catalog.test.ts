import { expect, test } from "bun:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { retireLegacyHandoffPlugin, writeHandoffPlugin } from "./opencode";

test("legacy registration is retired once without overwriting other plugins or losing its source", async () => {
  const directory = await mkdtemp(join(tmpdir(), "whiffle-plugin-"));
  try {
    const legacy = join(directory, "plugins", "cockpit-handoff.js");
    const canonical = join(directory, "plugins", "whiffle-handoff.js");
    await Bun.write(legacy, "legacy source");
    await Bun.write(canonical, "current source");
    await Bun.write(
      join(directory, "opencode.json"),
      JSON.stringify({
        plugin: ["another-plugin", `file://${legacy}`, `file://${canonical}`],
        model: "keep-model",
      })
    );
    await retireLegacyHandoffPlugin(directory);
    expect(await Bun.file(legacy).exists()).toBe(false);
    expect(await Bun.file(canonical).text()).toBe("current source");
    const files = await readdir(join(directory, "plugins"));
    const backup = files.find((file) =>
      file.startsWith("cockpit-handoff.js.disabled-")
    );
    expect(backup).toBeDefined();
    expect(
      await Bun.file(join(directory, "plugins", backup ?? "missing")).text()
    ).toBe("legacy source");
    expect(await Bun.file(join(directory, "opencode.json")).json()).toEqual({
      plugin: ["another-plugin", `file://${canonical}`],
      model: "keep-model",
    });
    await retireLegacyHandoffPlugin(directory);
    expect(await readdir(join(directory, "plugins"))).toEqual(files);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("changed definitions get a fresh module path and leave only one discoverable plugin", async () => {
  const directory = await mkdtemp(join(tmpdir(), "whiffle-revision-"));
  try {
    const first = await writeHandoffPlugin(
      "export const version = 1;",
      directory
    );
    expect(
      await writeHandoffPlugin("export const version = 1;", directory)
    ).toBe(first);
    const second = await writeHandoffPlugin(
      "export const version = 2;",
      directory
    );
    expect(second).not.toBe(first);
    expect(
      (await readdir(join(directory, "plugins"))).filter((name) =>
        name.endsWith(".js")
      )
    ).toHaveLength(1);
    expect(await Bun.file(second).text()).toContain("version = 2");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
