<script lang="ts">
  import type { Snippet } from "svelte";
  /**
   * One piece of a row taking its turn on the row's clock: a glyph, a chip, a
   * count. Text does not come through here — `Stream.svelte` reveals text a word
   * at a time and batches its own slots, because a paragraph is one `take`, not
   * forty.
   *
   * No cascade above it means the row is not arriving (it is history, or the
   * transcript is being scrolled), and then this renders as plain content with
   * no animation at all.
   */
  import { useCascade } from "./cascade.svelte";

  let { children }: { children: Snippet } = $props();

  const cascade = useCascade();
  const at = cascade?.take(1)[0];
</script>

{#if at === undefined}
  {@render children()}
{:else}
  <span class="reveal" style="--d:{at}ms">{@render children()}</span>
{/if}

<style>
  /* Deliberately the same three lines as Stream.svelte's own keyframe rather
     than a shared import: a streamed paragraph mounts one span per word, and
     wrapping each of those in a component to share ten lines of CSS is the kind
     of tidiness that shows up in a profile. */
  .reveal {
    display: inline-flex;
    animation: reveal var(--word-ms) var(--word-ease) var(--d) both;
  }
  @keyframes reveal {
    from {
      opacity: 0;
      filter: blur(var(--word-blur));
    }
    to {
      opacity: 1;
      filter: blur(0);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .reveal {
      animation: none;
    }
  }
</style>
