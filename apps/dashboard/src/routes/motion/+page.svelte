<script lang="ts">
  import { IconInfo, IconTerminal } from "$lib/icons";
  /**
   * The arrival lab: one sample ledger, every number in the ARRIVAL storyboard
   * on a dial, and a playhead that holds the whole thing at any instant.
   *
   * It renders the real `Arrival` wrapper and the real DESIGN.md tokens, so a
   * setting that reads right here reads right in the transcript. When it does,
   * "Copy CSS" hands over exactly the block to paste.
   */
  import { copyToClipboard } from "$lib/whiffle/copy";
  import Arrival from "$lib/whiffle/motion/Arrival.svelte";
  import {
    ARRIVAL,
    type Arrival as ArrivalParams,
    arrivalCss,
    arrivalDuration,
    arrivalVars,
    CURVES,
    type Easing,
  } from "$lib/whiffle/motion/arrival";
  import Reveal from "$lib/whiffle/motion/Reveal.svelte";
  import Stream from "$lib/whiffle/motion/Stream.svelte";

  type Kind = "you" | "agent" | "note" | "tool";
  interface Row {
    arg?: string;
    id: number;
    index: number;
    kind: Kind;
    text: string;
  }

  const p = $state<ArrivalParams>({ ...ARRIVAL });

  /** What the ledger opens on — history, so none of it animates. */
  const SEED: Omit<Row, "id" | "index">[] = [
    {
      kind: "you",
      text: "something is wrong, using claude models in this whiffle harness is draining usage so far o_o analyze today's sessions",
    },
    { kind: "note", text: "hook started" },
    { kind: "note", text: "hook response" },
    {
      kind: "agent",
      text: "I'll dig into today's session transcripts to see what's actually consuming usage.",
    },
  ];

  const seeded: Row[] = SEED.map((r, i) => ({ ...r, id: i, index: 0 }));
  let nextId = seeded.length;
  /** Fresh key for a row, so a replayed row is a new mount and animates again. */
  function mint(): number {
    nextId += 1;
    return nextId - 1;
  }
  let rows = $state<Row[]>(seeded);
  /** Rows present before the last add — they are settled and never replay. */
  /**
   * Everything except the last seed row, which is left ARRIVING: a dial with
   * nothing on screen to move is a dial you cannot tune.
   */
  let settled = $state(new Set<number>(seeded.slice(0, -1).map((r) => r.id)));

  const ARRIVALS: Record<Kind, Omit<Row, "id" | "index">> = {
    note: { kind: "note", text: "hook response" },
    tool: {
      kind: "tool",
      text: "List project session dirs",
      arg: "ls -la ~/.claude/projects/",
    },
    agent: {
      kind: "agent",
      text: "Today's spend is concentrated in one session — it re-read the same three transcripts on every turn.",
    },
    you: { kind: "you", text: "show me the per-session breakdown" },
  };

  function add(...kinds: Kind[]): void {
    settled = new Set(rows.map((r) => r.id));
    rows = [
      ...rows,
      ...kinds.map((k, i) => ({
        ...ARRIVALS[k],
        id: mint(),
        index: i,
      })),
    ];
  }

  /** Play the last arrival again from zero: new keys, same rows. */
  function replay(): void {
    const fresh = rows.filter((r) => !settled.has(r.id));
    rows = rows.filter((r) => settled.has(r.id));
    requestAnimationFrame(() => {
      rows = [...rows, ...fresh.map((r) => ({ ...r, id: mint() }))];
    });
  }

  /**
   * A reply arriving the way a real one does: uneven chunks, uneven gaps. The
   * point of the demo is that the reveal does not care — the words are spread
   * across one window per chunk, so a six-word burst and a one-word dribble
   * both resolve at the same rate.
   */
  const REPLY =
    "Two sessions account for 78% of today's spend. Both are re-reading the same three transcripts on every turn — about 240k tokens of context re-sent per message, none of it cached. The fix is to read them once and keep the summary in the session state.";

  function streamReply(): void {
    settled = new Set(rows.map((r) => r.id));
    const id = mint();
    rows = [...rows, { id, kind: "agent", text: "", index: 0 }];
    const source = REPLY.match(/\S+\s*/g) ?? [];
    let cut = 0;
    const tick = (): void => {
      const row = rows.find((r) => r.id === id);
      if (!row || cut >= source.length) {
        return;
      }
      const take = 1 + Math.floor(Math.random() * 6);
      const next = row.text + source.slice(cut, cut + take).join("");
      cut += take;
      rows = rows.map((r) => (r.id === id ? { ...r, text: next } : r));
      setTimeout(tick, 40 + Math.random() * 140);
    };
    setTimeout(tick, 160);
  }

  function reset(): void {
    rows = seeded.map((r) => ({ ...r, id: mint() }));
    settled = new Set(rows.map((r) => r.id));
  }

  /** A rail row directly under another rail row continues its line. */
  const railed = (k: Kind): boolean => k === "note" || k === "tool";
  const continues = (i: number): boolean =>
    i > 0 && railed(rows[i - 1].kind) && railed(rows[i].kind);

  /**
   * Who owns the line.
   *
   * `linked` — the run owns one rail and the arriving row grows inside it, so
   *   the line that extends is literally the same line, one gradient over the
   *   whole run. Nothing draws; the rail is as long as the space is open.
   * `drawn` — every row draws its own segment on its own timing, so the draw
   *   can lead or lag the space it is opening. Costs a visible seam: `--rail`
   *   is a gradient, so each segment restarts it.
   */
  let linked = $state(true);

  interface Run {
    key: number;
    rail: boolean;
    rows: { row: Row; i: number }[];
  }

  /** Consecutive rail rows are one run, and one line. */
  const runs = $derived.by(() => {
    const out: Run[] = [];
    rows.forEach((row, i) => {
      const rail = railed(row.kind);
      const last = out.at(-1);
      if (rail && last?.rail) {
        last.rows.push({ row, i });
        return;
      }
      out.push({ key: row.id, rail, rows: [{ row, i }] });
    });
    return out;
  });

  // ── Live tuning ─────────────────────────────────────────────────────────
  // A slider that changes a value nothing is currently playing is a slider you
  // are tuning blind. Every dial re-fires the pending arrival on a short
  // trailing debounce, so dragging one plays it over and over at the value
  // under your thumb. `replay` runs from a timer rather than inside the effect
  // so that reading `rows` there does not make this effect depend on its own
  // output.
  let refire: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    const tuned = JSON.stringify(p);
    if (tuned) {
      clearTimeout(refire);
      refire = setTimeout(replay, 140);
    }
  });

  /** Keep it firing, hands-free, while a value is being read. */
  let looping = $state(false);
  $effect(() => {
    if (!looping) {
      return;
    }
    const period = arrivalDuration(p) + 900;
    const id = setInterval(replay, period);
    return () => clearInterval(id);
  });

  // ── The playhead ────────────────────────────────────────────────────────
  let holding = $state(false);
  let head = $state(0);
  const span = $derived(
    arrivalDuration(p) +
      p.staggerMs *
        Math.max(0, rows.filter((r) => !settled.has(r.id)).length - 1)
  );
  const at = $derived(holding ? head : undefined);

  function copy(): void {
    copyToClipboard("Arrival CSS", arrivalCss(p));
  }

  const EASINGS = Object.entries(CURVES).map(([value, c]) => ({
    value: value as Easing,
    label: c.label,
    note: c.note,
  }));
</script>

{#snippet dial(
  label: string,
  value: number,
  min: number,
  max: number,
  step: number,
  unit: string,
  set: (n: number) => void
)}
  <label class="dial">
    <span class="dlabel">{label}</span>
    <input
      {max}
      {min}
      oninput={(e) => set(e.currentTarget.valueAsNumber)}
      {step}
      type="range"
      {value}
    >
    <span class="dval">{value}{unit}</span>
  </label>
{/snippet}

{#snippet ease(label: string, value: Easing, set: (e: Easing) => void)}
  <label class="dial">
    <span class="dlabel">{label}</span>
    <select onchange={(e) => set(e.currentTarget.value as Easing)} {value}>
      {#each EASINGS as e (e.value)}
        <option value={e.value}>{e.label}</option>
      {/each}
    </select>
  </label>
{/snippet}

<div class="lab">
  <section class="stage">
    <header class="shead">
      <h1>Row arrival</h1>
      <p>
        The rail extends downward, the space it opens is the row's, and the
        content resolves into it.
      </p>
    </header>

    <div class="ledger" style={arrivalVars(p)}>
      {#each runs as run (run.key)}
        <div class="run" class:owns={run.rail && linked}>
          {#each run.rows as { row, i } (row.id)}
            {#if settled.has(row.id)}
              <div
                class="static"
                class:flush={continues(i)}
                class:railrow={railed(row.kind) && !linked}
              >
                {@render body(row)}
              </div>
            {:else}
              <Arrival
                {at}
                continues={continues(i)}
                lead={row.index * p.staggerMs}
                params={p}
                rail={railed(row.kind) && !linked}
              >
                {@render body(row)}
              </Arrival>
            {/if}
          {/each}
        </div>
      {/each}
    </div>

    <div class="acts">
      <button class="act" onclick={() => add('note')} type="button">
        Note
      </button>
      <button class="act" onclick={() => add('tool')} type="button">
        Tool row
      </button>
      <button class="act" onclick={() => add('agent')} type="button">
        Reply
      </button>
      <button
        class="act"
        onclick={() => add('note', 'tool', 'note', 'agent')}
        type="button"
      >
        Burst of 4
      </button>
      <button class="act" onclick={streamReply} type="button">
        Stream reply
      </button>
      <button class="act" onclick={replay} type="button">Replay</button>
      <button class="act" onclick={reset} type="button">Reset</button>
    </div>
  </section>

  <aside class="panel">
    <h2>Space</h2>
    {@render dial('Reserve', p.reserveMs, 0, 800, 10, 'ms', (n) => {
      p.reserveMs = n;
    })}
    {@render ease('Curve', p.reserveEase, (e) => {
      p.reserveEase = e;
    })}

    <h2>Rail</h2>
    <label class="dial">
      <span class="dlabel">Line</span>
      <select
        onchange={(e) => {
          linked = e.currentTarget.value === 'linked';
        }}
        value={linked ? 'linked' : 'drawn'}
      >
        <option value="linked">one, extends</option>
        <option value="drawn">per row, draws</option>
      </select>
    </label>
    {@render dial('Draw', p.railMs, 0, 800, 10, 'ms', (n) => {
      p.railMs = n;
    })}
    {@render dial('Offset', p.railDelayMs, -200, 400, 10, 'ms', (n) => {
      p.railDelayMs = n;
    })}
    {@render ease('Curve', p.railEase, (e) => {
      p.railEase = e;
    })}

    <h2>Content</h2>
    {@render dial('Delay', p.contentDelayMs, 0, 800, 10, 'ms', (n) => {
      p.contentDelayMs = n;
    })}
    {@render dial('Fade', p.contentMs, 0, 800, 10, 'ms', (n) => {
      p.contentMs = n;
    })}
    {@render dial('Rise', p.risePx, 0, 32, 1, 'px', (n) => {
      p.risePx = n;
    })}
    {@render dial('Blur', p.blurPx, 0, 10, 0.5, 'px', (n) => {
      p.blurPx = n;
    })}
    {@render ease('Curve', p.contentEase, (e) => {
      p.contentEase = e;
    })}

    <h2>Text</h2>
    {@render dial('Spread', p.wordSpreadMs, 0, 600, 10, 'ms', (n) => {
      p.wordSpreadMs = n;
    })}
    {@render dial('Fade', p.wordFadeMs, 0, 600, 10, 'ms', (n) => {
      p.wordFadeMs = n;
    })}
    {@render dial('Blur', p.wordBlurPx, 0, 8, 0.5, 'px', (n) => {
      p.wordBlurPx = n;
    })}
    {@render ease('Curve', p.wordEase, (e) => {
      p.wordEase = e;
    })}

    <h2>Burst</h2>
    {@render dial('Stagger', p.staggerMs, 0, 400, 10, 'ms', (n) => {
      p.staggerMs = n;
    })}

    <h2>Preview</h2>
    <label class="dial">
      <span class="dlabel">Loop</span>
      <input type="checkbox" bind:checked={looping}>
      <span class="dval">{arrivalDuration(p)}ms</span>
    </label>

    <h2>Playhead</h2>
    <label class="dial">
      <span class="dlabel">Hold</span>
      <input type="checkbox" bind:checked={holding}>
      <span class="dval">{holding ? `${head}ms` : `${span}ms`}</span>
    </label>
    <input
      class="scrub"
      disabled={!holding}
      max={span}
      min="0"
      step="5"
      type="range"
      bind:value={head}
    >

    <button class="copy" onclick={copy} type="button">Copy CSS</button>
  </aside>
</div>

{#snippet body(row: Row)}
  {#if row.kind === 'you'}
    <section class="turn you">
      <span class="who"><Stream text="You" /></span>
      <p class="said"><Stream text={row.text} /></p>
    </section>
  {:else if row.kind === 'agent'}
    <section class="turn">
      <span class="who"><Stream text="Claude Code" /></span>
      <p class="said"><Stream text={row.text} /></p>
    </section>
  {:else if row.kind === 'tool'}
    <span class="line">
      <Reveal><IconTerminal /></Reveal>
      <span class="tk"><Stream text={row.text} /></span>
      <span class="arg"><Stream text={row.arg ?? ''} /></span>
    </span>
  {:else}
    <span class="line">
      <Reveal><IconInfo /></Reveal>
      <span class="tk muted"><Stream text={row.text} /></span>
    </span>
  {/if}
{/snippet}

<style>
  .lab {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 300px;
    gap: var(--space-7);
    padding: var(--space-7);
    align-items: start;
  }
  .shead h1 {
    font-size: var(--text-lg);
    font-weight: var(--weight-strong);
    color: var(--ink-strong);
  }
  .shead p {
    font-size: var(--text-sm);
    color: var(--ink-muted);
    margin-top: var(--space-1);
  }
  .ledger {
    margin-top: var(--space-6);
    padding: 0 var(--space-6) var(--space-6) var(--space-7);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-panel);
    min-height: 320px;
  }
  /* A run of rail rows. In `linked` mode this box owns the line: one
     background over the whole run, `2px 100%`, so a row opening inside it
     makes the line longer with nothing to animate — the extension IS the
     space being reserved. Margins collapse through it, so the run adds no
     spacing of its own. */
  .run.owns {
    margin-left: var(--space-2);
    padding-left: var(--space-3);
    background: var(--rail-head, var(--rail)) left top / 2px 100% no-repeat;
  }
  /* Settled history: the same box the arriving row settles into, so nothing
     shifts when the animation hands the row back to normal flow. */
  .static {
    margin-top: var(--space-4);
  }
  /* A run of rail rows is one line, not a stack of stubs — the same rule
     ToolGroup already follows, and what makes "the line extends" legible. */
  .static.flush {
    margin-top: 0;
  }
  .static.railrow {
    margin-left: var(--space-2);
    padding-left: var(--space-3);
    background: var(--rail-head, var(--rail)) left top / 2px 100% no-repeat;
  }

  .turn.you {
    margin-inline: calc(var(--space-4) * -1);
    padding: var(--space-3) var(--space-4);
    background: var(--surface-sunken);
    border-radius: var(--radius-well);
  }
  .who {
    display: block;
    font-size: var(--text-xs);
    color: var(--ink-muted);
    margin-bottom: var(--space-1);
  }
  .said {
    font-size: var(--text-sm);
    line-height: var(--leading-body);
    color: var(--ink-body);
  }
  .line {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 26px;
    font-size: var(--text-sm);
    color: var(--ink-body);
  }
  .line :global(svg) {
    width: 14px;
    height: 14px;
    flex: 0 0 auto;
    color: var(--ink-muted);
  }
  /* The verb is a fixed token and the argument takes what is left, so a rail
     row stays one line at any column width. */
  .tk {
    flex: 0 0 auto;
    white-space: nowrap;
  }
  .tk.muted {
    color: var(--ink-muted);
  }
  .arg {
    min-width: 0;
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--ink-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .acts {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-top: var(--space-5);
  }
  .act,
  .copy {
    border: 1px solid var(--border-hairline);
    background: transparent;
    border-radius: var(--radius-control);
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-sm);
    color: var(--ink-body);
    cursor: pointer;
  }
  .act:hover,
  .copy:hover {
    background: var(--surface-hover);
  }

  .panel {
    position: sticky;
    top: var(--space-6);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-panel);
    padding: var(--space-5);
    background: var(--surface-sunken);
  }
  .panel h2 {
    font-size: var(--text-xs);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ink-muted);
    margin: var(--space-4) 0 var(--space-2);
  }
  .panel h2:first-child {
    margin-top: 0;
  }
  .dial {
    display: grid;
    grid-template-columns: 62px minmax(0, 1fr) 52px;
    align-items: center;
    gap: var(--space-2);
    padding: 2px 0;
  }
  .dlabel {
    font-size: var(--text-xs);
    color: var(--ink-muted);
  }
  .dval {
    font-family: var(--font-mono);
    font-size: var(--text-xs);
    color: var(--ink-body);
    text-align: right;
  }
  .dial input[type="range"],
  .scrub {
    width: 100%;
    accent-color: var(--accent-text);
  }
  .scrub {
    margin-top: var(--space-2);
  }
  .dial select {
    font-size: var(--text-xs);
    color: var(--ink-body);
    background: transparent;
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-mark);
    padding: 2px 4px;
  }
  .copy {
    width: 100%;
    margin-top: var(--space-5);
  }
</style>
