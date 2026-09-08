<script lang="ts">
  /**
   * Fleet memory, as the thing it actually is: a small set of files somebody
   * edits. A rail that stays put to move between them, and one pane that is
   * always the editor — there is no reading mode to leave, so nothing shifts
   * under the pointer when you decide to type, and no click is spent asking
   * for permission to edit your own file.
   */
  import { untrack } from "svelte";
  import { toast } from "svelte-sonner";
  import MarkdownEditor from "$lib/components/features/MarkdownEditor.svelte";
  // biome-ignore lint/performance/noNamespaceImport: shadcn-svelte component-group convention
  import * as Alert from "$lib/components/ui/alert";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  // biome-ignore lint/performance/noNamespaceImport: shadcn-svelte component-group convention
  import * as Tooltip from "$lib/components/ui/tooltip";
  import {
    IconCheck,
    IconPlus,
    IconSpinner,
    IconTrash,
    IconWarningTriangle,
  } from "$lib/icons";
  import { formatDistanceToNow } from "$lib/utils/time";
  import { whiffle } from "$lib/whiffle/client.svelte";
  import {
    adoptMemory,
    adoptMemoryDoc,
    type FleetMemoryDocRow,
    type FleetMemoryRow,
    formatBytes,
    pushMemory,
    removeMemory,
    removeMemoryDoc,
    saveMemory,
    saveMemoryDoc,
  } from "$lib/whiffle/fleet";
  import { machineLabel } from "$lib/whiffle/machine";
  import { orderMachines } from "$lib/whiffle/rail.svelte";

  const { data } = $props();

  /** The main file has no path under memories/, so the empty string is it. */
  const FLEET = "";

  let memory = $state<FleetMemoryRow | null>(untrack(() => data.memory));
  let docs = $state<FleetMemoryDocRow[]>(untrack(() => data.memoryDocs));
  let selected = $state(FLEET);
  let filter = $state("");
  let busy = $state(false);
  let drafting = $state(false);
  let newPath = $state("");

  const machines = $derived(orderMachines(whiffle.machines));

  const savedFor = (path: string): string =>
    path === FLEET
      ? (memory?.content ?? "")
      : (docs.find((doc) => doc.path === path)?.content ?? "");

  /**
   * One draft per file, kept while you move between them: switching away from
   * something half-written and back again returns it, because a rail you are
   * afraid to click is a rail that does not work.
   */
  let drafts = $state<Record<string, string>>({});
  let text = $state(untrack(() => data.memory?.content ?? ""));

  const dirty = $derived(text !== savedFor(selected));
  const bytes = $derived(new TextEncoder().encode(text).length);
  /** Roughly what this costs a session, at the usual ~4 bytes a token. */
  const tokens = $derived(Math.round(bytes / 4));

  function pick(path: string) {
    if (path === selected) {
      return;
    }
    drafts[selected] = text;
    selected = path;
    text = drafts[path] ?? savedFor(path);
  }

  const labelOf = (path: string) =>
    path === FLEET ? "~/.claude/CLAUDE.md" : `~/.claude/memories/${path}`;
  const shortOf = (path: string) =>
    path === FLEET ? "CLAUDE.md" : path.replace(/^models\//, "");

  const stateOf = (machine: (typeof machines)[number], path: string) =>
    path === FLEET
      ? machine.fleet?.memory
      : machine.fleet?.memoryDocs?.[path];
  const appliedOn = (path: string) =>
    machines.filter((row) => stateOf(row, path)?.state === "applied");
  const driftedOn = (path: string) =>
    machines.filter((row) => stateOf(row, path)?.state === "failed");
  const names = (rows: typeof machines) =>
    rows.map((row) => machineLabel(row.hostname)).join(", ");

  const shown = $derived(
    docs.filter((doc) =>
      filter.trim() === ""
        ? true
        : doc.path.toLowerCase().includes(filter.trim().toLowerCase())
    )
  );

  const message = (caught: unknown) =>
    caught instanceof Error ? caught.message : String(caught);

  async function commit() {
    if (!dirty || busy) {
      return;
    }
    busy = true;
    try {
      if (selected === FLEET) {
        const result = await saveMemory(text, memory?.hash);
        if (result.ok) {
          memory = result.memory;
          delete drafts[FLEET];
        } else {
          toast.error(
            "Changed elsewhere while you edited. Nothing was overwritten."
          );
        }
      } else {
        const doc = docs.find((row) => row.path === selected);
        const result = await saveMemoryDoc(selected, text, doc?.hash);
        if (result.ok) {
          const landed = result.doc;
          docs = docs.some((row) => row.path === landed.path)
            ? docs.map((row) => (row.path === landed.path ? landed : row))
            : [...docs, landed].sort((a, b) => a.path.localeCompare(b.path));
          delete drafts[selected];
        } else {
          toast.error(
            `${selected} changed elsewhere while you edited. Nothing was overwritten.`
          );
        }
      }
    } catch (caught) {
      toast.error(message(caught));
    } finally {
      busy = false;
    }
  }

  function keydown(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      // biome-ignore lint/complexity/noVoid: fire-and-forget — commit owns its errors
      void commit();
    }
  }

  async function create() {
    const path = newPath.trim();
    if (path === "") {
      return;
    }
    if (docs.some((doc) => doc.path === path)) {
      toast.error(`${path} already exists.`);
      pick(path);
      drafting = false;
      return;
    }
    busy = true;
    try {
      const result = await saveMemoryDoc(path, "");
      if (result.ok) {
        docs = [...docs, result.doc].sort((a, b) =>
          a.path.localeCompare(b.path)
        );
        drafting = false;
        newPath = "";
        pick(path);
      }
    } catch (caught) {
      toast.error(message(caught));
    } finally {
      busy = false;
    }
  }

  async function drop() {
    busy = true;
    try {
      if (selected === FLEET) {
        await removeMemory();
        memory = null;
      } else {
        const gone = selected;
        await removeMemoryDoc(gone);
        docs = docs.filter((doc) => doc.path !== gone);
        pick(FLEET);
      }
    } catch (caught) {
      toast.error(message(caught));
    } finally {
      busy = false;
    }
  }

  async function adopt(machineId: string) {
    busy = true;
    try {
      if (selected === FLEET) {
        memory = await adoptMemory(machineId);
        text = memory.content;
      } else {
        const landed = await adoptMemoryDoc(machineId, selected);
        docs = docs.map((row) => (row.path === landed.path ? landed : row));
        text = landed.content;
      }
      delete drafts[selected];
    } catch (caught) {
      toast.error(message(caught));
    } finally {
      busy = false;
    }
  }

  async function overwrite(machineId: string) {
    busy = true;
    try {
      await pushMemory(machineId, selected === FLEET ? undefined : selected);
      toast.success("That machine takes the fleet's copy.");
    } catch (caught) {
      toast.error(message(caught));
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head><title>Memory &middot; Whiffle</title></svelte:head>
<svelte:window onkeydown={keydown} />

<Tooltip.Provider>
  <div class="shell">
    <!-- The rail. Never scrolls with the file it is pointing at. -->
    <aside class="rail">
      <div class="railhead">
        <Input
          aria-label="Filter documents"
          class="h-8"
          placeholder="Filter…"
          bind:value={filter}
        />
      </div>
      <nav class="raillist">
        <p class="group">Fleet</p>
        {@render row(FLEET)}
        <p class="group">Model documents</p>
        {#each shown as doc (doc.path)}
          {@render row(doc.path)}
        {/each}
        {#if shown.length === 0}
          <p class="empty">No document matches.</p>
        {/if}
      </nav>
      <div class="railfoot">
        {#if drafting}
          <form
            onsubmit={(event) => {
              event.preventDefault();
              // biome-ignore lint/complexity/noVoid: fire-and-forget — create owns its errors
              void create();
            }}
          >
            <!-- svelte-ignore a11y_autofocus -->
            <Input
              aria-label="New document path"
              autofocus
              class="h-8 font-mono"
              onblur={() => (drafting = false)}
              placeholder="models/deepseek-v4.md"
              bind:value={newPath}
            />
          </form>
        {:else}
          <Button
            class="w-full justify-start"
            onclick={() => (drafting = true)}
            size="xs"
            variant="ghost"><IconPlus class="shrink-0" />New document</Button
          >
        {/if}
      </div>
    </aside>

    <!-- The file. One pane, always the editor. -->
    <section class="detail">
      <header class="dhead">
        <span class="path" title={labelOf(selected)}>{labelOf(selected)}</span>
        <span class="stat">{formatBytes(bytes)}</span>
        <Tooltip.Root>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <span class="stat" {...props}>~{tokens.toLocaleString()} tokens</span
              >
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Content
            >Roughly what this file costs every session that loads it, estimated
            at about four bytes a token</Tooltip.Content
          >
        </Tooltip.Root>
        {@render sync(selected)}
        <span class="spacer"></span>
        <Tooltip.Root>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                aria-label="Delete this document"
                class="text-muted-foreground hover:text-destructive"
                disabled={busy || (selected === FLEET && memory === null)}
                onclick={drop}
                size="icon-sm"
                variant="ghost"><IconTrash /></Button
              >
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Content
            >Takes it off every machine that still has Whiffle's copy</Tooltip.Content
          >
        </Tooltip.Root>
      </header>

      {#if driftedOn(selected).length > 0}
        <div class="drift">
          {#each driftedOn(selected) as machine (machine.machineId)}
            {@const online = machine.status === 'online'}
            <div class="driftrow">
              <IconWarningTriangle class="size-3.5 shrink-0 text-warning" />
              <span class="dname">{machineLabel(machine.hostname)}</span>
              <span class="dsay"
                >kept its own copy{online ? '' : ' — offline, it syncs when back'}</span
              >
              <Button
                disabled={!online || busy}
                onclick={() => adopt(machine.machineId)}
                size="xs"
                variant="outline">Adopt theirs</Button
              >
              <Button
                disabled={!online || busy}
                onclick={() => overwrite(machine.machineId)}
                size="xs"
                variant="outline">Send ours</Button
              >
            </div>
          {/each}
        </div>
      {/if}

      {#if data.fleetError}
        <div class="pad">
          <Alert.Root
            class="items-center rounded-[var(--radius-control)] border-[var(--warning-9)] bg-[var(--warning-3)] p-[var(--space-3)]"
          >
            <IconWarningTriangle />
            <Alert.Description class="text-caption text-[var(--warning-11)]"
              >{data.fleetError}</Alert.Description
            >
          </Alert.Root>
        </div>
      {/if}

      <div class="editor">
        {#key selected}
          <MarkdownEditor label={labelOf(selected)} bind:value={text} />
        {/key}
      </div>

      <footer class="dfoot">
        {#if busy}
          <span class="say"
            ><IconSpinner class="size-3.5 shrink-0 animate-spin" />Saving…</span
          >
        {:else if dirty}
          <span class="say say-dirty">Unsaved changes</span>
        {:else}
          <span class="say"
            ><IconCheck class="size-3.5 shrink-0 text-success" />Saved{#if selected === FLEET && memory}
              {formatDistanceToNow(new Date(memory.updatedAt))}{/if}</span
          >
        {/if}
        <span class="spacer"></span>
        <kbd class="kbd">⌘S</kbd>
        <Button disabled={!dirty || busy} onclick={commit} size="xs"
          >Save</Button
        >
      </footer>
    </section>
  </div>
</Tooltip.Provider>

{#snippet row(path: string)}
  {@const applied = appliedOn(path)}
  {@const drifted = driftedOn(path)}
  <button
    aria-current={selected === path}
    class="rrow"
    class:on={selected === path}
    onclick={() => pick(path)}
    type="button"
  >
    <span class="rname">{shortOf(path)}</span>
    {#if drifted.length > 0}
      <span class="dot dot-warn" title={names(drifted)}></span>
    {:else if applied.length > 0}
      <span class="dot dot-ok" title={names(applied)}></span>
    {:else}
      <span class="dot"></span>
    {/if}
    {#if drafts[path] !== undefined && drafts[path] !== savedFor(path)}
      <span class="pip" title="Unsaved changes">•</span>
    {/if}
  </button>
{/snippet}

{#snippet sync(path: string)}
  {@const applied = appliedOn(path)}
  {@const drifted = driftedOn(path)}
  {#if drifted.length > 0}
    <span class="chip chip-warn" title={names(drifted)}
      >{drifted.length} kept own</span
    >
  {:else if applied.length > 0}
    <span class="chip" title={names(applied)}>in sync on {applied.length}</span>
  {/if}
{/snippet}

<style>
  .shell {
    display: flex;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }
  .rail {
    display: flex;
    flex-direction: column;
    width: 260px;
    flex-shrink: 0;
    min-height: 0;
    border-right: 1px solid var(--border-hairline);
    background: var(--surface-sunken);
  }
  .railhead,
  .railfoot {
    padding: var(--space-3);
    flex-shrink: 0;
  }
  .railfoot {
    border-top: 1px solid var(--border-hairline);
  }
  .raillist {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    padding: 0 var(--space-2) var(--space-2);
  }
  .group {
    padding: var(--space-3) var(--space-2) var(--space-1);
    font-size: var(--text-xs);
    color: var(--ink-label);
  }
  .empty {
    padding: var(--space-2);
    font-size: var(--text-xs);
    color: var(--ink-muted);
  }
  .rrow {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    padding: var(--space-2);
    border-radius: var(--radius-control);
    text-align: left;
    font-size: var(--text-base);
    color: var(--ink-body);
  }
  .rrow:hover {
    background: var(--surface-hover);
  }
  .rrow.on {
    background: var(--surface-active);
    color: var(--ink-strong);
  }
  .rname {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
  }
  .dot {
    width: 6px;
    height: 6px;
    border-radius: 999px;
    flex-shrink: 0;
    background: var(--border-divider);
  }
  .dot-ok {
    background: var(--success-9);
  }
  .dot-warn {
    background: var(--warning-9);
  }
  .pip {
    color: var(--accent-9);
    line-height: 1;
  }

  .detail {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
  }
  .dhead,
  .dfoot {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-shrink: 0;
    padding: var(--space-2) var(--space-4);
  }
  .dhead {
    border-bottom: 1px solid var(--border-hairline);
  }
  .dfoot {
    border-top: 1px solid var(--border-hairline);
  }
  .path {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--ink-strong);
  }
  .stat,
  .say {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    flex-shrink: 0;
    font-size: var(--text-xs);
    color: var(--ink-muted);
  }
  .say-dirty {
    color: var(--ink-strong);
  }
  .spacer {
    flex: 1 1 auto;
  }
  .chip {
    flex-shrink: 0;
    padding: 2px var(--space-2);
    border-radius: var(--radius-pill);
    background: var(--surface-hover);
    font-size: var(--text-xs);
    color: var(--ink-muted);
  }
  .chip-warn {
    background: var(--warning-3);
    color: var(--warning-11);
  }
  .kbd {
    flex-shrink: 0;
    padding: 1px var(--space-2);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-control);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--ink-muted);
  }
  /* The one scroll region on the page. */
  .editor {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
  }
  .pad {
    padding: var(--space-3) var(--space-4);
  }
  .drift {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    flex-shrink: 0;
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--border-hairline);
    background: var(--warning-3);
  }
  .driftrow {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }
  .dname {
    font-size: var(--text-xs);
    font-weight: var(--weight-strong);
    color: var(--ink-strong);
  }
  .dsay {
    flex: 1 1 auto;
    min-width: 0;
    font-size: var(--text-xs);
    color: var(--ink-muted);
  }

  @media (max-width: 767px) {
    .shell {
      flex-direction: column;
    }
    .rail {
      width: 100%;
      max-height: 40%;
      border-right: 0;
      border-bottom: 1px solid var(--border-hairline);
    }
  }
</style>
