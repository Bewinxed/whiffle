<script lang="ts">
  /**
   * The Configure rail: every section, grouped, with how many rows it holds
   * and how many of them are failing somewhere. As `list` it is the whole
   * screen under 900px — the same entries at a touch height.
   */
  import { countOf, faultsIn } from "./counts.svelte";
  import { GROUPS, type SectionSlug } from "./sections";
  import { configStore } from "./store.svelte";

  let {
    current,
    variant = "rail",
  }: { current?: SectionSlug; variant?: "rail" | "list" } = $props();

  const store = configStore();
</script>

<nav aria-label="Configure" class="rail" data-variant={variant}>
  {#each GROUPS as { group, sections } (group)}
    <div class="group">
      <h2 class="label">{group}</h2>
      <ul class="list">
        {#each sections as section (section.slug)}
          {@const count = countOf(store, section.slug)}
          {@const faults = faultsIn(store, section.slug)}
          <li>
            <a
              aria-current={current === section.slug ? 'page' : undefined}
              class="row focus-ring"
              href="/config/{section.slug}"
            >
              <span class="tile" style="color:{section.hue}"
                ><section.icon /></span
              >
              <span class="name">{section.label}</span>
              {#if faults > 0}
                <span
                  class="fault"
                  title="{faults} failing on a machine or at the hub"
                  >{faults}<span class="sr-only"> failing</span></span
                >
              {/if}
              {#if section.slug !== 'models'}
                <span class="count">{count ?? '—'}</span>
              {/if}
            </a>
          </li>
        {/each}
      </ul>
    </div>
  {/each}
</nav>

<style>
  .rail {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 14px 8px 14px 12px;
  }
  .rail[data-variant="rail"] {
    width: 232px;
    flex: none;
    overflow-y: auto;
    background: var(--surface-recess);
  }
  .rail[data-variant="list"] {
    padding: 7px;
  }
  .group {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .label {
    padding: 0 8px 4px;
    font: var(--type-meta);
    color: var(--ink-muted);
  }
  .list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 9px;
    height: 36px;
    padding: 0 8px;
    border-radius: var(--radius-sm);
    color: var(--ink-strong);
    text-decoration: none;
    transition: var(--transition-control);
  }
  [data-variant="list"] .row {
    height: 48px;
  }
  @media (pointer: coarse) {
    .row {
      height: 44px;
    }
    [data-variant="list"] .row {
      height: 48px;
    }
  }
  @media (hover: hover) {
    .row:hover {
      background: var(--surface-hover);
    }
  }
  .row[aria-current="page"] {
    background: var(--surface-fill);
  }
  .tile {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 22px;
    height: 22px;
    border-radius: var(--radius-xs);
    background: var(--surface-raised);
    box-shadow: var(--shadow-tile);
  }
  .tile :global(svg) {
    width: 14px;
    height: 14px;
  }
  .name {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    font: var(--type-label);
    font-weight: 500;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .count {
    flex: none;
    font: var(--type-meta);
    font-variant-numeric: tabular-nums;
    color: var(--ink-muted);
  }
  .fault {
    flex: none;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: var(--radius-xs);
    background: var(--status-attn-bg);
    font: var(--type-meta);
    font-weight: 500;
    line-height: 18px;
    text-align: center;
    color: var(--status-attn-ink);
  }
</style>
