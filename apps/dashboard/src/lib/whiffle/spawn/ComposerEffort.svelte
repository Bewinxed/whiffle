<script lang="ts">
  import type { EffortLevel, HarnessKind } from "@whiffle/core";
  import { Slider } from "bits-ui";
  import { untrack } from "svelte";
  import { prefersReducedMotion, Spring } from "svelte/motion";
  import BoltFilled from "~icons/solar/bolt-bold";
  import Bolt from "~icons/solar/bolt-linear";
  import FireFilled from "~icons/solar/fire-bold";
  import Fire from "~icons/solar/fire-linear";
  import FlameFilled from "~icons/solar/flame-bold";
  import Flame from "~icons/solar/flame-linear";
  import LeafFilled from "~icons/solar/leaf-bold";
  import Leaf from "~icons/solar/leaf-linear";
  import RocketFilled from "~icons/solar/rocket-2-bold";
  import Rocket from "~icons/solar/rocket-2-linear";
  import type { EffortStop } from "../effort-levels";
  import { type SpringSpec, springFromVisual } from "./motion";

  let {
    value,
    harness,
    stops,
    spring,
    onchange,
  }: {
    value: EffortLevel | null;
    harness: HarnessKind;
    stops: EffortStop[];
    spring: SpringSpec;
    onchange: (value: EffortLevel | null) => void;
  } = $props();
  const icons = [Leaf, Bolt, Fire, Flame, Rocket];
  const filled = [
    LeafFilled,
    BoltFilled,
    FireFilled,
    FlameFilled,
    RocketFilled,
  ];
  // effort-levels.ts documents Claude Code's xhigh and the API's high defaults.
  const defaultIndex = $derived(
    harness === "claude" && stops[3].reachable ? 3 : 2
  );
  const index = $derived(
    value === null
      ? defaultIndex
      : stops.findIndex((stop) => stop.value === value)
  );
  const x = new Spring(untrack(() => index));
  let hovered = $state<number | null>(null);
  let dragging = $state(false);
  $effect(() => {
    Object.assign(x, springFromVisual(spring));
    x.set(index, { instant: prefersReducedMotion.current });
  });
  function choose(next: number) {
    const stop = stops[next];
    if (stop.reachable) {
      onchange(stop.value);
    }
  }
  function pointerIndex(event: PointerEvent) {
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    return Math.max(
      0,
      Math.min(
        4,
        Math.round(((event.clientX - box.left - 9) / (box.width - 18)) * 4)
      )
    );
  }
</script>

<div class="effort" onpointerleave={() => { hovered = null; }}>
  <Slider.Root
    aria-label="Effort"
    class="effort-slider"
    max={4}
    min={0}
    onkeydown={(event) => { if (event.key === 'Backspace') { onchange(null); } }}
    onpointercancel={() => { dragging = false; }}
    onpointerdown={(event) => { dragging = true; choose(pointerIndex(event)); }}
    onpointermove={(event) => { hovered = pointerIndex(event); }}
    onpointerup={() => { dragging = false; }}
    onValueChange={choose}
    onValueCommit={() => { dragging = false; }}
    step={1}
    type="single"
    value={index}
  >
    <div class="track"></div>
    <div aria-hidden="true" class="detents">
      {#each stops as stop, i (stop.value)}
        {@const Icon = icons[i]}
        <span
          class="detent"
          data-effort={stop.value}
          onpointerenter={() => { hovered = i; }}
          class:current={i === index}
          ><Icon viewBox="2 2 20 20" /></span
        >
      {/each}
    </div>
    <Slider.Thumb
      aria-label="Effort"
      aria-valuetext={value ?? `${stops[index].label} (harness default)`}
      class="effort-native-thumb"
      index={0}
    />
    {@const ActiveIcon = filled[index]}
    <span
      aria-hidden="true"
      class="effort-thumb"
      style:left={`calc(9px + (100% - 18px) * ${x.current / 4})`}
      class:default-value={value === null}
      ><ActiveIcon viewBox="2 2 20 20" /></span
    >
  </Slider.Root>
  {#if hovered !== null || dragging}
    <span class="effort-tooltip" role="tooltip"
      >{stops[hovered ?? index].label}</span
    >
  {/if}
</div>

<style>
  .effort {
    position: relative;
    width: 150px;
    height: 40px;
    flex: none;
  }
  :global(.effort-slider) {
    position: relative;
    display: flex;
    align-items: center;
    height: 100%;
    touch-action: none;
  }
  .track {
    position: absolute;
    inset-inline: var(--space-2);
    height: 4px;
    border-radius: var(--radius-pill);
    background: var(--border-control);
  }
  .detents {
    position: absolute;
    inset-inline: 1px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .detent {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 18px;
    color: var(--ink-muted);
    background: var(--surface-raised);
  }
  .detent :global(svg),
  .effort-thumb :global(svg) {
    width: 16px;
    height: 16px;
    flex: none;
    overflow: visible;
  }
  .detent :global([stroke-width]) {
    stroke-width: 2;
  }
  .detent.current :global(svg) {
    opacity: 0;
  }
  :global(.effort-native-thumb) {
    width: 18px;
    height: 18px;
    opacity: 0;
    z-index: 2;
  }
  .effort-thumb {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    transform: translateX(-50%);
    color: var(--brand-solid);
    background: var(--surface-raised);
    border-radius: var(--radius-pill);
    pointer-events: none;
  }
  .effort:has(:focus-visible) {
    outline: 2px solid var(--focus-ring);
    border-radius: var(--radius-control);
  }
  .effort-thumb.default-value {
    color: var(--ink-muted);
  }
  .effort-tooltip {
    position: absolute;
    left: 50%;
    bottom: 100%;
    transform: translateX(-50%);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-control);
    background: var(--surface-overlay);
    box-shadow: var(--shadow-overlay);
    color: var(--ink-strong);
    font-size: var(--text-sm);
  }
</style>
