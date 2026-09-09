<script lang="ts">
  import type { HarnessKind, ModelInfo } from "@whiffle/core";
  import { onMount } from "svelte";
  import { prefersReducedMotion, Spring } from "svelte/motion";
  import { fade, fly } from "svelte/transition";
  import { whiffle } from "$lib/whiffle/client.svelte";
  import { models } from "$lib/whiffle/models.svelte";
  import ClaudeMark from "~icons/logos/claude-icon";
  import IconBypass from "~icons/solar/bolt-linear";
  import IconAsk from "~icons/solar/chat-round-dots-linear";
  import IconPlan from "~icons/solar/clipboard-list-linear";
  import IconFolder from "~icons/solar/folder-linear";
  import IconEdits from "~icons/solar/pen-new-square-linear";
  import EffortSlider from "./EffortSlider.svelte";
  import HighlightGroup from "./HighlightGroup.svelte";
  import LocationPicker, { type Place } from "./LocationPicker.svelte";
  import ModelPicker from "./ModelPicker.svelte";
  import type { Usage } from "./model-order";
  import OpenCodeMark from "./OpenCodeMark.svelte";
  import PiMark from "./PiMark.svelte";
  import { springFromVisual } from "./spring";

  interface Clip {
    current: { y: number; opacity: number; scale: number };
    progress: number;
  }
  let {
    timeline,
    params,
    onclose,
    onsubmit,
  }: {
    timeline: Record<"card" | "prompt" | "chips" | "footer", Clip> & {
      header: { current: { y: number; opacity: number } };
      scrim: { current: { opacity: number; blur: number } };
      interactive: { started: boolean };
    };
    params: {
      stagger: number;
      highlightSpring: { visualDuration?: number; bounce?: number };
      sliderSpring: { visualDuration?: number; bounce?: number };
      panelSpring: { visualDuration?: number; bounce?: number };
      card: { radius: number; blur: number; scrim: number };
      highlight: { inset: number; radius: number };
    };
    onclose: () => void;
    onsubmit: () => void;
  } = $props();

  const harnesses = [
    { value: "claude", label: "Claude", icon: ClaudeMark },
    { value: "opencode", label: "OpenCode", icon: OpenCodeMark },
    { value: "pi", label: "pi", icon: PiMark },
  ];
  const demoModels: Record<HarnessKind, ModelInfo[]> = {
    claude: [
      ["claude-opus-5", "Opus 5", "2026-08-20"],
      ["claude-fable-5-1", "Fable 5.1", "2026-08-02"],
      ["claude-sonnet-5", "Sonnet 5", "2026-06-11"],
      ["claude-opus-4-6", "Opus 4.6", "2026-02-05"],
      ["claude-haiku-4-5", "Haiku 4.5", "2025-10-01"],
    ].map(([value, displayName, released]) => ({
      value,
      displayName,
      released,
    })),
    opencode: [
      ["openai/gpt-6-astra", "GPT-6 Astra", "2026-07-30"],
      ["openai/gpt-5.6-terra", "GPT-5.6 Terra", "2026-05-14"],
      ["opencode-go/deepseek-v4-pro", "DeepSeek V4 Pro", "2026-04-02"],
    ].map(([value, displayName, released]) => ({
      value,
      displayName,
      released,
    })),
    pi: [
      ["claude-sonnet-5", "Sonnet 5", "2026-06-11"],
      ["claude-opus-5", "Opus 5", "2026-08-20"],
    ].map(([value, displayName, released]) => ({
      value,
      displayName,
      released,
    })),
  };
  const demoPlaces: Place[] = [
    {
      machineId: "m1",
      machine: "obelisk-of-light",
      cwd: "/home/bewinxed/cockpit",
      name: "cockpit",
    },
    {
      machineId: "m1",
      machine: "obelisk-of-light",
      cwd: "/home/bewinxed/backlot",
      name: "backlot",
    },
    {
      machineId: "m1",
      machine: "obelisk-of-light",
      cwd: "/home/bewinxed/locallm-router",
    },
    {
      machineId: "m2",
      machine: "Omars-MacBook-Pro",
      cwd: "/Users/bewinxed/keeboard",
      name: "keeboard",
    },
    {
      machineId: "m2",
      machine: "Omars-MacBook-Pro",
      cwd: "/Users/bewinxed/whiffle",
    },
  ];
  const permissions = [
    { value: "default", label: "Ask", icon: IconAsk },
    { value: "acceptEdits", label: "Accept edits", icon: IconEdits },
    { value: "plan", label: "Plan", icon: IconPlan },
    { value: "bypassPermissions", label: "Bypass", icon: IconBypass },
  ];
  const efforts = ["Low", "Medium", "High", "Max"];
  const USAGE_KEY = "whiffle:new-session:model-usage";

  function catalog(kind: HarnessKind) {
    const offered = models.forHarness(kind);
    return offered.length ? offered : demoModels[kind];
  }
  function places(): Place[] {
    const live = whiffle.projects.map((project) => {
      const machine = whiffle.machines.find(
        (m) => m.machineId === project.machineId
      );
      return {
        machineId: project.machineId,
        machine: machine?.hostname ?? project.machineId,
        cwd: project.cwd,
        name: project.name,
      };
    });
    return live.length ? live : demoPlaces;
  }

  let harness = $state<HarnessKind>("claude");
  let model = $state(catalog("claude")[0].value);
  let effort = $state(2);
  let permission = $state("default");
  const [first] = places();
  let machineId = $state(first.machineId);
  let cwd = $state(first.cwd);
  let prompt = $state("");
  let usage = $state<Usage>({});
  /** Which setting is expanded under the chips; nothing, by default. */
  let panel = $state<
    "" | "harness" | "model" | "where" | "permission" | "effort"
  >("");
  // biome-ignore lint/suspicious/noUnassignedVariables: assigned by Svelte bind:this
  let promptField: HTMLTextAreaElement;

  const rows = $derived(catalog(harness));
  const modelRow = $derived(rows.find((row) => row.value === model));
  const place = $derived(
    places().find((p) => p.machineId === machineId && p.cwd === cwd) ?? {
      machineId,
      machine:
        whiffle.machines.find((m) => m.machineId === machineId)?.hostname ?? "",
      cwd,
    }
  );
  const chips = $derived([
    {
      value: "harness",
      label: harnesses.find((h) => h.value === harness)?.label ?? harness,
      icon: harnesses.find((h) => h.value === harness)?.icon,
    },
    { value: "model", label: modelRow?.displayName ?? model },
    {
      value: "where",
      label: `${place.machine} · ${place.name ?? place.cwd}`,
      icon: IconFolder,
    },
    {
      value: "permission",
      label:
        permissions.find((p) => p.value === permission)?.label ?? permission,
      icon: permissions.find((p) => p.value === permission)?.icon,
    },
    { value: "effort", label: `Effort ${efforts[effort]}` },
  ]);

  /** The expanded setting's height, sprung so the card grows and shrinks rather than jumps. */
  const panelHeight = new Spring(0);
  let panelContent = $state(0);
  $effect(() => {
    const config = springFromVisual(
      params.panelSpring.visualDuration ?? 0.4,
      params.panelSpring.bounce ?? 0.1
    );
    panelHeight.stiffness = config.stiffness;
    panelHeight.damping = config.damping;
  });
  $effect(() => {
    panelHeight.set(panel ? panelContent : 0, {
      instant: prefersReducedMotion.current,
    });
  });

  function toggle(next: string) {
    panel = panel === next ? "" : (next as typeof panel);
  }
  function chooseHarness(value: string) {
    harness = value as HarnessKind;
    model = catalog(harness)[0].value;
  }
  function style(clip: Clip) {
    return `opacity: ${clip.current.opacity}; transform: translateY(${clip.current.y}px) scale(${clip.current.scale});`;
  }
  function submit() {
    usage = { ...usage, [model]: new Date().toISOString() };
    localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
    onsubmit();
  }
  onMount(() => {
    usage = JSON.parse(localStorage.getItem(USAGE_KEY) ?? "{}");
    const previous = document.activeElement as HTMLElement;
    promptField.focus();
    return () => previous.focus();
  });
</script>

<svelte:window
  onkeydown={(event) => { if (event.key === 'Escape') { event.preventDefault(); if (panel) { panel = ''; } else { onclose(); } } }}
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
    aria-labelledby="new-session-title"
    open
    style="{style(timeline.card)} --radius-modal: {params.card.radius}px;"
    tabindex="-1"
  >
    <form
      inert={!timeline.interactive.started}
      onsubmit={(event) => { event.preventDefault(); submit(); }}
      style:pointer-events={timeline.interactive.started ? 'auto' : 'none'}
    >
      <h2
        id="new-session-title"
        style="opacity: {timeline.header.current.opacity}; transform: translateY({timeline.header.current.y}px);"
      >
        New session
      </h2>
      <label class="prompt" style={style(timeline.prompt)}>
        <span class="sr-only">First prompt</span>
        <textarea
          onkeydown={(event) => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); submit(); } }}
          placeholder="What should it work on?"
          rows="5"
          bind:this={promptField}
          bind:value={prompt}
        ></textarea>
      </label>
      <div class="chips" style={style(timeline.chips)}>
        <HighlightGroup
          items={chips}
          label="Session settings"
          onchange={toggle}
          spring={params.highlightSpring}
          value={panel}
          {...params.highlight}
          progress={timeline.chips.progress}
          stagger={params.stagger}
        >
          {#snippet children(item)}
            <span class="chip" class:open={panel === item.value}>
              {#if item.icon}
                <item.icon />
              {/if}
              <span>{item.label}</span>
            </span>
          {/snippet}
        </HighlightGroup>
      </div>
      <div
        aria-live="polite"
        class="panel"
        style:height="{panelHeight.current}px"
      >
        <div class="panel-inner" bind:clientHeight={panelContent}>
          {#key panel}
            <div
              class="panel-body"
              in:fly|global={{ y: -8, duration: prefersReducedMotion.current ? 0 : 260, delay: 60 }}
              out:fade|global={{ duration: prefersReducedMotion.current ? 0 : 120 }}
            >
              {#if panel === "harness"}
                <HighlightGroup
                  items={harnesses}
                  label="Harness"
                  onchange={chooseHarness}
                  spring={params.highlightSpring}
                  value={harness}
                  {...params.highlight}
                  stagger={params.stagger}
                >
                  {#snippet children(item)}
                    <span class="harness"
                      ><item.icon /><span>{item.label}</span></span
                    >
                  {/snippet}
                </HighlightGroup>
              {:else if panel === "model"}
                <ModelPicker
                  {rows}
                  spring={params.highlightSpring}
                  stagger={params.stagger}
                  swapKey={harness}
                  {usage}
                  {...params.highlight}
                  bind:value={model}
                />
              {:else if panel === "where"}
                <LocationPicker
                  places={places()}
                  spring={params.highlightSpring}
                  stagger={params.stagger}
                  {...params.highlight}
                  bind:cwd
                  bind:machineId
                />
              {:else if panel === "permission"}
                <HighlightGroup
                  columns={2}
                  items={permissions}
                  label="Permissions"
                  onchange={(value) => { permission = value; }}
                  spring={params.highlightSpring}
                  value={permission}
                  {...params.highlight}
                  stagger={params.stagger}
                >
                  {#snippet children(item)}
                    <span class="mode"
                      ><item.icon /><span>{item.label}</span></span
                    >
                  {/snippet}
                </HighlightGroup>
              {:else if panel === "effort"}
                <EffortSlider
                  spring={params.sliderSpring}
                  bind:value={effort}
                />
              {/if}
            </div>
          {/key}
        </div>
      </div>
      <footer style={style(timeline.footer)}>
        <span>⌘↵ to start</span>
        <button onclick={onclose} type="button">Cancel</button>
        <button class="primary" type="submit">Start session</button>
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
    width: 640px;
    max-width: 100%;
    max-height: calc(100dvh - var(--space-8));
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
  form {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-5) var(--space-5) var(--space-4);
    min-height: 0;
  }
  h2 {
    color: var(--ink-strong);
    font-size: var(--text-lg);
    font-weight: var(--weight-strong);
  }
  .prompt textarea {
    width: 100%;
    padding: var(--space-3) var(--space-4);
    border: 1px solid var(--border-control);
    border-radius: var(--radius-modal);
    background: var(--surface-field);
    color: var(--ink-strong);
    font-size: var(--text-base);
    line-height: 1.5;
    resize: vertical;
    min-height: 120px;
  }
  .prompt textarea::placeholder {
    color: var(--ink-muted);
  }
  .prompt textarea:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
  .chips :global(.group) {
    flex-wrap: wrap;
  }
  .chips :global(.group > button) {
    flex: 0 1 auto;
    min-height: 36px;
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-xs);
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    white-space: nowrap;
  }
  .chip :global(svg) {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }
  .panel {
    overflow: hidden;
    display: grid;
  }
  .panel-inner {
    grid-area: 1 / 1;
    align-self: start;
  }
  .panel-body {
    padding-top: var(--space-1);
  }
  .harness,
  .mode {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }
  .harness {
    width: 100%;
    justify-content: center;
  }
  .harness :global(svg) {
    width: 20px;
    height: 20px;
  }
  .mode :global(svg) {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }
  footer {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-top: var(--space-1);
  }
  footer span {
    margin-right: auto;
    color: var(--ink-muted);
    font-size: var(--text-xs);
  }
  footer button {
    min-height: 40px;
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
  footer button:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
  @media (max-width: 480px) {
    .overlay {
      padding: var(--space-2);
    }
    form {
      padding-inline: var(--space-4);
    }
  }
</style>
