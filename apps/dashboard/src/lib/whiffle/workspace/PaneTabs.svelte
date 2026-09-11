<script lang="ts">
  /**
   * One group's tabs: a segmented control (the Fluid Functionalism tabs,
   * `$lib/components/ui/fluid-tabs`) with one segment per open conversation.
   *
   * The app used to have a single strip because there was a single place a
   * conversation could be. A group owns its own now, which is what makes a
   * split two workstations rather than one view showing two things: each half
   * has its own set of things open and its own idea of which is in front.
   *
   * Each segment carries the session's mark, its state on the mark's corner,
   * its name, and a close control; the strip scrolls when the row cannot
   * hold them. Hosted, the strip is the top bar's content; in a group it
   * brings its own row.
   */
  import { untrack } from "svelte";
  import { page } from "$app/state";
  // biome-ignore lint/performance/noNamespaceImport: shadcn-svelte convention for component groups
  import * as ContextMenu from "$lib/components/ui/context-menu";
  import {
    TabItem,
    Tabs,
    TabsList,
    type TabsTravel,
  } from "$lib/components/ui/fluid-tabs";
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

  let {
    leaf,
    hosted = false,
    travel = null,
  }: {
    leaf: LeafNode;
    hosted?: boolean;
    /** A swipe in progress: the indicator follows it toward the next tab. */
    travel?: TabsTravel | null;
  } = $props();

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

  const otherLeaves = $derived(
    workspace.leaves.filter((other) => other.id !== leaf.id)
  );
</script>

<!-- `''` when the board is showing: a value no segment carries, so nothing
     is drawn as chosen. The name is per group: two groups' strips in one
     navigation must be two transition groups, or the transition is
     abandoned. -->
<Tabs
  class="tabs {hosted ? 'hosted' : ''}"
  onValueChange={(id) => workspace.activate(id, leaf.id)}
  style="view-transition-name: tabs-{leaf.id}"
  {travel}
  value={leaf.active ?? ''}
  variant="folder"
>
  <TabsList aria-label="Open sessions in this group" scrollable>
    {#each tabs as tab, i (tab.id)}
      <ContextMenu.Root>
        <ContextMenu.Trigger class="contents">
          <!-- The caret marks where a drop would land, drawn on the side the
               pointer is nearest. Graphite, like every structural mark here:
               the one loud colour belongs to a session asking for something. -->
          <div
            class="tab"
            class:drop-after={dropHint.tabIndexIn(leaf.id) === i + 1 && i === tabs.length - 1}
            class:drop-before={dropHint.tabIndexIn(leaf.id) === i}
            class:needs={tab.activity === 'blocked'}
            use:dragSession={{ sessionId: tab.id, from: leaf.id }}
            use:tabDropTarget={{ leafId: leaf.id, index: i, sessionId: tab.id }}
          >
            <TabItem
              href={tab.href}
              label={tab.label}
              title={tab.status ? `${tab.label} — ${tab.status}` : tab.label}
              value={tab.id}
            >
              {#snippet lead()}
                <span class="mark">
                  <span aria-hidden="true" class="tm m{tab.hue}">
                    <HarnessGlyph harness={tab.harness} />
                  </span>
                  <!-- The session's state, on the mark's corner: the running
                       one breathes, the one parked on you pings, a failed one
                       is red and still. An idle tab says nothing. -->
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
                </span>
              {/snippet}
              {#snippet trail()}
                <button
                  aria-label="Close {tab.label}"
                  class="tclose"
                  onclick={() => workspace.close(tab.id)}
                  type="button"
                >
                  <IconClose />
                </button>
              {/snippet}
            </TabItem>
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
              <ContextMenu.Item
                onSelect={() => workspace.move(tab.id, other.id)}
              >
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
            onSelect={() =>
              copyToClipboard('Link', new URL(tab.href, location.origin).href)}
          >
            Copy link
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Root>
    {/each}
  </TabsList>
</Tabs>

<style>
  /* ── The row ──────────────────────────────────────────────────────
     Folder tabs stand on a shelf: a hairline in the row's own bottom
     pixel, so the chosen tab's sheet — which ends on that same pixel —
     covers it and runs on into the header below. In a group the row is
     the group's own; hosted, it fills the top bar and the bar draws the
     shelf. The row is its own view-transition group and, like the bar
     and the rail, holds still while a spoke navigation slides the
     content under it: it is chrome. (A tab switch is not a navigation
     at all — the segment simply slides.) */
  :global(.tabs) {
    display: flex;
    align-items: flex-end;
    flex: 0 0 auto;
    min-inline-size: 0;
    padding-block: 4px 0;
    padding-inline: var(--space-7) var(--space-4);
    background:
      linear-gradient(var(--border-hairline), var(--border-hairline)) bottom /
      100% 1px no-repeat;
    view-transition-class: tabs;
  }
  :global(.tabs.hosted) {
    flex: 1 1 0;
    align-self: stretch;
    padding: 0;
    background: none;
  }
  @container leaf (width <= 620px) {
    :global(.tabs:not(.hosted)) {
      padding-inline-start: var(--space-4);
    }
  }

  /* The strip's texture: a dense strip's small text and a tighter
     horizontal pad. The ladder, the shape and the sheet are the
     component's. */
  :global(.tabs .ff-tabs-list) {
    --px: 10px;
    --text: var(--text-sm);
  }

  .tab {
    position: relative;
    display: flex;
    flex: 0 0 auto;
    min-inline-size: 0;
    max-inline-size: 200px;

    /* Parked on you: the label carries the strong ink whether or not it
       is chosen, so the ask is legible from across the strip. */
    &.needs {
      color: var(--ink-strong);
    }

    /* Where a drop would land: a 2px rule in the gap, on the near side. */
    &.drop-before::before,
    &.drop-after::after {
      content: "";
      position: absolute;
      inset-block: 2px;
      inline-size: 2px;
      border-radius: 1px;
      background: var(--ink-strong);
      z-index: 3;
    }
    &.drop-before::before {
      inset-inline-start: -2px;
    }
    &.drop-after::after {
      inset-inline-end: -2px;
    }
  }
  /* The tab being carried recedes; it is somewhere else now. */
  :global(.tab[data-dragging]) {
    opacity: 0.4;
  }

  .mark {
    position: relative;
    display: grid;
    place-items: center;
    flex: 0 0 auto;
  }
  .tm {
    display: grid;
    place-items: center;
    inline-size: 14px;
    block-size: 14px;
    border-radius: var(--radius-mark);
    background-image: var(--mark-overlay);
    background-color: var(--mark-1);

    &.m2 {
      background-color: var(--mark-2);
    }
    &.m3 {
      background-color: var(--mark-3);
    }
    &.m4 {
      background-color: var(--mark-4);
    }
    &.m5 {
      background-color: var(--mark-5);
    }
    &.m6 {
      background-color: var(--mark-6);
    }
    &.m7 {
      background-color: var(--mark-7);
    }
    &.m8 {
      background-color: var(--mark-8);
    }
  }
  .tm :global(svg) {
    inline-size: 10px;
    block-size: 10px;
    display: block;
    color: var(--mark-glyph);
  }

  /* On the mark's corner, ringed in the surface the tab stands on: the
     shelf's field, or — chosen — the sheet. */
  .badge {
    position: absolute;
    inset-inline-end: -4px;
    inset-block-end: -4px;
    display: grid;
    place-items: center;
    inline-size: 10px;
    block-size: 10px;
    border-radius: 50%;
    background: var(--surface-field);
  }
  :global(.ff-tab.selected) .badge {
    background: var(--sheet);
  }

  .tclose {
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    inline-size: 20px;
    block-size: 20px;
    /* Its own size, not the page-wide touch floor: a 44px button does
       not fit a 32px tab. 24px on a coarse pointer is the WCAG floor. */
    min-inline-size: 0;
    min-block-size: 0;
    margin-inline-start: 2px;
    border: 0;
    padding: 0;
    background: none;
    border-radius: var(--radius-mark);
    color: var(--ink-muted);
    cursor: pointer;

    &:focus-visible {
      outline: 2px solid var(--focus-ring);
      outline-offset: 1px;
    }

    @media (hover: hover) and (pointer: fine) {
      &:hover {
        background: var(--surface-active);
        color: var(--ink-strong);
      }
    }
    @media (pointer: coarse) {
      inline-size: 24px;
      block-size: 24px;
    }
    @media (prefers-reduced-motion: no-preference) {
      transition:
        background-color var(--c-100) var(--e-in),
        color var(--c-100) var(--e-in),
        transform var(--c-100) var(--e-in);

      &:active {
        transform: scale(0.9);
      }
    }
  }
  .tclose :global(svg) {
    inline-size: 11px;
    block-size: 11px;
    display: block;
  }
</style>
