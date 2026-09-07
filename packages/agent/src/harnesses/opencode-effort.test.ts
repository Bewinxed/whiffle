import { expect, test } from "bun:test";
import { createOpencodeClient } from "@opencode-ai/sdk";
import { CONTROL_SET_EFFORT, type EffortLevel } from "@whiffle/core";
import type { HarnessContext } from "../harness";
import { OpencodeSession } from "./opencode";

const noop = () => undefined;

test.each([undefined, "low", "medium", "high", "xhigh", "max"] as const)(
  "OpenCode sends effort %s as a variant on prompts and commands",
  async (effort: EffortLevel | undefined) => {
    let received = Promise.withResolvers<Record<string, unknown>>();
    const server = Bun.serve({
      port: 0,
      async fetch(request) {
        const path = new URL(request.url).pathname;
        if (request.method === "GET" && path === "/command") {
          return Response.json([{ name: "test" }]);
        }
        if (path.endsWith("/prompt_async") || path.endsWith("/command")) {
          received.resolve((await request.json()) as Record<string, unknown>);
        }
        return Response.json({});
      },
    });
    const session = new OpencodeSession(
      "effort-test",
      {
        instanceId: "effort-test",
        cwd: "/tmp/opencode-effort",
        emit: noop,
        permission: noop,
        session: noop,
        busy: noop,
        frame: noop,
        failed: (error) => received.reject(error),
      } satisfies HarnessContext,
      createOpencodeClient({ baseUrl: server.url.toString() }),
      "ses_effort",
      "/tmp/opencode-effort",
      "openai/gpt-5.6-sol",
      "bypassPermissions",
      server.url.toString(),
      noop,
      noop,
      effort
    );
    try {
      session.send(
        { type: "user", message: { role: "user", content: "test prompt" } },
        {}
      );
      const prompt = await received.promise;
      expect(prompt.variant).toBe(effort);
      expect(Object.hasOwn(prompt, "variant")).toBe(effort !== undefined);
      received = Promise.withResolvers();
      session.send(
        { type: "user", message: { role: "user", content: "/test arguments" } },
        {}
      );
      expect((await received.promise).variant).toBe(effort);
      await session.control(CONTROL_SET_EFFORT, ["high"]);
      received = Promise.withResolvers();
      session.send(
        { type: "user", message: { role: "user", content: "next prompt" } },
        {}
      );
      expect((await received.promise).variant).toBe("high");
      await expect(
        session.control(CONTROL_SET_EFFORT, ["bogus"])
      ).rejects.toThrow("Unsupported OpenCode effort");
    } finally {
      await session.stop();
      server.stop(true);
    }
  }
);
