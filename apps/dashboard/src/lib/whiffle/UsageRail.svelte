<script lang="ts">
  import { band } from "./usage";

  /**
   * The one renderer for a limit fill: a thin continuous track and a single
   * fill. The fill stays neutral while there is room and only takes a status
   * colour once the window is actually tight — amber from 70%, red from 90% —
   * so colour on this bar always means "look at me", never decoration.
   * Colour rides the status tokens (warning / destructive), never a local hue.
   */
  interface Props {
    /** Narrow chrome gets the thinner track. */
    compact?: boolean;
    /** Named for the reader: "5-hour", "Weekly · Fable", "Spend". */
    label: string;
    /** How full the window is, 0–100. */
    value: number;
  }

  let { value, label, compact = false }: Props = $props();

  const pct = $derived(Math.max(0, Math.min(100, value)));
  const tone = $derived(band(pct));
</script>

<span
  aria-label="{label} limit"
  aria-valuemax={100}
  aria-valuemin={0}
  aria-valuenow={Math.round(pct)}
  class={compact ? "track compact" : "track"}
  role="progressbar"
>
  <span class="fill {tone}" style:width="{pct}%"></span>
</span>

<style>
  .track {
    position: relative;
    display: block;
    flex: 1 1 auto;
    min-width: 0;
    height: 6px;
    border-radius: var(--radius-pill);
    background: var(--surface-hover);
    overflow: hidden;
  }
  .track.compact {
    height: 4px;
  }
  .fill {
    position: absolute;
    inset: 0 auto 0 0;
    border-radius: inherit;
    background: var(--ink-muted);

    @media (prefers-reduced-motion: no-preference) {
      transition:
        width 260ms cubic-bezier(0.32, 0.72, 0, 1),
        background-color 160ms linear;
    }
  }
  .fill.warn {
    background: var(--warning);
  }
  .fill.critical {
    background: var(--destructive);
  }
</style>
