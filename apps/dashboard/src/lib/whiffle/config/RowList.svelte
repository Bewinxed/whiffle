<script lang="ts">
  /** The list a section's rows sit in: 2px apart, no hairlines. */
  import type { Snippet } from "svelte";

  let { label, children }: { label: string; children: Snippet } = $props();
</script>

<ul aria-label={label} class="rows">
  {@render children()}
</ul>

<style>
  .rows {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin: 0 -8px;
    padding: 0;
    list-style: none;
  }
</style>
