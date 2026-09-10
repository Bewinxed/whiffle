<script lang="ts">
  /**
   * Fluid Functionalism's Tabs, the root: a segmented control with a sliding
   * active indicator, proximity hover and a weight that animates. Controlled
   * by `value` or `selectedIndex`, uncontrolled by `defaultValue`; without
   * either, the first item is chosen so the indicator has somewhere to be
   * from the first paint.
   */
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { provideTabs, type TabsSize, TabsState } from "./context.svelte";

  let {
    value,
    onValueChange,
    selectedIndex,
    onSelect,
    defaultValue,
    size = "default",
    children,
    ...rest
  }: Omit<HTMLAttributes<HTMLDivElement>, "onselect"> & {
    value?: string;
    onValueChange?: (value: string) => void;
    selectedIndex?: number;
    onSelect?: (index: number) => void;
    defaultValue?: string;
    /** One step of the size ladder: 36px outer by default, 28px compact. */
    size?: TabsSize;
    children: Snippet;
  } = $props();

  // svelte-ignore state_referenced_locally — defaultValue is a one-time initial
  const state = new TabsState(defaultValue);
  // $effect.pre runs before the first paint and on every subsequent change,
  // so there is no need for a separate synchronous assignment.
  $effect.pre(() => {
    state.controlled = value;
    state.selectedIndex = selectedIndex;
    state.size = size;
    state.onValueChange = onValueChange;
    state.onSelect = onSelect;
  });
  provideTabs(state);
</script>

<div data-size={size} data-slot="tabs" {...rest}>
  {@render children()}
</div>
