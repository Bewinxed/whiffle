<script lang="ts">
  import {
    Comment01Icon,
    ComputerIcon,
    CpuIcon,
    File01Icon,
    Folder01Icon,
  } from "@hugeicons/core-free-icons";
  import { HugeiconsIcon } from "@hugeicons/svelte";
  import { flip } from "svelte/animate";
  import { expoOut } from "svelte/easing";
  import { fade } from "svelte/transition";
  import { goto } from "$app/navigation";
  // biome-ignore lint/performance/noNamespaceImport: shadcn-svelte component-group convention
  import * as Command from "$lib/components/ui/command";
  import { Kbd } from "$lib/components/ui/kbd";
  import { ACTIVITY_LABEL } from "./activity";
  import { whiffle } from "./client.svelte";
  import JumpMatch from "./JumpMatch.svelte";
  import { buildJumpIndex, filterJumpIndex, type JumpKind } from "./jump-index";
  import { JumpTranscriptSearch } from "./jump-search.svelte";

  let { open = $bindable(false) }: { open?: boolean } = $props();
  let query = $state("");

  const index = $derived.by(() =>
    buildJumpIndex({
      projects: whiffle.projects,
      onlineMachines: whiffle.onlineMachines,
      running: whiffle.runningInstances.map((instance) => ({
        id: instance.id,
        cwd: instance.cwd,
        activityLabel: ACTIVITY_LABEL[whiffle.activityOf(instance.id)],
      })),
      stored: whiffle.machines.map((machine) => ({
        machineId: machine.machineId,
        hostname: machine.hostname,
        catalog: whiffle.catalogOf(machine.machineId),
      })),
    })
  );
  const grouped = $derived(filterJumpIndex(index, query));
  const search = new JumpTranscriptSearch();
  $effect(() => {
    search.update(open ? query : "");
  });
  const hostOf = $derived(
    new Map(whiffle.machines.map((m) => [m.machineId, m.hostname]))
  );

  /** A row's kind decides its mark. Drawn icons, one stroke weight, never glyphs. */
  const MARK = {
    project: Folder01Icon,
    machine: ComputerIcon,
    live: CpuIcon,
    stored: File01Icon,
  } as const satisfies Record<JumpKind, unknown>;

  const snippetMarkers = /「|」/;
  /** The same markers for stripping: `replaceAll` refuses a non-global regex. */
  const allSnippetMarkers = /「|」/g;
  /** FTS5 wraps every matched term in 「…」; odd segments are the matches. */
  const segments = (snippet: string) => snippet.split(snippetMarkers);
  const plain = (snippet: string) => snippet.replaceAll(allSnippetMarkers, "");
  const leaf = (path: string) => path.split("/").filter(Boolean).pop() ?? path;

  /**
   * Motion is opt-out at the source, not only in CSS: `animate:` and
   * `transition:` run in JS and ignore the media query on their own.
   */
  const reduced =
    typeof matchMedia === "function"
      ? matchMedia("(prefers-reduced-motion: reduce)")
      : null;
  let still = $state(reduced?.matches ?? false);
  $effect(() => {
    if (!reduced) {
      return;
    }
    const sync = () => {
      still = reduced.matches;
    };
    reduced.addEventListener("change", sync);
    return () => reduced.removeEventListener("change", sync);
  });
  /** Rows settle into their new rank; they never slide in from nowhere. */
  const settle = $derived({ duration: still ? 0 : 180, easing: expoOut });
  const arrive = $derived({ duration: still ? 0 : 140 });

  const SKELETONS = [0, 1, 2];

  async function jump(href: string) {
    open = false;
    await goto(href);
  }
</script>

<Command.Dialog
  class="jump-dialog top-[9vh] sm:max-w-2xl"
  description="Jump to a project, machine, or session"
  loop
  shouldFilter={false}
  title="Jump to"
  bind:open
>
  <Command.Input
    placeholder="Jump to a project, machine, or session…"
    bind:value={query}
  />

  <!-- The signature move: the list is a sunken well inside the raised dialog,
       so the rows sit *in* the surface rather than on it. -->
  <Command.List class="jump-list">
    {#if !search.pending}
      <Command.Empty>Nothing matches that.</Command.Empty>
    {/if}

    {#each grouped as group (group.name)}
      <Command.Group heading={group.name}>
        {#each group.rows as entry (entry.id)}
          <div animate:flip={settle}>
            <Command.Item onSelect={() => jump(entry.href)} value={entry.id}>
              <HugeiconsIcon
                class="jump-mark"
                icon={MARK[entry.kind]}
                size={14}
                strokeWidth={1.8}
              />
              <JumpMatch
                class="jump-name"
                ranges={entry.labelRanges}
                text={entry.label}
              />
              <JumpMatch
                class="jump-trail"
                ranges={entry.detailRanges}
                text={entry.detail}
              />
            </Command.Item>
          </div>
        {/each}
      </Command.Group>
    {/each}

    {#if search.pending || search.hits.length > 0}
      <Command.Group heading="Transcripts">
        {#if search.pending && search.hits.length === 0}
          <!-- The shape of what is coming, so the list does not jump when it lands. -->
          <div aria-hidden="true" class="jump-skeletons">
            {#each SKELETONS as row (row)}
              <div class="jump-skeleton">
                <span
                  class="jump-skeleton-bar"
                  style="width: {38 - row * 6}%"
                ></span>
                <span
                  class="jump-skeleton-bar"
                  style="width: {74 - row * 9}%"
                ></span>
              </div>
            {/each}
          </div>
          <span class="sr-only" role="status">Searching transcripts</span>
        {/if}
        {#each search.hits as hit (hit.docId)}
          <div in:fade={arrive} animate:flip={settle}>
            <Command.Item
              class="jump-hit"
              onSelect={() =>
                jump(`/session/${hit.instanceId ?? hit.sessionId}`)}
              value={`hit:${hit.docId}`}
            >
              <!-- Which conversation this line came out of. Without it a list of
                   snippets is a list of strangers. -->
              <span class="jump-hit-head">
                <HugeiconsIcon
                  class="jump-mark"
                  icon={Comment01Icon}
                  size={14}
                  strokeWidth={1.8}
                />
                <span class="jump-name">
                  {index.sessionTitles.get(hit.sessionId) ??
                    (hit.cwd ? leaf(hit.cwd) : hit.sessionId.slice(0, 8))}
                </span>
                <span class="jump-trail">
                  {hostOf.get(hit.machineId) ?? hit.machineId}
                  · {hit.role}
                </span>
              </span>
              <!-- And the line itself, with the terms that matched marked. -->
              <span class="jump-snippet" title={plain(hit.snippet)}>
                {#each segments(hit.snippet) as part, i (i)}
                  {#if i % 2 === 1}
                    <mark>{part}</mark>
                  {:else}
                    {part}
                  {/if}
                {/each}
              </span>
            </Command.Item>
          </div>
        {/each}
      </Command.Group>
    {/if}
  </Command.List>

  <div class="jump-footer">
    <span><Kbd>↑↓</Kbd> navigate</span>
    <span><Kbd>↵</Kbd> open</span>
    <span><Kbd>esc</Kbd> close</span>
  </div>
</Command.Dialog>

<style>
  /* The dialog opens at 9vh; the well is bounded so the footer is never pushed
     under the fold. Measured before: at `top-1/3` with a 60vh list the panel
     ran 9px past the viewport and the key hints were unreachable. */
  :global(.jump-dialog) {
    max-height: 82vh;
  }
  :global(.jump-list) {
    max-height: calc(82vh - 96px);
    margin: 0 7px;
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-well);
    background: var(--surface-field);
    scroll-padding-block: 6px;
  }
  :global(.jump-mark) {
    flex: none;
    color: var(--ink-label);
  }
  /* The name is the anchor step; everything factual about it sits one rung
     down. Without the step the name, the folder and the matched line all
     rendered at 12.5px and the row had no hierarchy to read. */
  :global(.jump-name) {
    min-width: 0;
    flex: 1;
    overflow: hidden;
    color: var(--ink-row);
    font-size: var(--text-base);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* The trailing fact — machine, folder, role. Muted ink, the chip step of the
     ladder, and never wider than the name it follows. */
  :global(.jump-trail) {
    flex: none;
    margin-left: auto;
    max-width: 45%;
    overflow: hidden;
    color: var(--ink-muted);
    font-size: var(--text-sm);
    letter-spacing: var(--track-caps);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  :global(.jump-hit) {
    flex-direction: column;
    align-items: stretch;
    gap: 2px;
  }
  :global(.jump-hit-head) {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  :global(.jump-snippet) {
    display: block;
    overflow: hidden;
    margin-left: 22px;
    color: var(--ink-muted);
    font-size: var(--text-sm);
    line-height: var(--leading-ui);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* The matched terms. Weight and ink carry the emphasis — 500 is the top of
     this system's ladder, and the mark's own yellow is not in the palette. */
  :global(.jump-snippet mark) {
    background: transparent;
    color: var(--ink-strong);
    font-weight: 500;
  }
  .jump-skeletons {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 6px 8px 10px;
  }
  .jump-skeleton {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .jump-skeleton-bar {
    height: 7px;
    border-radius: var(--radius-pill);
    background: var(--border-divider);
    animation: jump-breathe var(--breath) var(--e-toggle) infinite;
  }
  .jump-skeleton:nth-child(2) .jump-skeleton-bar {
    animation-delay: 120ms;
  }
  .jump-skeleton:nth-child(3) .jump-skeleton-bar {
    animation-delay: 240ms;
  }
  @keyframes jump-breathe {
    0%,
    100% {
      opacity: 0.45;
    }
    50% {
      opacity: 0.9;
    }
  }
  .jump-footer {
    display: flex;
    gap: 16px;
    padding: 8px 14px;
    border-top: 1px solid var(--border-hairline);
    color: var(--ink-muted);
    font-size: var(--text-sm);
  }
  @media (prefers-reduced-motion: reduce) {
    .jump-skeleton-bar {
      animation: none;
      opacity: 0.6;
    }
  }
</style>
