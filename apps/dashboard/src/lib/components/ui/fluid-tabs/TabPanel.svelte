<script lang="ts">
  /** Rendered when the matching item is chosen. */
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "$lib/utils";
  import { useTabs } from "./context.svelte";

  let {
    value,
    class: className,
    children,
    ...rest
  }: HTMLAttributes<HTMLDivElement> & {
    value: string;
    children: Snippet;
  } = $props();

  const tabs = useTabs();
</script>

{#if tabs.value === value}
  <div class={cn("outline-none", className)} role="tabpanel" {...rest}>
    {@render children()}
  </div>
{/if}
