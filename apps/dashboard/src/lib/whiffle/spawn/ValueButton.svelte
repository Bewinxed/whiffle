<script lang="ts">
  import type { Snippet } from "svelte";
  import Chevron from "~icons/solar/alt-arrow-down-linear";

  let {
    label,
    meta,
    mark,
    empty = false,
    loading = false,
    expanded,
    onclick,
    element = $bindable(),
    id,
    disabled = false,
    reason,
  }: {
    label: string;
    meta?: string;
    mark?: Snippet;
    empty?: boolean;
    loading?: boolean;
    expanded: boolean;
    onclick: () => void;
    element?: HTMLButtonElement;
    id?: string;
    disabled?: boolean;
    reason?: string;
  } = $props();
  const uid = $props.id();
</script>

<button
  aria-describedby={reason ? `${uid}-reason` : undefined}
  aria-expanded={expanded}
  aria-haspopup="listbox"
  {disabled}
  {id}
  {onclick}
  type="button"
  bind:this={element}
  class:empty={empty}
>
  {#if mark}
    <span class="mark">{@render mark()}</span>
  {/if}
  <span class="label">{label}</span>
  {#if loading || meta}
    <span class="meta">{loading ? "Reading…" : meta}</span>
  {/if}
  <span class="chevron" class:expanded><Chevron /></span>
</button>
{#if reason}
  <span class="reason" id={`${uid}-reason`}>{reason}</span>
{/if}

<style>
  button {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    height: 32px;
    padding: 0 var(--space-3);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-well);
    background: var(--surface-field);
    color: var(--ink-row);
    font: 400 var(--text-base) / var(--leading-ui) var(--font-body);
    cursor: pointer;
  }
  .mark,
  .chevron {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }
  .label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .meta {
    margin-left: auto;
    color: var(--ink-muted);
    font-size: var(--text-sm);
    white-space: nowrap;
  }
  .chevron {
    margin-left: auto;
    color: var(--ink-muted);
    transition: transform var(--c-300) var(--e-in);
  }
  .expanded {
    transform: rotate(180deg);
  }
  .empty {
    color: var(--ink-muted);
  }
  button:active:not(:disabled) {
    background: var(--surface-active);
    box-shadow: var(--shadow-inset-sel);
  }
  button:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
  button:disabled {
    color: var(--ink-muted);
    opacity: 0.55;
    cursor: default;
  }
  .reason {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  @media (hover: hover) {
    button:hover:not(:disabled) {
      background: var(--surface-hover);
    }
  }
  @media (pointer: coarse) {
    button {
      min-height: 44px;
      min-width: 44px;
    }
  }
</style>
