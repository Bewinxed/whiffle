<script lang="ts">
  import { prefersReducedMotion, Spring } from "svelte/motion";
  import IconMedium from "~icons/solar/bolt-linear";
  import IconHigh from "~icons/solar/fire-linear";
  import IconLow from "~icons/solar/leaf-linear";
  import IconMax from "~icons/solar/rocket-2-linear";
  import { springFromVisual } from "./spring";

  let {
    value = $bindable(2),
    spring,
  }: { value?: number; spring: { visualDuration?: number; bounce?: number } } =
    $props();
  const detents = [
    { label: "Low", icon: IconLow },
    { label: "Medium", icon: IconMedium },
    { label: "High", icon: IconHigh },
    { label: "Max", icon: IconMax },
  ];
  const last = detents.length - 1;
  const thumb = new Spring(2 / last);
  let dragging = $state(false);
  // biome-ignore lint/suspicious/noUnassignedVariables: assigned by Svelte bind:this
  let track: HTMLDivElement;
  $effect(() => {
    const config = springFromVisual(
      spring.visualDuration ?? 0.3,
      spring.bounce ?? 0.25
    );
    thumb.stiffness = config.stiffness;
    thumb.damping = config.damping;
  });
  $effect(() => {
    if (!dragging) {
      thumb.set(value / last, { instant: prefersReducedMotion.current });
    }
  });
  function position(event: PointerEvent) {
    const rect = track.getBoundingClientRect();
    return Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  }
  // A press springs the thumb to the nearest detent; only a real drag follows the pointer.
  function press(event: PointerEvent) {
    value = Math.round(position(event) * last);
  }
  function drag(event: PointerEvent) {
    const at = position(event);
    thumb.set(at, { instant: true });
    value = Math.round(at * last);
  }
  function keydown(event: KeyboardEvent) {
    const delta = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[
      event.key
    ];
    if (delta === undefined && event.key !== "Home" && event.key !== "End") {
      return;
    }
    event.preventDefault();
    value = Math.max(0, Math.min(last, value + (delta ?? 0)));
    if (event.key === "Home") {
      value = 0;
    }
    if (event.key === "End") {
      value = last;
    }
  }
</script>

<div
  aria-label="Effort"
  aria-valuemax={last}
  aria-valuemin="0"
  aria-valuenow={value}
  aria-valuetext={detents[value].label}
  class="slider"
  onkeydown={keydown}
  onpointercancel={() => { dragging = false; }}
  onpointerdown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); event.currentTarget.focus(); press(event); }}
  onpointermove={(event) => { if (event.buttons === 1) { dragging = true; drag(event); } }}
  onpointerup={() => { dragging = false; }}
  role="slider"
  tabindex="0"
>
  <div class="track" bind:this={track}>
    <div class="fill" style:width="{thumb.current * 100}%"></div>
    {#each detents as detent, i (detent.label)}
      <span class="detent" style:left="{(i / last) * 100}%"></span>
    {/each}
    <span class="thumb" style:left="{thumb.current * 100}%"></span>
  </div>
  <div class="labels">
    {#each detents as detent, i (detent.label)}
      <span class="label" class:active={i === value}
        ><detent.icon /><span>{detent.label}</span></span
      >
    {/each}
  </div>
</div>

<style>
  .slider {
    padding: var(--space-4) var(--space-3) var(--space-1);
    cursor: pointer;
    touch-action: none;
    border-radius: var(--radius-control);
  }
  .slider:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
  .track {
    position: relative;
    height: 4px;
    background: var(--border-control);
    border-radius: var(--radius-pill);
  }
  .fill {
    position: absolute;
    height: 100%;
    background: var(--ink-strong);
    border-radius: inherit;
  }
  .detent {
    position: absolute;
    width: 4px;
    height: 4px;
    background: var(--ink-muted);
    border-radius: var(--radius-pill);
    transform: translateX(-50%);
  }
  .thumb {
    position: absolute;
    top: 50%;
    width: 18px;
    height: 18px;
    border: 1px solid var(--border-control);
    background: var(--surface-raised);
    border-radius: var(--radius-pill);
    box-shadow: var(--shadow-tile);
    transform: translate(-50%, -50%);
  }
  .labels {
    display: flex;
    justify-content: space-between;
    margin-top: var(--space-4);
    font-size: var(--text-sm);
    color: var(--ink-muted);
  }
  .label {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    transition:
      color var(--c-300) var(--e-out),
      font-weight var(--c-300) var(--e-out);
  }
  .label :global(svg) {
    width: 14px;
    height: 14px;
  }
  .active {
    color: var(--ink-strong);
    font-weight: var(--weight-strong);
  }
</style>
