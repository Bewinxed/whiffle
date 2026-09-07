/**
 * Toasts when the fleet deploys under an open dashboard.
 *
 * The hub reports its own build on every `instances` frame ({@link BuildInfo}).
 * The first commit this page sees is its "loaded with" revision; when a later
 * frame carries a different commit, the hub has restarted on new code and the
 * browser is running stale JavaScript. One toast per new commit, never per
 * reconnect — a socket that drops and comes back on the same revision stays
 * silent.
 */
import type { BuildInfo } from "@whiffle/core";
import { toast } from "svelte-sonner";

/** The commit the page loaded with — set once, from the first frame that names one. */
let loadedCommit: string | undefined;

/** The last commit we toasted for, so the same deploy never fires twice. */
let toastedCommit: string | undefined;

/**
 * Called whenever `hubBuild` is updated from an `instances` frame. Compares
 * the incoming commit against the one the page loaded with and toasts exactly
 * once per new revision.
 */
export function checkDeployToast(hubBuild: BuildInfo | undefined): void {
  const commit = hubBuild?.commit;
  if (!commit) {
    return;
  }

  // First sighting: this is the revision the page loaded with.
  if (loadedCommit === undefined) {
    loadedCommit = commit;
    return;
  }

  // Same revision the page loaded with, or already toasted for this one.
  if (commit === loadedCommit || commit === toastedCommit) {
    return;
  }

  toastedCommit = commit;
  toast.info("Whiffle updated — reload to get the new version.", {
    id: "deploy-update",
    duration: Number.POSITIVE_INFINITY,
    action: {
      label: "Reload",
      onClick: () => location.reload(),
    },
  });
}
