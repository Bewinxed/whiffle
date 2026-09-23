/**
 * Which session the New Session dialog is continuing, when it is. Set by the
 * session menus, read by the one dialog mount in the sidebar: the menus live
 * in rows all over the app, and the dialog must not be mounted once per row.
 */
import type { HarnessKind } from "@whiffle/core";
import { whiffle } from "./client.svelte";
import { contextOf } from "./workspace/workspace.svelte";

/** The session a continuation starts from, as the dialog shows and sends it. */
export interface ContinueSource {
  cwd: string;
  harness: HarnessKind;
  /** The id the hub knows it by: a whiffle instance id, or a stored session's own id. */
  instanceId: string;
  machineId: string;
  model?: string;
  title: string;
}

export const continuing = $state<{ source: ContinueSource | null }>({
  source: null,
});

/** Opens the New Session dialog continuing `source`. */
export function continueInNewSession(source: ContinueSource): void {
  continuing.source = source;
}

/**
 * A dashboard session as a continuation source, found the way the session
 * details card finds it: the live view, then the instance row, then the
 * workspace's remembered context.
 */
export function continueSourceOf(
  sessionId: string,
  title: string
): ContinueSource {
  const session = whiffle.session(sessionId);
  const row = whiffle.instanceIndex.byId.get(sessionId);
  const context = contextOf(sessionId);
  return {
    instanceId: sessionId,
    machineId: (session?.machineId ||
      row?.machineId ||
      context?.machine) as string,
    cwd: session?.cwd || row?.cwd || context?.cwd || "",
    harness: (session?.harness ||
      row?.harness ||
      context?.harness) as HarnessKind,
    model: session?.model ?? undefined,
    title,
  };
}
