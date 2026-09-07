import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { InstanceRow } from "@whiffle/core";
import { createDelegationMcp } from "../packages/hub/src/delegation-mcp";
import type { handoffTools } from "../packages/hub/src/delegation-tools";

// Real OpenCode + MCP transport; model responses are local fixtures, never paid inference.
const scratch = await mkdtemp(join(tmpdir(), "whiffle-reload-"));
let revision = 1;
let failList = false;
let lists = 0;
let calls = 0;
const modelRequests: {
  tools?: {
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }[];
}[] = [];
const definition = (
  name: string,
  description: string
): ReturnType<typeof handoffTools>[number] => ({
  name,
  description,
  inputSchema: {
    type: "object",
    properties:
      revision === 1
        ? { value: { type: "string" } }
        : { revision: { type: "string" } },
  },
  handler: () => {
    calls += 1;
    return Promise.resolve({ content: [{ type: "text", text: "new handler executed" }] });
  },
});
const factory: typeof handoffTools = () => [
  definition("probe", `description-v${revision}`),
  definition(revision === 1 ? "obsolete" : "fresh", "inventory test"),
];
const mcp = createDelegationMcp({
  instances: () => [
    {
      id: "fixture-actor",
      machineId: "fixture-machine",
      cwd: scratch,
      harness: "opencode",
      status: "running",
      sessionId: "fixture-session",
    } as InstanceRow,
  ],
  tools: factory,
  watch: false,
});
const changed = () => mcp.replaceTools(factory);
const fixture = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === "/mcp") {
      const body = request.method === "POST" ? await request.json() : undefined;
      if (body?.method === "tools/list") {
        lists += 1;
        if (failList) {
          return Response.json({
            jsonrpc: "2.0",
            id: body.id,
            error: { code: -32_603, message: "intentional refresh failure" },
          });
        }
      }
      return mcp.handle(request, body);
    }
    if (path === "/v1/chat/completions") {
      const body = (await request.json()) as {
        tools?: {
          function: {
            name: string;
            description: string;
            parameters: Record<string, unknown>;
          };
        }[];
        messages: { role: string }[];
      };
      modelRequests.push(body);
      const fresh = body.tools?.find((tool) =>
        tool.function.name.endsWith("_fresh")
      );
      const call = revision === 2 && !failList && calls === 0 && fresh;
      const delta = call
        ? {
            tool_calls: [
              {
                index: 0,
                id: "call_reload_probe",
                type: "function",
                function: { name: fresh.function.name, arguments: "{}" },
              },
            ],
          }
        : { content: "Acceptance fixture completed." };
      const chunk = (d: unknown, finish: string | null) =>
        `data: ${JSON.stringify({ id: "fixture-completion", object: "chat.completion.chunk", created: 0, model: "test", choices: [{ index: 0, delta: d, finish_reason: finish }] })}\n\n`;
      return new Response(
        chunk(delta, null) +
          chunk({}, call ? "tool_calls" : "stop") +
          "data: [DONE]\n\n",
        { headers: { "Content-Type": "text/event-stream" } }
      );
    }
    return new Response("Not found", { status: 404 });
  },
});
const child = Bun.spawn(
  [
    process.env.OPENCODE_BIN ?? "opencode",
    "serve",
    "--hostname=127.0.0.1",
    "--port=0",
  ],
  {
    cwd: scratch,
    env: {
      ...process.env,
      HOME: scratch,
      XDG_CONFIG_HOME: join(scratch, "config"),
      XDG_DATA_HOME: join(scratch, "data"),
      XDG_CACHE_HOME: join(scratch, "cache"),
      XDG_STATE_HOME: join(scratch, "state"),
      OPENCODE_DISABLE_DEFAULT_PLUGINS: "1",
      OPENCODE_DISABLE_AUTOUPDATE: "1",
      OPENCODE_CONFIG_CONTENT: JSON.stringify({
        model: "probe/test",
        small_model: "probe/test",
        plugin: [],
        permission: { "*": "allow" },
        provider: {
          probe: {
            npm: "@ai-sdk/openai-compatible",
            name: "Local fixture",
            options: { baseURL: `${fixture.url}v1`, apiKey: "fixture-only" },
            models: {
              test: { name: "Test", limit: { context: 32_000, output: 1000 } },
            },
          },
        },
        mcp: {
          reload: {
            type: "remote",
            url: `${fixture.url}mcp?instanceId=fixture-actor`,
            enabled: true,
            oauth: false,
          },
        },
      }),
    },
    stdout: "pipe",
    stderr: "pipe",
  }
);
let stderr = "";
// biome-ignore lint/complexity/noVoid: drain stderr while the child runs
void new Response(child.stderr).text().then((text) => {
  stderr = text;
});
const wait = async (predicate: () => boolean, label: string) => {
  const deadline = Date.now() + 30_000;
  while (!predicate()) {
    if (Date.now() > deadline) {
      throw new Error(`Timeout: ${label}`);
    }
    // biome-ignore lint/performance/noAwaitInLoops: bounded polling waits for a transport event
    await Bun.sleep(100);
  }
};
try {
  const reader = child.stdout.getReader();
  let output = "";
  const announcePattern = /http:\/\/127\.0\.0\.1:\d+/;
  const announced = async () => {
    for (;;) {
      // biome-ignore lint/performance/noAwaitInLoops: stdout must be read in arrival order
      const next = await reader.read();
      if (next.done) {
        throw new Error(`OpenCode exited before listen: ${stderr}`);
      }
      output += new TextDecoder().decode(next.value);
      const match = output.match(announcePattern);
      if (match) {
        return match[0];
      }
    }
  };
  const base = await Promise.race([
    announced(),
    Bun.sleep(60_000).then(() => {
      throw new Error("Server startup timeout");
    }),
  ]);
  const api = async (path: string, body?: unknown) => {
    const response = await fetch(
      `${base}${path}?directory=${encodeURIComponent(scratch)}`,
      {
        method: body === undefined ? "GET" : "POST",
        headers: { "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(60_000),
      }
    );
    if (!response.ok) {
      throw new Error(`${path}: ${response.status} ${await response.text()}`);
    }
    return response.json() as Promise<{ id: string }>;
  };
  const session = await api("/session", {});
  const prompt = () =>
    api(`/session/${session.id}/message`, {
      model: { providerID: "probe", modelID: "test" },
      parts: [{ type: "text", text: "Run the acceptance fixture." }],
    });
  await prompt();
  const initial = modelRequests.find((request) =>
    request.tools?.some((tool) => tool.function.name === "reload_probe")
  );
  assert.ok(initial, "initial model request includes MCP tools");
  assert.equal(
    initial.tools?.find((tool) => tool.function.name === "reload_probe")
      ?.function.description,
    "description-v1"
  );
  await Bun.sleep(300);
  revision = 2;
  const previousLists = lists;
  await changed();
  await wait(() => lists > previousLists, "tool-list re-fetch");
  modelRequests.length = 0;
  await prompt();
  const refreshed = modelRequests.find((request) =>
    request.tools?.some((tool) => tool.function.name === "reload_fresh")
  );
  assert.ok(refreshed, "new tool reaches same session's next model call");
  const probe = refreshed.tools?.find(
    (tool) => tool.function.name === "reload_probe"
  )?.function;
  assert.equal(probe?.description, "description-v2");
  assert.ok(
    (probe?.parameters.properties as Record<string, unknown>)?.revision
  );
  assert.ok(
    !refreshed.tools?.some((tool) => tool.function.name === "reload_obsolete")
  );
  assert.equal(calls, 1, "new tool actually executed");
  failList = true;
  const beforeFailure = lists;
  await changed();
  await wait(() => lists > beforeFailure, "failed refresh attempted");
  modelRequests.length = 0;
  await prompt();
  assert.ok(
    modelRequests.some((request) =>
      request.tools?.some((tool) => tool.function.name === "reload_fresh")
    ),
    "last good tool list survives failed refresh"
  );
  assert.equal((await api(`/session/${session.id}`)).id, session.id);
  assert.equal(child.exitCode, null, "same OpenCode process remains alive");
  console.log(
    JSON.stringify({
      status: "PASS",
      sessionId: session.id,
      pid: child.pid,
      checks: [
        "description changed",
        "schema changed",
        "tool added and executed",
        "tool removed",
        "failed refresh retained last good list",
        "same session and process",
      ],
      inference: "local mock only",
    })
  );
} finally {
  child.kill();
  await child.exited;
  fixture.stop(true);
  await mcp.close();
  await rm(scratch, { recursive: true, force: true });
  if (stderr) {
    console.error(stderr);
  }
}
