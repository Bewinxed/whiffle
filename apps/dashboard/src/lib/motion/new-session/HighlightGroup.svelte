<script generics="T extends Record<'value' | 'label', string>" lang="ts">
  import type { Snippet } from "svelte";
  import { prefersReducedMotion, Spring } from "svelte/motion";
  import { fly } from "svelte/transition";
  import { springFromVisual } from "./spring";

  let {
    items,
    value,
    onchange,
    orientation = "horizontal",
    spring,
    children,
    label,
    inset = 3,
    radius = 12,
    progress = 1,
    stagger = 0.06,
    duration = 0.45,
    entering = false,
  }: {
    items: T[];
    value: string;
    onchange: (value: string) => void;
    orientation?: "horizontal" | "vertical";
    spring: { visualDuration?: number; bounce?: number };
    children: Snippet<[T]>;
    label: string;
    inset?: number;
    radius?: number;
    progress?: number;
    stagger?: number;
    duration?: number;
    entering?: boolean;
  } = $props();
  // biome-ignore lint/suspicious/noUnassignedVariables: assigned by Svelte bind:this
  let group: HTMLDivElement;
  let buttons = $state<HTMLButtonElement[]>([]);
  const highlight = new Spring({ x: 0, y: 0, width: 0, height: 0 });
  let measured = false;
  let selected = $derived(items.findIndex((item) => item.value === value));

  $effect(() => {
    const config = springFromVisual(
      spring.visualDuration ?? 0.35,
      spring.bounce ?? 0.15
    );
    highlight.stiffness = config.stiffness;
    highlight.damping = config.damping;
  });
  $effect(() => {
    const button = buttons[selected];
    const pad = inset;
    if (!button) {
      return;
    }
    const measure = () => {
      highlight.set(
        {
          x: button.offsetLeft + pad,
          y: button.offsetTop + pad,
          width: button.offsetWidth - pad * 2,
          height: button.offsetHeight - pad * 2,
        },
        { instant: !measured || prefersReducedMotion.current }
      );
      measured = true;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(group);
    observer.observe(button);
    return () => observer.disconnect();
  });
  function keydown(event: KeyboardEvent, index: number) {
    const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[
      event.key
    ];
    if (delta === undefined && event.key !== "Home" && event.key !== "End") {
      return;
    }
    event.preventDefault();
    let next = (index + (delta ?? 0) + items.length) % items.length;
    if (event.key === "Home") {
      next = 0;
    }
    if (event.key === "End") {
      next = items.length - 1;
    }
    onchange(items[next].value);
    buttons[next].focus();
  }
  function itemProgress(index: number) {
    return Math.max(
      0,
      Math.min(
        1,
        (progress * (duration + (items.length - 1) * stagger) -
          index * stagger) /
          duration
      )
    );
  }
</script>

<div
  aria-label={label}
  aria-orientation={orientation}
  class="group"
  role="radiogroup"
  bind:this={group}
  class:vertical={orientation === 'vertical'}
>
  <span
    aria-hidden="true"
    class="highlight"
    style="opacity: {selected < 0 ? 0 : progress}; transform: translate({highlight.current.x}px, {highlight.current.y}px); width: {highlight.current.width}px; height: {highlight.current.height}px; border-radius: {radius}px;"
  ></span>
  {#each items as item, i (item.value)}
    <!-- biome-ignore lint/a11y/useSemanticElements: rich snippet content with roving radio keyboard behavior -->
    <button
      aria-checked={value === item.value}
      onclick={() => onchange(item.value)}
      onkeydown={(event) => keydown(event, i)}
      role="radio"
      style="opacity: {itemProgress(i)}; transform: translateY({(1 - itemProgress(i)) * 12}px);"
      tabindex={value === item.value || (selected < 0 && i === 0) ? 0 : -1}
      type="button"
      bind:this={buttons[i]}
      in:fly={{ y: 8, duration: entering && !prefersReducedMotion.current ? duration * 1000 : 0, delay: entering ? i * stagger * 1000 : 0 }}
    >
      {@render children(item)}
    </button>
  {/each}
</div>

<style>
  .group {
    position: relative;
    display: flex;
    background: var(--surface-field);
    border: 1px solid var(--border-control);
    border-radius: var(--radius-modal);
    isolation: isolate;
  }
  .vertical {
    flex-direction: column;
  }
  .highlight {
    position: absolute;
    top: 0;
    left: 0;
    background: var(--surface-raised);
    box-shadow: var(--shadow-tile);
    pointer-events: none;
    z-index: -1;
  }
  button {
    flex: 1;
    min-width: 0;
    min-height: 44px;
    padding: var(--space-3);
    color: var(--ink-muted);
    background: transparent;
    border: 0;
    border-radius: var(--radius-control);
    text-align: left;
    font-size: var(--text-sm);
    cursor: pointer;
    overflow-wrap: anywhere;
  }
  button[aria-checked="true"] {
    color: var(--ink-strong);
  }
  button:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: -2px;
  }
  @media (hover: hover) {
    button:hover {
      color: var(--ink-strong);
    }
  }
</style>
