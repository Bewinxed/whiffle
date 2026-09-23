/**
 * Which session the New Session dialog is continuing, when it is. Set by the
 * session menus, read by the one dialog mount in the sidebar: the menus live
 * in rows all over the app, and the dialog must not be mounted once per row.
 */
import type { HarnessKind } from "@whiffle/core";

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
