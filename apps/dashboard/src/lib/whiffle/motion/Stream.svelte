<script lang="ts">
  /**
   * Text that resolves as it arrives, whatever shape it arrives in.
   *
   * A stream does not deliver words, it delivers whatever the socket had ready:
   * one character, then eleven, then a whole paragraph. Rendering that raw makes
   * the text twitch — the eye tracks the boundary between what was already there
   * and what was just pasted on. So each word fades up out of a small blur, and
   * every word is scheduled against ONE clock shared by the whole message.
   *
   * The clock is the row's, not this component's — see `cascade.svelte.ts`. It
   * is shared with the row's glyph and chips so the whole row reveals in one
   * reading order, and it is what makes chunk boundaries invisible: each chunk
   * queues behind the last, rather than starting its own little cascade that
   * can overtake it. No clock above this component means the row is not
   * arriving, and then the text simply renders.
   *
   * Two more details carry it:
   *
   *  - Words are keyed by position and never remounted, so a chunk that only
   *    EXTENDS the last word ("some" → "something") updates that word's text
   *    without re-flashing it, and a word already animating is never rescheduled.
   *  - Text that was complete before the row landed reveals exactly like text
   *    that streams in: same clock, same window, left to right. A row that
   *    arrives finished has no reason to look different from one still being
   *    written — it is the same event either way.
   *
   * The reveal itself is opacity plus a 2px blur and no movement: text that
   * slides while more text is arriving under it reads as instability. Blur is
   * what hides the chunk boundary — without it the eye sees new text pasted
   * beside old text; with it the two read as one surface coming into focus.
   *
   * CSS animations rather than JS: a stream arrives exactly when the main thread
   * is busiest (parsing frames, laying out the transcript), and that is the
   * moment a rAF-driven reveal drops frames and a compositor one does not. The
   * only thing JS decides is each word's start time, once, at mount.
   */
  import { useCascade } from "./cascade.svelte";

  let { text }: { text: string } = $props();

  const cascade = useCascade();

  interface Word {
    /** Its slot on the row's clock, ms from mount. Absent = no reveal. */
    d?: number;
    /** The word plus the whitespace that followed it, so wrapping is unchanged. */
    t: string;
  }

  const TOKEN = /\S+\s*/g;

  let words = $state<Word[]>([]);
  /**
   * A plain mirror of `words`. The effect below has to know what it rendered
   * last time in order to append to it, and reading the `$state` it also writes
   * is a loop the runtime stops with `effect_update_depth_exceeded`. Only
   * `text` is a dependency; everything else it needs, it keeps itself.
   */
  let built: Word[] = [];
  /** What `text` was last time, to tell an append from a replacement. */
  let seen = "";

  $effect(() => {
    const next = text.match(TOKEN) ?? [];
    const held = text.startsWith(seen) ? built.length : 0;
    seen = text;

    const kept = built.slice(0, held);
    // A chunk usually finishes the word it interrupted; that word keeps its
    // identity, its slot, and whatever it was already doing.
    if (held > 0 && next.length >= held) {
      kept[held - 1] = { ...kept[held - 1], t: next[held - 1] };
    }

    const fresh = next.slice(held);
    const slots = cascade?.take(fresh.length);
    built = [...kept, ...fresh.map((t, i) => ({ t, d: slots?.[i] }))];
    words = built;
  });
</script>

<span class="stream"
  >{#each words as w, i (i)}
    <span class="w" style="--d:{w.d ?? 0}ms" class:on={w.d !== undefined}
      >{w.t}</span
    >
  {/each}</span
>

<style>
  /* No `white-space` here on purpose. It inherits, so the host decides: a
     reasoning trace wraps on its own `pre-wrap`, a tool argument stays on one
     line under its `nowrap` and keeps its ellipsis. Setting `pre-wrap` here
     overrode that and every argument wrapped, which grew the rows and put a
     scrollbar under the group. */
  .stream {
    display: contents;
  }
  .w {
    display: inline;
  }
  @media (prefers-reduced-motion: no-preference) {
    .w.on {
      /* `backwards`, never `both`. A forwards fill leaves every word holding
         `filter: blur(0)` for the life of the row, which keeps each one on its
         own compositing layer — hundreds of them per message, and Chrome
         renders that as a faint wash over the text. Backwards holds the FIRST
         keyframe through the delay, then hands the element back to its own
         style with no filter at all. */
      animation: word var(--word-ms) var(--word-ease) var(--d) backwards;
    }
  }

  @keyframes word {
    from {
      opacity: 0;
      filter: blur(var(--word-blur));
    }
    to {
      opacity: 1;
      filter: blur(0);
    }
  }
</style>
