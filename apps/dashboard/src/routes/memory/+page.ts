import type { FleetSnapshot } from "$lib/whiffle/fleet";
import type { PageLoad } from "./$types";

/**
 * The fleet's desired state, read through the proxy so the page renders on the
 * server and a hub that is down leaves a sentence rather than a blank pane.
 * Memory and its linked documents both arrive with their files, so the editor
 * is seeded from this one read instead of fetching each document again.
 */
export const load: PageLoad = async ({ fetch }) => {
  const fleet = await fetch("/api/fleet")
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`the hub answered ${response.status}`);
      }
      return (await response.json()) as FleetSnapshot;
    })
    .catch((error: unknown) => error as Error);

  if (fleet instanceof Error) {
    return { memory: null, memoryDocs: [], fleetError: fleet.message };
  }
  return {
    memory: fleet.memory,
    memoryDocs: fleet.memoryDocs,
    fleetError: null as string | null,
  };
};
