<script lang="ts">
  import { goto } from "$app/navigation";
  // biome-ignore lint/performance/noNamespaceImport: shadcn-svelte component-group convention
  import * as Command from "$lib/components/ui/command";
  import { Kbd } from "$lib/components/ui/kbd";
  import { ACTIVITY_LABEL } from "./activity";
  import { whiffle } from "./client.svelte";
  import { buildJumpIndex, filterJumpIndex } from "./jump-index";
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
  const snippetMarkers = /「|」/;
  const segments = (snippet: string) => snippet.split(snippetMarkers);

  async function jump(href: string) {
    open = false;
    await goto(href);
  }
</script>

<Command.Dialog
  class="sm:max-w-xl"
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
            <span class="truncate">{entry.label}</span>
            <span
              class="ml-auto truncate font-mono text-xs text-muted-foreground"
            >
              {entry.detail}
            </span>
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
            onSelect={() => jump(`/session/${hit.instanceId ?? hit.sessionId}`)}
            value={`hit:${hit.docId}`}
          >
            <span class="truncate">
              {#each segments(hit.snippet) as part, i (i)}
                {#if i % 2 === 1}
                  <span class="font-medium text-foreground">{part}</span>
                {:else}
                  {part}
                {/if}
              {/each}
            </span>
            <span
              class="ml-auto truncate font-mono text-xs text-muted-foreground"
            >
              {hostOf.get(hit.machineId) ?? hit.machineId}
              · {hit.role}
            </span>
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
