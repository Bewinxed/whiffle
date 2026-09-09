<script lang="ts">
  import type { ModelInfo } from "@whiffle/core";
  import { prefersReducedMotion } from "svelte/motion";
  import { fly } from "svelte/transition";
  import IconSearch from "~icons/solar/magnifer-linear";
  import HighlightGroup from "./HighlightGroup.svelte";
  import { matches, orderModels, type Usage } from "./model-order";

  let {
    rows,
    usage,
    value = $bindable(),
    swapKey,
    spring,
    inset,
    radius,
    stagger,
  }: {
    rows: ModelInfo[];
    usage: Usage;
    value: string;
    /** Changes when the whole list is replaced (another harness); the rows fly out, then in. */
    swapKey: string;
    spring: { visualDuration?: number; bounce?: number };
    inset: number;
    radius: number;
    stagger: number;
  } = $props();
  let query = $state("");
  const ordered = $derived(orderModels(rows, usage));
  const shown = $derived(ordered.filter((row) => matches(row, query)));
  const typed = $derived(query.trim());
  /** A typed id no row covers is offered as itself, so there is no second field for it. */
  const custom = $derived(
    typed !== "" && !rows.some((row) => row.value === typed)
      ? [{ value: typed, displayName: `Use ${typed}`, label: typed }]
      : []
  );
  const items = $derived([
    ...shown.map((row) => ({ ...row, label: row.displayName })),
    ...custom,
  ]);
  const OUT = 0.22;
  function tier(row: ModelInfo) {
    const { released } = row;
    if (released && !Object.values(usage).some((at) => at > released)) {
      return "New";
    }
    if (usage[row.value]) {
      return "Recent";
    }
    return "";
  }
  function when(row: ModelInfo) {
    if (usage[row.value]) {
      return `Used ${usage[row.value].slice(0, 10)}`;
    }
    if (row.released) {
      return `Released ${row.released}`;
    }
    return row.description ?? "";
  }
</script>

<div class="picker">
  <label class="search">
    <IconSearch />
    <input
      aria-label="Search models or type an id"
      placeholder="Search models or type an id"
      type="search"
      bind:value={query}
    >
  </label>
  <div class="list">
    {#key swapKey}
      <div
        class="rows"
        in:fly|global={{ x: 0, duration: 0, delay: prefersReducedMotion.current ? 0 : OUT * 1000 }}
        out:fly|global={{ x: -32, duration: prefersReducedMotion.current ? 0 : OUT * 1000 }}
      >
        <HighlightGroup
          {inset}
          {items}
          label="Model"
          onchange={(next) => { value = next; }}
          orientation="vertical"
          {radius}
          {spring}
          {stagger}
          swap
          {value}
        >
          {#snippet children(item)}
            <span class="row">
              <span class="name"
                >{item.displayName}
                <code
                  >{"label" in item && item.label === item.value ? "" : item.value}</code
                ></span
              >
              <small class="meta">
                {#if "released" in item || item.value in usage}
                  {#if tier(item)}
                    <span class="tag">{tier(item)}</span>
                  {/if}
                  <span>{when(item)}</span>
                {/if}
              </small>
            </span>
          {/snippet}
        </HighlightGroup>
      </div>
    {/key}
  </div>
</div>

<style>
  .picker {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-height: 0;
  }
  .search {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: 0 var(--space-3);
    min-height: 36px;
    border: 1px solid var(--border-control);
    border-radius: var(--radius-control);
    background: var(--surface-field);
    color: var(--ink-muted);
  }
  .search :global(svg) {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }
  .search input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: transparent;
    color: var(--ink-strong);
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    outline: none;
  }
  .search:focus-within {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
  .list {
    display: grid;
    min-height: 0;
    max-height: 300px;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .rows {
    grid-area: 1 / 1;
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }
  .name {
    min-width: 0;
  }
  code {
    display: block;
    margin-top: 2px;
    font: var(--text-xs) var(--font-mono);
    overflow-wrap: anywhere;
    color: var(--ink-muted);
  }
  code:empty {
    display: none;
  }
  .meta {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    flex-shrink: 0;
    font-size: var(--text-xs);
    color: var(--ink-muted);
  }
  .tag {
    padding: 2px var(--space-2);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-pill);
  }
</style>
