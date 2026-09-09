<script lang="ts">
  import type { Snippet } from "svelte";
  import { prefersReducedMotion, Spring } from "svelte/motion";
  import {
    Popover,
    PopoverContent,
    PopoverTrigger,
  } from "$lib/components/ui/popover";
  import { type SpringSpec, springFromVisual } from "./motion";

  let {
    id,
    label,
    open,
    onchange,
    trigger,
    children,
    spring,
    anchor = $bindable(null),
    style,
    attention = false,
    width = 420,
    align = "start",
  }: {
    id: string;
    label: string;
    open: boolean;
    onchange: (open: boolean) => void;
    trigger: Snippet;
    children: Snippet;
    spring: SpringSpec;
    anchor?: HTMLButtonElement | null;
    style?: string;
    attention?: boolean;
    width?: number;
    align?: "start" | "end";
  } = $props();
  const progress = new Spring(0);
  $effect(() => {
    Object.assign(progress, springFromVisual(spring));
    if (open) {
      progress.set(0, { instant: true });
      progress.set(1, { instant: prefersReducedMotion.current });
    }
  });
</script>

<Popover onOpenChange={onchange} {open}>
  <PopoverTrigger
    aria-label={label}
    class="composer-pill"
    data-attention={attention}
    {id}
    {style}
    bind:ref={anchor}
  >
    {@render trigger()}
  </PopoverTrigger>
  <PopoverContent
    {align}
    class="composer-popover"
    collisionPadding={8}
    id={`${id}-popover`}
    side="top"
    sideOffset={7}
    style={`--popover-width:${width}px;opacity:${prefersReducedMotion.current ? 1 : progress.current};scale:${prefersReducedMotion.current ? 1 : .96 + .04 * progress.current}`}
    trapFocus
  >
    {#snippet child({ props, wrapperProps })}
      <div {...wrapperProps}>
        <div {...props} id={`${id}-popover`}>
          {@render children()}
        </div>
      </div>
    {/snippet}
  </PopoverContent>
</Popover>

<style>
  :global(.composer-pill) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 24px;
    height: 40px;
    gap: var(--space-2);
    padding-inline: var(--space-2);
    border: 0;
    border-radius: var(--radius-control);
    background: transparent;
    color: var(--ink-body);
    font: 400 var(--text-sm) / var(--leading-ui) var(--font-body);
    white-space: nowrap;
    cursor: pointer;
  }
  :global(.composer-pill > span:not(.harness-logo):not(.machine-dot)) {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  :global(.composer-pill svg) {
    width: 16px;
    height: 16px;
    flex: none;
  }
  :global(.composer-pill[data-state="open"]) {
    background: var(--surface-active);
  }
  :global(.composer-pill[data-attention="true"]) {
    background: var(--status-attn-bg);
    color: var(--status-attn-ink);
  }
  :global(.composer-pill:focus-visible) {
    outline: 2px solid var(--focus-ring);
    outline-offset: -2px;
  }
  :global(.composer-popover) {
    z-index: 90;
    width: min(var(--popover-width), calc(100vw - var(--space-5)));
    max-height: min(440px, var(--bits-popover-content-available-height));
    overflow: hidden;
    display: flex;
    gap: 0;
    padding: var(--space-2);
    border: 0;
    border-radius: var(--radius-modal);
    background: var(--surface-overlay);
    color: var(--ink-strong);
    box-shadow: var(--shadow-modal);
    font: 400 var(--text-base) / var(--leading-ui) var(--font-body);
    animation: none !important;
    transform-origin: var(--bits-popover-content-transform-origin, left bottom);
  }
  @media (hover: hover) {
    :global(.composer-pill:hover) {
      background: var(--surface-hover);
    }
  }
</style>
