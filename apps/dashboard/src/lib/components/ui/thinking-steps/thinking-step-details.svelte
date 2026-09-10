<script lang="ts">
  import type { Snippet } from "svelte";
  import ThinkingSteps from "./thinking-steps.svelte";
  import ThinkingStepsContent from "./thinking-steps-content.svelte";
  import ThinkingStepsHeader from "./thinking-steps-header.svelte";

  let {
    summary,
    details,
    defaultOpen = false,
    open,
    onOpenChange,
    children,
    class: className = "",
  }: {
    summary: string;
    details?: string[];
    defaultOpen?: boolean;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children?: Snippet;
    class?: string;
  } = $props();
</script>

<ThinkingSteps class={className} {defaultOpen} {onOpenChange} {open}>
  <ThinkingStepsHeader>{summary}</ThinkingStepsHeader>
  <ThinkingStepsContent>
    {#each details ?? [] as detail, i (i)}
      <div>{detail}</div>
    {/each}
    {@render children?.()}
  </ThinkingStepsContent>
</ThinkingSteps>
