<script lang="ts">
  import { type Snippet, untrack } from "svelte";
  /**
   * ONE CONTAINER, CHANGING ITS MIND.
   *
   * A turn's live tail is a single place on the ledger that says different
   * things over the turn's life: reasoning while the model reasons, then the
   * answer. Those used to be two rows — one removed, one inserted — so the
   * reasoning vanished at full height and the answer opened a fresh space
   * below the hole it left. Measured: `.think` present at 17.5px on one frame
   * and gone the next, taking the pinned viewport 18px with it in that frame.
   *
   * Here the space is never surrendered. The box holds whatever height it has,
   * the outgoing content unreveals in place, the incoming content reveals into
   * the same box, and the box tweens from the old height to the new one. The
   * reader watches one thing become another thing, which is what it is.
   *
   * Height is driven from a ResizeObserver on the content rather than from the
   * swap, so it is correct for a body that is still growing — streaming text
   * lengthens under its own steam, and the box follows it without being told.
   */
  import { ARRIVAL } from "./arrival";

  let {
    /** Names what is on screen. A change here is a swap. */
    phase,
    children,
  }: { phase: string; children: Snippet } = $props();

  /** How long the outgoing content takes to leave. Entry waits exactly this
   *  long, so the two never overlap: one thing leaves, then one arrives. */
  const LEAVE_MS = 160;

  let box = $state<HTMLElement>();
  let content = $state<HTMLElement>();
  /** The height the box is currently animating to, so a resize that does not
   *  change anything does not restart a tween. */
  let target = -1;

  $effect(() => {
    const outer = box;
    const inner = content;
    if (!(outer && inner)) {
      return;
    }
    const follow = (): void => {
      const next = inner.getBoundingClientRect().height;
      if (Math.abs(next - target) < 0.5) {
        return;
      }
      const from = outer.getBoundingClientRect().height;
      target = next;
      // First measurement: take the height, do not animate into it from zero.
      if (from === 0 && untrack(() => phase)) {
        outer.style.height = `${next}px`;
        return;
      }
      outer.style.height = `${next}px`;
      outer.animate(
        [{ height: `${from}px` }, { height: `${next}px` }],
        { duration: ARRIVAL.reserveMs, easing: "linear", fill: "backwards" }
      );
    };
    follow();
    const ro = new ResizeObserver(follow);
    ro.observe(inner);
    return () => ro.disconnect();
  });

  /** Opacity and blur only. The BOX owns the height — content that collapsed
   *  its own height is what made the space disappear instead of expanding. */
  function unreveal(_node: HTMLElement) {
    return {
      duration: LEAVE_MS,
      css: (t: number, u: number) =>
        `opacity:${t};filter:blur(${u * ARRIVAL.wordBlurPx * 2}px)`,
    };
  }

  function reveal(_node: HTMLElement) {
    return {
      delay: LEAVE_MS,
      duration: ARRIVAL.contentMs,
      css: (t: number, u: number) =>
        `opacity:${t};filter:blur(${u * ARRIVAL.wordBlurPx * 2}px)`,
    };
  }
</script>

<div class="swap" bind:this={box}>
  {#key phase}
    <div
      class="face"
      bind:this={content}
      in:reveal|global
      out:unreveal|global
    >
      {@render children()}
    </div>
  {/key}
</div>

<style>
  /* A one-cell grid, so both faces sit in the SAME cell while one is leaving
     and the other arriving. In normal flow they stack, and for the frames they
     overlap the box briefly holds both — which the viewport, pinned to the
     bottom, reads as an 8px lurch backwards. One cell, no stacking. */
  .swap {
    display: grid;
    grid-template-columns: 1fr;
    overflow: hidden;
  }
  .face {
    grid-area: 1 / 1;
    min-width: 0;
  }
  @media (prefers-reduced-motion: reduce) {
    .swap {
      transition: none;
    }
  }
</style>
