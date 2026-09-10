<script lang="ts">
  /**
   * The segmented control's track. Three overlays travel under the items —
   * the active segment, the hover field and the focus ring — positioned from
   * measurements, which is what lets one element slide between tabs rather
   * than each tab drawing its own. The hover field enters from the active
   * segment and leaves to it, at the faster tier: it is following a hand.
   *
   * `scrollable` lets a track that overflows scroll sideways: the chosen
   * item is kept in view and a wheel over the track, which has no vertical
   * travel to spend it on, moves it along.
   */
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { ProximityHover } from "$lib/hooks/proximity-hover.svelte";
  import { cn } from "$lib/utils";
  import { provideList, TabsListState, useTabs } from "./context.svelte";

  let {
    class: className,
    scrollable = false,
    children,
    ...rest
  }: HTMLAttributes<HTMLDivElement> & {
    scrollable?: boolean;
    children: Snippet;
  } = $props();

  const tabs = useTabs();
  const hover = new ProximityHover("x");
  const list = new TabsListState(hover);
  provideList(list);

  const selectedIndex = $derived(
    tabs.value === undefined ? -1 : tabs.order.indexOf(tabs.value)
  );
  $effect.pre(() => {
    list.optimisticIndex = selectedIndex >= 0 ? selectedIndex : null;
  });

  const selectedRect = $derived(
    list.optimisticIndex === null
      ? undefined
      : hover.rects[list.optimisticIndex]
  );
  const hoverRect = $derived(
    hover.activeIndex === null ? undefined : hover.rects[hover.activeIndex]
  );
  const focusRect = $derived(
    list.focusedIndex === null ? undefined : hover.rects[list.focusedIndex]
  );
  const hoveringSelected = $derived(hover.activeIndex === list.optimisticIndex);
  const hovering = $derived(hoverRect !== undefined && !hoveringSelected);
  /** The field rests under the active segment: that is where it comes from and goes back to. */
  const fieldRect = $derived(hovering ? hoverRect : selectedRect);

  let node = $state<HTMLElement | undefined>();

  function onfocusin(event: FocusEvent): void {
    const trigger = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-proximity-index]"
    );
    if (!trigger) {
      return;
    }
    const index = Number(trigger.dataset.proximityIndex);
    hover.activeIndex = index;
    list.focusedIndex = trigger.matches(":focus-visible") ? index : null;
  }
  function onfocusout(event: FocusEvent): void {
    if (
      event.relatedTarget instanceof Node &&
      node?.contains(event.relatedTarget)
    ) {
      return;
    }
    list.focusedIndex = null;
    if (!hover.inside) {
      hover.leave();
    }
  }

  /** Arrow keys move AND choose — Base UI's `activateOnFocus`. */
  function onkeydown(event: KeyboardEvent): void {
    const keys: Record<string, number | "start" | "end"> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      Home: "start",
      End: "end",
    };
    const step = keys[event.key];
    if (step === undefined || !node) {
      return;
    }
    const items = [
      ...node.querySelectorAll<HTMLElement>("[data-proximity-index] > .hit"),
    ];
    if (items.length === 0) {
      return;
    }
    const at = items.indexOf(document.activeElement as HTMLElement);
    let to = (at + (step as number) + items.length) % items.length;
    if (step === "start") {
      to = 0;
    } else if (step === "end") {
      to = items.length - 1;
    }
    event.preventDefault();
    items[to].focus();
    items[to].click();
  }

  // Keep the chosen item in view. The rect, not the element: it is re-read
  // as items resize, so the scroll lands on where the item ends up.
  $effect(() => {
    const rect = selectedRect;
    const { width } = hover.viewport;
    if (!(scrollable && node && rect && width > 0)) {
      return;
    }
    // An instant write, not a smooth one: a smooth scroll is an animation the
    // browser abandons when the track's content changes under it, and the
    // segment sliding into place is the motion here.
    const pad = 8;
    if (rect.left - pad < node.scrollLeft) {
      node.scrollLeft = rect.left - pad;
    } else if (rect.left + rect.width + pad > node.scrollLeft + width) {
      node.scrollLeft = rect.left + rect.width + pad - width;
    }
  });

  function sideways(el: HTMLElement) {
    const onwheel = (event: WheelEvent) => {
      if (event.deltaX !== 0 || el.scrollWidth <= el.clientWidth) {
        return;
      }
      event.preventDefault();
      el.scrollLeft += event.deltaY;
    };
    el.addEventListener("wheel", onwheel, { passive: false });
    return {
      destroy() {
        el.removeEventListener("wheel", onwheel);
      },
    };
  }

  const px = (rect: {
    left: number;
    top: number;
    width: number;
    height: number;
  }) =>
    `left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px`;
</script>

<div
  class={cn("ff-tabs-list", scrollable && "scrollable", className)}
  {onfocusin}
  {onfocusout}
  {onkeydown}
  role="tablist"
  bind:this={node}
  use:hover.container
  use:sideways
  {...rest}
>
  {#if selectedRect}
    <div
      aria-hidden="true"
      class="field"
      style={px(fieldRect ?? selectedRect)}
      class:shown={hovering}
    ></div>
    <div
      aria-hidden="true"
      class="segment"
      style={px(selectedRect)}
      class:dim={hovering}
    ></div>
  {/if}
  {#if focusRect}
    <div
      aria-hidden="true"
      class="ring"
      style={px({
        left: focusRect.left - 2,
        top: focusRect.top - 2,
        width: focusRect.width + 4,
        height: focusRect.height + 4,
      })}
    ></div>
  {/if}
  {@render children()}
</div>

<style>
  /* The size ladder: the pad and the item add up to the control height —
     36px by default, 28px compact — so the control lines up with the
     buttons, selects and inputs beside it. */
  .ff-tabs-list {
    --pad: 4px;
    --item: 28px;
    --gap: 2px;
    --px: 12px;
    --icon: 16px;
    --text: var(--text-base);
    --radius: var(--radius-control);
    position: relative;
    display: inline-flex;
    align-items: center;
    flex: 0 0 auto;
    gap: var(--gap);
    padding: var(--pad);
    border-radius: var(--radius);
    background: var(--muted);
    user-select: none;
    -webkit-user-select: none;
  }
  :global([data-size="compact"]) > .ff-tabs-list,
  :global([data-size="compact"]) .ff-tabs-list {
    --pad: 2px;
    --item: 24px;
    --px: 10px;
    --icon: 14px;
    --text: var(--text-sm);
    --radius: var(--radius-tile);
  }
  /* A finger needs more room than a pointer: one step up the ladder on a
     coarse pointer — a 40px control — its shape unchanged. */
  @media (pointer: coarse) {
    .ff-tabs-list {
      --item: 32px;
    }
    /* Compact takes its own step (24 → 28): named here because the size
       rule above outranks a bare class, so it would otherwise stay put. */
    :global([data-size="compact"]) > .ff-tabs-list,
    :global([data-size="compact"]) .ff-tabs-list {
      --item: 28px;
    }
  }

  /* A scrolling track hugs its items and gives way — never grows — when
     the row it sits in is narrower than they are. */
  .scrollable {
    flex: 0 1 auto;
    min-width: 0;
    max-width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
  }
  .scrollable::-webkit-scrollbar {
    display: none;
  }

  .segment,
  .field,
  .ring {
    position: absolute;
    pointer-events: none;
    border-radius: calc(var(--radius) - var(--pad));
  }
  /* The active segment: raised, at the moderate tier — critically damped,
     lands without overshoot. Steps back a little while another tab is
     hovered, so the field reads as the thing about to take over. */
  .segment {
    z-index: 1;
    background: var(--surface-raised);
    box-shadow: var(--shadow-tile);
    transition:
      left 160ms var(--e-in),
      top 160ms var(--e-in),
      width 160ms var(--e-in),
      height 160ms var(--e-in),
      opacity 80ms linear;
  }
  .segment.dim {
    opacity: 0.85;
  }
  /* The hover field, one register down and one tier quicker. */
  .field {
    z-index: 0;
    background: var(--surface-hover);
    opacity: 0;
    transition:
      left 80ms var(--e-in),
      top 80ms var(--e-in),
      width 80ms var(--e-in),
      height 80ms var(--e-in),
      opacity 80ms linear;
  }
  .field.shown {
    opacity: 0.4;
  }
  .ring {
    z-index: 3;
    border: 1px solid var(--focus-ring);
    border-radius: calc(var(--radius) - var(--pad) + 2px);
    transition:
      left 80ms var(--e-in),
      top 80ms var(--e-in),
      width 80ms var(--e-in),
      height 80ms var(--e-in);
  }

  @media (prefers-reduced-motion: reduce) {
    .segment,
    .field,
    .ring {
      transition: none;
    }
  }
</style>
