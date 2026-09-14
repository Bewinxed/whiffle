<script lang="ts">
  import { band } from "./usage";

  /**
   * The tick rail: the one renderer for a limit fill. A segmented strip of
   * pipes, each tick lit by the band of the position it occupies — green down
   * the quiet end of the rail, amber through the warning band, red where the
   * limit bites. Lit ticks are instant state changes; nothing sweeps.
   *
   * Colour rides the locked status tokens (success / warning / destructive),
   * never a local hue. Unlit ticks sit on the muted surface.
   */
  interface Props {
    /** Narrow chrome gets fewer, shorter ticks. */
    compact?: boolean;
    /** Named for the reader: "5-hour", "Weekly · Fable", "Spend". */
    label: string;
    /** How full the window is, 0–100. */
    value: number;
  }

  let { value, label, compact = false }: Props = $props();

  const TICKS = $derived(compact ? 28 : 48);
  const ticks = $derived.by(() =>
    Array.from({ length: TICKS }, (_, i) => ((i + 0.5) / TICKS) * 100)
  );

  const litClass = (pos: number): string => {
    if (band(pos) === "critical") {
      return "bg-destructive";
    }
    if (band(pos) === "warn") {
      return "bg-warning";
    }
    return "bg-success";
  };
</script>

<span
  aria-label="{label} limit"
  aria-valuemax={100}
  aria-valuemin={0}
  aria-valuenow={Math.round(value)}
  class="{compact ? 'h-2' : 'h-2.5'} flex min-w-0 flex-1 items-stretch gap-px"
  role="progressbar"
>
  {#each ticks as pos}
    <i
      class="min-w-0 flex-1 rounded-[1px] {value >= pos ? litClass(pos) : 'bg-muted'}"
    ></i>
  {/each}
</span>
