<script lang="ts">
  /** The `@` / `/` menu (§2.3): caret-anchored, keyboard-driven, 300px wide. */
  import { FollowHover } from "./follow-hover.svelte";
  import NsPopover from "./NsPopover.svelte";
  import type { MenuItem } from "./ns-types";

  let {
    id,
    open,
    anchor,
    items,
    index,
    onpick,
    onchange,
  }: {
    id: string;
    open: boolean;
    anchor: { getBoundingClientRect: () => DOMRect } | null;
    items: MenuItem[];
    index: number;
    onpick: (item: MenuItem) => void;
    onchange: (open: boolean) => void;
  } = $props();
  const ghost = new FollowHover("y");
</script>

<NsPopover
  {anchor}
  aria-label="Insert"
  gap={2}
  {id}
  {onchange}
  onmouseleave={ghost.leave}
  onmousemove={ghost.move}
  {open}
  trapFocus={false}
  width={300}
>
  <span aria-hidden="true" class="ns-ghost" style={ghost.style}></span>
  <span
    aria-hidden="true"
    class="hi"
    style={`transform:translateY(calc(${index} * 38px));opacity:${items.length ? 1 : 0}`}
  ></span>
  {#each items as item, i (item.key)}
    {@const Icon = item.icon}
    <button
      class="row"
      data-fh="1"
      onmousedown={(event) => { event.preventDefault(); onpick(item); }}
      tabindex="-1"
      type="button"
      class:active={i === index}
    >
      <span class="ns-tile tile" style={`color:${item.hue}`}><Icon /></span>
      <span class="label">{item.label}</span>
      <span class="kind">{item.kind}</span>
    </button>
  {/each}
  {#if items.length === 0}
    <div class="none">No matches</div>
  {/if}
</NsPopover>

<style>
  :global(#trigger-menu-popover.ns-pop) {
    padding: 4px;
  }
  .hi {
    position: absolute;
    left: 4px;
    right: 4px;
    top: 4px;
    height: 36px;
    background: var(--fai-fill);
    border-radius: var(--fai-radius-sm);
    transition: transform 120ms var(--ns-ease-in-out);
    pointer-events: none;
  }
  .row {
    position: relative;
    display: flex;
    align-items: center;
    gap: 9px;
    width: 100%;
    height: 36px;
    padding: 0 8px;
    background: transparent;
    border: 0;
    border-radius: var(--fai-radius-sm);
    cursor: pointer;
    text-align: left;
    color: var(--fai-text);
  }
  .tile {
    width: 22px;
    height: 22px;
    border-radius: var(--fai-radius-xs);
  }
  .tile :global(svg) {
    width: 13px;
    height: 13px;
  }
  .label {
    flex: 1;
    min-width: 0;
    font: 500 13px / 1.2 var(--fai-font-sans);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .kind {
    font: var(--fai-type-meta);
    color: var(--fai-text-subtle);
    white-space: nowrap;
  }
  .none {
    padding: 10px 8px;
    font: var(--fai-type-meta);
    color: var(--fai-text-subtle);
  }
</style>
