import { expect, test } from "bun:test";
import type { SessionState } from "../client.svelte";
import { buildRows, buildRowsFrom } from "./rows";

const session = (over: Partial<SessionState> = {}): SessionState =>
  ({
    messages: [],
    subagents: {},
    queued: [],
    busy: true,
    pending: [],
    sdkStatus: null,
    streaming: "",
    thinkingStream: "",
    thinkingClosing: false,
    openBlock: null,
    currentTool: null,
    ...over,
  }) as SessionState;

test("the send gap and live reasoning share one indicator row", () => {
  for (const openBlock of [null, "thinking"] as const) {
    const rows = buildRows(session({ openBlock }));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "live", indicating: true });
  }
  const rows = buildRows(session({ openBlock: "thinking", thinkingStream: "Considering the options" }));
  expect(rows[0]).toMatchObject({ indicating: true, thinking: "Considering the options" });
});

test("visible output and blocked, tool, idle, cancelled, and closing phases suppress the indicator", () => {
  const phases: Partial<SessionState>[] = [
    { streaming: "The answer" },
    { openBlock: "thinking", streaming: "The answer" },
    { busy: false },
    { busy: false, lastTurnFailed: true },
    { busy: false, openBlock: "thinking", thinkingStream: "Interrupted" },
    { pending: [{ requestId: "permission" }] as SessionState["pending"] },
    { sdkStatus: "compacting" },
    { openBlock: "tool" },
    { currentTool: { toolId: "tool", name: "Bash", glance: "ls" } },
    { openBlock: "thinking", thinkingClosing: true },
    { messages: [{ instanceId: "i", type: "user", content: "Failed send", metadata: { sendFailed: "Disconnected" } }] },
  ];
  for (const phase of phases) {
    expect(buildRows(session(phase)).some((row) => row.kind === "live" && row.indicating)).toBe(false);
  }
});

test("incremental folding clears the indicator and preserves historical reasoning", () => {
  const state = session({ messages: [
    { id: "reason", instanceId: "i", type: "thinking", content: "Earlier reasoning" },
    { id: "send", instanceId: "i", type: "user", content: "Continue" },
  ] });
  const first = buildRowsFrom(state, null);
  expect(first.rows.at(-1)).toMatchObject({ indicating: true });
  state.busy = false;
  const settled = buildRowsFrom(state, first.memo);
  expect(settled.rows).toHaveLength(2);
  expect(settled.rows[0]).toBe(first.rows[0]);
  expect(settled.rows[0]).toMatchObject({ kind: "single", message: { content: "Earlier reasoning" } });
});

test("focused and scheduled rebuilds fingerprint indicator lifecycle changes", async () => {
  const source = await Bun.file(new URL("./Transcript.svelte", import.meta.url)).text();
  const fingerprint = source.slice(source.indexOf("const printOf ="), source.indexOf("const countBuild ="));
  for (const field of ["busy", "pending.length", "streaming.length", "openBlock", "thinkingClosing", "currentTool", "sdkStatus", "sendFailed"]) {
    expect(fingerprint).toContain(field);
  }
  expect(source).toMatch(/rebuildScheduler\.join\(\s*session\.instanceId,\s*printOf,/);
});
