import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { InstanceRow } from "@whiffle/core";
import { createDelegationMcp } from "../packages/hub/src/delegation-mcp";
import type { handoffTools } from "../packages/hub/src/delegation-tools";

// Real Claude Code, real hub MCP transport, local mock inference only.
const scratch = await mkdtemp(join(tmpdir(), "whiffle-claude-reload-"));
let revision = 1;
let failList = false;
let calls = 0;
let lists = 0;
const requests: { tools?: { name: string; description?: string; input_schema?: { properties?: Record<string, unknown> } }[] }[] = [];
const definition = (name: string): ReturnType<typeof handoffTools>[number] => ({ name, description: `${name}-v${revision}`, inputSchema: { type: "object", properties: revision === 1 ? { value: { type: "string" } } : { revision: { type: "string" } } }, handler: () => { calls += 1; return Promise.resolve({ content: [{ type: "text", text: "executed" }] }); } });
const factory: typeof handoffTools = () => [definition("probe"), definition(revision === 1 ? "obsolete" : "fresh")];
const mcp = createDelegationMcp({ instances: () => [{ id: "fixture", cwd: scratch, status: "running" } as InstanceRow], tools: factory, watch: false });
const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
  const path = new URL(request.url).pathname;
  if (path === "/mcp") {
    const body = request.method === "POST" ? await request.json() : undefined;
    if (body?.method === "tools/list") {
      lists += 1;
      if (failList) return Response.json({ jsonrpc: "2.0", id: body.id, error: { code: -32603, message: "intentional refresh failure" } });
    }
    return mcp.handle(request, body);
  }
  if (path.includes("count_tokens")) return Response.json({ input_tokens: 1 });
  if (path === "/v1/messages") {
    const body = await request.json() as typeof requests[number];
    requests.push(body);
    const fresh = body.tools?.find((tool) => tool.name.endsWith("__fresh"));
    const call = revision === 2 && !failList && calls === 0 && fresh;
    const event = (type: string, data: unknown) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data as object })}\n\n`;
    return new Response(
      event("message_start", { message: { id: "msg_fixture", type: "message", role: "assistant", model: "claude-sonnet-4-5", content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } }) +
      event("content_block_start", { index: 0, content_block: call ? { type: "tool_use", id: "toolu_fixture", name: fresh.name, input: {} } : { type: "text", text: "" } }) +
      event("content_block_delta", { index: 0, delta: call ? { type: "input_json_delta", partial_json: "{}" } : { type: "text_delta", text: "Fixture completed." } }) +
      event("content_block_stop", { index: 0 }) +
      event("message_delta", { delta: { stop_reason: call ? "tool_use" : "end_turn", stop_sequence: null }, usage: { output_tokens: 1 } }) +
      event("message_stop", {}), { headers: { "Content-Type": "text/event-stream" } });
  }
  return Response.json({});
}});
const child = Bun.spawn([process.env.CLAUDE_BIN ?? "claude", "-p", "--verbose", "--output-format", "stream-json", "--input-format", "stream-json", "--model", "claude-sonnet-4-5", "--tools", "", "--strict-mcp-config", "--mcp-config", JSON.stringify({ mcpServers: { whiffle: { type: "http", url: `${server.url}mcp?instanceId=fixture` } } }), "--dangerously-skip-permissions"], { cwd: scratch, stdin: "pipe", stdout: "pipe", stderr: "pipe", env: { ...process.env, HOME: scratch, CLAUDE_CONFIG_DIR: join(scratch, "claude"), ANTHROPIC_API_KEY: "fixture-only", ANTHROPIC_AUTH_TOKEN: "", CLAUDE_CODE_OAUTH_TOKEN: "", ANTHROPIC_BASE_URL: server.url.origin, CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1", ENABLE_TOOL_SEARCH: "false" } });
const send = () => child.stdin.write(`${JSON.stringify({ type: "user", message: { role: "user", content: "Run the acceptance fixture." } })}\n`);
let stderr = "";
const stderrDone = new Response(child.stderr).text().then((text) => { stderr = text; });
const timer = setTimeout(() => child.kill(), 60000);
let results = 0;
const sessionIds = new Set<string>();
try {
  send();
  let buffer = "";
  for await (const chunk of child.stdout) {
    buffer += new TextDecoder().decode(chunk);
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
      if (!line.trim()) continue;
      const message = JSON.parse(line);
      if (message.session_id) sessionIds.add(message.session_id);
      if (message.type !== "result") continue;
      if (message.is_error) throw new Error(JSON.stringify(message));
      results += 1;
      if (results === 1) {
        const baseline = requests.find((request) => request.tools?.some((tool) => tool.name === "mcp__whiffle__probe"));
        assert.ok(baseline, "initial Claude model request contains MCP definitions");
        assert.equal(baseline.tools?.find((tool) => tool.name === "mcp__whiffle__probe")?.description, "probe-v1");
        revision = 2;
        const before = lists;
        await mcp.replaceTools(factory);
        for (let retry = 0; lists === before && retry < 50; retry += 1) await Bun.sleep(100);
        assert.ok(lists > before, "Claude re-fetched tools after notification");
        requests.length = 0;
        send();
      } else if (results === 2) {
        const refreshed = requests.find((request) => request.tools?.some((tool) => tool.name === "mcp__whiffle__fresh"));
        assert.ok(refreshed);
        assert.equal(refreshed.tools?.find((tool) => tool.name === "mcp__whiffle__probe")?.description, "probe-v2");
        assert.ok(refreshed.tools?.find((tool) => tool.name === "mcp__whiffle__probe")?.input_schema?.properties?.revision);
        assert.ok(!refreshed.tools?.some((tool) => tool.name === "mcp__whiffle__obsolete"));
        assert.equal(calls, 1);
        failList = true;
        const before = lists;
        await mcp.replaceTools(factory);
        for (let retry = 0; lists === before && retry < 50; retry += 1) await Bun.sleep(100);
        requests.length = 0;
        send();
      } else {
        assert.ok(requests.some((request) => request.tools?.some((tool) => tool.name === "mcp__whiffle__fresh")));
        assert.equal(sessionIds.size, 1);
        console.log(JSON.stringify({ status: "PASS", pid: child.pid, sessionId: [...sessionIds][0], checks: ["description changed", "schema changed", "tool added and executed", "tool removed", "failed refresh retained last good list", "same session and process"], inference: "local mock only" }));
        break;
      }
    }
    if (results === 3) break;
  }
  assert.equal(results, 3, "three turns completed");
} finally {
  clearTimeout(timer);
  child.kill();
  await child.exited;
  await stderrDone;
  await mcp.close();
  server.stop(true);
  await rm(scratch, { recursive: true, force: true });
  if (stderr) console.error(stderr);
}
