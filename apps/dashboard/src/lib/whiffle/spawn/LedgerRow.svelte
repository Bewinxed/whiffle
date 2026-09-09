<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    label,
    controlId,
    children,
  }: { label: string; controlId: string; children: Snippet } = $props();
</script>

<div class="ledger-row" data-ledger-row={label}>
  <label for={controlId}>{label}</label>
  <div class="control">
    {@render children()}
  </div>
</div>

<style>
  .ledger-row {
    display: grid;
    grid-template-columns: 96px minmax(0, 1fr);
    min-height: 40px;
    align-items: center;
    padding-inline: var(--session-content-inset, var(--space-4));
  }
  label {
    font-size: var(--text-sm);
    font-weight: 450;
    color: var(--ink-label);
    line-height: var(--leading-ui);
  }
  .control {
    min-width: 0;
    color: var(--ink-row);
    font-size: var(--text-base);
  }
  @media (max-width: 479px) {
    .ledger-row {
      grid-template-columns: minmax(0, 1fr);
      min-height: 56px;
      gap: var(--space-1);
      padding-block: var(--space-1);
    }
  }
</style>
