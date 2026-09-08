<script lang="ts">
  import type { HarnessKind, ModelInfo } from "@whiffle/core";
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";
  import { models } from "$lib/whiffle/models.svelte";
  import ClaudeMark from "~icons/logos/claude-icon";
  import IconBypass from "~icons/solar/bolt-linear";
  import IconAsk from "~icons/solar/chat-round-dots-linear";
  import IconPlan from "~icons/solar/clipboard-list-linear";
  import IconEdits from "~icons/solar/pen-new-square-linear";
  import EffortSlider from "./EffortSlider.svelte";
  import HighlightGroup from "./HighlightGroup.svelte";
  import OpenCodeMark from "./OpenCodeMark.svelte";
  import PiMark from "./PiMark.svelte";

  interface Section {
    current: { y: number; opacity: number; scale: number };
    progress: number;
  }
  let {
    timeline,
    params,
    onclose,
    onsubmit,
  }: {
    timeline: Record<
      | "card"
      | "harness"
      | "model"
      | "effort"
      | "permissions"
      | "machine"
      | "fields"
      | "footer",
      Section
    > & {
      header: { current: { y: number; opacity: number } };
      scrim: { current: { opacity: number; blur: number } };
      interactive: { started: boolean };
    };
    params: {
      stagger: number;
      highlightSpring: { visualDuration?: number; bounce?: number };
      sliderSpring: { visualDuration?: number; bounce?: number };
      card: { radius: number; blur: number; scrim: number };
      highlight: { inset: number; radius: number };
    };
    onclose: () => void;
    onsubmit: () => void;
  } = $props();
  const harnesses = [
    {
      value: "claude",
      label: "Claude",
      icon: ClaudeMark,
    },
    {
      value: "opencode",
      label: "OpenCode",
      icon: OpenCodeMark,
    },
    { value: "pi", label: "pi", icon: PiMark },
  ];
  const demo: Record<HarnessKind, ModelInfo[]> = {
    claude: [
      ["claude-opus-5", "Opus 5"],
      ["claude-fable-5-1", "Fable 5.1"],
      ["claude-sonnet-5", "Sonnet 5"],
      ["claude-opus-4-6", "Opus 4.6"],
      ["claude-haiku-4-5", "Haiku 4.5"],
    ].map(([value, displayName]) => ({ value, displayName })),
    opencode: [
      ["openai/gpt-6-astra", "GPT-6 Astra"],
      ["openai/gpt-5.6-terra", "GPT-5.6 Terra"],
      ["opencode-go/deepseek-v4-pro", "DeepSeek V4 Pro"],
    ].map(([value, displayName]) => ({ value, displayName })),
    pi: [
      ["claude-sonnet-5", "Sonnet 5"],
      ["claude-opus-5", "Opus 5"],
    ].map(([value, displayName]) => ({ value, displayName })),
  };
  const permissions = [
    { value: "default", label: "Ask", icon: IconAsk },
    { value: "acceptEdits", label: "Accept edits", icon: IconEdits },
    { value: "plan", label: "Plan", icon: IconPlan },
    { value: "bypassPermissions", label: "Bypass", icon: IconBypass },
  ];
  const machines = ["obelisk-of-light", "aurora", "quarry"].map((value) => ({
    value,
    label: value,
  }));
  let harness = $state<HarnessKind>("claude");
  let model = $state(catalog("claude")[0].value);
  let effort = $state(2);
  let permission = $state("default");
  let machine = $state("obelisk-of-light");
  let directory = $state("");
  let prompt = $state("");
  // biome-ignore lint/suspicious/noUnassignedVariables: assigned by Svelte bind:this
  let dialog: HTMLDialogElement;
  const rows = $derived(
    catalog(harness).map((row) => ({ ...row, label: row.displayName }))
  );
  function catalog(kind: HarnessKind) {
    const offered = models.forHarness(kind);
    return offered.length ? offered : demo[kind];
  }
  function chooseHarness(value: string) {
    harness = value as HarnessKind;
    model = catalog(harness)[0].value;
  }
  function style(section: Section) {
    return `opacity: ${section.current.opacity}; transform: translateY(${section.current.y}px) scale(${section.current.scale});`;
  }
  function tier(id: string) {
    if (id.includes("haiku")) {
      return "Fast";
    }
    if (id.includes("opus") || id.includes("astra") || id.includes("pro")) {
      return "Advanced";
    }
    return "Standard";
  }
  onMount(() => {
    const previous = document.activeElement as HTMLElement;
    dialog.focus();
    return () => previous.focus();
  });
</script>

<svelte:window
  onkeydown={(event) => { if (event.key === 'Escape') { event.preventDefault(); onclose(); } }}
/>
<div class="overlay" out:fade={{ duration: 140 }}>
  <button
    aria-label="Close new session"
    class="scrim"
    onclick={onclose}
    style="opacity: {timeline.scrim.current.opacity}; background: oklch(from var(--scrim) l c h / {params.card.scrim}); backdrop-filter: blur({timeline.scrim.current.blur * params.card.blur / 12}px);"
    tabindex="-1"
    type="button"
  ></button>
  <dialog
    aria-describedby="new-session-description"
    aria-labelledby="new-session-title"
    open
    style="{style(timeline.card)} --radius-modal: {params.card.radius}px;"
    tabindex="-1"
    bind:this={dialog}
  >
    <header
      style="opacity: {timeline.header.current.opacity}; transform: translateY({timeline.header.current.y}px);"
    >
      <h2 id="new-session-title">New session</h2>
      <p id="new-session-description">
        Choose a harness and configure the session.
      </p>
    </header>
    <form
      inert={!timeline.interactive.started}
      onsubmit={(event) => { event.preventDefault(); onsubmit(); }}
      style:pointer-events={timeline.interactive.started ? 'auto' : 'none'}
    >
      <div class="body">
        <div class="column choose">
          <section style={style(timeline.harness)}>
            <h3>Harness</h3>
            <HighlightGroup
              items={harnesses}
              label="Harness"
              onchange={chooseHarness}
              spring={params.highlightSpring}
              value={harness}
              {...params.highlight}
              progress={timeline.harness.progress}
              stagger={params.stagger}
            >
              {#snippet children(item)}
                <span class="harness"
                  ><item.icon /><span>{item.label}</span></span
                >
              {/snippet}
            </HighlightGroup>
          </section>
          <section class="model" style={style(timeline.model)}>
            <h3>Model</h3>
            <div class="models">
              {#key harness}
                <div class="model-list">
                  <HighlightGroup
                    items={rows}
                    label="Model"
                    onchange={(value) => { model = value; }}
                    orientation="vertical"
                    spring={params.highlightSpring}
                    swap
                    value={model}
                    {...params.highlight}
                    progress={timeline.model.progress}
                    stagger={params.stagger}
                  >
                    {#snippet children(item)}
                      <span class="model-row"
                        ><span class="model-name"
                          >{item.displayName}<code>{item.value}</code></span
                        ><small class="tier">{tier(item.value)}</small></span
                      >
                    {/snippet}
                  </HighlightGroup>
                </div>
              {/key}
            </div>
            <label class="custom"
              >Custom model ID<input
                aria-label="Custom model ID"
                class="mono"
                oninput={(event) => { model = event.currentTarget.value; }}
                placeholder="provider/model-id"
                value={rows.some((row) => row.value === model) ? '' : model}
              ></label
            >
          </section>
        </div>
        <div class="column configure">
          <section style={style(timeline.machine)}>
            <h3>Machine</h3>
            <HighlightGroup
              items={machines}
              label="Machine"
              onchange={(value) => { machine = value; }}
              spring={params.highlightSpring}
              value={machine}
              {...params.highlight}
              duration={0.4}
              progress={timeline.machine.progress}
              stagger={params.stagger}
            >
              {#snippet children(item)}
                {item.label}
              {/snippet}
            </HighlightGroup>
          </section>
          <section style={style(timeline.effort)}>
            <h3>Effort</h3>
            <EffortSlider spring={params.sliderSpring} bind:value={effort} />
          </section>
          <section style={style(timeline.permissions)}>
            <h3>Permissions</h3>
            <HighlightGroup
              columns={2}
              items={permissions}
              label="Permissions"
              onchange={(value) => { permission = value; }}
              spring={params.highlightSpring}
              value={permission}
              {...params.highlight}
              duration={0.4}
              progress={timeline.permissions.progress}
              stagger={params.stagger}
            >
              {#snippet children(item)}
                <span class="mode"><item.icon /><span>{item.label}</span></span>
              {/snippet}
            </HighlightGroup>
          </section>
          <section class="fields" style={style(timeline.fields)}>
            <label
              >Working directory<input
                class="mono"
                placeholder="/home/bewinxed/cockpit"
                bind:value={directory}
              ></label
            >
            <label
              >First prompt<textarea
                placeholder="Describe the task"
                rows="2"
                bind:value={prompt}
              ></textarea></label
            >
          </section>
        </div>
      </div>
      <footer style={style(timeline.footer)}>
        <span>Prototype</span
        ><button onclick={onclose} type="button">Cancel</button
        ><button class="primary" type="submit">Start session</button>
      </footer>
    </form>
  </dialog>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 80;
    display: grid;
    place-items: center;
    padding: var(--space-5);
    pointer-events: none;
  }
  .scrim {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border: 0;
    pointer-events: auto;
  }
  dialog {
    position: relative;
    inset: auto;
    margin: 0;
    width: 840px;
    max-width: 100%;
    max-height: min(720px, 100dvh - var(--space-8));
    display: flex;
    flex-direction: column;
    border: 1px solid var(--border-control);
    border-radius: var(--radius-modal);
    background: var(--surface-raised);
    color: var(--ink-body);
    box-shadow: var(--shadow-overlay);
    padding: 0;
    pointer-events: auto;
    overflow: hidden;
  }
  header {
    padding: var(--space-5) var(--space-6) var(--space-4);
    border-bottom: 1px solid var(--border-hairline);
  }
  h2 {
    color: var(--ink-strong);
    font-size: var(--text-lg);
    font-weight: var(--weight-strong);
  }
  header p {
    margin-top: var(--space-1);
    font-size: var(--text-sm);
    color: var(--ink-muted);
  }
  form {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .body {
    display: grid;
    grid-template-columns: 1.15fr 1fr;
    gap: var(--space-6);
    padding: var(--space-5) var(--space-6);
    min-height: 0;
  }
  .column {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
    min-height: 0;
  }
  .model {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
  }
  h3,
  label {
    font-size: var(--text-sm);
    font-weight: var(--weight-medium);
    color: var(--ink-label);
  }
  h3 {
    margin-bottom: var(--space-2);
  }
  .harness {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
  }
  .harness :global(svg) {
    width: 20px;
    height: 20px;
  }
  .mode {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }
  .mode :global(svg) {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }
  .models {
    display: grid;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .model-list {
    grid-area: 1 / 1;
  }
  .model-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }
  .model-name {
    min-width: 0;
  }
  code {
    display: block;
    margin-top: var(--space-1);
    font: var(--text-xs) var(--font-mono);
    overflow-wrap: anywhere;
    color: var(--ink-muted);
  }
  .tier {
    flex-shrink: 0;
    padding: var(--space-1) var(--space-2);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-pill);
    font-size: var(--text-xs);
    color: var(--ink-muted);
  }
  label {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }
  .custom {
    margin-top: var(--space-3);
  }
  input,
  textarea {
    width: 100%;
    min-height: 36px;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--border-control);
    border-radius: var(--radius-control);
    background: var(--surface-field);
    color: var(--ink-strong);
    font-size: var(--text-base);
    font-weight: var(--weight-body);
  }
  input::placeholder,
  textarea::placeholder {
    color: var(--ink-muted);
  }
  .mono {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
  }
  textarea {
    resize: vertical;
  }
  .fields {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  footer {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-4) var(--space-6);
    border-top: 1px solid var(--border-hairline);
  }
  footer span {
    margin-right: auto;
    color: var(--ink-muted);
    font-size: var(--text-xs);
  }
  footer button {
    min-height: 44px;
    border: 0;
    background: transparent;
    color: var(--ink-body);
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-control);
    cursor: pointer;
    font-size: var(--text-base);
  }
  footer .primary {
    background: var(--gradient-action);
    box-shadow: var(--shadow-action);
    color: var(--on-brand);
  }
  input:focus-visible,
  textarea:focus-visible,
  footer button:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
  @media (max-width: 720px) {
    dialog {
      max-height: calc(100dvh - var(--space-4));
    }
    .body {
      grid-template-columns: 1fr;
      overflow-y: auto;
    }
    .models {
      max-height: 240px;
    }
  }
  @media (max-width: 480px) {
    .overlay {
      padding: var(--space-2);
    }
    header,
    .body,
    footer {
      padding-inline: var(--space-4);
    }
  }
</style>
