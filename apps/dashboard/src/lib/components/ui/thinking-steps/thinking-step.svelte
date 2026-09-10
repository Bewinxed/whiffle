<script lang="ts" module>
  export type StepStatus = "complete" | "active" | "pending";
</script>

<script lang="ts">
  import type { Component, Snippet } from "svelte";
  import { IconCheck, IconGlobe, IconSearch } from "$lib/icons";
  import Stream from "$lib/whiffle/motion/Stream.svelte";
  import { getSizeContext } from "../thinking-indicator/size-context";

  let {
    icon = "dot",
    showIcon = true,
    label = "",
    description,
    status = "complete",
    delay = 0.08,
    isLast = false,
    children,
    class: className = "",
  }: {
    icon?: "dot" | "search" | "globe" | "check" | Component;
    showIcon?: boolean;
    label?: string;
    description?: string;
    status?: StepStatus;
    delay?: number;
    isLast?: boolean;
    children?: Snippet;
    class?: string;
  } = $props();
  const size = getSizeContext();
  const icons = {
    dot: undefined,
    search: IconSearch,
    globe: IconGlobe,
    check: IconCheck,
  };
  const Icon = $derived(typeof icon === "string" ? icons[icon] : icon);
</script>

{#if status !== "pending"}
  <div
    class="step {className}"
    data-size={size?.() ?? "default"}
    data-slot="thinking-step"
    data-status={status}
    style:--step-delay={`${delay}s`}
  >
    <div aria-hidden="true" class="icon-column">
      <span class="icon"
        >{#if showIcon && Icon}
          <Icon />
        {:else}
          <span class="dot"></span>
        {/if}</span
      >
      {#if !isLast}
        <span class="connector"></span>
      {/if}
    </div>
    <div class="copy">
      {#if label}
        <span class="label" class:shimmer={status === "active"}
          ><Stream text={label} /></span
        >
      {/if}
      {#if description}
        <span class="description" class:shimmer={!label && status === "active"}
          ><Stream text={description} /></span
        >
      {/if}
      {@render children?.()}
    </div>
  </div>
{/if}

<style>
  .step {
    display: flex;
    gap: var(--space-2);
    min-width: 0;
    font-size: var(--text-sm);
    line-height: var(--leading-body);
  }
  .step[data-size="compact"] {
    font-size: var(--text-xs);
  }
  .icon-column {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 0 0 15px;
  }
  .icon {
    display: grid;
    place-items: center;
    width: 15px;
    height: 1lh;
    min-height: 15px;
  }
  .icon :global(svg) {
    width: 15px;
    height: 15px;
  }
  .dot {
    width: var(--space-1);
    height: var(--space-1);
    border-radius: 50%;
    background: currentColor;
  }
  .connector {
    width: 1px;
    flex: 1;
    background: var(--border-hairline);
  }
  .copy {
    min-width: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding-bottom: var(--space-2);
  }
  .label {
    color: var(--ink-body);
    font-weight: var(--weight-body);
  }
  .description {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  @media (prefers-reduced-motion: no-preference) {
    .copy {
      animation: step-in var(--c-200, 200ms) var(--e-in) var(--step-delay)
        backwards;
    }
    .shimmer {
      color: transparent;
      background: linear-gradient(
        90deg,
        var(--ink-muted) 0% 35%,
        var(--ink-body) 50%,
        var(--ink-muted) 65% 100%
      );
      background-size: 300% 100%;
      background-clip: text;
      animation: shimmer 1.5s ease-in-out infinite;
    }
  }
  @keyframes step-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  @keyframes shimmer {
    from {
      background-position: 0% 0;
    }
    to {
      background-position: 100% 0;
    }
  }
</style>
