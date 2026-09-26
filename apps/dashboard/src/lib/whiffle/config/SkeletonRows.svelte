<script lang="ts">
  /** Three rows at the height a two-line row takes, while a section is read. */
  import { Skeleton } from "$lib/components/ui/skeleton";
</script>

<div aria-label="Loading" class="rows" role="status">
  {#each [0, 1, 2] as row (row)}
    <Skeleton class="h-14 w-full rounded-[var(--radius-sm)]" />
  {/each}
</div>

<style>
  .rows {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
</style>
