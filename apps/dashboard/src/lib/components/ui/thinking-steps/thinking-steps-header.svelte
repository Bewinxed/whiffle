<script lang="ts">
  import { Collapsible } from "bits-ui";
  import type { Snippet } from "svelte";
  import { IconChevronRight } from "$lib/icons";

  let {
    children,
    after,
    class: className = "",
    ...rest
  }: Collapsible.TriggerProps & {
    /** What reads on past the chevron, on the same line. */
    after?: Snippet;
  } = $props();
</script>

<Collapsible.Trigger
  {...rest}
  class="thinking-header {className}"
  data-slot="thinking-steps-header"
>
  {#if children}
    {@render children()}
  {:else}
    Thinking
  {/if}
  <span aria-hidden="true" class="chevron"><IconChevronRight /></span>
  {@render after?.()}
</Collapsible.Trigger>

<style>
  :global(.thinking-header) {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 26px;
    max-width: 100%;
    margin: 0;
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }
  :global(.thinking-header:disabled) {
    cursor: default;
  }
  :global(.thinking-header:hover:not(:disabled)) {
    color: var(--ink-strong);
  }
  :global(.thinking-header:focus-visible) {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
    border-radius: var(--radius-xs);
  }
  .chevron {
    display: grid;
    flex: 0 0 auto;
    transition: transform var(--dur-control) var(--ease-out);
  }
  .chevron :global(svg) {
    width: 14px;
    height: 14px;
  }
  :global(.thinking-header[data-state="open"]) .chevron {
    transform: rotate(90deg);
  }
  @media (pointer: coarse) {
    :global(.thinking-header:not(:disabled)) {
      min-height: 44px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .chevron {
      transition: none;
    }
  }
  :global(.thinking-header:disabled) .chevron {
    visibility: hidden;
  }
</style>
