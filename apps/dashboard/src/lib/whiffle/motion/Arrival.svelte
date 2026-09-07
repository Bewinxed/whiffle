<script lang="ts">
  import { type Snippet, untrack } from "svelte";
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
     * Whether this row OPENS a space for itself, or simply resolves into the
     * space it already has.
     *
     * Opening is what extends the rail, and it is right for a row that is a
     * line or two tall. It is wrong for a tall one: the reader is pinned to
     * the bottom while it opens, so a 300px row makes the viewport travel
     * 300px in the length of the animation — a lurch that hides the very
     * motion it was meant to show. Rows that own a rail open; turns do not.
     */
    opens = true,
    /**
     * This row continues the rail above it, so it opens flush against it and
     * the two segments read as one line growing — never as a second line.
     */
    continues = false,
    /**
     * How long this row waits before its storyboard starts. Rows landing
     * together share one clock, so a run of them cascades instead of each
     * playing the same animation over the top of the last.
     */
    lead = 0,
    /**
     * This row is not arriving — it is history being scrolled past, or the
     * transcript is not following the tail. It renders as plain content: no
     * animation, and no clock, so nothing inside it reveals either.
     */
    still = false,
    /**
     * Whether this component owns the row's top margin. False where the row's
     * own component already carries the ledger's rhythm, which is every row in
     * the transcript.
     */
    owns = true,
    /** Hold the storyboard at this instant instead of playing it. */
    at,
  }: {
    children: Snippet;
    params?: Arrival;
    rail?: boolean;
    continues?: boolean;
    opens?: boolean;
    lead?: number;
    still?: boolean;
    owns?: boolean;
    at?: number;
  } = $props();

  /**
   * Captured once, deliberately. Whether a row is arriving is decided the
   * moment it mounts; a virtualiser that re-renders the same row later must
   * not be able to re-open a question that was already answered, or the class
   * changes out from under a running animation.
   */
  const animates = !untrack(() => still);

  const vars = $derived(arrivalVars(params));
  /** Rows only lift if there is something to lift by. */
  const lifts = $derived(params.risePx > 0 || params.blurPx > 0);

  /**
   * The row's clock, opened here so that everything rendered inside — through
   * `children`, however deeply — reveals in one reading order. The window
   * starts once the space has begun opening, which is what `contentDelayMs`
   * measures.
   */
  if (animates) {
    provideCascade(
      () => params.wordSpreadMs,
      () => params.contentDelayMs + lead
    );
  }

  let node = $state<HTMLElement>();
  let measured = $state(false);

  /**
   * The row's natural height, read once, before it is ever painted.
   *
   * The animation cannot be in the markup: it has to know how tall the row
   * wants to be, and only the browser can answer that. `$effect.pre` runs
   * after the element exists and before the frame is painted, so measuring
   * here and only then arming the animation costs no flash of the open row.
   */
  $effect.pre(() => {
    if (!(node && animates && opens) || measured) {
      return;
    }
    node.style.setProperty(
      "--open-h",
      `${node.getBoundingClientRect().height}px`
    );
    measured = true;
  });

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
    if (!animates) {
      return;
    }
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

{#if animates}
  <div
    class="arrive"
    style="{vars};--t0:{lead}ms;--gap:{owns && !continues
      ? 'var(--space-4)'
      : '0px'}"
    bind:this={node}
    class:continues={continues}
    class:measured={measured}
    class:opens={opens}
    class:rail={rail}
  >
    <div class="clip">
      <div class="body" class:lift={lifts}>{@render children()}</div>
    </div>
  </div>
{:else}
  <div class="arrive still" class:continues={continues}>
    {@render children()}
  </div>
{/if}

<style>
  .arrive {
    position: relative;
    margin-top: var(--gap);
  }
  /* Only a row that OPENS reserves space, and only once its height has been
     measured — see `measure` in the script. The row is clipped to that height
     while it opens and not a moment longer: a row that clipped permanently
     would cut off a card's own popover. */
  .arrive.opens.measured {
    animation: reserve var(--reserve-ms) var(--reserve-ease) var(--t0) backwards;
  }
  .arrive.opens.measured > .clip {
    overflow: hidden;
  }
  /* A row that is not arriving is a row: no box of its own, no motion. */
  .arrive.still {
    display: block;
  }
  /* This row's line is the line above it, so it abuts and paints the weight
     the head gradient settles to rather than restarting it. */
  /* The rail block is the row's own element, and it is at a different depth in
     the two branches: directly under a settled row, under the clip and the
     body while one is arriving. Aiming at `.arrive.continues > *` hit BOTH —
     and on an arriving row that is `.clip`, which carries none of the rail's
     `2px 100%` sizing, so the continuation gradient painted across the whole
     row as a grey band. Each branch names its own child. */
  .arrive.still.continues > :global(*),
  .arrive.continues > .clip > .body > :global(*) {
    margin-top: 0;
    background-image: var(--rail-body);
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
      calc(var(--t0) + var(--rail-delay)) backwards;
  }

  .clip {
    min-height: 0;
  }
  .body.lift {
    animation: render var(--content-ms) var(--content-ease)
      calc(var(--t0) + var(--content-delay)) backwards;
  }
  /* Pixels, not `fr`.
     `grid-template-rows: 0fr → 1fr` is the tidy way to animate a height that
     content decides, and it is why this did nothing at all in Safari: WebKit
     does not interpolate grid tracks, so on iOS the space never opened and the
     rail never grew. A measured pixel height animates in every engine. */
  @keyframes reserve {
    from {
      height: 0;
      margin-top: 0;
    }
    to {
      height: var(--open-h);
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
    .clip {
      min-height: 0;
    }
    .body.lift {
      animation: none;
    }
  }
</style>
