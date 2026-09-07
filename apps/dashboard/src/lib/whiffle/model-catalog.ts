import type { HarnessKind, ModelInfo } from "@whiffle/core";

export type HarnessModel = ModelInfo & { harness: HarnessKind };

/**
 * The long-context spelling of a model: Claude Code names the 1M-context run of
 * a model by suffixing its id, so a session reports `claude-opus-5[1m]` while
 * `supportedModels()` offers only the bare `claude-opus-5` row. The suffix is a
 * context setting, not a different model — matching has to see through it, or
 * the row that carries the model's name and its effort scale is never found and
 * every 1M session reads as an unknown model with no effort control.
 */
const LONG_CONTEXT = /\[1m\]$/i;

/** The model id with any long-context suffix off — what the catalog is keyed by. */
export const baseModelId = (model: string): string =>
  model.replace(LONG_CONTEXT, "");

/** Whether this id names the 1M-context run of its model. */
export const isLongContext = (model: string): boolean =>
  LONG_CONTEXT.test(model);

/** Model ids are unique within a harness; different harnesses may offer the same id. */
export function modelsForHarness(
  catalog: HarnessModel[],
  harness?: string
): ModelInfo[] {
  const seen = new Set<string>();
  return catalog.filter((row) => {
    if ((harness && row.harness !== harness) || seen.has(row.value)) {
      return false;
    }
    seen.add(row.value);
    return true;
  });
}
