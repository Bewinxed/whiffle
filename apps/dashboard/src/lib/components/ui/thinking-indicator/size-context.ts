import { getContext, setContext } from "svelte";

export type SizeVariant = "default" | "compact";
const key = Symbol("fluid-size");

export function setSizeContext(size: () => SizeVariant) {
  setContext(key, size);
}

export function getSizeContext(): (() => SizeVariant) | undefined {
  return getContext(key);
}
