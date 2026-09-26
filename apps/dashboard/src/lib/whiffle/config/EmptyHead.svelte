<script lang="ts">
  /** What an empty section says first: a title and one line. */
  let { title, line }: { title: string; line: string } = $props();
</script>

<div class="empty">
  <h2 class="t">{title}</h2>
  <p class="l">{line}</p>
</div>

<style>
  .empty {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .t {
    font: var(--type-label);
    color: var(--ink-strong);
  }
  .l {
    max-width: 72ch;
    font: var(--type-meta);
    color: var(--ink-muted);
  }
</style>
