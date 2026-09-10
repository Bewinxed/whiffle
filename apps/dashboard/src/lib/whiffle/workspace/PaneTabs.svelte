<script lang="ts">
  /**
   * One group's tabs, drawn as page tabs.
   *
   * The app used to have a single strip because there was a single place a
   * conversation could be. A group owns its own now, which is what makes a
   * split two workstations rather than one view showing two things: each half
   * has its own set of things open and its own idea of which is in front.
   *
   * The tabs are not chips. The strip is a well, the tab in front is a SHEET
   * — the same surface as the pane below it, open along its bottom edge and
   * curling into the pane at both corners — and there is exactly one sheet,
   * which slides to whichever tab is chosen rather than being redrawn on it.
   * A hover is the same idea one register down: a soft field that follows
   * the tab nearest the pointer and returns to the sheet when the pointer
   * leaves. Labels are set at the strong weight invisibly underneath their
   * visible text, so choosing a tab changes its weight without changing its
   * width and the sheet lands where it was aimed.
   *
   * Hosted (`hosted`), the strip is the top bar's content and the bar
   * supplies the well; in a group it brings its own row.
   */
  import { untrack } from "svelte";
  import { page } from "$app/state";
  // biome-ignore lint/performance/noNamespaceImport: shadcn-svelte convention for component groups
  import * as ContextMenu from "$lib/components/ui/context-menu";
  import { IconClose } from "$lib/icons";
  import ActivityDot from "../ActivityDot.svelte";
  import {
    ACTIVITY_LABEL,
    type Activity,
    FAILED_LABEL,
    UNKNOWN_LABEL,
  } from "../activity";
  import { isFailed, isStale, whiffle } from "../client.svelte";
  import { copyToClipboard } from "../copy";
  import HarnessGlyph from "../HarnessGlyph.svelte";
  import { markHue } from "../mark";
  import { sessionName } from "../session-name";
  import { workingSet } from "../working-set.svelte";
  import { dragSession, dropHint, tabDropTarget } from "./dnd.svelte";
  import {
    contextOf,
    type LeafNode,
    urlFor,
    workspace,
  } from "./workspace.svelte";

  let { leaf, hosted = false }: { leaf: LeafNode; hosted?: boolean } = $props();

  const servedNames = $derived(
    (page.data as { names?: Record<string, string> }).names ?? {}
  );

  interface Tab {
    activity: Activity;
    failed: boolean;
    harness: string;
    href: string;
    hue: ReturnType<typeof markHue>;
    id: string;
    label: string;
    named: boolean;
    stale: boolean;
    /** What the badge says, or '' for a tab with nothing to say. */
    status: string;
  }

  function resolve(id: string): Tab {
    const row = whiffle.instances.find((instance) => instance.id === id);
    const view = whiffle.session(id);
    const ctx = contextOf(id);
    const { label, named } = sessionName(id, servedNames);
    const activity = whiffle.activityOf(id);
    const failed = row ? isFailed(row) : false;
    const stale = row ? isStale(row) : false;
    const tool = whiffle.currentToolOf(id)?.name;
    let status = "";
    if (failed) {
      status = FAILED_LABEL;
    } else if (stale) {
      status = UNKNOWN_LABEL;
    } else if (activity !== "idle") {
      status =
        activity === "working" && tool
          ? `${ACTIVITY_LABEL.working} — ${tool}`
          : ACTIVITY_LABEL[activity];
    }
    return {
      id,
      href: urlFor(id),
      label,
      hue: markHue(view?.cwd || row?.cwd || ctx?.cwd || id),
      harness: ctx?.harness || row?.harness || view?.harness || "claude",
      named,
      activity,
      failed,
      stale,
      status,
    };
  }

  const tabs = $derived(leaf.tabs.map(resolve));

  // Remember every name the strip works out, so a tab on a conversation the
  // board no longer lists is called by its name and not eight characters of
  // its id until its transcript arrives.
  $effect(() => {
    const named = tabs
      .filter((tab) => tab.named)
      .map((tab) => [tab.id, tab.label] as const);
    untrack(() => {
      for (const [id, label] of named) {
        workingSet.setTitle(id, label);
      }
    });
  });

  /**
   * A plain left click shows the conversation without navigating. The anchor
   * keeps its `href` so middle-click still opens a window and "Copy link"
   * copies something that works; modified clicks fall through to the browser.
   */
  function show(event: MouseEvent, id: string) {
    if (event.defaultPrevented || event.button !== 0) {
      return;
    }
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    workspace.activate(id, leaf.id);
  }

  const otherLeaves = $derived(
    workspace.leaves.filter((other) => other.id !== leaf.id)
  );

  /* ── Where the tabs are ──────────────────────────────────────────────
     The sheet and the hover field are positioned from measurements, not
     drawn by the tabs, which is what lets one element travel between them.
     Offsets are read against the strip (its offset parent), so a transform
     on an ancestor — the deck's lift — does not skew them. */

  interface Box {
    left: number;
    width: number;
  }

  let strip = $state<HTMLElement | undefined>();
  let boxes = $state<Record<string, Box>>({});
  const items = new Map<string, HTMLElement>();
  let observer: ResizeObserver | null = null;

  function measure(): void {
    if (!strip) {
      return;
    }
    const next: Record<string, Box> = {};
    for (const [id, el] of items) {
      next[id] = { left: el.offsetLeft, width: el.offsetWidth };
    }
    boxes = next;
  }

  /** Registers a tab's box with the strip for as long as it is mounted. */
  function item(node: HTMLElement, id: string) {
    let key = id;
    items.set(key, node);
    observer?.observe(node);
    measure();
    return {
      update(next: string) {
        if (next !== key) {
          items.delete(key);
          key = next;
          items.set(key, node);
        }
      },
      destroy() {
        items.delete(key);
        observer?.unobserve(node);
        measure();
      },
    };
  }

  $effect(() => {
    if (!strip) {
      return;
    }
    observer = new ResizeObserver(measure);
    observer.observe(strip);
    for (const el of items.values()) {
      observer.observe(el);
    }
    measure();
    return () => {
      observer?.disconnect();
      observer = null;
    };
  });

  const sheet = $derived(leaf.active ? boxes[leaf.active] : undefined);

  /* ── A strip that overflows scrolls ──────────────────────────────────
     Tabs give up width down to a floor and then the strip scrolls, the
     way a browser's does. The chosen tab is kept in view, and a wheel over
     the strip — which has no vertical travel to spend it on — moves it
     sideways. */

  $effect(() => {
    const id = leaf.active;
    // The box, not the element: it is re-read as names resolve and the tabs
    // change width, so the scroll lands on where the tab ends up.
    const box = id ? boxes[id] : undefined;
    if (!(strip && box)) {
      return;
    }
    const left = box.left - 12;
    const right = box.left + box.width + 12;
    if (left < strip.scrollLeft) {
      strip.scrollTo({ left, behavior: "smooth" });
    } else if (right > strip.scrollLeft + strip.clientWidth) {
      strip.scrollTo({ left: right - strip.clientWidth, behavior: "smooth" });
    }
  });

  function sideways(node: HTMLElement) {
    const onwheel = (event: WheelEvent) => {
      if (event.deltaX !== 0 || node.scrollWidth <= node.clientWidth) {
        return;
      }
      event.preventDefault();
      node.scrollLeft += event.deltaY;
    };
    node.addEventListener("wheel", onwheel, { passive: false });
    return {
      destroy() {
        node.removeEventListener("wheel", onwheel);
      },
    };
  }

  /* ── Proximity hover ─────────────────────────────────────────────────
     The field goes to the tab NEAREST the pointer, not the one under it, so
     the gaps between tabs are never dead and the field is always somewhere.
     Pointer-only: a finger has no hover, and arming this under it would
     leave a field stranded on whatever was tapped last. */

  let hoverId = $state<string | null>(null);
  let frame: number | null = null;
  const canHover = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  function onpointermove(event: PointerEvent): void {
    if (!(strip && canHover())) {
      return;
    }
    const x = event.clientX;
    if (frame !== null) {
      cancelAnimationFrame(frame);
    }
    frame = requestAnimationFrame(() => {
      frame = null;
      if (!strip) {
        return;
      }
      const origin = strip.getBoundingClientRect().left - strip.scrollLeft;
      let nearest: string | null = null;
      let distance = Number.POSITIVE_INFINITY;
      for (const [id, box] of Object.entries(boxes)) {
        const gap = Math.abs(x - (origin + box.left + box.width / 2));
        if (gap < distance) {
          distance = gap;
          nearest = id;
        }
      }
      hoverId = nearest;
    });
  }

  function onpointerleave(): void {
    if (frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
    }
    hoverId = null;
  }

  const hover = $derived(
    hoverId && hoverId !== leaf.active ? boxes[hoverId] : undefined
  );
  /** Where the field sits when it is not showing: under the sheet, ready. */
  const fieldBox = $derived(hover ?? sheet);
</script>

<div
  aria-label="Open sessions in this group"
  class="strip"
  {onpointerleave}
  {onpointermove}
  role="tablist"
  bind:this={strip}
  class:hosted={hosted}
  use:sideways
>
  {#if fieldBox}
    <div
      aria-hidden="true"
      class="field"
      style="left: {fieldBox.left}px; width: {fieldBox.width}px"
      class:shown={hover !== undefined}
    ></div>
  {/if}
  {#if sheet}
    <div
      aria-hidden="true"
      class="sheet"
      style="left: {sheet.left}px; width: {sheet.width}px"
    ></div>
  {/if}
  {#each tabs as tab, i (tab.id)}
    {@const active = leaf.active === tab.id}
    <ContextMenu.Root>
      <ContextMenu.Trigger class="contents">
        <!-- The caret marks where the tab would land, drawn on the side the
             pointer is nearest. Graphite, like every structural mark here:
             the one loud colour belongs to a session asking for something. -->
        <div
          class="tab"
          class:drop-after={dropHint.tabIndexIn(leaf.id) === i + 1 && i === tabs.length - 1}
          class:drop-before={dropHint.tabIndexIn(leaf.id) === i}
          class:near={hoverId === tab.id}
          class:needs={tab.activity === 'blocked'}
          class:on={active}
          use:dragSession={{ sessionId: tab.id, from: leaf.id }}
          use:item={tab.id}
          use:tabDropTarget={{ leafId: leaf.id, index: i, sessionId: tab.id }}
        >
          <a
            aria-selected={active}
            class="tl"
            draggable="false"
            href={tab.href}
            onclick={(e) => show(e, tab.id)}
            role="tab"
            title={tab.status ? `${tab.label} — ${tab.status}` : tab.label}
          >
            <span aria-hidden="true" class="tm m{tab.hue}">
              <HarnessGlyph harness={tab.harness} />
            </span>
            <!-- The session's state, on the mark's corner: the running one
                 breathes, the one parked on you pings, a failed one is red
                 and still. An idle tab says nothing — quiet is the default. -->
            {#if tab.status}
              <span class="badge">
                <ActivityDot
                  activity={tab.activity}
                  failed={tab.failed}
                  size={1.5}
                  stale={tab.stale}
                />
              </span>
            {/if}
            <span class="nm">
              <span aria-hidden="true" class="sizer">{tab.label}</span>
              <span class="text">{tab.label}</span>
            </span>
          </a>
          <button
            aria-label="Close {tab.label}"
            class="tclose"
            onclick={() => workspace.close(tab.id)}
            type="button"
          >
            <IconClose />
          </button>
        </div>
      </ContextMenu.Trigger>
      <ContextMenu.Content>
        <!-- Every gesture has a command that does the same thing. Splitting
             and moving are reachable from here before drag-and-drop exists,
             and stay reachable for anyone not using a pointer. -->
        <ContextMenu.Item
          onSelect={() => workspace.split(leaf.id, 'right', tab.id)}
        >
          Split right
        </ContextMenu.Item>
        <ContextMenu.Item
          onSelect={() => workspace.split(leaf.id, 'bottom', tab.id)}
        >
          Split down
        </ContextMenu.Item>
        {#if otherLeaves.length > 0}
          <ContextMenu.Separator />
          {#each otherLeaves as other, i (other.id)}
            <ContextMenu.Item onSelect={() => workspace.move(tab.id, other.id)}>
              Move to group {i + 2}
            </ContextMenu.Item>
          {/each}
        {/if}
        <ContextMenu.Separator />
        <ContextMenu.Item onSelect={() => workspace.close(tab.id)}
          >Close</ContextMenu.Item
        >
        <ContextMenu.Item
          disabled={leaf.tabs.length < 2}
          onSelect={() => {
            for (const id of [...leaf.tabs]) {
              if (id !== tab.id) {
                workspace.close(id);
              }
            }
          }}
        >
          Close others
        </ContextMenu.Item>
        <ContextMenu.Separator />
        <ContextMenu.Item
          onSelect={() => copyToClipboard('Link', new URL(tab.href, location.origin).href)}
        >
          Copy link
        </ContextMenu.Item>
      </ContextMenu.Content>
    </ContextMenu.Root>
  {/each}
</div>

<style>
  /* The well. A recessed track — sunk a step below the bar, lit along its
     top edge — that the tabs sit in, and the one region of the bar that
     scrolls. Its floor is the bar's own hairline, drawn as an inset shadow
     rather than a border so that it stays put while the tabs scroll and so
     the chosen tab's sheet, a child, can paint over it: that is the join
     between the tab and the pane. `--tab-top` is where the tabs begin
     below the well's top edge; the sheet and the field share it. */
  .strip {
    --tab-top: 8px;
    --curl: var(--radius-control);
    position: relative;
    display: flex;
    align-items: stretch;
    gap: 2px;
    flex: 1 1 0;
    min-width: 0;
    height: 46px;
    padding: var(--tab-top) var(--space-4) 0 calc(var(--space-7) - 10px);
    background: var(--surface-sunken);
    box-shadow:
      inset 0 1px 2px var(--shadow-tint-2),
      inset 0 -1px 0 var(--border-hairline);
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
  }
  .strip::-webkit-scrollbar {
    display: none;
  }
  .strip.hosted {
    --tab-top: 19px;
    align-self: stretch;
    height: auto;
  }
  @container leaf (max-width: 620px) {
    .strip:not(.hosted) {
      padding-left: calc(var(--space-4) - 10px);
    }
  }

  /* The sheet: the pane's own surface, brought up behind the chosen tab and
     run down to the well's floor, over the hairline, so the tab and the pane
     below are one shape. The corners curl OUTWARD at the foot — a quarter
     circle of the sheet's colour, edged with the same hairline the sides
     carry, cut from the well on either side. Above the field: the field is
     the hover, a register down, and it goes under the sheet, never over. */
  .sheet,
  .field {
    position: absolute;
    top: var(--tab-top);
    pointer-events: none;
  }
  .sheet {
    z-index: 1;
    bottom: 0;
    background: var(--surface-raised);
    border: 1px solid var(--border-hairline);
    border-bottom: 0;
    border-radius: var(--curl) var(--curl) 0 0;
    transition:
      left var(--c-300) var(--e-in),
      width var(--c-300) var(--e-in);
  }
  .sheet::before,
  .sheet::after {
    content: "";
    position: absolute;
    bottom: 0;
    width: var(--curl);
    height: var(--curl);
  }
  .sheet::before {
    left: calc(-1 * var(--curl) - 1px);
    background: radial-gradient(
      circle at 0 0,
      transparent calc(var(--curl) - 1px),
      var(--border-hairline) calc(var(--curl) - 1px),
      var(--border-hairline) var(--curl),
      var(--surface-raised) calc(var(--curl) + 0.5px)
    );
  }
  .sheet::after {
    right: calc(-1 * var(--curl) - 1px);
    background: radial-gradient(
      circle at 100% 0,
      transparent calc(var(--curl) - 1px),
      var(--border-hairline) calc(var(--curl) - 1px),
      var(--border-hairline) var(--curl),
      var(--surface-raised) calc(var(--curl) + 0.5px)
    );
  }

  /* The hover field: quicker than the sheet — it is following a hand —
     and parked under the sheet while nothing is hovered, so it enters from
     there and leaves to there without ever crossing the sheet. */
  .field {
    z-index: 0;
    bottom: 4px;
    border-radius: var(--curl);
    /* Half a step toward the sheet's surface: lighter than the well in both
       modes, so it reads as the tab beginning to lift rather than a tint. */
    background: color-mix(in oklab, var(--surface-raised) 55%, transparent);
    opacity: 0;
    transition:
      left var(--c-100) var(--e-in),
      width var(--c-100) var(--e-in),
      opacity var(--c-100) var(--e-in);
  }
  .field.shown {
    opacity: 1;
  }

  /* Tabs are transparent: the sheet and the field paint, the tab only
     places its content over them. They share the row's width the way a
     browser's do, giving up their labels before their marks. */
  .tab {
    --tab-bg: var(--tab-well);
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 0 1 200px;
    min-width: 120px;
    padding: 0 6px 0 10px;
    color: var(--ink-muted);
    font-size: var(--text-base);
    font-weight: var(--weight-medium);
    white-space: nowrap;
    transition: color var(--c-100) var(--e-in);
  }
  .tab.near,
  .tab.on {
    color: var(--ink-strong);
  }
  .tab.on {
    --tab-bg: var(--surface-raised);
  }
  /* Parked on you: the label carries the strong ink whether or not it is
     in front, so the ask is legible from across the strip. */
  .tab.needs {
    color: var(--ink-strong);
  }

  /* Where it would land. A 2px rule against the gap between tabs, so the
     answer is unambiguous about WHICH side without moving anything. */
  .tab.drop-before::before,
  .tab.drop-after::after {
    content: "";
    position: absolute;
    top: 3px;
    bottom: 3px;
    width: 2px;
    border-radius: 1px;
    background: var(--ink-strong);
  }
  .tab.drop-before::before {
    left: -2px;
  }
  .tab.drop-after::after {
    right: -2px;
  }

  /* The tab being carried recedes; it is somewhere else now. */
  :global(.tab[data-dragging]) {
    opacity: 0.4;
  }

  .tl {
    position: relative;
    display: flex;
    align-items: center;
    align-self: stretch;
    gap: 8px;
    min-width: 0;
    flex: 1 1 auto;
    color: inherit;
    text-decoration: none;
  }

  /* The 17px item mark at 14px, the same recipe the sidebar rows carry. */
  .tm {
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    width: 14px;
    height: 14px;
    border-radius: var(--radius-mark);
    background-image: var(--mark-overlay);
    background-color: var(--mark-1);
  }
  .tm :global(svg) {
    width: 10px;
    height: 10px;
    display: block;
    color: var(--mark-glyph);
  }
  .tm.m2 {
    background-color: var(--mark-2);
  }
  .tm.m3 {
    background-color: var(--mark-3);
  }
  .tm.m4 {
    background-color: var(--mark-4);
  }
  .tm.m5 {
    background-color: var(--mark-5);
  }
  .tm.m6 {
    background-color: var(--mark-6);
  }
  .tm.m7 {
    background-color: var(--mark-7);
  }
  .tm.m8 {
    background-color: var(--mark-8);
  }

  /* On the mark's corner, ringed in the tab's own surface so it reads as
     sitting on the mark rather than beside it. */
  .badge {
    position: absolute;
    left: 9px;
    top: calc(50% + 2px);
    display: grid;
    place-items: center;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--tab-bg);
    transition: background-color var(--c-100) var(--e-in);
  }

  /* Two labels in one cell: the invisible one is set at the strong weight
     and decides the width, so the visible one can change weight in place. */
  .nm {
    display: grid;
    min-width: 0;
    overflow: hidden;
  }
  .nm > span {
    grid-area: 1 / 1;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
  .sizer {
    visibility: hidden;
    font-weight: var(--weight-strong);
  }
  .tab.on .text {
    font-weight: var(--weight-strong);
  }

  .tclose {
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    width: 18px;
    height: 18px;
    border: 0;
    padding: 0;
    background: none;
    border-radius: var(--radius-mark);
    color: var(--ink-muted);
    cursor: pointer;
    transition:
      background-color var(--c-100) var(--e-in),
      color var(--c-100) var(--e-in),
      transform var(--c-100) var(--e-in);
  }
  .tclose :global(svg) {
    width: 11px;
    height: 11px;
    display: block;
  }
  @media (hover: hover) and (pointer: fine) {
    .tclose:hover {
      background: var(--surface-active);
      color: var(--ink-strong);
    }
  }
  .tclose:active {
    transform: scale(0.9);
  }

  .tl:focus-visible,
  .tclose:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: -2px;
    border-radius: var(--radius-control);
  }

  @media (pointer: coarse) {
    .strip:not(.hosted) {
      --tab-top: 10px;
      height: 54px;
    }
    .tclose {
      width: 28px;
      height: 28px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .sheet,
    .field,
    .tab,
    .tclose {
      transition: none;
    }
    .tclose:active {
      transform: none;
    }
  }
</style>
