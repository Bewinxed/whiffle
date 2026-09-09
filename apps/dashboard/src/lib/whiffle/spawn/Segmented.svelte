<script generics="T extends string" lang="ts">
  import { type Snippet, untrack } from "svelte";
  import { prefersReducedMotion, Spring } from "svelte/motion";
  import { type SpringSpec, springFromVisual } from "./motion";

  let {
    options,
    value,
    onchange,
    spring = { visualDuration: 0.26, bounce: 0 },
    id,
    "aria-label": label,
  }: {
    options: {
      value: T;
      label: string;
      mark?: Snippet;
      disabled?: boolean;
      reason?: string;
      tone?: "neutral" | "attn";
    }[];
    value: T;
    onchange: (value: T) => void;
    spring?: SpringSpec;
    id?: string;
    "aria-label"?: string;
  } = $props();
  const uid = $props.id();
  // biome-ignore lint/style/noNonNullAssertion: bind:this assigns the element before effects and event handlers run.
  let track = $state<HTMLDivElement>(null!);
  const thumb = new Spring({ x: 0, y: 0, width: 0, height: 0 });
  let painted = false;
  const selected = $derived(
    options.findIndex((option) => option.value === value)
  );
  const tab = $derived(
    selected >= 0 && !options[selected].disabled
      ? selected
      : options.findIndex((option) => !option.disabled)
  );
  function measure(
    selection = selected,
    reduced = prefersReducedMotion.current
  ) {
    const option = track?.querySelector<HTMLButtonElement>(
      `[data-index="${selection}"]`
    );
    if (!option) {
      return;
    }
    thumb.set(
      {
        x: option.offsetLeft,
        y: option.offsetTop,
        width: option.offsetWidth,
        height: option.offsetHeight,
      },
      { instant: !painted || reduced }
    );
    painted = true;
  }
  $effect(() => {
    Object.assign(thumb, springFromVisual(spring));
    const selection = selected;
    const reduced = prefersReducedMotion.current;
    untrack(() => measure(selection, reduced));
  });
  $effect(() => {
    const observer = new ResizeObserver(() => measure());
    observer.observe(track);
    for (const button of track.querySelectorAll("button")) {
      observer.observe(button);
    }
    return () => observer.disconnect();
  });
  function keydown(event: KeyboardEvent, index: number) {
    const enabled = options.flatMap((option, i) =>
      option.disabled ? [] : [i]
    );
    let next: number | undefined;
    const at = enabled.indexOf(index);
    if (event.key === "Home") {
      [next] = enabled;
    } else if (event.key === "End") {
      next = enabled.at(-1);
    } else if (event.key === "ArrowRight") {
      next = enabled[(at + 1) % enabled.length];
    } else if (event.key === "ArrowLeft") {
      next = enabled[(at - 1 + enabled.length) % enabled.length];
    }
    if (next === undefined) {
      return;
    }
    event.preventDefault();
    onchange(options[next].value);
    track.querySelector<HTMLButtonElement>(`[data-index="${next}"]`)?.focus();
  }
</script>

<div aria-label={label} class="track" {id} role="radiogroup" bind:this={track}>
  <span
    aria-hidden="true"
    class="thumb"
    style:height={`${thumb.current.height}px`}
    style:left={`${thumb.current.x}px`}
    style:top={`${thumb.current.y}px`}
    style:width={`${thumb.current.width}px`}
    class:attn={options[selected]?.tone === "attn"}
  ></span>
  {#each options as option, i (option.value)}
    <!-- biome-ignore lint/a11y/useSemanticElements: snippet-bearing radio buttons implement the specified roving radio interaction. -->
    <button
      aria-checked={value === option.value}
      aria-describedby={option.reason ? `${uid}-${i}` : undefined}
      data-index={i}
      disabled={option.disabled}
      onclick={() => onchange(option.value)}
      onkeydown={(event) => keydown(event, i)}
      role="radio"
      tabindex={i === tab ? 0 : -1}
      type="button"
      class:attn={value === option.value && option.tone === "attn"}
      class:marked={!!option.mark}
    >
      {#if option.mark}
        <span class="mark">{@render option.mark()}</span>
      {/if}
      {option.label}
    </button>
    {#if option.reason}
      <span class="reason" id={`${uid}-${i}`}>{option.reason}</span>
    {/if}
  {/each}
</div>

<style>
  .track {
    position: relative;
    display: flex;
    align-items: center;
    padding: 2px;
    border: 1px solid var(--border-control);
    border-radius: var(--radius-well);
    background: var(--surface-field);
  }
  .thumb {
    position: absolute;
    pointer-events: none;
    border-radius: calc(var(--radius-well) - 2px);
    background: var(--surface-raised);
    box-shadow: var(--shadow-tile);
    transition: background var(--c-300) var(--e-in);
  }
  .thumb.attn {
    background: var(--status-attn-bg);
  }
  button {
    position: relative;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 28px;
    padding: 0 12px;
    border: 0;
    border-radius: calc(var(--radius-well) - 2px);
    background: transparent;
    color: var(--ink-body);
    font: 400 var(--text-base) / var(--leading-ui) var(--font-body);
    white-space: nowrap;
    cursor: pointer;
    transition: color var(--c-100) var(--e-toggle);
  }
  button.marked {
    padding-left: 11px;
  }
  button[aria-checked="true"] {
    color: var(--ink-strong);
    font-weight: 450;
  }
  button.attn {
    color: var(--status-attn-ink);
  }
  .mark {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    height: 14px;
  }
  button:active:not(:disabled) {
    background: var(--surface-active);
    box-shadow: var(--shadow-inset-sel);
  }
  button:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
  button:disabled {
    color: var(--ink-muted);
    opacity: 0.55;
    cursor: default;
  }
  .reason {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  @media (hover: hover) {
    button:hover:not(:disabled):not([aria-checked="true"]) {
      background: var(--surface-hover);
    }
  }
  @media (pointer: coarse) {
    button {
      min-height: 44px;
      min-width: 44px;
    }
  }
  @media (max-width: 479px) {
    .track:has(button:nth-of-type(4)) {
      display: grid;
      grid-template-columns: 1fr 1fr;
    }
  }
</style>
