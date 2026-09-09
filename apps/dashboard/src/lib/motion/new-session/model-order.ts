import type { ModelInfo } from "@whiffle/core";

/** When each model id was last started, ISO timestamps keyed by id. */
export type Usage = Record<string, string>;

/**
 * The order a model list is read in: what is newer than anything you have
 * used, then what you used most recently, then everything else newest-first.
 *
 * A model released after your last session is the one thing you do not know
 * about yet, so it goes above your habits; below that, the list is your
 * habits. Aliases carry no release date and sort with the rest by name.
 */
export function orderModels(rows: ModelInfo[], usage: Usage): ModelInfo[] {
  const lastUse = Object.values(usage).sort().at(-1);
  const fresh = rows.filter(
    (row) => row.released && (!lastUse || row.released > lastUse)
  );
  const used = rows
    .filter((row) => !fresh.includes(row) && usage[row.value])
    .sort((a, b) => usage[b.value].localeCompare(usage[a.value]));
  const rest = rows
    .filter((row) => !(fresh.includes(row) || used.includes(row)))
    .sort((a, b) => (b.released ?? "").localeCompare(a.released ?? ""));
  return [...fresh, ...used, ...rest];
}

export function matches(row: ModelInfo, query: string): boolean {
  const q = query.trim().toLowerCase();
  return (
    q === "" ||
    row.value.toLowerCase().includes(q) ||
    row.displayName.toLowerCase().includes(q)
  );
}
