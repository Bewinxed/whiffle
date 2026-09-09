<script lang="ts">
  import type { Snippet } from "svelte";
  import { prefersReducedMotion, Spring } from "svelte/motion";
  import { MediaQuery } from "svelte/reactivity";
  import {
    Popover,
    PopoverContent,
    PopoverTrigger,
  } from "$lib/components/ui/popover";
  import Back from "~icons/solar/alt-arrow-left-linear";
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
  const mobile = new MediaQuery("(max-width: 600px)");
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
      <div {...wrapperProps} class="composer-popover-shell">
        <div {...props} id={`${id}-popover`}>
          {#if mobile.current}
            <button
              class="panel-back"
              onclick={() => onchange(false)}
              type="button"
            >
              <Back />Back
            </button>
          {/if}
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
  @media (max-width: 600px) {
    .composer-popover-shell {
      position: fixed !important;
      top: var(--ns-viewport-top, 0px) !important;
      left: 0 !important;
      right: 0 !important;
      width: 100% !important;
      min-width: 0 !important;
      max-width: 100vw !important;
      height: var(--ns-viewport-height, 100dvh) !important;
      transform: none !important;
      z-index: 90 !important;
    }
    :global(.composer-popover) {
      width: 100%;
      min-width: 0;
      max-width: 100%;
      height: 100%;
      max-height: 100%;
      border-radius: 0;
      padding: calc(var(--space-2) + env(safe-area-inset-top)) 16px
        calc(var(--space-2) + env(safe-area-inset-bottom));
      scale: 1 !important;
      overflow-y: auto;
      overflow-x: hidden;
      transform-origin: bottom center;
    }
    .panel-back {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      height: 44px;
      min-height: 44px;
      align-self: flex-start;
      padding-inline: var(--space-2);
      border-radius: var(--radius-control);
      color: var(--ink-strong);
    }
    .panel-back :global(svg) {
      width: 20px;
      height: 20px;
    }
    .panel-back:focus-visible {
      outline: 2px solid var(--focus-ring);
    }
    :global(.composer-popover [role="combobox"]) {
      min-height: 44px;
    }
  }
</style>
