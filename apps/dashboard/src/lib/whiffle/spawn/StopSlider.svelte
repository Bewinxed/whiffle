<script lang="ts">
  import { prefersReducedMotion, Spring } from "svelte/motion";
  import { fade } from "svelte/transition";
  import { type SpringSpec, springFromVisual } from "./motion";

  let {
    stops,
    value,
    readout,
    onchange,
    spring = { visualDuration: 0.22, bounce: 0 },
    id,
    "aria-label": label = "Effort",
  }: {
    stops: { value: string; label: string; reachable: boolean }[];
    value: string | null;
    readout: string;
    onchange: (value: string | null) => void;
    spring?: SpringSpec;
    id?: string;
    "aria-label"?: string;
  } = $props();
  // biome-ignore lint/style/noNonNullAssertion: bind:this assigns the element before effects and event handlers run.
  let slider = $state<HTMLDivElement>(null!);
  let dragging = $state(false);
  let dragX = $state(0);
  let started = 0;
  let moved = $state(false);
  let fadeMs = $state(100);
  const position = new Spring(0);
  const appearance = new Spring(
    0,
    springFromVisual({ visualDuration: 0.18, bounce: 0 })
  );
  const isSet = $derived(value !== null);
  $effect(() => {
    if (isSet) {
      appearance.set(0, { instant: true });
      appearance.set(1, { instant: prefersReducedMotion.current });
    }
  });
  const index = $derived(stops.findIndex((stop) => stop.value === value));
  const reachable = $derived(
    stops.flatMap((stop, i) => (stop.reachable ? [i] : []))
  );
  const x = $derived(dragging && moved ? dragX : position.current);
  $effect(() => {
    Object.assign(position, springFromVisual(spring));
    if (!dragging && index >= 0) {
      position.set((index / (stops.length - 1)) * 100, {
        instant: prefersReducedMotion.current,
      });
    }
  });
  $effect(() => {
    fadeMs = Number.parseFloat(
      getComputedStyle(slider).getPropertyValue("--c-100")
    );
  });
  function nearest(event: PointerEvent) {
    const rect = slider.getBoundingClientRect();
    const percent = Math.max(
      0,
      Math.min(100, ((event.clientX - rect.left - 7) / (rect.width - 14)) * 100)
    );
    const nearestIndex = reachable.reduce(
      (best, i) =>
        Math.abs((i / (stops.length - 1)) * 100 - percent) <
        Math.abs((best / (stops.length - 1)) * 100 - percent)
          ? i
          : best,
      reachable[0]
    );
    return { percent, index: nearestIndex };
  }
  function down(event: PointerEvent) {
    if (event.button !== 0 || !reachable.length) {
      return;
    }
    event.preventDefault();
    slider.focus();
    slider.setPointerCapture(event.pointerId);
    started = event.clientX;
    moved = false;
    dragging = true;
    const next = nearest(event);
    dragX = next.percent;
    position.set((next.index / (stops.length - 1)) * 100, {
      instant: prefersReducedMotion.current,
    });
    onchange(stops[next.index].value);
  }
  function move(event: PointerEvent) {
    if (!dragging) {
      return;
    }
    if (Math.abs(event.clientX - started) > 3) {
      moved = true;
    }
    const next = nearest(event);
    dragX = next.percent;
    if (moved) {
      position.set(dragX, { instant: true });
      onchange(stops[next.index].value);
    }
  }
  function up(event: PointerEvent) {
    if (!dragging) {
      return;
    }
    const next = nearest(event);
    dragging = false;
    position.set((next.index / (stops.length - 1)) * 100, {
      instant: prefersReducedMotion.current,
    });
    onchange(stops[next.index].value);
    if (slider.hasPointerCapture(event.pointerId)) {
      slider.releasePointerCapture(event.pointerId);
    }
  }
  function keydown(event: KeyboardEvent) {
    let next: number | undefined;
    if (event.key === "Backspace") {
      event.preventDefault();
      onchange(null);
      return;
    }
    if (event.key === "Home") {
      [next] = reachable;
    } else if (event.key === "End") {
      next = reachable.at(-1);
    } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      next = reachable.find((i) => i > index) ?? reachable.at(-1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      next = reachable.findLast((i) => i < index) ?? reachable[0];
    }
    if (next === undefined) {
      return;
    }
    event.preventDefault();
    onchange(stops[next].value);
  }
</script>

<div class="effort">
  <div
    aria-disabled={!reachable.length}
    aria-label={label}
    aria-valuemax={stops.length - 1}
    aria-valuemin="0"
    aria-valuenow={index < 0 ? undefined : index}
    aria-valuetext={readout}
    class="slider"
    {id}
    onkeydown={keydown}
    onpointercancel={() => { dragging = false; }}
    onpointerdown={down}
    onpointermove={move}
    onpointerup={up}
    role="slider"
    tabindex="0"
    bind:this={slider}
  >
    <div class="rail">
      <span class="fill" style:width={value === null ? "0%" : `${x}%`}></span>
      {#each stops as stop, i (stop.value)}
        <span
          class="tick"
          style:left={`${i / (stops.length - 1) * 100}%`}
          class:first={i === 0}
          class:last={i === stops.length - 1}
          class:reachable={stop.reachable}
          ><span class="caption">{stop.label}</span></span
        >
      {/each}
      <span class="thumb" style:left={`${x}%`} class:visible={value !== null}
        ><span
          class="knob"
          style:transform={`scale(${appearance.current})`}
        ></span></span
      >
    </div>
  </div>
  <div class="reading">
    <span class="readout"
      >{#key readout}
        <span
          transition:fade={{ duration: prefersReducedMotion.current ? 1 : fadeMs }}
          >{readout}</span
        >
      {/key}</span
    ><button
      aria-hidden={value === null}
      onclick={() => onchange(null)}
      tabindex={value === null ? -1 : 0}
      type="button"
      class:unset={value === null}
    >
      Reset
    </button>
  </div>
</div>

<style>
  .effort {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    min-width: 0;
  }
  .slider {
    position: relative;
    flex: 1;
    min-width: 120px;
    height: 34px;
    touch-action: none;
    cursor: pointer;
    border-radius: var(--radius-well);
  }
  .rail {
    position: absolute;
    left: 7px;
    right: 7px;
    top: 10px;
    height: 2px;
    background: var(--border-control);
  }
  .fill {
    position: absolute;
    height: 2px;
    background: var(--ink-body);
  }
  .tick {
    position: absolute;
    top: 1px;
    width: 6px;
    height: 6px;
    border: 1px solid var(--ink-body);
    border-radius: var(--radius-pill);
    background: var(--surface-raised);
    transform: translate(-50%, -50%);
  }
  .tick.reachable {
    background: var(--ink-body);
  }
  .caption {
    position: absolute;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    color: var(--ink-muted);
    font: 400 var(--text-xs) / var(--leading-ui) var(--font-body);
  }
  .tick.first .caption {
    transform: none;
    left: -3px;
  }
  .tick.last .caption {
    transform: translateX(-100%);
  }
  .thumb {
    position: absolute;
    top: 1px;
    width: 14px;
    height: 14px;
    transform: translate(-50%, -50%) scale(0);
    transition: transform var(--c-100) var(--e-out);
  }
  .thumb.visible {
    transform: translate(-50%, -50%) scale(1);
    transition: none;
  }
  .knob {
    display: block;
    width: 100%;
    height: 100%;
    border: 2px solid var(--brand-solid);
    border-radius: var(--radius-pill);
    background: var(--surface-raised);
  }
  .reading {
    display: flex;
    align-items: center;
    min-width: 0;
    gap: var(--space-2);
    color: var(--ink-muted);
    font: 400 var(--text-sm) / var(--leading-ui) var(--font-body);
    font-variant-numeric: tabular-nums;
  }
  .readout {
    display: grid;
    align-items: center;
  }
  .readout > span {
    grid-area: 1 / 1;
  }
  button {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 28px;
    flex-shrink: 0;
    padding: 0 var(--space-1);
    border: 0;
    border-radius: var(--radius-well);
    background: transparent;
    color: var(--ink-body);
    font: inherit;
    cursor: pointer;
  }
  .unset {
    visibility: hidden;
  }
  button:active {
    background: var(--surface-active);
    box-shadow: var(--shadow-inset-sel);
  }
  button:focus-visible,
  .slider:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
  .slider[aria-disabled="true"] {
    cursor: default;
  }
  @media (hover: hover) {
    button:hover {
      background: var(--surface-hover);
    }
  }
  @media (pointer: coarse) {
    .slider,
    button {
      min-height: 44px;
      min-width: 44px;
    }
  }
</style>
