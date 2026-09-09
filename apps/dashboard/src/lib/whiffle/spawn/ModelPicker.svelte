<script lang="ts">
  import { HARNESSES, type HarnessKind } from "@whiffle/core";
  import { ToggleGroup } from "bits-ui";
  import { tick, untrack } from "svelte";
  import { Spring } from "svelte/motion";
  import ProviderLogo from "$lib/components/features/ProviderLogo.svelte";
  import HarnessLogo from "../HarnessLogo.svelte";
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
  import { springFromVisual } from "./motion";
  import SearchField from "./SearchField.svelte";

  let {
    harness,
    installedHarnesses,
    machineName,
    onharness,
    value,
    onselect,
    spring = { visualDuration: 0.22, bounce: 0 },
    stagger = 0.014,
    swapSpring = { visualDuration: 0.24, bounce: 0 },
    swapStagger = 0.018,
  }: {
    harness: HarnessKind;
    installedHarnesses: HarnessKind[];
    machineName: string;
    onharness: (value: HarnessKind) => void;
    value: string;
    onselect: (id: string) => void;
    spring?: { visualDuration: number; bounce: number };
    stagger?: number;
    swapSpring?: { visualDuration: number; bounce: number };
    swapStagger?: number;
  } = $props();
  const uid = $props.id();
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
  let measuredHarness = $state<HarnessKind | null>(null);
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
  const selectedId = $derived(
    value || entries.find((entry) => entry.isDefault)?.id
  );
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
            name: query.trim(),
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
    direction = 1;
    leaving = true;
    const timer = setTimeout(
      () => {
        shown = next;
        leaving = false;
      },
      reducedMotion.current
        ? 0
        : swapSpring.visualDuration * 1000 +
            Math.min(rows.length - 1, 12) * swapStagger * 1000
    );
    return () => clearTimeout(timer);
  });
  $effect(() => {
    const ids = rows.map((row) => row.id);
    active = Math.max(0, selectedId ? ids.indexOf(selectedId) : 0);
  });
  $effect(() => {
    const index = Math.min(active, rows.length - 1);
    const node = list;
    const currentHarness = shown;
    const firstMeasure = untrack(() => measuredHarness) !== currentHarness;
    let cancelled = false;
    Object.assign(highlight, springFromVisual(spring));
    tick().then(() => {
      const row = node?.querySelector<HTMLElement>(`[data-index="${index}"]`);
      if (cancelled) {
        return;
      }
      if (!row) {
        measuredHarness = null;
        return;
      }
      height = row.offsetHeight;
      highlight.set(row.offsetTop, {
        instant: firstMeasure || reducedMotion.current,
      });
      measuredHarness = currentHarness;
      row.scrollIntoView({ block: "nearest" });
    });
    return () => {
      cancelled = true;
    };
  });

  function enter(node: HTMLElement, index: number) {
    const travel = direction;
    const progress = new Spring(
      reducedMotion.current ? 1 : 0,
      springFromVisual(swapSpring)
    );
    const swapInterval = swapStagger;
    const delay =
      (travel ? index * swapInterval : Math.min(index, 12) * stagger) * 1000;
    const timer = setTimeout(
      () => {
        progress.set(1, { instant: reducedMotion.current });
      },
      reducedMotion.current ? 0 : delay
    );
    const stop = $effect.root(() => {
      $effect(() => {
        if (!leaving) {
          return;
        }
        const exit = setTimeout(
          () => progress.set(0, { instant: reducedMotion.current }),
          reducedMotion.current ? 0 : index * swapStagger * 1000
        );
        return () => clearTimeout(exit);
      });
      $effect(() => {
        const remaining = 1 - progress.current;
        node.style.opacity = `${progress.current}`;
        node.style.transform = `translate(${(leaving ? -1 : travel) * 8 * remaining}px, ${travel || leaving ? 0 : 6 * remaining}px)`;
      });
    });
    return {
      destroy() {
        clearTimeout(timer);
        stop();
      },
    };
  }
  function relative(date: string, lastUse?: string): string {
    const difference =
      (lastUse ? Date.parse(lastUse) : Date.now()) - Date.parse(date);
    const minutes = Math.max(0, Math.floor(Math.abs(difference) / 60_000));
    const relation = difference < 0 ? "after last use" : "before last use";
    const suffix = lastUse ? relation : "ago";
    if (minutes < 60) {
      return `${minutes}m ${suffix}`;
    }
    if (minutes < 1440) {
      return `${Math.floor(minutes / 60)}h ${suffix}`;
    }
    return `${Math.floor(minutes / 1440)}d ${suffix}`;
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
  <ToggleGroup.Root
    aria-label="Agent"
    class="agent-tiles"
    onValueChange={(value) => { if (value) { onharness(value as HarnessKind); } }}
    type="single"
    value={harness}
  >
    {#each HARNESSES as kind (kind)}
      <ToggleGroup.Item
        aria-describedby={installedHarnesses.includes(kind) ? undefined : `${uid}-${kind}-unavailable`}
        class="agent-tile"
        disabled={!installedHarnesses.includes(kind)}
        value={kind}
      >
        <HarnessLogo harness={kind} />{labels[kind]}
      </ToggleGroup.Item>
      {#if !installedHarnesses.includes(kind)}
        <span class="sr-only" id={`${uid}-${kind}-unavailable`}
          >Not installed on {machineName}</span
        >
      {/if}
    {/each}
  </ToggleGroup.Root>
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
      {#key shown}
        {#if rows.length}
          <div
            class="highlight"
            style:background={rows[active]?.id === selectedId ? "transparent" : "var(--surface-hover)"}
            style:height={`${height}px`}
            style:transform={`translateY(${highlight.current}px)`}
            class:ready={measuredHarness === shown}
          ></div>
        {/if}
        {#each rows as entry, index (entry.id)}
          {@const group = groups.find((group) => group.entries[0]?.id === entry.id)}
          {#if custom}
            <div class="caption" role="presentation">Typed</div>
          {:else if group}
            <div class="caption" role="presentation">
              {captions[group.group]}
            </div>
          {/if}
          <button
            aria-selected={entry.id === selectedId}
            class="row"
            data-index={index}
            id={`${uid}-model-${index}`}
            onclick={() => select(entry)}
            onpointermove={() => { active = index; }}
            role="option"
            tabindex="-1"
            type="button"
            class:active={active === index}
            use:enter={index}
          >
            <span class="mark"
              >{#if providerOf(entry.id)}
                <ProviderLogo model={entry.id} size={16} />
              {:else}
                <HarnessLogo harness={shown} />
              {/if}</span
            >
            <span class="name" class:mono={entry.mono}>{entry.name}</span>
            {#if entry.isDefault}
              <span class="default-tag">default</span>
            {/if}
            {#if entry.released}
              <time class="meta" datetime={entry.released}
                >{relative(entry.released, entry.lastUsedAt ?? use.lastSpawnAt)}</time
              >
            {/if}
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
  :global(.agent-tiles) {
    display: flex;
    gap: var(--space-2);
    padding: var(--space-2);
  }
  :global(.agent-tile) {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    gap: var(--space-2);
    height: 40px;
    border: 0;
    border-radius: var(--radius-control);
    background: transparent;
    color: var(--ink-body);
  }
  :global(.agent-tile[data-state="on"]) {
    background: color-mix(in oklab, var(--brand-solid) 12%, transparent);
    color: var(--ink-strong);
  }
  :global(.agent-tile:disabled) {
    opacity: 0.55;
  }
  :global(.agent-tile:hover:not(:disabled):not([data-state="on"])) {
    background: var(--surface-hover);
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
    pointer-events: none;
  }
  .highlight {
    opacity: 0;
    position: absolute;
    inset: 0 0 auto;
    border-radius: var(--radius-well);
    background: var(--surface-hover);
    pointer-events: none;
  }
  .highlight.ready {
    animation: highlight-in var(--c-100) var(--e-in) both;
  }
  @keyframes highlight-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
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
  .row[aria-selected="true"] {
    font-weight: 500;
    background: color-mix(in oklab, var(--brand-solid) 12%, transparent);
  }
  .default-tag {
    color: var(--ink-muted);
    font-size: var(--text-xs);
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
    border: 0;
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
