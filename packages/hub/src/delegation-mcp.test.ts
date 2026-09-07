import { expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ToolListChangedNotificationSchema } from "@modelcontextprotocol/sdk/types.js";
import type { InstanceRow } from "@whiffle/core";
import { WHIFFLE_ENV } from "@whiffle/core";
import { Elysia } from "elysia";
import { createDelegationMcp } from "./delegation-mcp";
import { handoffTools } from "./delegation-tools";

test("same MCP connection refreshes definitions and dispatches live presets with bound identity", async () => {
  const actor = {
    id: "actor",
    machineId: "machine",
    cwd: "/scratch",
    harness: "claude",
    sessionId: "native-actor",
    status: "running",
  } as InstanceRow;
  let preset = {
    name: "code",
    description: "Implementation",
    harness: "opencode",
    model: "openai/gpt-5.6-terra",
    effort: "medium",
  };
  const relayed: { path: string; body: Record<string, unknown> }[] = [];
  let mcp: ReturnType<typeof createDelegationMcp>;
  const transportApp = new Elysia().all("/mcp/whiffle", ({ request, body }) =>
    mcp.handle(request, body)
  );
  const hub = Bun.serve({
    port: 0,
    async fetch(request) {
      const path = new URL(request.url).pathname;
      if (path === "/mcp/whiffle") {
        return transportApp.handle(request);
      }
      if (path === "/api/delegate-types") {
        return Response.json({ types: [preset] });
      }
      if (path === "/api/instances") {
        return Response.json([actor]);
      }
      if (path === "/api/agents") {
        return Response.json([{ machineId: "machine", hostname: "fixture" }]);
      }
      if (path.startsWith("/api/relay/")) {
        relayed.push({
          path,
          body: (await request.json()) as Record<string, unknown>,
        });
        return Response.json({ ok: true });
      }
      return new Response("Not found", { status: 404 });
    },
  });
  const previous = process.env[WHIFFLE_ENV.hubUrl];
  process.env[WHIFFLE_ENV.hubUrl] = hub.url.toString();
  mcp = createDelegationMcp({
    instances: () => [actor],
    baseUrl: hub.url.origin,
    watch: false,
  });
  const client = new Client({ name: "acceptance", version: "1" });
  try {
    await client.connect(
      new StreamableHTTPClientTransport(
        new URL("mcp/whiffle?instanceId=actor", hub.url)
      )
    );
    const original = await client.listTools();
    expect(
      original.tools.some((tool) => tool.name === "list_delegate_types")
    ).toBe(true);
    const first = await client.callTool({
      name: "delegate",
      arguments: {
        type: "code",
        prompt: "first",
        __whiffle: { sessionId: "spoofed" },
      },
    });
    expect(first.isError).not.toBe(true);
    expect(relayed[0].body).toMatchObject({
      model: "openai/gpt-5.6-terra",
      effort: "medium",
      parent: { instanceId: "actor" },
    });
    preset = { ...preset, model: "openai/gpt-5.6-sol", effort: "high" };
    relayed.length = 0;
    await client.callTool({
      name: "delegate",
      arguments: { type: "code", prompt: "second" },
    });
    expect(relayed[0].body).toMatchObject({
      model: "openai/gpt-5.6-sol",
      effort: "high",
    });
    const changed = Promise.withResolvers<void>();
    client.setNotificationHandler(ToolListChangedNotificationSchema, () => {
      changed.resolve();
    });
    const next: typeof handoffTools = (deps) =>
      handoffTools(deps)
        .filter((tool) => tool.name !== "list_sessions")
        .map((tool): ReturnType<typeof handoffTools>[number] =>
          tool.name === "list_delegate_types"
            ? {
                ...tool,
                description: "Live catalog revision two",
                inputSchema: {
                  type: "object",
                  properties: { revision: { type: "string" } },
                },
              }
            : tool
        )
        .concat({
          name: "acceptance_probe",
          description: "Acceptance-only tool",
          inputSchema: { type: "object", properties: {} },
          handler: async () => ({
            content: [{ type: "text", text: "new handler executed" }],
          }),
        });
    await mcp.replaceTools(next);
    await changed.promise;
    const updated = await client.listTools();
    expect(updated.tools.some((tool) => tool.name === "list_sessions")).toBe(
      false
    );
    expect(
      updated.tools.find((tool) => tool.name === "list_delegate_types")
        ?.description
    ).toBe("Live catalog revision two");
    expect(
      updated.tools.find((tool) => tool.name === "list_delegate_types")
        ?.inputSchema.properties
    ).toHaveProperty("revision");
    const called = await client.callTool({
      name: "acceptance_probe",
      arguments: {},
    });
    expect(called.content).toEqual([
      { type: "text", text: "new handler executed" },
    ]);
    await expect(
      mcp.replaceTools(() => {
        throw new Error("broken update");
      })
    ).rejects.toThrow("broken update");
    expect((await client.listTools()).tools).toEqual(updated.tools);
    expect(
      (
        await mcp.call(null, "delegate", {
          type: "code",
          prompt: "spoof",
          __whiffle: { sessionId: "unknown", directory: "/scratch" },
        })
      ).isError
    ).toBe(true);
  } finally {
    await client.close();
    await mcp.close();
    hub.stop(true);
    if (previous === undefined) {
      delete process.env[WHIFFLE_ENV.hubUrl];
    } else {
      process.env[WHIFFLE_ENV.hubUrl] = previous;
    }
  }
});
