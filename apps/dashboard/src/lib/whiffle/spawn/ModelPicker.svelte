<script lang="ts">
  import type { HarnessKind } from "@whiffle/core";
  import { tick, untrack } from "svelte";
  import { Spring } from "svelte/motion";
  import ProviderLogo from "$lib/components/features/ProviderLogo.svelte";
  import HarnessGlyph from "../HarnessGlyph.svelte";
  import {
    ensureModels,
    models,
    providerOf,
    refreshModels,
    rememberModel,
  } from "../models.svelte";
  import { reducedMotion } from "../motion.svelte";
  import {
    deriveModelEntries,
    groupModelEntries,
    isIdShaped,
    type ModelEntry,
    matchesQuery,
  } from "./model-entries";
  import { lastSpawnAt, lastUsedAt, type ModelUse } from "./modelUse.svelte";
  import SearchField from "./SearchField.svelte";

  let {
    harness,
    value,
    onselect,
    spring = { visualDuration: 0.22, bounce: 0 },
    stagger = 0.014,
    swapSpring = { visualDuration: 0.24, bounce: 0 },
    swapStagger = 0.018,
  }: {
    harness: HarnessKind;
    value: string;
    onselect: (id: string) => void;
    spring?: { visualDuration: number; bounce: number };
    stagger?: number;
    swapSpring?: { visualDuration: number; bounce: number };
    swapStagger?: number;
  } = $props();
  const uid = $props.id();
  const order: HarnessKind[] = ["claude", "opencode", "pi"];
  const labels = { claude: "Claude", opencode: "OpenCode", pi: "pi" };
  let shown = $state<HarnessKind>(untrack(() => harness));
  let query = $state("");
  let active = $state(0);
  let direction = $state(0);
  let leaving = $state(false);
  let refreshError = $state("");
  let list = $state<HTMLDivElement>();
  let height = $state(36);
  const highlight = new Spring(0);
  const catalog = $derived(models.forHarness(shown));
  const use = $derived.by<ModelUse>(() => ({
    lastSpawnAt: lastSpawnAt(shown),
    lastUsedAt: Object.fromEntries(
      [
        ...catalog.map((row) => row.resolvedModel ?? row.value),
        ...models.recent,
      ].flatMap((id) => {
        const used = lastUsedAt(shown, id);
        return used ? [[id, used]] : [];
      })
    ),
  }));
  const entries = $derived(deriveModelEntries(catalog, use));
  const groups = $derived(
    groupModelEntries(entries, use, models.recent)
      .map((group) => ({
        ...group,
        entries: group.entries.filter((entry) => matchesQuery(entry, query)),
      }))
      .filter((group) => group.entries.length)
  );
  const filtered = $derived(groups.flatMap((group) => group.entries));
  const custom = $derived(filtered.length === 0 && isIdShaped(query.trim()));
  const rows = $derived(
    custom
      ? [
          {
            id: query.trim(),
            name: `Use \`${query.trim()}\``,
            provider: null,
            isCustom: true,
            isDefault: false,
            effort: [],
            aliases: [],
            mono: true,
          } satisfies ModelEntry,
        ]
      : filtered
  );
  const captions = $derived({
    new: `New since you last used ${labels[shown]}`,
    recent: "Recent",
    all: "All",
    typed: "Typed",
  });

  $effect(() => {
    const next = harness;
    refreshError = "";
    ensureModels(next);
    if (next === untrack(() => shown)) {
      leaving = false;
      return;
    }
    direction =
      order.indexOf(next) > order.indexOf(untrack(() => shown)) ? 1 : -1;
    leaving = true;
    const timer = setTimeout(
      () => {
        shown = next;
        leaving = false;
      },
      reducedMotion.current ? 0 : 100
    );
    return () => clearTimeout(timer);
  });
  $effect(() => {
    const ids = rows.map((row) => row.id);
    active = Math.max(0, ids.indexOf(value));
  });
  $effect(() => {
    const index = Math.min(active, rows.length - 1);
    const frequency = 4.6 / (spring.visualDuration * 60);
    highlight.stiffness = frequency * frequency;
    highlight.damping = Math.min(1, 2 * frequency * (1 - spring.bounce));
    tick().then(() => {
      const row = list?.querySelector<HTMLElement>(`[data-index="${index}"]`);
      if (!row) {
        return;
      }
      height = row.offsetHeight;
      highlight.set(row.offsetTop, { instant: reducedMotion.current });
      row.scrollIntoView({ block: "nearest" });
    });
  });

  function enter(node: HTMLElement, index: number) {
    const travel = direction;
    const frequency = 4.6 / (swapSpring.visualDuration * 60);
    const progress = new Spring(reducedMotion.current ? 1 : 0, {
      stiffness: frequency * frequency,
      damping: Math.min(1, 2 * frequency * (1 - swapSpring.bounce)),
    });
    const swapInterval = Math.min(
      swapStagger,
      0.25 / Math.max(1, rows.length - 1)
    );
    const delay =
      (travel ? index * swapInterval : Math.min(index, 12) * stagger) * 1000;
    const timer = setTimeout(
      () => {
        progress.set(1, { instant: reducedMotion.current });
      },
      reducedMotion.current ? 0 : delay
    );
    // The 100ms exit leaves 500ms for entry; reserve one frame before the deadline.
    const settled = travel
      ? setTimeout(
          () => progress.set(1, { instant: true }),
          reducedMotion.current
            ? 0
            : Math.min(delay + swapSpring.visualDuration * 1000, 480)
        )
      : undefined;
    const stop = $effect.root(() => {
      $effect(() => {
        const remaining = 1 - progress.current;
        node.style.opacity = `${progress.current}`;
        node.style.transform = `translate(${travel * 8 * remaining}px, ${travel ? 0 : 6 * remaining}px)`;
      });
    });
    return {
      destroy() {
        clearTimeout(timer);
        clearTimeout(settled);
        stop();
      },
    };
  }
  function relative(date: string): string {
    const minutes = Math.max(
      0,
      Math.floor((Date.now() - Date.parse(date)) / 60_000)
    );
    if (minutes < 60) {
      return `${minutes}m ago`;
    }
    if (minutes < 1440) {
      return `${Math.floor(minutes / 60)}h ago`;
    }
    return `${Math.floor(minutes / 1440)}d ago`;
  }
  function select(entry: ModelEntry) {
    if (harness !== shown || leaving) {
      return;
    }
    if (entry.isCustom) {
      rememberModel(entry.id);
    }
    onselect(entry.id);
  }
  async function refresh() {
    const requested = harness;
    refreshError = "";
    try {
      await refreshModels(requested);
    } catch {
      if (requested === harness) {
        refreshError = `Could not read models from ${labels[requested]}.`;
      }
    }
  }
  function keydown(event: KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      active = Math.max(
        0,
        Math.min(rows.length - 1, active + (event.key === "ArrowDown" ? 1 : -1))
      );
    } else if (
      event.key === "Enter" &&
      !event.metaKey &&
      !event.ctrlKey &&
      rows[active]
    ) {
      event.preventDefault();
      event.stopPropagation();
      select(rows[active]);
    }
  }
</script>

<div class="picker">
  <!-- biome-ignore lint/a11y/useAriaActivedescendantWithTabindex: SearchField renders a native focusable input. -->
  <SearchField
    aria-activedescendant={rows[active] ? `${uid}-model-${active}` : undefined}
    aria-controls={`${uid}-models`}
    aria-expanded={true}
    onkeydown={keydown}
    placeholder="Search, or type a model id"
    bind:value={query}
  />
  <div class="scroll">
    <div
      aria-label={`${labels[shown]} models`}
      class="list"
      id={`${uid}-models`}
      role="listbox"
      bind:this={list}
      style:--travel={`${-direction * 8}px`}
      class:leaving={leaving}
    >
      {#if rows.length}
        <div
          class="highlight"
          style:height={`${height}px`}
          style:transform={`translateY(${highlight.current}px)`}
        ></div>
      {/if}
      {#key shown}
        {#each rows as entry, index (entry.id)}
          {@const group = groups.find((group) => group.entries[0]?.id === entry.id)}
          {#if group}
            <div class="caption" role="presentation">
              {captions[group.group]}
            </div>
          {/if}
          <button
            aria-selected={entry.id === value}
            class="row"
            data-index={index}
            id={`${uid}-model-${index}`}
            onclick={() => select(entry)}
            onpointermove={() => { active = index; }}
            role="option"
            tabindex="-1"
            type="button"
            use:enter={index}
          >
            <span class="mark"
              >{#if providerOf(entry.id)}
                <ProviderLogo model={entry.id} size={16} />
              {:else}
                <HarnessGlyph harness={shown} />
              {/if}</span
            >
            <span class="name" class:mono={entry.mono}>{entry.name}</span>
            <span class="meta"
              >{#if custom}
                custom
              {:else}
                {#if entry.provider}
                  <span>{entry.provider}</span>
                {/if}
                <span>{entry.released ? relative(entry.released) : '—'}</span>
                {#if entry.lastUsedAt}
                  <span>used {relative(entry.lastUsedAt)}</span>
                {/if}
                {#if entry.isDefault}
                  <span>default</span>
                {/if}
                {#if entry.effort.includes('max')}
                  <span>max</span>
                {/if}
              {/if}</span
            >
          </button>
        {/each}
      {/key}
    </div>
    {#if catalog.length === 0 && !custom}
      <div class="empty">
        <p>No models reported for {labels[shown]}.</p>
        <button onclick={refresh} type="button">Refresh models</button>
      </div>
    {:else if rows.length === 0}
      <p class="empty">No models match.</p>
    {/if}
    {#if refreshError || models.error}
      <p class="empty" role="status">{refreshError || models.error}</p>
    {/if}
  </div>
</div>

<style>
  .picker {
    display: flex;
    flex-direction: column;
    max-height: 100%;
    min-height: 0;
    color: var(--ink-strong);
    font: var(--text-base) / var(--leading-ui) var(--font-body);
  }
  .scroll {
    min-height: 0;
    overflow: auto;
    overscroll-behavior: contain;
    padding: var(--space-1);
  }
  .list {
    position: relative;
    transition:
      opacity var(--c-100) var(--e-out),
      transform var(--c-100) var(--e-out);
  }
  .leaving {
    opacity: 0;
    transform: translateX(var(--travel));
    pointer-events: none;
  }
  .highlight {
    position: absolute;
    inset: 0 0 auto;
    border-radius: var(--radius-well);
    background: var(--surface-active);
    box-shadow: var(--shadow-inset-sel);
    pointer-events: none;
  }
  .row {
    display: flex;
    align-items: center;
    position: relative;
    width: 100%;
    height: 36px;
    gap: var(--space-2);
    padding: 0 var(--space-2);
    border: 0;
    border-radius: var(--radius-well);
    background: transparent;
    color: var(--ink-strong);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .mark {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 16px;
    height: 16px;
  }
  .mark :global(svg) {
    width: 16px;
    height: 16px;
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .mono {
    font-family: var(--font-mono);
  }
  .meta {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--space-2);
    margin-left: auto;
    color: var(--ink-muted);
    font-size: var(--text-sm);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .caption {
    display: flex;
    align-items: center;
    height: 24px;
    padding-inline: var(--space-2);
    color: var(--ink-label);
    font-size: var(--text-xs);
  }
  .empty {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin: 0;
    padding: var(--space-3);
    color: var(--ink-muted);
    font-size: var(--text-sm);
  }
  .empty p {
    margin: 0;
  }
  .empty button {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-2);
    border: 1px solid var(--border-control);
    border-radius: var(--radius-well);
    background: var(--surface-field);
    box-shadow: var(--shadow-tile);
    color: var(--ink-strong);
    font: inherit;
    cursor: pointer;
  }
  button:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
  button:active {
    background: var(--surface-active);
    box-shadow: var(--shadow-inset-sel);
  }
  @media (hover: hover) {
    .row:hover {
      background: var(--surface-hover);
    }
  }
  @media (pointer: coarse) {
    .row {
      height: 44px;
      min-width: 44px;
    }
  }
  @media (max-width: 479px) {
    .picker {
      height: 100%;
    }
    .meta {
      max-width: 45%;
      overflow: hidden;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .list {
      transition-duration: 1ms;
    }
  }
</style>
