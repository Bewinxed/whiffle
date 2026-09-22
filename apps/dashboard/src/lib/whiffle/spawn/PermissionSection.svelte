<script lang="ts">
  import type { PermissionMode } from "@whiffle/core";
  /** Permission-mode rows (§1.8, §2.11): sliding fill + mounted check. */
  import type { Component } from "svelte";
  import Check from "~icons/solar/check-circle-bold";
  import Danger from "~icons/solar/danger-triangle-bold-duotone";
  import Notes from "~icons/solar/notes-bold-duotone";
  import Pen from "~icons/solar/pen-new-square-bold-duotone";
  import Shield from "~icons/solar/shield-check-bold-duotone";
  import { FollowHover } from "./follow-hover.svelte";

  let {
    modes,
    value,
    onchange,
    embedded = false,
  }: {
    modes: { value: PermissionMode; disabled: boolean; reason?: string }[];
    value: PermissionMode | null;
    onchange: (mode: PermissionMode) => void;
    embedded?: boolean;
  } = $props();
  const uid = $props.id();
  const LOOK: Record<
    string,
    { name: string; desc: string; icon: Component; hue: string }
  > = {
    default: {
      name: "Ask before edits",
      desc: "Approve every file write and command.",
      icon: Shield,
      hue: "var(--fai-green-500)",
    },
    plan: {
      name: "Plan first",
      desc: "Read-only until you approve a plan.",
      icon: Notes,
      hue: "var(--fai-violet-400)",
    },
    acceptEdits: {
      name: "Auto-accept edits",
      desc: "Edits run freely; shell commands still ask.",
      icon: Pen,
      hue: "var(--fai-blue-500)",
    },
    bypassPermissions: {
      name: "Full access",
      desc: "No prompts. Use on disposable machines only.",
      icon: Danger,
      hue: "var(--fai-orange-500)",
    },
  };
  const rows = $derived(
    modes.map((mode) => ({
      ...mode,
      ...(LOOK[mode.value] ?? {
        name: mode.value,
        desc: "",
        icon: Shield,
        hue: "var(--fai-text-subtle)",
      }),
    }))
  );
  const index = $derived(
    Math.max(
      0,
      rows.findIndex((row) => row.value === value)
    )
  );
  const ghost = new FollowHover("y");
</script>

<div
  aria-label="Permission mode"
  class="perms"
  onmouseleave={ghost.leave}
  onmousemove={ghost.move}
  role="radiogroup"
  tabindex="-1"
  class:embedded={embedded}
>
  <span aria-hidden="true" class="ns-ghost" style={ghost.style}></span>
  <span
    aria-hidden="true"
    class="fill"
    style={`transform:translateY(calc(${index} * (var(--permission-row-height, 44px) + 2px)));opacity:${rows.some(row => row.value === value) ? 1 : 0}`}
  ></span>
  {#each rows as row, i (row.value)}
    {@const Icon = row.icon}
    {@const on = row.value === value}
    <!-- biome-ignore lint/a11y/useSemanticElements: the permission rows are designed tiles with a sliding fill; a native radio cannot render them -->
    <button
      aria-checked={on}
      aria-describedby={row.reason ? `${uid}-perm-${row.value}-reason` : undefined}
      class="row ns-in"
      data-fh="1"
      data-perm={row.value}
      disabled={row.disabled}
      onclick={() => onchange(row.value)}
      role="radio"
      style={`--delay:${i * 35}ms`}
      type="button"
    >
      <span class="ns-tile tile" style={`color:${row.hue}`}><Icon /></span>
      <span class="text">
        <span class="name">{row.name}</span>
        <span class="desc">{row.desc}</span>
      </span>
      {#if on}
        <Check class="check ns-check" />
      {/if}
      {#if row.reason}
        <span class="sr-only" id={`${uid}-perm-${row.value}-reason`}
          >{row.reason}</span
        >
      {/if}
    </button>
  {/each}
</div>

<style>
  .perms {
    position: relative;
    display: grid;
    gap: 2px;
    padding: 4px;
    background: var(--fai-surface);
    border: 1px solid var(--fai-border);
    border-radius: var(--fai-radius-md);
    box-shadow: var(--fai-shadow-xs);
  }
  .perms.embedded {
    padding: 0;
    border: 0;
    box-shadow: none;
    background: transparent;
  }
  .fill {
    position: absolute;
    left: 4px;
    right: 4px;
    top: 4px;
    height: var(--permission-row-height, 44px);
    background: var(--fai-fill);
    border-radius: var(--fai-radius-sm);
    transition: transform 160ms var(--ns-ease-in-out);
    pointer-events: none;
  }
  .embedded .fill {
    inset-inline: 0;
    top: 0;
  }
  .row {
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    height: var(--permission-row-height, 44px);
    padding: 6px 8px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--fai-radius-sm);
    cursor: pointer;
    text-align: left;
    color: var(--fai-text);
  }
  .row:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
  .tile {
    width: 26px;
    height: 26px;
  }
  .tile :global(svg) {
    width: 15px;
    height: 15px;
  }
  .text {
    flex: 1;
    min-width: 0;
  }
  .name {
    display: block;
    font: 500 13px / 1.3 var(--fai-font-sans);
  }
  .desc {
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
</style>
