<script lang="ts">
  /**
   * The effort slider (§1.7, §2.10), ported with the design's formulas as they
   * are (decision §8.3). Pointer drives the track; the hidden range input keeps
   * keyboard and screen readers.
   */
  import type { EffortLevel } from "@whiffle/core";

  let {
    efforts,
    value,
    onchange,
  }: {
    efforts: EffortLevel[];
    /** The level the slider sits on; the owner decides what "untouched" shows. */
    value: EffortLevel | null;
    onchange: (level: EffortLevel) => void;
  } = $props();
  const n = $derived(efforts.length);
  const effortIdx = $derived(
    Math.max(0, efforts.indexOf(value as EffortLevel))
  );
  const frac = (i: number) => (n > 1 ? i / (n - 1) : 0);
  const p = $derived(frac(effortIdx));
  let hover = $state(-1);
  let drag = $state(false);
  let focused = $state(false);
  let width = $state(0);
  const stops = $derived(
    [0, 1, 2, 3, 4].map((i) => {
      if (!n) {
        return { frac: i / 4, pipO: 0.3 };
      }
      const live = i < n;
      return {
        frac: live ? frac(i) : 1,
        pipO: live && i > effortIdx ? 0.3 : 0,
      };
    })
  );
  const fillOff = $derived(20 - 20 * p - (effortIdx === 0 ? 20 : 0));
  const lineOff = $derived(11 - 24 * p);
  const active = $derived(hover >= 0 || drag || focused);
  const lineInset = $derived(active ? 7 : 8);
  const lineColor = $derived.by(() => {
    if (focused || drag) {
      return "var(--fai-grey-900)";
    }
    return hover >= 0
      ? "oklch(from var(--fai-grey-900) l c h / 0.5)"
      : "oklch(from var(--fai-grey-900) l c h / 0.25)";
  });
  const hoverGeom = $derived.by(() => {
    if (hover < 0 || !n || !width) {
      return { l: 0, w: 0 };
    }
    const hx = p * width + 20 - 20 * p - (effortIdx === 0 ? 20 : 0);
    const edge = hover === 0 ? 0 : width;
    const x = hover === 0 || hover === n - 1 ? edge : frac(hover) * width;
    return { l: Math.min(hx, x), w: Math.abs(x - hx) };
  });
  const hoverO = $derived(hover >= 0 && !drag && hover !== effortIdx ? 1 : 0);
  const label = $derived(n ? (efforts[effortIdx] ?? "") : "Default");

  function indexAt(event: PointerEvent) {
    const el = event.currentTarget as HTMLElement;
    const r = el.getBoundingClientRect();
    width = el.clientWidth;
    const f = Math.min(
      1,
      Math.max(0, (event.clientX - r.left) / Math.max(1, el.clientWidth))
    );
    return Math.round(f * (n - 1));
  }
  function down(event: PointerEvent) {
    if (!n || (event.pointerType === "mouse" && event.button !== 0)) {
      return;
    }
    event.preventDefault();
    const idx = indexAt(event);
    try {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is a nicety; the move handler still tracks the pointer.
    }
    drag = true;
    hover = -1;
    onchange(efforts[idx]);
  }
  function move(event: PointerEvent) {
    if (!n) {
      return;
    }
    const idx = indexAt(event);
    if (drag) {
      if (efforts[idx] !== value) {
        onchange(efforts[idx]);
      }
    } else if (idx !== hover) {
      hover = idx;
    }
  }
  function up() {
    drag = false;
    hover = -1;
  }
  function leave() {
    if (!drag) {
      hover = -1;
    }
  }
</script>

<div class="box">
  <div
    class="slider"
    style={`opacity:${n ? 1 : 0.55};pointer-events:${n ? "auto" : "none"}`}
  >
    <div
      class="track"
      onpointercancel={up}
      onpointerdown={down}
      onpointerleave={leave}
      onpointermove={move}
      onpointerup={up}
      role="presentation"
      class:focus={focused}
    >
      <div
        class="fill"
        style={`width:calc(${p} * 100% + ${fillOff}px);opacity:${n ? 1 : 0}`}
      ></div>
      <div
        class="preview"
        style={`left:${hoverGeom.l}px;width:${hoverGeom.w}px;opacity:${hoverO}`}
      ></div>
      {#each stops as stop, i (i)}
        <span
          class="pip"
          data-pip={i}
          style={`left:calc(12px + (100% - 29px) * ${stop.frac});opacity:${stop.pipO}`}
        ></span>
      {/each}
      <div
        class="line"
        data-effort-line
        style={`top:${lineInset}px;bottom:${lineInset}px;left:calc(${p} * 100% + ${lineOff}px);background:${lineColor};opacity:${n ? 1 : 0}`}
      ></div>
      <div class="labels">
        <span class="lbl" class:ink={active}>Effort</span>
        <span class="lbl value" class:ink={active}>{label}</span>
      </div>
      <input
        aria-label="Effort"
        aria-valuetext={label}
        max={Math.max(0, n - 1)}
        min="0"
        onblur={() => {
          focused = false;
        }}
        onfocus={() => {
          focused = true;
        }}
        oninput={(event) => onchange(efforts[Number(event.currentTarget.value)])}
        step="1"
        type="range"
        value={effortIdx}
      >
    </div>
  </div>
</div>

<style>
  .box {
    position: relative;
    display: grid;
    height: 56px;
    padding: 10px 12px;
    background: var(--fai-surface-subtle);
    border: 1px solid var(--fai-border-subtle);
    border-radius: var(--fai-radius-md);
    overflow: hidden;
  }
  .slider {
    grid-area: 1 / 1;
    display: grid;
    align-content: start;
    transition: opacity 240ms ease;
  }
  .track {
    position: relative;
    height: 34px;
    background: var(--fai-surface);
    border: 1px solid var(--fai-border);
    border-radius: var(--fai-radius-md);
    overflow: hidden;
    cursor: ew-resize;
    user-select: none;
    touch-action: none;
    box-shadow: none;
    transition:
      var(--fai-transition-control),
      box-shadow 120ms ease;
  }
  .track.focus {
    border-color: var(--fai-grey-400);
    box-shadow: 0 0 0 3px var(--fai-focus-ring);
  }
  .fill {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    background: var(--fai-grey-100);
    transition: width 160ms var(--ns-ease-in-out);
    pointer-events: none;
  }
  .preview {
    position: absolute;
    top: 0;
    bottom: 0;
    background: var(--fai-hover-preview);
    transition: opacity 120ms ease;
    pointer-events: none;
  }
  .pip {
    position: absolute;
    top: 50%;
    width: 5px;
    height: 5px;
    margin-top: -2.5px;
    border-radius: var(--fai-radius-pill);
    background: var(--fai-grey-900);
    transition:
      left 160ms var(--ns-ease-in-out),
      opacity 120ms ease;
    pointer-events: none;
  }
  .line {
    position: absolute;
    width: 2px;
    border-radius: 1px;
    transition:
      left 160ms var(--ns-ease-in-out),
      top 120ms ease,
      bottom 120ms ease,
      background-color 120ms ease;
    pointer-events: none;
  }
  .labels {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 10px;
    pointer-events: none;
  }
  .lbl {
    font: 500 13px / 1 var(--fai-font-sans);
    color: var(--fai-text-muted);
    padding: 0 4px;
    border-radius: 3px;
    transition: color 120ms ease;
  }
  .lbl.ink {
    color: var(--fai-grey-900);
  }
  .value {
    text-transform: capitalize;
    font-variant-numeric: tabular-nums;
  }
  input[type="range"] {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    pointer-events: none;
  }
  @media (max-width: 640px) {
    .box {
      height: 64px;
    }
    .track {
      height: 42px;
    }
  }
</style>
