<script lang="ts">
  /**
   * Fleet memory, as the thing it actually is: a small set of files somebody
   * edits. A rail that stays put to move between them, and one pane that is
   * always the editor — there is no reading mode to leave, so nothing shifts
   * under the pointer when you decide to type, and no click is spent asking
   * for permission to edit your own file.
   */
  import { tick, untrack } from "svelte";
  import { toast } from "svelte-sonner";
  import MarkdownEditor from "$lib/components/features/MarkdownEditor.svelte";
  // biome-ignore lint/performance/noNamespaceImport: shadcn-svelte component-group convention
  import * as Alert from "$lib/components/ui/alert";
  import { Button } from "$lib/components/ui/button";
  // biome-ignore lint/performance/noNamespaceImport: shadcn-svelte component-group convention
  import * as Card from "$lib/components/ui/card";
  import { Input } from "$lib/components/ui/input";
  // biome-ignore lint/performance/noNamespaceImport: shadcn-svelte component-group convention
  import * as Tooltip from "$lib/components/ui/tooltip";
  import {
    IconCheck,
    IconPlus,
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

  /** The rail's running order, so a switch knows which way it travelled. */
  const orderOf = (path: string) =>
    path === FLEET ? -1 : docs.findIndex((doc) => doc.path === path);

  function swap(path: string) {
    drafts[selected] = text;
    selected = path;
    text = drafts[path] ?? savedFor(path);
  }

  /**
   * Switching files is a view transition, the same one the sidebar spokes use
   * (`+layout.svelte` → `--vt-*` → `::view-transition-*(content)` in app.css).
   * It is not a navigation, so `onNavigate` never sees it and this drives the
   * API directly: the direction comes from the rail's own order, so moving
   * down the list pushes the old file up and brings the new one from below.
   *
   * The selection is a named element rather than a background, so the API
   * morphs it from the old row to the new one instead of repainting it.
   */
  async function pick(path: string) {
    if (path === selected) {
      return;
    }
    // Same three stand-downs the layout uses: no API, hidden tab, reduced motion.
    if (
      typeof document === "undefined" ||
      !document.startViewTransition ||
      document.hidden ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      swap(path);
      return;
    }

    const down = orderOf(path) > orderOf(selected);
    const el = document.documentElement;
    el.dataset.memvt = "1";
    el.style.setProperty("--vt-mem-old-y", down ? "-6%" : "6%");
    el.style.setProperty("--vt-mem-new-y", down ? "6%" : "-6%");

    const run = document.startViewTransition(async () => {
      swap(path);
      // The snapshot is taken when this resolves, so the DOM has to be the new
      // one by then — without the tick it captures the file it just left.
      await tick();
    });
    const clear = () => {
      delete el.dataset.memvt;
      el.style.removeProperty("--vt-mem-old-y");
      el.style.removeProperty("--vt-mem-new-y");
    };
    run.finished.then(clear, clear);
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
    <nav class="rail" aria-label="Memory documents">
      <div class="railhead">
        <Input
          aria-label="Filter documents"
          placeholder="Filter…"
          bind:value={filter}
        />
      </div>
      <div class="raillist">
        <h2 class="group" id="fleet-documents">Fleet</h2>
        <ul aria-labelledby="fleet-documents">
          <li>{@render row(FLEET)}</li>
        </ul>
        <h2 class="group" id="model-documents">Model documents</h2>
        <ul aria-labelledby="model-documents">
          {#each shown as doc (doc.path)}
            <li>{@render row(doc.path)}</li>
          {/each}
        </ul>
        {#if shown.length === 0}
          <p class="empty">No document matches.</p>
        {/if}
      </div>
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
               class="font-mono"
              onblur={() => (drafting = false)}
              placeholder="models/deepseek-v4.md"
              bind:value={newPath}
            />
          </form>
        {:else}
          <Button
            class="memory-action w-full justify-start"
            onclick={() => (drafting = true)}
            size="xs"
            variant="outline"><IconPlus class="shrink-0" />New document</Button
          >
        {/if}
      </div>
    </nav>

    <!-- The file. One pane, always the editor. -->
    <section class="detail" aria-label="Document editor">
      <Card.Root class="memory-panel min-h-0 flex-1 gap-0 rounded-[var(--radius-panel)] bg-[var(--surface-raised)] p-[var(--space-2)] shadow-[var(--shadow-hairline)] ring-0">
      <header class="dhead">
        <span class="path" title={labelOf(selected)}>{labelOf(selected)}</span>
        <div class="metadata" aria-label="Document details">
        <span class="stat">{formatBytes(bytes)}</span>
        <Tooltip.Root>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <button type="button" class="stat token-estimate" {...props}>~{tokens.toLocaleString()} tokens</button
              >
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Content
            >Roughly what this file costs every session that loads it, estimated
            at about four bytes a token</Tooltip.Content
          >
        </Tooltip.Root>
        {@render sync(selected)}
        </div>
        <span class="spacer"></span>
        <Tooltip.Root>
          <Tooltip.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                aria-label="Delete this document"
                class="memory-action delete-action"
                disabled={busy || (selected === FLEET && memory === null)}
                onclick={drop}
                size="icon-sm"
                variant="secondary"><IconTrash /></Button
              >
            {/snippet}
          </Tooltip.Trigger>
          <Tooltip.Content
            >Takes it off every machine that still has Whiffle's copy</Tooltip.Content
          >
        </Tooltip.Root>
      </header>

      <div class="editor-well">
      <div class="editor">
      {#if driftedOn(selected).length > 0}
        <div class="drift">
          {#each driftedOn(selected) as machine (machine.machineId)}
            {@const online = machine.status === 'online'}
            <div class="driftrow">
              <IconWarningTriangle class="attention-glyph" />
              <span class="dname">{machineLabel(machine.hostname)}</span>
              <span class="dsay"
                >kept its own copy{online ? '' : ' — offline, it syncs when back'}</span
              >
              <Button
                class="memory-action"
                disabled={!online || busy}
                onclick={() => adopt(machine.machineId)}
                size="xs"
                variant="outline">Adopt theirs</Button
              >
              <Button
                class="memory-action"
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
            class="items-center rounded-[var(--radius-well)] border-[var(--border-control)] bg-[var(--surface-field)] p-[var(--space-3)]"
          >
            <IconWarningTriangle />
            <Alert.Description class="text-[length:var(--text-sm)] text-[var(--ink-body)]"
              >{data.fleetError}</Alert.Description
            >
          </Alert.Root>
        </div>
      {/if}

        {#key selected}
          <MarkdownEditor label={labelOf(selected)} bind:value={text} />
        {/key}
      </div>
      </div>

      <footer class="dfoot">
        <span role="status" class="save-status">
        {#if busy}
          <span class="say">Saving…</span>
        {:else if dirty}
          <span class="say say-dirty">Unsaved changes</span>
        {:else}
          <span class="say"
             ><IconCheck />Saved{#if selected === FLEET && memory}
               <span>{formatDistanceToNow(new Date(memory.updatedAt))}</span>{/if}</span
          >
        {/if}
        </span>
        <span class="spacer"></span>
        <kbd class="kbd">⌘S</kbd>
        <Button class="memory-action save-action" disabled={!dirty || busy} onclick={commit} size="xs"
          >Save</Button
        >
      </footer>
      </Card.Root>
    </section>
  </div>
</Tooltip.Provider>

{#snippet row(path: string)}
  {@const applied = appliedOn(path)}
  {@const drifted = driftedOn(path)}
  <button
    aria-current={selected === path ? 'page' : undefined}
    class="rrow"
    class:on={selected === path}
    onclick={() => pick(path)}
    type="button"
  >
    {#if selected === path}
      <span class="rowsel"></span>
    {/if}
    <span class="rname">{shortOf(path)}</span>
    {#if drifted.length > 0}
      <span class="row-state" title={names(drifted)}><IconWarningTriangle /><span class="sr-only">Kept own copy</span></span>
    {:else if applied.length > 0}
      <span class="row-state" title={names(applied)}><IconCheck /><span class="sr-only">In sync</span></span>
    {:else}
      <span class="dot" role="img" aria-label="Not synced"></span>
    {/if}
    {#if path === selected ? dirty : drafts[path] !== undefined && drafts[path] !== savedFor(path)}
      <span class="draft-label">Unsaved</span>
    {/if}
  </button>
{/snippet}

{#snippet sync(path: string)}
  {@const applied = appliedOn(path)}
  {@const drifted = driftedOn(path)}
  {#if drifted.length > 0}
    <span class="chip chip-warn" title={names(drifted)}
      ><IconWarningTriangle />{drifted.length} kept own</span
    >
  {:else if applied.length > 0}
    <span class="chip" title={names(applied)}><IconCheck />in sync on {applied.length}</span>
  {/if}
{/snippet}

<style>
  /* The transition itself, matching the app's own: 120ms on the same curve
     app.css uses for ::view-transition-*(content), direction from --vt-mem-*.
     The rail is held still the way the sidebar and topbar are, and `content`
     is silenced while this runs so the whole page does not slide underneath
     the pane that is already sliding. */
  :global(html[data-memvt])::view-transition-old(content),
  :global(html[data-memvt])::view-transition-new(content) {
    animation: none;
  }
  :global(::view-transition-old(memory-rail)),
  :global(::view-transition-new(memory-rail)) {
    animation: none;
  }
  :global(::view-transition-old(memory-detail)) {
    animation: 120ms cubic-bezier(0.32, 0.72, 0, 1) both vt-mem-exit;
  }
  :global(::view-transition-new(memory-detail)) {
    animation: 120ms cubic-bezier(0.32, 0.72, 0, 1) both vt-mem-enter;
  }
  @keyframes vt-mem-exit {
    to {
      transform: translateY(var(--vt-mem-old-y, -6%));
      opacity: 0;
    }
  }
  @keyframes vt-mem-enter {
    from {
      transform: translateY(var(--vt-mem-new-y, 6%));
      opacity: 0;
    }
  }
  /* The highlight morphs; it must not also fade, or the move reads as a blink. */
  :global(::view-transition-group(memory-selection)) {
    animation-duration: 120ms;
    animation-timing-function: cubic-bezier(0.32, 0.72, 0, 1);
  }
  :global(::view-transition-old(memory-selection)),
  :global(::view-transition-new(memory-selection)) {
    animation: none;
  }

  .shell {
    display: flex;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    color: var(--ink-body);
    font-size: var(--text-base);
    line-height: var(--leading-body);
    background: var(--surface-field);
  }
  .rail {
    view-transition-name: memory-rail;
    display: flex;
    flex-direction: column;
    width: calc(var(--space-8) * 8);
    flex-shrink: 0;
    min-height: 0;
    border-right: 1px solid var(--border-divider);
    background: var(--surface-raised);
  }
  .railhead,
  .railfoot {
    flex-shrink: 0;
  }
  .railhead {
    padding: var(--space-5) var(--space-3) var(--space-3) var(--space-4);
  }
  .railfoot {
    padding: var(--space-3) var(--space-3) var(--space-4) var(--space-4);
    border-top: 1px solid var(--border-divider);
  }
  .raillist {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 0 var(--space-2) var(--space-2);
  }
  .raillist ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .raillist li + li {
    border-top: 1px solid var(--border-hairline);
  }
  .group {
    margin: 0;
    padding: var(--space-4) var(--space-2) var(--space-2);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
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
    min-height: var(--c-nav-h);
    padding: var(--space-3) var(--space-2);
    border-radius: var(--radius-control);
    text-align: left;
    font-size: var(--text-base);
    color: var(--ink-body);
  }
  .rrow {
    position: relative;
  }
  .rrow.on {
    color: var(--ink-strong);
    font-weight: var(--weight-strong);
  }
  /* The selection is drawn as its own element, and only the selected row has
     one, so the View Transitions API matches it across the swap by name and
     moves it between rows rather than repainting a background. */
  .rowsel {
    position: absolute;
    inset: 0;
    z-index: 0;
    border-radius: var(--radius-control);
    background: var(--surface-active);
    box-shadow: var(--shadow-inset-sel);
    view-transition-name: memory-selection;
  }
  .rrow > :not(.rowsel) {
    position: relative;
    z-index: 1;
  }
  .rname {
    flex: 1 1 auto;
    min-width: 0;
    overflow-wrap: anywhere;
    font-family: var(--font-mono);
    font-size: var(--text-base);
  }
  .dot {
    width: var(--space-2);
    height: var(--space-2);
    border-radius: var(--radius-pill);
    flex-shrink: 0;
    border: 1px solid var(--ink-muted);
  }
  .row-state {
    display: inline-flex;
    color: var(--ink-muted);
  }
  .draft-label {
    font-size: var(--text-xs);
    font-weight: var(--weight-strong);
    color: var(--ink-strong);
  }

  .detail {
    view-transition-name: memory-detail;
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    padding: var(--space-5) var(--space-6) var(--space-4) var(--space-7);
  }
  .dhead,
  .dfoot {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    flex-shrink: 0;
    flex-wrap: wrap;
    padding: var(--space-3) var(--space-4) var(--space-3) var(--space-5);
  }
  .dhead {
    padding-top: var(--space-2);
    padding-bottom: var(--space-4);
  }
  .dfoot {
    padding-bottom: var(--space-1);
  }
  .path {
    min-width: 0;
    flex: 1 1 100%;
    overflow-wrap: anywhere;
    font-family: var(--font-mono);
    font-size: var(--text-base);
    font-weight: var(--weight-medium);
    color: var(--ink-strong);
  }
  .metadata {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-well);
    background: var(--surface-field);
  }
  .stat,
  .say {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--text-sm);
    color: var(--ink-muted);
  }
  .token-estimate {
    min-height: var(--c-pill-h);
    border-radius: var(--radius-tile);
  }
  .save-status {
    display: flex;
    min-width: 0;
  }
  .say-dirty {
    color: var(--ink-strong);
    font-weight: var(--weight-strong);
  }
  .spacer {
    flex: 1 1 auto;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--text-sm);
    color: var(--ink-muted);
  }
  .chip-warn {
    color: var(--status-attn-ink);
  }
  .kbd {
    flex-shrink: 0;
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-control);
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--ink-muted);
  }
  .editor-well {
    display: flex;
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-well);
    background: var(--surface-field);
  }
  .editor {
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .pad {
    padding: var(--space-3) var(--space-6) var(--space-3) var(--space-7);
  }
  .drift {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    flex-shrink: 0;
    padding: var(--space-3) var(--space-6) var(--space-4) var(--space-7);
    border-bottom: 1px solid var(--border-divider);
  }
  .driftrow {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }
  .dname {
    font-size: var(--text-sm);
    font-weight: var(--weight-strong);
    color: var(--ink-strong);
  }
  .dsay {
    flex: 1 1 auto;
    min-width: 0;
    overflow-wrap: anywhere;
    font-size: var(--text-sm);
    color: var(--ink-muted);
  }
  .shell :global(svg) {
    width: var(--space-4);
    height: var(--space-4);
    flex-shrink: 0;
  }
  .shell :global(.attention-glyph) {
    color: var(--status-attn-ink);
    background: var(--status-attn-bg);
    border-radius: var(--radius-mark);
  }
  .shell :global(button),
  .shell :global(input) {
    transition: none;
    line-height: var(--leading-ui);
  }
  .shell :global(.memory-action) {
    height: auto;
    min-height: var(--space-8);
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-control);
    border-color: var(--border-control);
    color: var(--ink-strong);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    box-shadow: var(--shadow-tile);
    transform: none;
    filter: none;
  }
  .shell :global(input) {
    height: var(--space-8);
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border-control);
    border-radius: var(--radius-control);
    background: var(--surface-field);
    font-size: var(--text-base);
    box-shadow: none;
  }
  .shell :global(.save-action) {
    background: var(--gradient-action);
    color: var(--on-brand);
    box-shadow: var(--shadow-action);
    border-color: transparent;
  }
  .shell :global(.delete-action) {
    background: var(--surface-field);
    box-shadow: none;
  }
  .shell :global(button:active) {
    background: var(--surface-active);
    color: var(--ink-strong);
    transform: none;
  }
  .shell :global(.memory-action:active) {
    box-shadow: var(--shadow-inset-sel);
  }
  .shell :global(:is(button, input):focus-visible) {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
    box-shadow: none;
  }
  @media (hover: hover) {
    .shell :global(button:hover:not(:disabled):not(:active)) {
      background: var(--surface-hover);
      color: var(--ink-strong);
    }
    .shell :global(.save-action:hover:not(:disabled):not(:active)) {
      background: var(--gradient-action);
      color: var(--on-brand);
    }
    .rrow.on:hover {
      background: var(--surface-active);
    }
  }
  @media (hover: none) {
    .shell :global(.memory-action:hover:not(:active)) {
      background: var(--surface-raised);
    }
    .shell :global(.save-action:hover:not(:active)) {
      background: var(--gradient-action);
    }
    .shell :global(.delete-action:hover:not(:active)) {
      background: var(--surface-field);
    }
  }
  @media (pointer: coarse) {
    .shell :global(button),
    .shell :global(.memory-action),
    .shell :global(input) {
      min-width: var(--c-btn-h);
      min-height: var(--c-btn-h);
    }
  }

  @media (max-width: 767px) {
    .shell {
      flex-direction: column;
    }
    .rail {
      width: 100%;
      height: 30%;
      min-height: calc(var(--space-8) * 4);
      border-right: 0;
      border-bottom: 1px solid var(--border-divider);
    }
    .railhead,
    .railfoot {
      padding-block: var(--space-2);
    }
    .detail {
      padding: var(--space-3) var(--space-2);
    }
    .dhead,
    .dfoot {
      gap: var(--space-2);
      padding-inline: var(--space-2);
    }
  }
</style>
