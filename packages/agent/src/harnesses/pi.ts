/**
 * The pi adapter (badlogic / earendil-works).
 *
 * pi is an in-process TypeScript SDK: `createAgentSession` returns an
 * `AgentSession` whose `subscribe()` streams the events the TUI would render.
 * There is no permission system — pi deliberately has none — so the permission
 * surface is empty and the dashboard hides it (capabilities). Sessions are
 * append-only JSONL trees on disk; `SessionManager` re-opens and forks them.
 *
 * The translation maps pi's stream (text/thinking deltas, tool calls, tool
 * results, turns) onto the same neutral frames the claude and opencode
 * adapters produce, so the dashboard renders pi with full parity everywhere
 * the harness has a feature to map.
 */

import { homedir } from "node:os";
import { join } from "node:path";
import type { Model } from "@earendil-works/pi-ai/compat";
import {
  type AgentSession,
  type AgentSessionEvent,
  createAgentSession,
  defineTool,
  ModelRuntime,
  SessionManager,
  type ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import type {
  AuthState,
  FleetConfig,
  FleetSyncReport,
  HarnessCapabilities,
  HarnessReport,
  NeutralAssistantBlock,
  NeutralSessionInfo,
  NeutralUserMessage,
  PermissionResult,
  SendPayload,
  SessionMessage,
  SpawnPayload,
} from "@whiffle/core";
import {
  CONTROL_CONTEXT_USAGE,
  CONTROL_INTERRUPT,
  CONTROL_SET_MODEL,
} from "@whiffle/core";
import { callDelegationTool, delegationTools } from "../delegation";
import type { Harness, HarnessContext, HarnessSession } from "../harness";
import { resolveBin } from "../tools";
import {
  hashText,
  readSidecar,
  syncMemory,
  syncSkillFiles,
  writeJson,
} from "./fleet-common";

/** pi's own config files — the machine profile the fleet sync converges. */
const PI_DIR = join(homedir(), ".pi", "agent");
const PI_SKILLS = join(PI_DIR, "skills");
const PI_MEMORY = join(PI_DIR, "AGENTS.md");
const PI_SIDECAR = join(PI_DIR, "whiffle-fleet.json");

export const PI_CAPABILITIES: HarnessCapabilities = {
  interrupt: true,
  permissionModes: [],
  setModel: true,
  // pi streams thinking but offers no knob for how much of it to do.
  effort: false,
  contextUsage: true,
  supportedModels: true,
  supportedCommands: false,
  mcpStatus: false,
  mcpControl: false,
  listSessions: true,
  getSessionMessages: true,
  renameSession: false,
  deleteSession: true,
  fork: true,
  rewind: false,
  tagSession: false,
  skills: true,
  subagents: false,
  tasks: false,
  compaction: true,
  costUsd: false,
  thinking: true,
  images: true,
  handoff: true,
  hooks: false,
  plugins: false,
  fleet: true,
};

const textOf = (content: unknown): string => {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((block) =>
        typeof block === "object" && block !== null && "text" in block
          ? String((block as { text: unknown }).text)
          : ""
      )
      .filter(Boolean)
      .join("\n");
  }
  return "";
};

/** A pi `Model` is resolved by its `id`, which is what the dashboard sends. */
// biome-ignore lint/suspicious/noExplicitAny: Model<T>'s config shape varies per provider; only `id` is read here, across every provider
const modelIdOf = (model: Model<any>): string =>
  String((model as { id?: unknown }).id ?? "");

/** Thin adapter over the same hub-owned definitions and handlers as MCP. */
const piHandoffTools = async (instanceId: string): Promise<ToolDefinition[]> =>
  (await delegationTools()).map((tool) =>
    defineTool({
      name: tool.name,
      label: tool.name,
      description: tool.description,
      parameters: tool.inputSchema as never,
      execute: async (_id, params) =>
        callDelegationTool(instanceId, tool.name, params),
    })
  );

class PiSession implements HarnessSession {
  readonly harness = "pi" as const;
  sessionId: string | null = null;
  readonly #ctx: HarnessContext;
  readonly #session: AgentSession;
  #streamedText = "";
  #streamedThinking = "";
  #busy = false;

  constructor(ctx: HarnessContext, session: AgentSession) {
    this.#ctx = ctx;
    this.#session = session;
    this.sessionId = session.sessionId;
    session.subscribe((event) => this.#handle(event));
    ctx.session(session.sessionId);
    ctx.frame({
      type: "system",
      subtype: "init",
      session_id: session.sessionId,
      cwd: ctx.cwd,
      ...(session.model ? { model: modelIdOf(session.model) } : {}),
    });
  }

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: routes every pi AgentSessionEvent kind into neutral frames; not refactored in this pass
  #handle(event: AgentSessionEvent): void {
    switch (event.type) {
      case "message_update": {
        const ae = (event as { assistantMessageEvent?: { type?: string } })
          .assistantMessageEvent;
        if (!ae) {
          break;
        }
        switch (ae.type) {
          case "text_delta": {
            const delta = (ae as { delta?: string }).delta ?? "";
            this.#streamedText += delta;
            this.#ctx.frame({
              type: "stream_event",
              event: {
                type: "content_block_delta",
                delta: { type: "text_delta", text: delta },
              },
            });
            this.#ctx.busy(true);
            this.#busy = true;
            break;
          }
          case "thinking_delta": {
            this.#streamedThinking += (ae as { delta?: string }).delta ?? "";
            break;
          }
          case "toolcall_end": {
            const call = (
              ae as {
                toolCall?: {
                  id?: string;
                  name?: string;
                  arguments?: Record<string, unknown>;
                };
              }
            ).toolCall;
            if (!(call?.id && call.name)) {
              break;
            }
            this.#ctx.frame({
              type: "assistant",
              message: {
                content: [
                  {
                    type: "tool_use",
                    id: call.id,
                    name: call.name,
                    input: call.arguments ?? {},
                  },
                ],
              },
            });
            this.#ctx.busy(true);
            this.#busy = true;
            break;
          }
          default:
            break;
        }
        break;
      }
      case "tool_execution_end": {
        const { toolCallId, result, isError } = event as unknown as {
          toolCallId: string;
          toolName: string;
          result:
            | {
                content?: { type?: string; text?: string }[];
                details?: Record<string, unknown>;
              }
            | unknown;
          isError: boolean;
        };
        const content = Array.isArray(result)
          ? ""
          : // biome-ignore lint/suspicious/noUnnecessaryConditions: `as` is an unchecked cast; result can still be undefined at runtime even though the cast type says otherwise
            textOf((result as { content?: unknown })?.content) || "";
        const details = (result as { details?: Record<string, unknown> } | null)
          ?.details;
        const structuredContent =
          details && Object.keys(details).length > 0 ? details : undefined;
        this.#ctx.frame({
          type: "user",
          message: {
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: toolCallId,
                content,
                is_error: isError,
                ...(structuredContent ? { structuredContent } : {}),
              },
            ],
          },
        });
        break;
      }
      case "turn_end": {
        // The final assistant message: the streamed text already painted it, but
        // the closing frame replaces the buffer with the real blocks (and carries
        // any thinking the stream did not surface as text).
        const blocks: NeutralAssistantBlock[] = [];
        const { message } = event as { message?: { content?: unknown[] } };
        for (const block of message?.content ?? []) {
          const b = block as {
            type?: string;
            text?: string;
            thinking?: string;
          };
          if (b.type === "text" && b.text) {
            blocks.push({ type: "text", text: b.text });
          } else if (b.type === "thinking" && b.thinking) {
            blocks.push({ type: "thinking", thinking: b.thinking });
          }
        }
        if (blocks.length) {
          this.#ctx.frame({ type: "assistant", message: { content: blocks } });
          // biome-ignore lint/suspicious/noUnnecessaryConditions: #streamedText is reassigned elsewhere in the class; biome's per-method inference doesn't see that
        } else if (this.#streamedText) {
          this.#ctx.frame({
            type: "assistant",
            message: { content: [{ type: "text", text: this.#streamedText }] },
          });
          // biome-ignore lint/suspicious/noUnnecessaryConditions: #streamedThinking is reassigned elsewhere in the class; biome's per-method inference doesn't see that
        } else if (this.#streamedThinking) {
          this.#ctx.frame({
            type: "assistant",
            message: {
              content: [{ type: "thinking", thinking: this.#streamedThinking }],
            },
          });
        }
        break;
      }
      case "agent_end": {
        this.#streamedText = "";
        this.#streamedThinking = "";
        this.#ctx.busy(false);
        this.#busy = false;
        const willRetry = (event as { willRetry?: boolean }).willRetry === true;
        const failed = (
          event as { messages?: { role?: string; errorMessage?: string }[] }
        ).messages?.some(
          (m) => typeof m.errorMessage === "string" && m.errorMessage
        );
        this.#ctx.frame({
          type: "result",
          subtype: willRetry || failed ? "error_during_execution" : "success",
          is_error: willRetry === true || failed === true,
          ...(failed ? { errors: ["pi reported an error"] } : {}),
        });
        break;
      }
      case "session_info_changed":
        break;
      default:
        break;
    }
  }

  send(
    message: NeutralUserMessage,
    extras: Pick<SendPayload, "attachments" | "images" | "urgent">
  ): void {
    const text = textOf(message.message.content);
    const images = (extras.images ?? []).map((image) => ({
      type: "image" as const,
      data: image.data,
      mimeType: image.mediaType,
    }));
    const attachments = (extras.attachments ?? [])
      .map(
        (a) =>
          `\n\n<pasted-text name="${a.name}">\n${a.content}\n</pasted-text>`
      )
      .join("");

    if (extras.urgent && this.#busy) {
      const prompt = `[Urgent — your previous turn was interrupted to deliver this]\n\n${text}${attachments}`;
      // biome-ignore lint/complexity/noVoid: fire-and-forget: send() itself is not awaited by its callers
      void this.#session
        .abort()
        // biome-ignore lint/suspicious/noEmptyBlockStatements: an urgent abort racing the turn's own close is expected; nothing to report
        .catch(() => {})
        .then(() => {
          this.#ctx.busy(true);
          this.#busy = true;
          return this.#session.prompt(prompt, { images: images as never });
        })
        .catch((error) => this.#ctx.failed(error));
      return;
    }

    this.#ctx.busy(true);
    this.#busy = true;
    // biome-ignore lint/complexity/noVoid: fire-and-forget: send() itself is not awaited by its callers
    void this.#session
      .prompt(text + attachments, { images: images as never })
      .catch((error) => this.#ctx.failed(error));
  }

  async control(method: string, args: unknown[]): Promise<unknown> {
    switch (method) {
      case CONTROL_INTERRUPT:
        await this.#session.abort();
        return undefined;
      case CONTROL_SET_MODEL: {
        const model = await this.#resolveModel(args[0] as string);
        if (!model) {
          throw new Error(`pi does not know model ${args[0]}`);
        }
        await this.#session.setModel(model);
        return undefined;
      }
      case CONTROL_CONTEXT_USAGE: {
        const last = [...this.#session.messages]
          .reverse()
          .find((m) => (m as { usage?: unknown }).usage);
        // biome-ignore lint/suspicious/noUnnecessaryConditions: `as` is an unchecked cast; last is undefined when #session.messages is empty even though the cast type says otherwise
        const usage = (last as { usage?: { totalTokens?: number } })?.usage;
        const total = usage?.totalTokens ?? 0;
        return {
          totalTokens: total,
          maxTokens: 200_000,
          percentage: Math.min(100, Math.round((total / 200_000) * 100)),
          categories: [],
        };
      }
      default:
        // An unsupported control verb is a silent no-op, never a user-facing
        // failure: the hub may send a reload this harness has no verb for, and a
        // session must not answer that with an error the reader sees.
        console.warn(`[pi] no control verb ${method} — ignored`);
        return undefined;
    }
  }

  // biome-ignore lint/suspicious/noExplicitAny: Model<T>'s config shape varies per provider; getAvailable() returns models across every provider
  async #resolveModel(id: string): Promise<Model<any> | undefined> {
    const runtime = await PiHarness.runtime();
    return (await runtime.getAvailable()).find(
      (model) => modelIdOf(model) === id
    );
  }

  resolvePermission(_requestId: string, _result: PermissionResult): void {
    /* pi has no parked-permission concept: it prompts and answers inline */
  }

  async interrupt(): Promise<void> {
    await this.#session.abort();
  }

  async stop(): Promise<void> {
    // biome-ignore lint/suspicious/noEmptyBlockStatements: stop() is tearing down regardless; the abort's own failure is not actionable
    await this.#session.abort().catch(() => {});
    // biome-ignore lint/suspicious/noEmptyBlockStatements: stop() is tearing down regardless; waitForIdle's own failure is not actionable
    await this.#session.waitForIdle().catch(() => {});
  }

  // biome-ignore lint/suspicious/useAwait: implements Harness.dispose's Promise<void> contract; this session's teardown is synchronous
  async dispose(): Promise<void> {
    this.#session.dispose();
  }
}

let runtimePromise: Promise<ModelRuntime> | null = null;

export class PiHarness implements Harness {
  readonly kind = "pi" as const;
  readonly capabilities = PI_CAPABILITIES;
  auth: AuthState = "authenticated";

  static runtime(): Promise<ModelRuntime> {
    if (!runtimePromise) {
      runtimePromise = ModelRuntime.create({ refreshOnCreate: false }).catch(
        (error) => {
          runtimePromise = null;
          throw error;
        }
      );
    }
    return runtimePromise;
  }

  // biome-ignore lint/suspicious/useAwait: implements Harness.detect's Promise<HarnessReport> contract; the bin probe is synchronous
  async detect(): Promise<HarnessReport> {
    const installed = resolveBin("pi") !== undefined;
    return {
      harness: "pi",
      installed,
      auth: installed ? "authenticated" : "unauthenticated",
      capabilities: PI_CAPABILITIES,
    };
  }

  // biome-ignore lint/suspicious/noExplicitAny: Model<T>'s config shape varies per provider; getAvailable() returns models across every provider
  async #resolveModel(modelId: string): Promise<Model<any> | undefined> {
    const runtime = await PiHarness.runtime();
    return (await runtime.getAvailable()).find(
      (model) => modelIdOf(model) === modelId
    );
  }

  async spawn(
    spec: SpawnPayload,
    ctx: HarnessContext
  ): Promise<HarnessSession> {
    const runtime = await PiHarness.runtime();
    const model = spec.model ? await this.#resolveModel(spec.model) : undefined;

    let sessionManager: SessionManager | undefined;
    if (spec.resume?.fork) {
      const source = await this.#sessionPath(spec.resume.sessionKey, ctx.cwd);
      if (source) {
        sessionManager = SessionManager.forkFrom(source, ctx.cwd);
      }
    } else if (spec.resume) {
      const source = await this.#sessionPath(spec.resume.sessionKey, ctx.cwd);
      if (source) {
        sessionManager = SessionManager.open(source, undefined, ctx.cwd);
      }
    }

    const { session } = await createAgentSession({
      cwd: ctx.cwd,
      modelRuntime: runtime,
      ...(model ? { model } : {}),
      ...(sessionManager
        ? { sessionManager }
        : { sessionManager: SessionManager.create(ctx.cwd) }),
      customTools: await piHandoffTools(ctx.instanceId),
    });

    return new PiSession(ctx, session);
  }

  async #sessionPath(
    sessionKey: string,
    cwd: string
  ): Promise<string | undefined> {
    const sessions = await SessionManager.list(cwd);
    const found = sessions.find(
      (info) => info.id === sessionKey || info.path.includes(sessionKey)
    );
    return found?.path;
  }

  async listSessions(dir?: string): Promise<NeutralSessionInfo[]> {
    if (!dir) {
      return [];
    }
    const sessions = await SessionManager.list(dir);
    return sessions.map((info) => ({
      sessionId: info.id,
      harness: "pi",
      lastModified:
        (info as { updatedAt?: number }).updatedAt ??
        (info as { createdAt?: number }).createdAt ??
        Date.now(),
      ...(info.name ? { customTitle: info.name } : {}),
      ...(info.path ? { cwd: info.path } : {}),
    }));
  }

  async getSessionInfo(
    sessionKey: string,
    dir?: string
  ): Promise<NeutralSessionInfo | undefined> {
    const info = (await this.listSessions(dir)).find(
      (one) => one.sessionId === sessionKey
    );
    return info;
  }

  async getSessionMessages(
    sessionKey: string,
    dir?: string
  ): Promise<SessionMessage[]> {
    if (!dir) {
      return [];
    }
    const path = await this.#sessionPath(sessionKey, dir);
    if (!path) {
      return [];
    }
    const manager = SessionManager.open(path, undefined, dir);
    const entries: SessionMessage[] = [];
    for (const entry of manager.getEntries()) {
      if (entry.type !== "message") {
        continue;
      }
      const message = (entry as { message?: unknown }).message as
        | { role?: string; content?: unknown }
        | undefined;
      if (!message) {
        continue;
      }
      const { role } = message;
      if (role === "user") {
        entries.push({
          type: "user",
          uuid: entry.id,
          session_id: sessionKey,
          message: { role: "user", content: textOf(message.content) },
          parent_tool_use_id: null,
          parent_agent_id: null,
        });
      } else if (role === "assistant") {
        entries.push({
          type: "assistant",
          uuid: entry.id,
          session_id: sessionKey,
          message: { role: "assistant", content: toBlocks(message.content) },
          parent_tool_use_id: null,
          parent_agent_id: null,
        });
      } else if (role === "toolResult") {
        const tool = message as { toolCallId?: string; isError?: boolean };
        entries.push({
          type: "user",
          uuid: entry.id,
          session_id: sessionKey,
          message: {
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: tool.toolCallId ?? "",
                content: textOf(message.content),
                is_error: tool.isError,
              },
            ],
          },
          parent_tool_use_id: null,
          parent_agent_id: null,
        });
      }
    }
    return entries;
  }

  renameSession(): Promise<void> {
    return Promise.resolve();
  }

  tagSession(): Promise<void> {
    return Promise.resolve();
  }

  async deleteSession(sessionKey: string, dir?: string): Promise<void> {
    if (!dir) {
      return;
    }
    const path = await this.#sessionPath(sessionKey, dir);
    if (path) {
      await Bun.$`rm -f ${path}`.quiet().nothrow();
    }
  }

  // biome-ignore lint/suspicious/useAwait: implements Harness.dispose's Promise<void> contract; this teardown is synchronous
  async dispose(): Promise<void> {
    runtimePromise = null;
  }

  async syncFleet(config: FleetConfig): Promise<FleetSyncReport> {
    const sidecar = await readSidecar(PI_SIDECAR);
    const report: FleetSyncReport = {
      mcp: {},
      marketplaces: {},
      plugins: {},
      skills: {},
      at: Date.now(),
    };

    // pi has no MCP and no plugins: the fleet's skills and memory are all it
    // can converge, and its reports say so for the tables it cannot.
    const skills = await syncSkillFiles(
      PI_SKILLS,
      config.skills ?? [],
      sidecar.skills,
      // biome-ignore lint/style/noNonNullAssertion: invariant: report.skills is initialized to {} a few lines above; TS drops the narrowing across the earlier await
      report.skills!
    );
    const memory = await syncMemory(
      PI_MEMORY,
      config.memory,
      sidecar.memory,
      report
    );

    await writeJson(PI_SIDECAR, { skills, ...(memory ? { memory } : {}) });
    // pi keeps its OWN copy of the skills, so it has to make its own claim: the
    // hub leaves bytes out only when every harness that converges them says it
    // already has that hash, and a harness that stays silent is one the fleet
    // would quietly stop sending content to.
    report.have = { skills };
    return report;
  }

  async fleetStatus(): Promise<FleetSyncReport> {
    const sidecar = await readSidecar(PI_SIDECAR);
    const report: FleetSyncReport = {
      mcp: {},
      marketplaces: {},
      plugins: {},
      skills: {},
      at: Date.now(),
    };

    for (const name of Object.keys(sidecar.skills)) {
      const file = Bun.file(join(PI_SKILLS, name, "SKILL.md"));
      // biome-ignore lint/performance/noAwaitInLoops: each skill file's presence is checked in turn; the count is small and order doesn't matter but the report is built incrementally
      // biome-ignore lint/style/noNonNullAssertion: invariant: report.skills is initialized to {} above; TS drops the narrowing across each loop iteration's await
      report.skills![name] = (await file.exists())
        ? { state: "applied" }
        : { state: "failed", detail: "not on disk" };
    }
    if (sidecar.memory !== undefined) {
      const file = Bun.file(PI_MEMORY);
      const hash = (await file.exists()) ? hashText(await file.text()) : null;
      report.memory =
        hash === sidecar.memory
          ? { state: "applied" }
          : {
              state: "failed",
              detail: hash === null ? "not on disk" : "edited on this machine",
            };
    }
    // The same claim the sync makes, from the sidecar it already read: a status
    // that stayed silent would retract it and cost a full resend.
    report.have = { skills: sidecar.skills };
    return report;
  }
}

function toBlocks(content: unknown): NeutralAssistantBlock[] {
  if (!Array.isArray(content)) {
    return [];
  }
  const blocks: NeutralAssistantBlock[] = [];
  for (const block of content) {
    const b = block as {
      type?: string;
      text?: string;
      thinking?: string;
      id?: string;
      name?: string;
      arguments?: Record<string, unknown>;
    };
    if (b.type === "text" && b.text) {
      blocks.push({ type: "text", text: b.text });
    } else if (b.type === "thinking" && b.thinking) {
      blocks.push({ type: "thinking", thinking: b.thinking });
    } else if (b.type === "toolCall" && b.id && b.name) {
      blocks.push({
        type: "tool_use",
        id: b.id,
        name: b.name,
        input: b.arguments ?? {},
      });
    }
  }
  return blocks;
}

export const piHarness: Harness = new PiHarness();
