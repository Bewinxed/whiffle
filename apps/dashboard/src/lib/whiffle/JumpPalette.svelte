<script lang="ts">
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

  /** One glyph per kind, so rows are told apart before they are read. */
  const GLYPH: Record<JumpKind, string> = {
    project: "◆",
    machine: "▣",
    live: "●",
    stored: "◇",
  };

  const snippetMarkers = /「|」/;
  /** The same markers for stripping: `replaceAll` refuses a non-global regex. */
  const allSnippetMarkers = /「|」/g;
  /** FTS5 wraps every matched term in 「…」; odd segments are the matches. */
  const segments = (snippet: string) => snippet.split(snippetMarkers);
  const plain = (snippet: string) => snippet.replaceAll(allSnippetMarkers, "");
  const leaf = (path: string) => path.split("/").filter(Boolean).pop() ?? path;

  async function jump(href: string) {
    open = false;
    await goto(href);
  }
</script>

<Command.Dialog
  class="sm:max-w-2xl"
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

  <Command.List class="max-h-[60vh]">
    {#if !search.pending}
      <Command.Empty>Nothing matches that.</Command.Empty>
    {/if}

    {#each grouped as group (group.name)}
      <Command.Group heading={group.name}>
        {#each group.rows as entry (entry.id)}
          <Command.Item onSelect={() => jump(entry.href)} value={entry.id}>
            <span
              aria-hidden="true"
              class="w-3 shrink-0 text-center text-[10px] text-muted-foreground/60"
              >{GLYPH[entry.kind]}</span
            >
            <JumpMatch
              class="min-w-0 flex-1 truncate"
              ranges={entry.labelRanges}
              text={entry.label}
            />
            <JumpMatch
              class="ml-auto max-w-[45%] shrink-0 truncate font-mono text-xs text-muted-foreground"
              ranges={entry.detailRanges}
              text={entry.detail}
            />
          </Command.Item>
        {/each}
      </Command.Group>
    {/each}

    {#if search.pending || search.hits.length > 0}
      <Command.Group heading="Transcripts">
        {#if search.pending && search.hits.length === 0}
          <Command.Loading>Searching transcripts…</Command.Loading>
        {/if}
        {#each search.hits as hit (hit.docId)}
          <Command.Item
            class="flex-col items-start gap-1 py-2"
            onSelect={() => jump(`/session/${hit.instanceId ?? hit.sessionId}`)}
            value={`hit:${hit.docId}`}
          >
            <!-- Which conversation this line came out of. Without it a list of
                 snippets is a list of strangers. -->
            <div class="flex w-full min-w-0 items-center gap-2">
              <span
                aria-hidden="true"
                class="w-3 shrink-0 text-center text-[10px] text-muted-foreground/60"
                >◇</span
              >
              <span class="min-w-0 flex-1 truncate">
                {index.sessionTitles.get(hit.sessionId) ??
                  (hit.cwd ? leaf(hit.cwd) : hit.sessionId.slice(0, 8))}
              </span>
              <span
                class="ml-auto shrink-0 font-mono text-xs text-muted-foreground"
              >
                {hostOf.get(hit.machineId) ?? hit.machineId}
                · {hit.role}
              </span>
            </div>
            <!-- And the line itself, with the terms that matched marked. -->
            <p
              class="w-full truncate pl-5 text-xs text-muted-foreground"
              title={plain(hit.snippet)}
            >
              {#each segments(hit.snippet) as part, i (i)}
                {#if i % 2 === 1}
                  <mark class="bg-transparent font-semibold text-foreground"
                    >{part}</mark
                  >
                {:else}
                  {part}
                {/if}
              {/each}
            </p>
          </Command.Item>
        {/each}
      </Command.Group>
    {/if}
  </Command.List>

  <div
    class="flex gap-4 border-t border-border px-4 py-2 text-xs text-muted-foreground"
  >
    <span><Kbd>↑↓</Kbd> navigate</span>
    <span><Kbd>↵</Kbd> open</span>
    <span><Kbd>esc</Kbd> close</span>
  </div>
</Command.Dialog>
