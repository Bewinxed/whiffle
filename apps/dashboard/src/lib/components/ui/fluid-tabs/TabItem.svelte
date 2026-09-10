<script lang="ts">
  import type { Component } from "svelte";
  /**
   * One segment. The item draws nothing of its own state — the track's
   * overlays do — it only places its content over them and changes weight
   * when chosen. The label is stacked over an invisible copy set at the
   * strong weight, so choosing it changes nothing but the weight: the box
   * the indicator was aimed at is the box it lands on.
   *
   * `href` makes the item a link — the row keeps a real address for
   * middle-click and copy — with a plain click still choosing in place.
   */
  import { onMount, type Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { cn } from "$lib/utils";
  import { useList, useTabs } from "./context.svelte";

  let {
    value,
    label,
    icon: Icon,
    href,
    class: className,
    lead,
    trail,
    onclick,
    ...rest
  }: Omit<HTMLAttributes<HTMLElement>, "onclick"> & {
    value: string;
    label: string;
    /** An optional leading icon. */
    icon?: Component<{ class?: string }>;
    href?: string;
    /** Custom leading content, in the icon's place. */
    lead?: Snippet;
    /** Content after the label: a close control, a count. */
    trail?: Snippet;
    onclick?: (event: MouseEvent) => void;
  } = $props();

  const tabs = useTabs();
  const list = useList();
  const index = list.claim();

  let node = $state<HTMLElement | undefined>();
  onMount(() => {
    if (!node) {
      return;
    }
    return list.hover.register(index, node);
  });

  // The root learns the order from the items themselves, in mount order.
  $effect.pre(() => {
    const order = [...tabs.order];
    order[index] = value;
    tabs.setOrder(order);
  });

  const selected = $derived(tabs.value === value);
  const active = $derived(list.hover.activeIndex === index || selected);
  // The list's props land on the hit, not the box; `class` is the box's.

  function choose(event: MouseEvent): void {
    onclick?.(event);
    if (event.defaultPrevented || event.button !== 0) {
      return;
    }
    if (
      href &&
      (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
    ) {
      return;
    }
    event.preventDefault();
    // The indicator moves on the click, ahead of the value arriving.
    list.optimisticIndex = index;
    tabs.select(value);
  }
</script>

<span
  class={cn("ff-tab", active && "active", selected && "selected", className)}
  data-proximity-index={index}
  bind:this={node}
>
  <svelte:element
    aria-selected={selected}
    class="hit"
    draggable={href ? 'false' : undefined}
    {href}
    onclick={choose}
    role="tab"
    tabindex={selected ? 0 : -1}
    this={href ? 'a' : 'button'}
    type={href ? undefined : 'button'}
    {...rest}
  >
    {#if lead}
      {@render lead()}
    {:else if Icon}
      <Icon class="ff-tab-icon" />
    {/if}
    <span class="label">
      <span aria-hidden="true" class="sizer">{label}</span>
      <span class="text">{label}</span>
    </span>
  </svelte:element>
  {#if trail}
    {@render trail()}
  {/if}
</span>

<style>
  /* The measured box: the hit and whatever trails it. The overlays are
     aimed at this, so a trailing control sits inside the segment. */
  .ff-tab {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    flex: 0 1 auto;
    min-width: 0;
    height: var(--item);
    padding-right: calc(var(--px) - 6px);
    border-radius: calc(var(--radius) - var(--pad));
    color: var(--ink-muted);
    transition: color 80ms linear;
  }
  .ff-tab:has(.hit:last-child) {
    padding-right: 0;
  }
  .hit {
    display: flex;
    align-items: center;
    align-self: stretch;
    flex: 1 1 auto;
    gap: calc(var(--gap) + 4px);
    min-width: 0;
    /* The track's ladder is the hit's size: it fills the item and no more.
       Without this the page-wide touch minimum (44px on every [role=tab])
       makes a 44px hit inside a 32px item, and the content sits 6px low. */
    min-height: 0;
    padding: 0 var(--px);
    border: 0;
    border-radius: inherit;
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: var(--text);
    line-height: 1;
    white-space: nowrap;
    text-decoration: none;
    cursor: pointer;
    outline: none;
  }
  .ff-tab:has(.hit:not(:last-child)) .hit {
    padding-right: 0;
  }
  .ff-tab.active {
    color: var(--ink-strong);
  }
  .ff-tab :global(.ff-tab-icon) {
    width: var(--icon);
    height: var(--icon);
    flex: 0 0 auto;
    transition: stroke-width 80ms linear;
  }
  .ff-tab.active :global(.ff-tab-icon) {
    stroke-width: 2;
  }
  .ff-tab :global(.ff-tab-icon) {
    stroke-width: 1.5;
  }

  /* Two labels in one cell: the hidden one is set at the strong weight and
     decides the width; the visible one animates its weight in place. */
  .label {
    display: grid;
    min-width: 0;
  }
  /* Clipped for the ellipsis, so the line box is left whole — a trimmed
     one would lose its descenders to the clip. */
  .label > span {
    grid-area: 1 / 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: var(--item);
  }
  .sizer {
    visibility: hidden;
    font-variation-settings: "wght" var(--weight-strong);
  }
  .text {
    font-variation-settings: "wght" var(--weight-body);
    transition: font-variation-settings 80ms linear;
  }
  .ff-tab.selected .text {
    font-variation-settings: "wght" var(--weight-strong);
  }

  @media (prefers-reduced-motion: reduce) {
    .ff-tab,
    .text {
      transition: none;
    }
  }
</style>
