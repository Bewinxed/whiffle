<script lang="ts">
  import type { Snippet } from "svelte";
  /**
   * One row landing on the ledger, per the ARRIVAL storyboard in `arrival.ts`.
   *
   * Three animations, all keyframes rather than transitions so a playhead can
   * hold them at any instant (negative `animation-delay` + `paused`):
   *
   *  1. `reserve` — `grid-template-rows: 0fr → 1fr` on the wrapper. Intrinsic
   *     content height, so nothing is measured and no JS runs per row. This is
   *     the space the message will stand in.
   *  2. `draw` — the rail scales down from its top edge through exactly that
   *     space. Same duration by default, so the line's tip and the bottom of
   *     the opening space are one edge moving down the page.
   *  3. the row's CONTENT reveals, left to right, on a clock this component
   *     opens and everything inside it draws from (`cascade.svelte.ts`): the
   *     glyph, then the verb, then each word. It starts before the space has
   *     finished opening — the overlap is what makes the two one gesture.
   *     `render` here is only the optional lift (rise/blur) on the row as a
   *     whole; the opacity belongs to the cascade, so a row never fades as a
   *     block AND reveals in order, which reads as two animations fighting.
   *
   * `at` holds all three at one instant through the Web Animations API, so the
   * storyboard can be read frame by frame without changing what it does.
   *
   * Nothing translates the row itself, so rows below never jump, and a
   * virtualizer's measurement of the settled row is untouched.
   */
  import { ARRIVAL, type Arrival, arrivalVars } from "./arrival";
  import { provideCascade } from "./cascade.svelte";

  let {
    children,
    params = ARRIVAL,
    /** Draw a rail beside this row. A turn has no line; a note or tool has. */
    rail = false,
    /**
     * This row continues the rail above it, so it opens flush against it and
     * the two segments read as one line growing — never as a second line.
     */
    continues = false,
    /** Position in the burst: the row's whole storyboard is pushed back by it. */
    index = 0,
    /** Hold the storyboard at this instant instead of playing it. */
    at,
  }: {
    children: Snippet;
    params?: Arrival;
    rail?: boolean;
    continues?: boolean;
    index?: number;
    at?: number;
  } = $props();

  const vars = $derived(arrivalVars(params));
  const lead = $derived(index * params.staggerMs);
  /** Rows only lift if there is something to lift by. */
  const lifts = $derived(params.risePx > 0 || params.blurPx > 0);

  /**
   * The row's clock, opened here so that everything rendered inside — through
   * `children`, however deeply — reveals in one reading order. The window
   * starts once the space has begun opening, which is what `contentDelayMs`
   * measures.
   */
  provideCascade(
    () => params.wordSpreadMs,
    () => params.contentDelayMs + lead
  );

  let node = $state<HTMLElement>();

  /**
   * The playhead. CSS animations are the storyboard; the Web Animations API is
   * how a playhead reaches into them — `currentTime` is measured from the
   * animation's own start, so seeking one number holds all three (the row's, the
   * rail's, the content's) at the same instant, each still inside its own delay
   * and curve. Nothing about the motion changes to be inspected.
   */
  /** The instant, bundled with the timing it is read against: tuning a dial
   *  re-seeks rather than leaving the playhead on the old timing's frame. */
  $effect(() => {
    const t = at;
    const running = node?.getAnimations({ subtree: true }) ?? [];
    if (t === undefined) {
      // Not holding. Resume only what THIS component paused — `play()` on an
      // animation that already finished restarts it from zero, which is how a
      // dial change used to fire a stray partial replay of its own a beat
      // before the tuning preview fired the real one.
      for (const a of running) {
        if (a.playState === "paused") {
          a.play();
        }
      }
      return;
    }
    // Read inside the held branch only, so that while the playhead is NOT held
    // this effect does not depend on the tuning at all and a dial change cannot
    // reach the animations. Held, it re-seeks: the frame under the playhead is
    // the frame for the values now on the dials.
    const frame = { time: t, tuning: vars };
    for (const a of running) {
      a.pause();
      a.currentTime = frame.time;
    }
  });
</script>

<div
  class="arrive"
  style="{vars};--t0:{lead}ms;--gap:{continues ? '0px' : 'var(--space-4)'}"
  bind:this={node}
  class:rail={rail}
>
  <div class="clip">
    <div class="body" class:lift={lifts}>{@render children()}</div>
  </div>
</div>

<style>
  .arrive {
    display: grid;
    grid-template-rows: 1fr;
    position: relative;
    margin-top: var(--gap);
    animation: reserve var(--reserve-ms) var(--reserve-ease) var(--t0) both;
  }
  /* The rail is a child of the row that is opening, so its 100% height is the
     space being reserved — it cannot draw past the edge it is opening. */
  .arrive.rail {
    margin-left: var(--space-2);
    padding-left: var(--space-3);
  }
  .arrive.rail::before {
    content: "";
    position: absolute;
    inset: 0 auto 0 0;
    width: 2px;
    background: var(--rail);
    transform-origin: top;
    animation: draw var(--rail-ms) var(--rail-ease)
      calc(var(--t0) + var(--rail-delay)) both;
  }
  .clip {
    overflow: hidden;
    min-height: 0;
  }
  .body.lift {
    animation: render var(--content-ms) var(--content-ease)
      calc(var(--t0) + var(--content-delay)) both;
  }
  @keyframes reserve {
    from {
      grid-template-rows: 0fr;
      margin-top: 0;
    }
    to {
      grid-template-rows: 1fr;
      margin-top: var(--gap);
    }
  }
  @keyframes draw {
    from {
      transform: scaleY(0);
    }
    to {
      transform: scaleY(1);
    }
  }
  /* No opacity here on purpose — the cascade owns it. This is the row as a
     body moving into place, if it moves at all. */
  @keyframes render {
    from {
      transform: translateY(var(--rise));
      filter: blur(var(--enter-blur));
    }
    to {
      transform: translateY(0);
      filter: blur(0);
    }
  }

  /* The row still arrives; it just arrives already there. */
  @media (prefers-reduced-motion: reduce) {
    .arrive,
    .arrive.rail::before,
    .body.lift {
      animation: none;
    }
  }
</style>
