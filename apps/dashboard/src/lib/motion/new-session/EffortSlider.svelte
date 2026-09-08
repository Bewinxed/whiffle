<script lang="ts">
  import { prefersReducedMotion, Spring } from "svelte/motion";
  import { springFromVisual } from "./spring";

  let {
    value = $bindable(2),
    spring,
  }: { value?: number; spring: { visualDuration?: number; bounce?: number } } =
    $props();
  const labels = ["Low", "Medium", "High", "Max"];
  const thumb = new Spring(2 / 3);
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
      thumb.set(value / 3, { instant: prefersReducedMotion.current });
    }
  });
  function position(event: PointerEvent) {
    const rect = track.getBoundingClientRect();
    return Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  }
  // A press springs the thumb to the nearest detent; only a real drag follows the pointer.
  function press(event: PointerEvent) {
    value = Math.round(position(event) * 3);
  }
  function drag(event: PointerEvent) {
    const at = position(event);
    thumb.set(at, { instant: true });
    value = Math.round(at * 3);
  }
  function keydown(event: KeyboardEvent) {
    const delta = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[
      event.key
    ];
    if (delta === undefined && event.key !== "Home" && event.key !== "End") {
      return;
    }
    event.preventDefault();
    value = Math.max(0, Math.min(3, value + (delta ?? 0)));
    if (event.key === "Home") {
      value = 0;
    }
    if (event.key === "End") {
      value = 3;
    }
  }
</script>

<div
  aria-label="Effort"
  aria-valuemax="3"
  aria-valuemin="0"
  aria-valuenow={value}
  aria-valuetext={labels[value]}
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
    {#each labels as label, i (label)}
      <span class="detent" style:left="{i / 3 * 100}%"></span>
    {/each}
    <span class="thumb" style:left="{thumb.current * 100}%"></span>
  </div>
  <div class="labels">
    {#each labels as label, i (label)}
      <span class:active={i === value}>{label}</span>
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
  .active {
    color: var(--ink-strong);
    font-weight: var(--weight-strong);
  }
</style>
