<script lang="ts">
  /**
   * Machines chip + popover (§1.4, §2.5): multi-select rows. The design's
   * "Connect a machine…" row is omitted: the dashboard has no join/pair
   * command surface to reuse.
   */
  import Down from "~icons/solar/alt-arrow-down-linear";
  import Check from "~icons/solar/check-circle-bold";
  import Server from "~icons/solar/server-square-bold-duotone";
  import { FollowHover } from "./follow-hover.svelte";
  import NsPopover from "./NsPopover.svelte";
  import type { MachineItem } from "./ns-types";

  let {
    machines,
    selected,
    open,
    onchange,
    ontoggle,
  }: {
    machines: MachineItem[];
    selected: string[];
    open: boolean;
    onchange: (open: boolean) => void;
    ontoggle: (id: string) => void;
  } = $props();
  const picked = $derived(machines.filter((row) => selected.includes(row.id)));
  const label = $derived.by(() => {
    if (picked.length === 0) {
      return "Select machine";
    }
    return picked.length === 1 ? picked[0].name : `${picked.length} machines`;
  });
  const ghost = new FollowHover("y");
  const radius = (index: number, on: boolean) => {
    const prev = index > 0 && selected.includes(machines[index - 1].id);
    const next =
      index < machines.length - 1 && selected.includes(machines[index + 1].id);
    return `${on && prev ? "0 0" : "8px 8px"} ${on && next ? "0 0" : "8px 8px"}`;
  };
</script>

<NsPopover
  id="session-machines"
  label="Machines"
  {onchange}
  onmouseleave={ghost.leave}
  onmousemove={ghost.move}
  {open}
  triggerClass="ns-chip-btn"
  triggerStyle={picked.length ? "" : "color:var(--fai-status-expired-fg);border-color:var(--fai-status-expired-fg)"}
>
  {#snippet trigger()}
    <Server style="color:var(--fai-cyan-500)" />
    <span class="chip-label">{label}</span>
    <Down class="chevron" />
  {/snippet}
  <span aria-hidden="true" class="ns-ghost" style={ghost.style}></span>
  {#each machines as row, index (row.id)}
    {@const on = selected.includes(row.id)}
    {@const Icon = row.icon}
    <button
      aria-pressed={on}
      class="row ns-in"
      data-fh="1"
      disabled={!row.online}
      onclick={() => ontoggle(row.id)}
      style={`--delay:${80 + index * 45}ms;border-radius:${radius(index, on)}`}
      type="button"
      class:on={on}
    >
      <span
        class="ns-tile tile"
        style={on ? "" : `color:${row.hue}`}
        class:ink={on}
        ><Icon /></span
      >
      <span class="text">
        <span class="name">{row.name}</span>
        <span class="meta"
          ><span
            class="dot"
            class:away={row.online && row.load !== 'Idle'}
            class:online={row.online && row.load === 'Idle'}
          ></span>{row.os ? `${row.os} · ` : ""}{row.load}</span
        >
      </span>
      <Check
        class="check"
        style={`opacity:${on ? 1 : 0};transform:scale(${on ? 1 : 0.94})`}
      />
    </button>
  {/each}
  {#if machines.length === 0}
    <div class="none ns-in">No machines have checked in.</div>
  {/if}
</NsPopover>

<style>
  :global(.ns-theme .ns-chip-btn) {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 30px;
    padding: 0 8px;
    background: var(--fai-surface);
    border: 1px solid var(--fai-border);
    border-radius: var(--fai-radius-sm);
    font: 500 13px / 1 var(--fai-font-sans);
    color: var(--fai-text);
    cursor: pointer;
    white-space: nowrap;
    max-width: 100%;
    transition:
      background-color var(--ns-chip-ms) ease,
      border-color var(--ns-chip-ms) ease,
      color var(--ns-chip-ms) ease,
      transform 160ms var(--ns-ease-out);
  }
  :global(.ns-theme .ns-chip-btn > svg) {
    width: 15px;
    height: 15px;
    flex: none;
  }
  :global(.ns-theme .ns-chip-btn > svg.chevron) {
    width: 13px;
    height: 13px;
    color: var(--fai-text-subtle);
  }
  :global(.ns-theme .ns-chip-btn .chip-label) {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  @media (hover: hover) {
    :global(.ns-theme .ns-chip-btn:hover) {
      background: var(--fai-grey-50);
    }
  }
  .row {
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    height: 44px;
    padding: 6px 8px;
    background: transparent;
    border: 0;
    cursor: pointer;
    text-align: left;
    color: var(--fai-text);
    transition:
      background-color 160ms ease,
      border-radius 160ms ease,
      transform 160ms var(--ns-ease-out);
  }
  .row.on {
    background: var(--fai-grey-100);
  }
  .row:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
  .tile {
    width: 26px;
    height: 26px;
  }
  .tile :global(svg) {
    width: 15px;
    height: 15px;
  }
  .text {
    flex: 1;
    min-width: 0;
  }
  .name {
    display: block;
    font: 500 13px / 1.3 var(--fai-font-sans);
  }
  .meta {
    display: flex;
    align-items: center;
    gap: 6px;
    font: var(--fai-type-meta);
    color: var(--fai-text-subtle);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .dot {
    flex: none;
    width: 6px;
    height: 6px;
    border-radius: var(--fai-radius-pill);
    background: var(--fai-presence-offline);
  }
  .dot.online {
    background: var(--fai-presence-online);
  }
  .dot.away {
    background: var(--fai-presence-away);
  }
  .row :global(svg.check) {
    width: 16px;
    height: 16px;
    flex: none;
    color: var(--fai-grey-900);
    transition:
      opacity 160ms var(--ns-ease-out),
      transform 160ms var(--ns-ease-out);
  }
  .none {
    padding: 14px 8px;
    font: var(--fai-type-meta);
    color: var(--fai-text-subtle);
    text-align: center;
  }
  @media (max-width: 640px) {
    :global(.ns-theme .ns-chip-btn) {
      height: 44px;
      padding: 0 12px;
    }
  }
</style>
