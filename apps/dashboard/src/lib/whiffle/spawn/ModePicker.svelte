<script lang="ts">
  import type { PermissionMode } from "@whiffle/core";
  import { RadioGroup } from "bits-ui";
  import { untrack } from "svelte";
  import { prefersReducedMotion, Spring } from "svelte/motion";
  import { MediaQuery } from "svelte/reactivity";
  import Notes from "~icons/solar/notes-linear";
  import Pen from "~icons/solar/pen-linear";
  import Shield from "~icons/solar/shield-check-linear";
  import Warning from "~icons/solar/shield-warning-linear";
  import { type SpringSpec, springFromVisual } from "./motion";

  let {
    value,
    modes,
    onselect,
    spring,
    stagger,
  }: {
    value: PermissionMode;
    modes: {
      value: PermissionMode;
      label: string;
      disabled: boolean;
      reason?: string;
    }[];
    onselect: (value: PermissionMode) => void;
    spring: SpringSpec;
    stagger: number;
  } = $props();
  const icons = [Shield, Notes, Pen, Warning];
  let active = $state(
    untrack(() => modes.findIndex((mode) => mode.value === value))
  );
  const mobile = new MediaQuery("(max-width: 600px)");
  const rowHeight = $derived(mobile.current ? 44 : 40);
  const highlight = new Spring(untrack(() => active * rowHeight));
  $effect(() => {
    Object.assign(highlight, springFromVisual(spring));
    highlight.set(active * rowHeight, {
      instant: prefersReducedMotion.current,
    });
  });
</script>

<div class="mode-list">
  <div
    class="highlight"
    style:background={modes[active].value === value ? "transparent" : "var(--surface-hover)"}
    style:transform={`translateY(${highlight.current}px)`}
  ></div>
  <RadioGroup.Root
    aria-label="Permission mode"
    onValueChange={(value) => onselect(value as PermissionMode)}
    {value}
  >
    {#each modes as mode, index (mode.value)}
      {@const Icon = icons[index]}
      <RadioGroup.Item
        class="mode-row"
        data-active={active === index}
        disabled={mode.disabled}
        onfocus={() => { active = index; }}
        onpointermove={() => { if (!mode.disabled) { active = index; } }}
        style={`--delay:${prefersReducedMotion.current ? 0 : index * stagger}s`}
        title={mode.reason}
        value={mode.value}
      >
        <Icon />{mode.label}
      </RadioGroup.Item>
    {/each}
  </RadioGroup.Root>
</div>

<style>
  .mode-list {
    position: relative;
  }
  .highlight {
    position: absolute;
    inset: 0 0 auto;
    height: 40px;
    border-radius: var(--radius-control);
    background: var(--surface-hover);
    pointer-events: none;
    animation: appear var(--c-100) var(--e-in) both;
  }
  :global(.mode-row) {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    height: 40px;
    padding-inline: var(--space-3);
    border: 0;
    border-radius: var(--radius-control);
    color: var(--ink-strong);
    background: transparent;
    font: inherit;
    animation: appear var(--c-300) var(--e-out) var(--delay) both;
  }
  :global(.mode-row[data-state="checked"]) {
    background: color-mix(in oklab, var(--brand-solid) 12%, transparent);
    color: var(--ink-strong);
  }
  :global(.mode-row:disabled) {
    opacity: 0.55;
  }
  :global(.mode-row svg) {
    width: 16px;
    height: 16px;
  }
  @keyframes appear {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .highlight,
    :global(.mode-row) {
      animation-duration: 1ms;
      animation-delay: 0s;
    }
  }
  @media (max-width: 600px) {
    .highlight,
    :global(.mode-row) {
      height: 44px;
    }
  }
</style>
