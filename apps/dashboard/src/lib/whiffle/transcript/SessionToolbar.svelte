<script lang="ts">
  import { IconChat, IconFlow, IconWindow } from "$lib/icons";

  let {
    view,
    onview,
    previewOpen,
    previewAvailable,
    onpreview,
  }: {
    view: "chat" | "flow";
    onview: (view: "chat" | "flow") => void;
    previewOpen: boolean;
    previewAvailable: boolean;
    onpreview: () => void;
  } = $props();
</script>

<div class="session-toolbar">
  <fieldset aria-label="Transcript view" class="readings">
    <button
      aria-pressed={view === 'chat'}
      onclick={() => onview('chat')}
      type="button"
    >
      <IconChat />Conversation
    </button>
    <button
      aria-pressed={view === 'flow'}
      onclick={() => onview('flow')}
      type="button"
    >
      <IconFlow />Work
    </button>
  </fieldset>
  {#if previewAvailable}
    <button
      aria-pressed={previewOpen}
      class="preview"
      onclick={onpreview}
      type="button"
    >
      <IconWindow />Preview
    </button>
  {/if}
</div>

<style>
  .session-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-4);
    border-bottom: 1px solid var(--border-hairline);
    background: var(--surface-raised);
    flex: none;
  }
  .readings {
    border: 0;
    padding: 0;
    margin: 0;
    display: flex;
    gap: var(--space-1);
  }
  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-height: 30px;
    padding: var(--space-1) var(--space-3);
    border: 0;
    border-radius: var(--radius-control);
    background: transparent;
    color: var(--ink-muted);
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    cursor: pointer;
    transition:
      background var(--c-100) var(--e-in),
      color var(--c-100) var(--e-in);
  }
  button[aria-pressed="true"] {
    background: var(--surface-field);
    color: var(--ink-strong);
    box-shadow: var(--shadow-inset-sel);
  }
  button :global(svg) {
    width: 16px;
    height: 16px;
  }
  button:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
  @media (hover: hover) {
    button:hover {
      background: var(--surface-hover);
      color: var(--ink-strong);
    }
  }
  @media (pointer: coarse) {
    button {
      min-height: 44px;
    }
    .session-toolbar {
      padding-block: var(--space-1);
    }
  }
  @media (max-width: 380px) {
    button {
      padding-inline: var(--space-2);
    }
    .session-toolbar {
      gap: var(--space-1);
      padding-inline: var(--space-2);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    button {
      transition: none;
    }
  }
</style>
