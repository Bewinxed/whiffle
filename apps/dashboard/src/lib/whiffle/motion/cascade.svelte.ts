import { getContext, setContext } from "svelte";

/**
 * One clock per row, so everything in it reveals in reading order.
 *
 * A row is not one thing. It is a glyph, a verb, an argument, a chip — and, if
 * it is a turn, a paragraph of words that may still be arriving. Each of those
 * is a separate element, and if each animates on its own schedule the row
 * flickers into being in whatever order the DOM happens to mount. So they all
 * draw from ONE clock, handed down the tree: every piece takes the next slot,
 * and slots are only ever issued forward. Reading order out, left to right,
 * line by line, whether the text arrived complete or in eleven chunks.
 *
 * `take(n)` hands out `n` slots spread over whatever remains of the window from
 * now, queued behind everything already issued. Two consequences worth naming:
 * the reveal is monotonic by construction (a late chunk can never overtake an
 * early one), and a backlog always drains inside one window — so a burst
 * compresses to keep up instead of queueing up a long tail.
 */
export interface Cascade {
  /** Delays in ms, relative to now, for the next `n` items in reading order. */
  take: (n: number) => number[];
}

const KEY = Symbol("cascade");

/**
 * How many pieces a row is assumed to have when it asks for fewer. It sets the
 * steady per-piece cadence (`spread / 8` — 25ms at the default window), which
 * is what a row of a glyph and a few words reveals at. A paragraph asks for
 * more than this in one go and gets a proportionally tighter step, so it still
 * finishes inside the window.
 */
const TYPICAL_PIECES = 8;

/**
 * Open a row's clock. `spread` is the drain window and `start` is how long the
 * row waits before revealing anything — the time its space spends opening.
 * Both are read at each `take`, so a dial moves the next row, not this one's
 * already-issued slots.
 */
export function provideCascade(
  spread: () => number,
  start: () => number
): Cascade {
  let nextSlot = 0;
  let opened = false;

  const cascade: Cascade = {
    take(n) {
      const now = performance.now();
      if (!opened) {
        nextSlot = now + start();
        opened = true;
      }
      const from = Math.max(nextSlot, now);
      // Two rates, and the slower one wins. The nominal one is a steady cadence
      // per piece — a row is taken from in several goes (glyph, then verb, then
      // words), and spreading each go across the whole window would let a
      // one-item take eat all of it. The other is the drain rate needed to
      // finish everything outstanding inside the window, which takes over when
      // a stream is arriving faster than the cadence can show it.
      const cadence = spread() / Math.max(n, TYPICAL_PIECES);
      const budget = Math.max(now + start() + spread() - from, 0);
      const step = n > 0 ? Math.min(cadence, budget / n) : 0;
      nextSlot = from + n * step;
      return Array.from({ length: n }, (_, i) => from - now + i * step);
    },
  };

  setContext(KEY, cascade);
  return cascade;
}

/** The row's clock, if this element is inside a row that is arriving. */
export const useCascade = (): Cascade | undefined => getContext(KEY);
