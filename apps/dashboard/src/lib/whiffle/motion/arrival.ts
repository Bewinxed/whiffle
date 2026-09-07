/* ─────────────────────────────────────────────────────────────────────────
 * ARRIVAL STORYBOARD — one new row landing on the ledger
 *
 * The reading: a row does not appear on top of the transcript, it is let in.
 * The rail is what lets it in. The line the previous rail rows already drew
 * grows downward, and the growth IS the space the new row will stand in —
 * one motion, not two. Only once the space is there does the row's content
 * resolve into it.
 *
 *    0ms   nothing has moved. The rail ends where the last row ended.
 *    0ms   the row's height opens (grid-rows 0fr → 1fr) over 110ms, and the
 *          rail goes with it: in the default line mode the run owns one rail
 *          and the opening row is what makes it longer, so the line's tip and
 *          the bottom of the reserved space are the same edge by construction.
 *   80ms   the row reveals LEFT TO RIGHT: the glyph, the verb, then each
 *          word, every piece taking the next slot on one clock the row owns
 *          (`cascade.svelte.ts`). Each fades up out of a 2px blur. It starts
 *          before the space finishes opening — the overlap is what makes it
 *          one gesture instead of a stall.
 *  410ms   the last slot is issued; the reveal front has crossed the row.
 * 1010ms   the last word has finished resolving. The front crosses in a third
 *          of a second; the fade behind it is what takes the rest.
 *
 * A row that arrives COMPLETE reveals exactly like a row still being written
 * — same clock, same window, same direction. A finished message and a
 * streaming one are the same event, so they are the same animation.
 *
 * A row with no rail (a turn) runs the same storyboard without the draw —
 * the space still opens, the content still resolves into it.
 *
 * The animated property is the row's own height, because the height IS the
 * information: "a message is landing, here is where it goes". One row at the
 * tail — never a reflow of rows already read, which is the thing that
 * actually makes a ledger unscannable.
 *
 * The STRUCTURE is over in 110ms, deliberately: a transcript row is not a
 * modal, and in a live session the operator sees the layout change tens of
 * times an hour. What runs long is only the reveal's own fade, which moves
 * nothing and blocks nothing.
 * ───────────────────────────────────────────────────────────────────────── */

/**
 * The curves, by what they are for.
 *
 * The first three are the ones this file defaults to — Apple/iOS-derived,
 * stronger than any built-in CSS easing, which is the point: the built-ins are
 * too weak to read as intentional. The project's own three tokens follow, so a
 * tuned value can be compared against the DESIGN.md vocabulary directly, and
 * `linear` is there to read the raw shape of a duration.
 */
export const CURVES = {
  drawer: {
    label: "iOS drawer",
    css: "cubic-bezier(0.32, 0.72, 0, 1)",
    note: "Ionic's drawer curve. Leaves immediately, settles for a long time.",
  },
  out: {
    label: "out (strong)",
    css: "cubic-bezier(0.23, 1, 0.32, 1)",
    note: "Entry. Fast first, so the response reads as instant.",
  },
  inOut: {
    label: "in-out (strong)",
    css: "cubic-bezier(0.77, 0, 0.175, 1)",
    note: "Movement on screen, not entry or exit.",
  },
  eIn: { label: "--e-in", css: "var(--e-in)", note: "DESIGN.md entry." },
  eOut: { label: "--e-out", css: "var(--e-out)", note: "DESIGN.md exit." },
  eToggle: {
    label: "--e-toggle",
    css: "var(--e-toggle)",
    note: "DESIGN.md toggle.",
  },
  linear: { label: "linear", css: "linear", note: "For reading a duration." },
} as const;

export type Easing = keyof typeof CURVES;

export interface Arrival {
  /** Blur the content resolves out of. 0 = a plain fade. */
  blurPx: number;
  /** When the content starts resolving, measured from the row landing. */
  contentDelayMs: number;
  contentEase: Easing;
  contentMs: number;
  /** Rail head start (negative reads as the rail lagging the space). */
  railDelayMs: number;
  railEase: Easing;
  /** How long the rail takes to draw through that space. */
  railMs: number;
  reserveEase: Easing;
  /** How long the row's height takes to open. The space reservation. */
  reserveMs: number;
  /** How far the content rises into its space. 0 = it only fades. */
  risePx: number;
  /** Gap between rows that arrive in the same burst. */
  staggerMs: number;
  /** Blur each word resolves out of — what hides the chunk boundary. */
  wordBlurPx: number;
  wordEase: Easing;
  wordFadeMs: number;
  /**
   * The reveal. Every piece of the row — glyph, verb, word — takes a slot on
   * one clock, and the whole backlog drains inside this window. A two-word
   * chunk and a forty-word chunk both finish in `wordSpreadMs`, so the reveal
   * can never fall behind a fast stream and never crawls behind a slow one.
   */
  wordSpreadMs: number;
}

export const ARRIVAL: Arrival = {
  /* Tuned on /motion. The space opens in one --c-100-and-change and the line
     goes with it: at this length the extension is not something you watch, it
     is something you have already seen happen. The entry curve suits that —
     it is nearly all travel in the first third. */
  reserveMs: 110,
  reserveEase: "eIn",
  /* Zero, so the rail is never a second thing being drawn. In the default
     line mode the run owns one rail and the opening row simply makes it
     longer; the draw is here for the per-row mode, and at 0 it is instant. */
  railMs: 0,
  railDelayMs: 0,
  railEase: "inOut",
  /* Content starts before the space has finished — 80 into a 110 — so the two
     never read as a sequence. The 2px lift and the 3px unblur are the whole
     of the row's own movement. */
  contentDelayMs: 80,
  contentMs: 220,
  contentEase: "eIn",
  risePx: 2,
  blurPx: 3,
  /* Wide, for a burst: four rows landing together stay four events. */
  staggerMs: 140,
  /* A tight front and a long soft fade behind it: slots are handed out over
     330ms, but each word takes 600ms to finish resolving, so the reveal is a
     gradient several words deep rather than a hard edge. */
  wordSpreadMs: 330,
  wordFadeMs: 600,
  wordBlurPx: 1,
  wordEase: "out",
};

const easing = (e: Easing): string => CURVES[e].css;

/** The whole storyboard's length — what a scrubber's track spans. */
export const arrivalDuration = (a: Arrival): number =>
  Math.max(
    a.reserveMs,
    a.railDelayMs + a.railMs,
    a.contentDelayMs + a.contentMs,
    // The reveal front crosses the row over `spread`, and the last piece it
    // touches takes `fade` to finish.
    a.contentDelayMs + a.wordSpreadMs + a.wordFadeMs
  );

/** Every tuned number as one inline style, read by the components' CSS. */
export const arrivalVars = (a: Arrival): string =>
  [
    `--reserve-ms:${a.reserveMs}ms`,
    `--reserve-ease:${easing(a.reserveEase)}`,
    `--rail-ms:${a.railMs}ms`,
    `--rail-delay:${a.railDelayMs}ms`,
    `--rail-ease:${easing(a.railEase)}`,
    `--content-delay:${a.contentDelayMs}ms`,
    `--content-ms:${a.contentMs}ms`,
    `--content-ease:${easing(a.contentEase)}`,
    `--rise:${a.risePx}px`,
    `--enter-blur:${a.blurPx}px`,
    `--word-ms:${a.wordFadeMs}ms`,
    `--word-blur:${a.wordBlurPx}px`,
    `--word-ease:${easing(a.wordEase)}`,
  ].join(";");

/** The tuned values as the block to paste back into the transcript. */
export const arrivalCss = (a: Arrival): string => `.arrive {
  --reserve-ms: ${a.reserveMs}ms;
  --reserve-ease: ${easing(a.reserveEase)};
  --rail-ms: ${a.railMs}ms;
  --rail-delay: ${a.railDelayMs}ms;
  --rail-ease: ${easing(a.railEase)};
  --content-delay: ${a.contentDelayMs}ms;
  --content-ms: ${a.contentMs}ms;
  --content-ease: ${easing(a.contentEase)};
  --rise: ${a.risePx}px;
  --enter-blur: ${a.blurPx}px;
}
.stream {
  /* spread is a prop, not a property: ${a.wordSpreadMs}ms */
  --word-ms: ${a.wordFadeMs}ms;
  --word-blur: ${a.wordBlurPx}px;
  --word-ease: ${easing(a.wordEase)};
}
/* burst stagger: ${a.staggerMs}ms per row */`;
