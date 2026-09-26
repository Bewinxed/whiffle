<script lang="ts">
  /** A labelled control: the label above, then the hint or the problem under it. */
  import type { Snippet } from "svelte";

  let {
    id,
    label,
    hint,
    problem,
    warn,
    children,
  }: {
    /** The control's id; the label points at it. */
    id: string;
    label: string;
    hint?: Snippet | string;
    problem?: string;
    /** A caution that is not a refusal. */
    warn?: Snippet;
    children: Snippet;
  } = $props();
</script>

<div class="field">
  <label class="label" for={id}>{label}</label>
  {@render children()}
  {#if problem}
    <span class="error">{problem}</span>
  {:else if warn}
    <span class="warn">{@render warn()}</span>
  {:else if typeof hint === 'string'}
    <span class="hint">{hint}</span>
  {:else if hint}
    <span class="hint">{@render hint()}</span>
  {/if}
</div>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }
  .label {
    font: var(--type-meta);
    color: var(--ink-muted);
  }
  .hint,
  .error,
  .warn {
    max-width: 72ch;
    font: var(--type-meta);
    color: var(--ink-muted);
  }
  .error {
    color: var(--status-fail-ink);
  }
  .warn {
    color: var(--status-attn-ink);
  }
</style>
