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
  triggerStyle={picked.length ? "" : "color:var(--status-fail-ink);border-color:var(--status-fail-ink)"}
>
  {#snippet trigger()}
    <Server style="color:var(--hue-cyan-500)" />
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
    color: var(--ink-strong);
    transition:
      background-color 160ms ease,
      border-radius 160ms ease,
      transform 160ms var(--ease-out);
  }
  .row.on {
    background: var(--surface-fill);
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
    font: var(--type-label);
  }
  .meta {
    display: flex;
    align-items: center;
    gap: 6px;
    font: var(--type-meta);
    color: var(--ink-subtle);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .dot {
    flex: none;
    width: 6px;
    height: 6px;
    border-radius: var(--radius-pill);
    background: var(--neutral-8);
  }
  .dot.online {
    background: var(--hue-green-500);
  }
  .dot.away {
    background: var(--hue-orange-500);
  }
  .row :global(svg.check) {
    width: 16px;
    height: 16px;
    flex: none;
    color: var(--ink-strong);
    transition:
      opacity 160ms var(--ease-out),
      transform 160ms var(--ease-out);
  }
  .none {
    padding: 14px 8px;
    font: var(--type-meta);
    color: var(--ink-subtle);
    text-align: center;
  }
</style>
