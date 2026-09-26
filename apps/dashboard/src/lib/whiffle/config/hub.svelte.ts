import { whiffle } from "../client.svelte";

/**
 * Why a write cannot happen right now, or null when it can. Every section's
 * primary action and every Delete reads this, so a hub that is down disables
 * them with the same sentence everywhere.
 */
export const hubDown = (): string | null =>
  whiffle.status === "connected"
    ? null
    : "The hub is not connected, so nothing here can be saved until it is.";
