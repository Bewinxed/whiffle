<script lang="ts">
  import IconFolder from "~icons/solar/folder-linear";
  import IconSearch from "~icons/solar/magnifer-linear";
  import IconMachine from "~icons/solar/server-linear";
  import HighlightGroup from "./HighlightGroup.svelte";

  export interface Place {
    cwd: string;
    machine: string;
    machineId: string;
    /** A project name when the directory is a saved project. */
    name?: string;
  }
  let {
    places,
    machineId = $bindable(),
    cwd = $bindable(),
    spring,
    inset,
    radius,
    stagger,
  }: {
    places: Place[];
    machineId: string;
    cwd: string;
    spring: { visualDuration?: number; bounce?: number };
    inset: number;
    radius: number;
    stagger: number;
  } = $props();
  let query = $state("");
  const typed = $derived(query.trim());
  const shown = $derived(
    places.filter((place) => {
      const q = typed.toLowerCase();
      return (
        q === "" ||
        place.cwd.toLowerCase().includes(q) ||
        place.machine.toLowerCase().includes(q) ||
        place.name?.toLowerCase().includes(q)
      );
    })
  );
  const machines = $derived([
    ...new Map(places.map((p) => [p.machineId, p.machine])).entries(),
  ]);
  /** A path typed by hand becomes a place on the machine already chosen. */
  const custom = $derived<Place[]>(
    typed.startsWith("/") && !places.some((p) => p.cwd === typed)
      ? [
          {
            machineId,
            machine: machines.find(([id]) => id === machineId)?.[1] ?? "",
            cwd: typed,
          },
        ]
      : []
  );
  const items = $derived(
    [...shown, ...custom].map((place) => ({
      ...place,
      value: `${place.machineId}\n${place.cwd}`,
      label: place.cwd,
    }))
  );
  const value = $derived(`${machineId}\n${cwd}`);
  function choose(next: string) {
    const [id, path] = next.split("\n");
    machineId = id;
    cwd = path;
  }
</script>

<div class="picker">
  <label class="search">
    <IconSearch />
    <input
      aria-label="Search directories or type a path"
      placeholder="Search directories or type a path"
      type="search"
      bind:value={query}
    >
  </label>
  {#if machines.length > 1}
    <div class="machines">
      {#each machines as [id, name] (id)}
        <button
          onclick={() => { query = query === name ? '' : name; }}
          type="button"
          class:active={query === name}
        >
          <IconMachine />{name}
        </button>
      {/each}
    </div>
  {/if}
  <div class="list">
    <HighlightGroup
      {inset}
      {items}
      label="Directory"
      onchange={choose}
      orientation="vertical"
      {radius}
      {spring}
      {stagger}
      {value}
    >
      {#snippet children(item)}
        <span class="row">
          <IconFolder />
          <span class="path">
            <span class="cwd">{item.name ?? item.cwd}</span>
            <small>{item.machine}{item.name ? ` · ${item.cwd}` : ""}</small>
          </span>
        </span>
      {/snippet}
    </HighlightGroup>
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
  .machines {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  .machines button {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    min-height: 28px;
    padding: 0 var(--space-3);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-pill);
    background: transparent;
    color: var(--ink-muted);
    font-size: var(--text-xs);
    cursor: pointer;
    transition:
      color var(--c-100) var(--e-out),
      border-color var(--c-100) var(--e-out);
  }
  .machines button :global(svg) {
    width: 12px;
    height: 12px;
  }
  .machines button.active {
    color: var(--ink-strong);
    border-color: var(--ink-strong);
  }
  .list {
    max-height: 260px;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
  .row :global(svg) {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    color: var(--ink-muted);
  }
  .path {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .cwd {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    overflow-wrap: anywhere;
  }
  small {
    font-size: var(--text-xs);
    color: var(--ink-muted);
  }
</style>
