import { readEnv, WHIFFLE_ENV, WHIFFLE_HUB_PORT } from "@whiffle/core";

export const MCP_SERVER_NAME = "whiffle";
const WS_SCHEME = /^ws/;
const WS_PATH = /\/ws$/;
export const delegationHubUrl = () =>
  (readEnv(WHIFFLE_ENV.hubUrl) ?? `ws://localhost:${WHIFFLE_HUB_PORT}/ws`)
    .replace(WS_SCHEME, "http")
    .replace(WS_PATH, "");
export const delegationMcp = (instanceId: string) => ({
  type: "http" as const,
  url: `${delegationHubUrl()}/mcp/whiffle?instanceId=${encodeURIComponent(instanceId)}`,
  // Exempt from tool-search deferral (Claude Code >= 2.1.121). Measured: across
  // 54 whiffle-spawned sessions the delegate tool was one deferred NAME among
  // 133, uncallable until a ToolSearch round trip, while Bash sat loaded — a
  // 79:1 inline-to-delegate ratio and one unprompted adoption in 54 sessions.
  // The whole server is ~10 tools, so loading them upfront costs little; the
  // alternative (`ENABLE_TOOL_SEARCH=false`) would load all 133 and reintroduce
  // the context cost this exists to avoid.
  alwaysLoad: true,
});

export async function delegationTools() {
  const response = await fetch(`${delegationHubUrl()}/api/delegation/tools`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) {
    throw new Error(
      `Could not discover Whiffle tools: HTTP ${response.status}`
    );
  }
  return (
    (await response.json()) as {
      tools: {
        name: string;
        description: string;
        inputSchema: Record<string, unknown>;
      }[];
    }
  ).tools;
}

export async function callDelegationTool(
  instanceId: string,
  name: string,
  args: unknown
) {
  const response = await fetch(
    `${delegationHubUrl()}/api/delegation/call/${encodeURIComponent(instanceId)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, arguments: args }),
      signal: AbortSignal.timeout(30_000),
    }
  );
  if (!response.ok) {
    throw new Error(`Whiffle tool ${name}: HTTP ${response.status}`);
  }
  const result = (await response.json()) as {
    content: { type: "text"; text: string }[];
    structuredContent?: Record<string, unknown>;
    isError?: boolean;
  };
  if (result.isError) {
    throw new Error(result.content.map((part) => part.text).join("\n"));
  }
  return { content: result.content, details: result.structuredContent ?? {} };
}
