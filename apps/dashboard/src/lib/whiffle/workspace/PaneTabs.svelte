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
  import { TabItem, Tabs, TabsList } from "$lib/components/ui/fluid-tabs";
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

  const otherLeaves = $derived(
    workspace.leaves.filter((other) => other.id !== leaf.id)
  );
</script>

<!-- `''` when the board is showing: a value no segment carries, so nothing
     is drawn as chosen. -->
<Tabs
  class="tabs {hosted ? 'hosted' : ''}"
  onValueChange={(id) => workspace.activate(id, leaf.id)}
  value={leaf.active ?? ''}
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
  /* ── Strip overrides ─────────────────────────────────────────────
     The FF tabs component is a segmented control: a muted-background
     pill with a raised, shadowed active segment. Session tabs are
     navigation — a flat strip flush with its surface, compact, the
     active tab distinguished by a subtle fill rather than a lifted
     card. Everything below overrides the component's defaults for
     this use case. */

  /* The wrapper row. Non-hosted: its own row with a hairline.
     Hosted: fills the top bar inline. */
  :global(.tabs) {
    display: flex;
    align-items: center;
    flex: 0 0 auto;
    min-width: 0;
    padding: 2px var(--space-4) 2px var(--space-7);
    border-bottom: 1px solid var(--border-hairline);
  }
  :global(.tabs.hosted) {
    flex: 1 1 0;
    padding: 0;
    border-bottom: 0;
  }
  @container leaf (max-width: 620px) {
    :global(.tabs:not(.hosted)) {
      padding-left: var(--space-4);
    }
  }

  /* Strip the segmented control chrome. No pill background, tighter
     dimensions, smaller text. The overlays remain — the sliding
     segment and hover field — but against a transparent background
     they read as inline highlights, not floating cards. */
  :global(.tabs .ff-tabs-list) {
    --pad: 2px;
    --item: 26px;
    --gap: 1px;
    --px: 8px;
    --text: var(--text-sm);
    --radius: var(--radius-tile);
    background: transparent;
  }
  /* Coarse pointer bumps to 32px in the generic component — session
     tabs stay compact; the row's own padding handles the touch
     target, not inflated items. */
  @media (pointer: coarse) {
    :global(.tabs .ff-tabs-list) {
      --item: 28px;
    }
  }

  /* The active segment: a gentle surface, no shadow. The raised-card
     look is for toggles with 3–4 items; a scrolling strip with many
     tabs needs something quieter. */
  :global(.tabs .segment) {
    background: var(--surface-hover);
    box-shadow: none;
  }
  /* No dimming when hovering another tab — the subtle segment
     doesn't need to recede further. */
  :global(.tabs .segment.dim) {
    opacity: 1;
  }
  /* The hover field is softer. */
  :global(.tabs .field.shown) {
    opacity: 0.3;
  }

  .tab {
    position: relative;
    display: flex;
    flex: 0 0 auto;
    min-width: 0;
    max-width: 200px;
  }
  /* Parked on you: the label carries the strong ink whether or not it is
     chosen, so the ask is legible from across the strip. */
  .tab.needs {
    color: var(--ink-strong);
  }

  /* Where it would land. A 2px rule against the gap between tabs. */
  .tab.drop-before::before,
  .tab.drop-after::after {
    content: "";
    position: absolute;
    top: 2px;
    bottom: 2px;
    width: 2px;
    border-radius: 1px;
    background: var(--ink-strong);
    z-index: 3;
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

  .mark {
    position: relative;
    display: grid;
    place-items: center;
    flex: 0 0 auto;
  }
  .tm {
    display: grid;
    place-items: center;
    width: 13px;
    height: 13px;
    border-radius: var(--radius-mark);
    background-image: var(--mark-overlay);
    background-color: var(--mark-1);
  }
  .tm :global(svg) {
    width: 9px;
    height: 9px;
    display: block;
    color: var(--mark-glyph);
  }
  .tm.m2 { background-color: var(--mark-2); }
  .tm.m3 { background-color: var(--mark-3); }
  .tm.m4 { background-color: var(--mark-4); }
  .tm.m5 { background-color: var(--mark-5); }
  .tm.m6 { background-color: var(--mark-6); }
  .tm.m7 { background-color: var(--mark-7); }
  .tm.m8 { background-color: var(--mark-8); }

  /* On the mark's corner, ringed in the strip's surface. */
  .badge {
    position: absolute;
    right: -3px;
    bottom: -3px;
    display: grid;
    place-items: center;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--surface-raised);
  }

  .tclose {
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    width: 18px;
    height: 18px;
    margin-left: 2px;
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
    width: 10px;
    height: 10px;
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
  .tclose:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 1px;
  }
  /* Touch: generous hit area via padding, not inflated visible size. */
  @media (pointer: coarse) {
    .tclose {
      width: 22px;
      height: 22px;
      padding: 2px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .tclose {
      transition: none;
    }
    .tclose:active {
      transform: none;
    }
  }
</style>
