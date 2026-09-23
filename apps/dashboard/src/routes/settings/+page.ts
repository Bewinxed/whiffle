import type { OpenRouterState } from "$lib/whiffle/suggest.svelte";
import type { PageLoad } from "./$types";

/**
 * Read through the proxy like `/rules`: a hub that is down leaves a sentence
 * to read instead of a blank page.
 */
export const load: PageLoad = async ({ fetch }) => {
  const payload = await fetch("/api/openrouter")
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`the hub answered ${response.status}`);
      }
      return (await response.json()) as OpenRouterState;
    })
    .catch((error: unknown) => error as Error);

  return {
    openrouter:
      payload instanceof Error
        ? ({
            connected: false,
            connectedAt: null,
            suggestWhileTyping: false,
          } as OpenRouterState)
        : payload,
    error:
      payload instanceof Error
        ? `Could not read the OpenRouter connection — ${payload.message}.`
        : null,
  };
};
