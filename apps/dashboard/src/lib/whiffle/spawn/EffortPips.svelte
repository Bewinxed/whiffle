<script lang="ts">
  /**
   * The chip lives inside the fill so the level and its filled track read as
   * one object. Its measured width keeps the fill wrapped at both ends and
   * gives pips, hover previews, and pointer targeting the same geometry.
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

  let knobWidth = $state(0);
  const kw = $derived(knobWidth + 6);

  const n = $derived(efforts.length);
  const effortIdx = $derived(
    Math.max(0, efforts.indexOf(value as EffortLevel))
  );
  const frac = (i: number) => (n > 1 ? i / (n - 1) : 0);
  const p = $derived(frac(effortIdx));
  let hover = $state(-1);
  let drag = $state(false);
  let focused = $state(false);
  const active = $derived(hover >= 0 || drag || focused);
  /** Stops still ahead of the level, so the track says where else it can go. */
  const pips = $derived(
    efforts.map((_, i) => ({ frac: frac(i), on: i > effortIdx }))
  );
  const preview = $derived.by(() => {
    if (hover < 0 || drag || hover === effortIdx) {
      return { from: 0, span: 0 };
    }
    const to = frac(hover);
    return { from: Math.min(p, to), span: Math.abs(to - p) };
  });
  const label = $derived(n ? (efforts[effortIdx] ?? "") : "Default");

  function indexAt(event: PointerEvent) {
    const el = event.currentTarget as HTMLElement;
    const box = el.getBoundingClientRect();
    const rail = el.clientWidth - kw;
    const f = Math.min(
      1,
      Math.max(0, (event.clientX - box.left - el.clientLeft - kw / 2) / rail)
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
      style={`--kw:${kw}px`}
      class:focus={focused}
    >
      <div
        class="fill"
        style={`width:calc(var(--kw) + ${p} * (100% - var(--kw)))`}
      >
        <div
          class="knob"
          style={`opacity:${n ? 1 : 0.7}`}
          class:active={active}
          bind:offsetWidth={knobWidth}
        >
          {#if n}
            <span aria-hidden="true" class="meter">
              {#each efforts as level, i (level)}
                <span
                  class="bar"
                  style={`height:${4 + (n > 1 ? i / (n - 1) : 1) * 8}px`}
                  class:lit={i <= effortIdx}
                ></span>
              {/each}
            </span>
          {/if}
          <span class="lvl">
            {#each efforts as level (level)}
              <span aria-hidden="true" class="sizer">{level}</span>
            {/each}
            <span>{label}</span>
          </span>
        </div>
      </div>
      <div
        class="preview"
        style={`left:calc(var(--kw) + ${preview.from} * (100% - var(--kw)));width:calc(${preview.span} * (100% - var(--kw)))`}
      ></div>
      {#each pips as pip, i (i)}
        <span
          class="pip"
          data-pip={i}
          style={`left:calc(var(--kw) / 2 + ${pip.frac} * (100% - var(--kw)) - 2.5px);opacity:${pip.on ? 0.3 : 0}`}
        ></span>
      {/each}
      <input
        aria-label="Effort"
        aria-valuetext={label}
        disabled={!n}
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
    display: flex;
    justify-content: flex-end;
    align-items: center;
    padding: 3px;
    border-radius: calc(var(--fai-radius-md) - 1px);
    left: 0;
    top: 0;
    bottom: 0;
    background: var(--fai-fill);
    transition: width var(--ns-fill-ms) var(--ns-ease-in-out);
    pointer-events: none;
  }
  .preview {
    position: absolute;
    top: 0;
    bottom: 0;
    background: var(--fai-hover-preview);
    transition:
      left 120ms var(--ns-ease-in-out),
      width 120ms var(--ns-ease-in-out);
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
      left var(--ns-fill-ms) var(--ns-ease-in-out),
      opacity 120ms ease;
    pointer-events: none;
  }
  .knob {
    flex-shrink: 0;
    height: 100%;
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 0 9px;
    border-radius: var(--fai-radius-sm);
    background: var(--fai-raised);
    box-shadow: var(--fai-shadow-raised);
    color: var(--fai-text-muted);
    transition:
      color 120ms ease,
      opacity 120ms ease;
    pointer-events: none;
    white-space: nowrap;
  }
  .knob.active {
    color: var(--fai-grey-900);
  }
  /* As many bars as the model has levels, lit up to the one it sits on. The
     ramp is set inline so it spans 4→12px whether the model offers three
     levels or five. */
  .meter {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 12px;
  }
  .bar {
    width: 2px;
    border-radius: 1px;
    background: var(--fai-grey-900);
    opacity: 0.22;
    transition:
      opacity 160ms ease,
      height 160ms var(--ns-ease-in-out);
  }
  .bar.lit {
    opacity: 1;
  }
  .lvl {
    /* Reserve every label's width so a switch keeps the chip and rail stable. */
    display: grid;
    font: 500 12px / 1 var(--fai-font-sans);
    text-transform: capitalize;
    font-variant-numeric: tabular-nums;
  }
  .lvl > span {
    grid-area: 1 / 1;
  }
  .sizer {
    visibility: hidden;
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
    .lvl {
      font-size: 13px;
    }
  }
</style>
