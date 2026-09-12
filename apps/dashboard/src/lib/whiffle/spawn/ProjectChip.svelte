<script lang="ts">
  /** Project chip + popover (§1.4, §2.7): pick, clear, or create a project. */
  import Add from "~icons/solar/add-circle-linear";
  import Down from "~icons/solar/alt-arrow-down-linear";
  import Check from "~icons/solar/check-circle-bold";
  import Clear from "~icons/solar/close-square-linear";
  import Folder from "~icons/solar/folder-bold-duotone";
  import Files from "~icons/solar/folder-with-files-bold-duotone";
  import { FollowHover } from "./follow-hover.svelte";
  import NsPopover from "./NsPopover.svelte";
  import type { ProjectItem } from "./ns-types";

  let {
    projects,
    projectId,
    open,
    onchange,
    onpick,
    onclear,
    oncreate,
  }: {
    projects: ProjectItem[];
    projectId: string | undefined;
    open: boolean;
    onchange: (open: boolean) => void;
    onpick: (project: ProjectItem) => void;
    onclear: () => void;
    oncreate: (draft: { name: string; path: string }) => Promise<void>;
  } = $props();
  const project = $derived(projects.find((row) => row.id === projectId));
  let draft = $state<{ name: string; path: string } | null>(null);
  let creating = $state(false);
  let createError = $state("");
  const ghost = new FollowHover("y");
  const slug = (value: string) =>
    value.trim().toLowerCase().replace(/\s+/g, "-");
  $effect(() => {
    if (!open) {
      draft = null;
      createError = "";
    }
  });
  function onName(value: string) {
    if (!draft) {
      return;
    }
    const follows =
      draft.path === "" || draft.path === `~/code/${slug(draft.name)}`;
    draft = {
      name: value,
      path: follows ? `~/code/${slug(value)}` : draft.path,
    };
  }
  async function create() {
    if (!draft || creating) {
      return;
    }
    creating = true;
    createError = "";
    try {
      await oncreate({ name: draft.name.trim(), path: draft.path.trim() });
      draft = null;
    } catch (cause) {
      createError = cause instanceof Error ? cause.message : String(cause);
    } finally {
      creating = false;
    }
  }
</script>

<NsPopover
  gap={2}
  id="session-project"
  label="Project"
  {onchange}
  onmouseleave={ghost.leave}
  onmousemove={ghost.move}
  {open}
  triggerClass="ns-chip-btn"
  triggerStyle={project ? "" : "color:var(--fai-text-muted)"}
>
  {#snippet trigger()}
    <Files style="color:var(--fai-amber-500)" />
    <span class="chip-label">{project?.name ?? "No project"}</span>
    {#if project}
      <!-- biome-ignore lint/a11y/useSemanticElements: the clear control sits inside the chip trigger, which is already a button; buttons cannot nest -->
      <span
        class="clear ns-check"
        onclick={(event) => { event.stopPropagation(); onclear(); }}
        onkeydown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); onclear(); } }}
        role="button"
        tabindex="0"
        title="Clear project"
        ><Clear /></span
      >
    {:else}
      <Down class="chevron" />
    {/if}
  {/snippet}
  <span aria-hidden="true" class="ns-ghost" style={ghost.style}></span>
  {#if draft}
    <div class="ns-panel form">
      <label class="field">
        <Files />
        <input
          aria-label="Project name"
          autocapitalize="off"
          oninput={(event) => onName(event.currentTarget.value)}
          placeholder="Project name"
          spellcheck="false"
          value={draft.name}
        >
      </label>
      <label class="field">
        <Folder />
        <input
          aria-label="Project path"
          autocapitalize="off"
          class="mono"
          oninput={(event) => { if (draft) { draft = { ...draft, path: event.currentTarget.value }; } }}
          placeholder="~/code/project"
          spellcheck="false"
          value={draft.path}
        >
      </label>
      <div class="actions">
        <span class="error" role="alert">{createError}</span>
        <button
          class="ns-btn sm"
          onclick={() => { draft = null; }}
          type="button"
        >
          Back
        </button>
        <button
          class="ns-btn sm primary"
          disabled={creating || !(draft.name.trim() && draft.path.trim())}
          onclick={create}
          type="button"
        >
          Create
        </button>
      </div>
    </div>
  {:else}
    {#each projects as row, index (row.id)}
      {@const on = row.id === projectId}
      <button
        aria-pressed={on}
        class="row ns-in"
        data-fh="1"
        onclick={() => onpick(row)}
        style={`--delay:${index * 35}ms`}
        type="button"
        class:on={on}
      >
        <span class="ns-tile tile" style={`color:${row.hue}`}><Files /></span>
        <span class="text">
          <span class="name">{row.name}</span>
          <span class="meta">{row.path}</span>
        </span>
        {#if on}
          <Check class="check ns-check" />
        {/if}
      </button>
    {/each}
    <div class="divider"></div>
    <button
      class="row add ns-in"
      data-fh="1"
      onclick={() => { draft = { name: '', path: '' }; }}
      style="--delay:110ms"
      type="button"
    >
      <span class="ns-tile tile dashed"><Add /></span>
      <span class="name">New project…</span>
    </button>
  {/if}
</NsPopover>

<style>
  .clear {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    margin-right: -2px;
    border-radius: var(--fai-radius-xs);
    color: var(--fai-text-subtle);
    transition:
      background-color 120ms ease,
      color 120ms ease;
  }
  .clear :global(svg) {
    width: 13px;
    height: 13px;
  }
  .clear::before {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    width: max(100%, 44px);
    height: max(100%, 44px);
    transform: translate(-50%, -50%);
  }
  @media (hover: hover) {
    .clear:hover {
      background: var(--fai-hover);
      color: var(--fai-text);
    }
  }
  .row {
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    height: 44px;
    padding: 6px 8px;
    background: transparent;
    border: 0;
    border-radius: var(--fai-radius-sm);
    cursor: pointer;
    text-align: left;
    color: var(--fai-text);
    transition:
      background-color 160ms ease,
      transform 160ms var(--ns-ease-out);
  }
  .row.on {
    background: var(--fai-fill);
  }
  .tile {
    width: 24px;
    height: 24px;
  }
  .tile :global(svg) {
    width: 14px;
    height: 14px;
  }
  .text {
    flex: 1;
    min-width: 0;
  }
  .name {
    display: block;
    font: 500 13px / 1.3 var(--fai-font-sans);
  }
  .meta {
    display: block;
    font: var(--fai-type-meta);
    color: var(--fai-text-subtle);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .row :global(svg.check) {
    width: 16px;
    height: 16px;
    flex: none;
    color: var(--fai-grey-900);
  }
  .divider {
    height: 1px;
    margin: 4px 2px;
    background: var(--fai-border-subtle);
  }
  .add {
    height: 40px;
    color: var(--fai-text-muted);
  }
  @media (hover: hover) {
    .add:hover {
      color: var(--fai-text);
    }
  }
  .form {
    display: grid;
    gap: 8px;
    padding: 4px;
  }
  .field {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 36px;
    padding: 0 10px;
    background: var(--fai-surface);
    border: 1px solid var(--fai-border);
    border-radius: var(--fai-radius-md);
    box-shadow: var(--fai-shadow-xs);
  }
  .field :global(svg) {
    width: 14px;
    height: 14px;
    flex: none;
    color: var(--fai-text-subtle);
  }
  .field input {
    flex: 1;
    min-width: 0;
    border: 0;
    outline: none;
    background: transparent;
    font: 400 13px / 1.4 var(--fai-font-sans);
    color: var(--fai-text);
    padding: 0;
  }
  .field input.mono {
    font-family: var(--fai-font-mono);
  }
  .actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
    margin-top: 2px;
  }
  .error {
    flex: 1;
    min-width: 0;
    font: var(--fai-type-meta);
    color: var(--fai-status-expired-fg);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  @media (max-width: 640px) {
    .field {
      height: 44px;
    }
    .field input {
      font-size: 16px;
    }
  }
</style>
