<script lang="ts">
  import {
    type EffortLevel,
    HARNESSES,
    type HarnessKind,
    type PermissionMode,
    repoPath,
  } from "@whiffle/core";
  import type { TransitionConfig } from "dialkit";
  import {
    computeClipState,
    computeStaticTimeline,
    parseTimelineConfig,
  } from "dialkit/timeline";
  import { tick, untrack } from "svelte";
  import { prefersReducedMotion } from "svelte/motion";
  import { goto } from "$app/navigation";
  import ProviderLogo from "$lib/components/features/ProviderLogo.svelte";
  import { IconClose } from "$lib/icons";
  import {
    createProject,
    machineFs,
    spawnSession,
    whiffle,
  } from "../client.svelte";
  import { EFFORT_LEVELS } from "../effort-levels";
  import { inspectMachine } from "../fleet";
  import HarnessGlyph from "../HarnessGlyph.svelte";
  import { models } from "../models.svelte";
  import { PERMISSION_MODES } from "../permission-modes";
  import { rememberSpawn, spawnPrefs } from "../spawnPrefs.svelte";
  import ActionButton from "./ActionButton.svelte";
  import AnchoredPopover from "./AnchoredPopover.svelte";
  import LedgerRow from "./LedgerRow.svelte";
  import LocationPicker from "./LocationPicker.svelte";
  import ModelPicker from "./ModelPicker.svelte";
  import { deriveModelEntries } from "./model-entries";
  import { lastSpawnAt, lastUsedAt, recordModelUse } from "./modelUse.svelte";
  import PromptWell from "./PromptWell.svelte";
  import Segmented from "./Segmented.svelte";
  import StopSlider from "./StopSlider.svelte";
  import ToggleChip from "./ToggleChip.svelte";
  import ValueButton from "./ValueButton.svelte";

  interface Clip {
    at: number;
    current: { opacity: number; y?: number };
    duration: number;
    from: { opacity: number; y: number };
    to: { opacity: number; y: number };
    transition: TransitionConfig;
  }
  interface Timeline {
    card: { current: { opacity: number; scale: number; y: number } };
    duration: number;
    focus: { started: boolean };
    interactive: { started: boolean };
    rows: Clip;
    scrim: { current: { opacity: number } };
    time: number;
  }
  interface SpringParams {
    bounce: number;
    visualDuration: number;
  }
  interface Params {
    list: { highlight: SpringParams };
    open: { rowStagger: number };
    pop: { open: SpringParams; rowStagger: number };
    seg: { thumb: SpringParams };
    slider: { thumb: SpringParams };
    swap: { spring: SpringParams; stagger: number };
  }
  let {
    open,
    prefill,
    onclose,
    timeline,
    params,
  }: {
    open: boolean;
    prefill?: { machineId?: string; cwd?: string; projectId?: string };
    onclose: () => void;
    timeline: Timeline;
    params: Params;
  } = $props();
  let card = $state<HTMLElement>();
  let modelAnchor = $state<HTMLButtonElement>();
  let locationAnchor = $state<HTMLButtonElement>();
  let opener: HTMLElement | null = null;
  let submission = 0;
  let prompt = $state("");
  let machineId = $state("");
  let cwd = $state("");
  let repo = $state<string>();
  let harness = $state<HarnessKind>(spawnPrefs.harness);
  let model = $state("");
  let effort = $state<EffortLevel | null>(null);
  let permissionMode = $state<PermissionMode>(spawnPrefs.permissionMode);
  let projectId = $state<string>();
  let editing = $state(false);
  let sideQuest = $state(false);
  let worktree = $state(false);
  let saveAsProject = $state(false);
  let busy = $state(false);
  let error = $state("");
  let unreadable = $state(false);
  let verifiedLocation = $state("");
  const locationKey = $derived(JSON.stringify([machineId, cwd.trim()]));
  const locationUnverified = $derived(
    Boolean(machineId && cwd.trim()) && verifiedLocation !== locationKey
  );
  let popover = $state<"model" | "location" | null>(null);
  const machine = $derived(
    whiffle.machines.find((row) => row.machineId === machineId)
  );
  const report = $derived(
    machine?.harnesses?.find((row) => row.harness === harness)
  );
  const installedHarnesses = $derived(
    HARNESSES.filter((kind) =>
      machine?.harnesses?.some(
        (entry) => entry.harness === kind && entry.installed
      )
    )
  );
  const entries = $derived(
    deriveModelEntries(models.forHarness(harness), {
      lastSpawnAt: lastSpawnAt(harness),
      lastUsedAt: Object.fromEntries(
        models.forHarness(harness).flatMap((row) => {
          const id = row.resolvedModel ?? row.value;
          const used = lastUsedAt(harness, id);
          return used ? [[id, used]] : [];
        })
      ),
    })
  );
  const selected = $derived(
    entries.find((row) => row.id === model) ??
      (model ? undefined : entries.find((row) => row.isDefault))
  );
  const stops = $derived(
    EFFORT_LEVELS.map((stop) => ({
      ...stop,
      reachable:
        report?.capabilities.effort === true &&
        (selected?.effort.includes(stop.value) ?? false),
    }))
  );
  const scale = $derived(stops.some((stop) => stop.reachable));
  const modes = $derived(
    PERMISSION_MODES.map((mode) => ({
      ...mode,
      label:
        ({ default: "Ask", plan: "Plan" } as Record<string, string>)[
          mode.value
        ] ?? mode.label,
      disabled: report
        ? !report.capabilities.permissionModes.includes(mode.value)
        : false,
      reason:
        report && !report.capabilities.permissionModes.includes(mode.value)
          ? "This agent cannot honor this permission mode."
          : undefined,
      tone:
        mode.value === "bypassPermissions"
          ? ("attn" as const)
          : ("neutral" as const),
    }))
  );
  const workdir = $derived(
    repo === undefined
      ? cwd.trim()
      : `${cwd.trim().replace(/\/+$/, "")}/${repoPath(repo).split("/").pop() ?? ""}`
  );
  const project = $derived(
    whiffle.projects.find(
      (row) =>
        row.id === projectId ||
        (row.machineId === machineId && row.cwd === workdir)
    )
  );
  const locked = $derived(
    Boolean(
      (prefill?.machineId || prefill?.cwd || prefill?.projectId) && !editing
    )
  );
  const homePrefix = /^\/home\/[^/]+/;
  const locationReading = $derived.by(() => {
    if (unreadable) {
      return `That directory can't be read on ${machine?.hostname ?? machineId}. Check the path and try again.`;
    }
    return machine && machine.status !== "online"
      ? `${machine.hostname} is offline. Pick another machine, or start when it returns.`
      : "";
  });
  const locationLabel = $derived.by(() => {
    if (locked) {
      return `From project ${project?.name ?? cwd.split("/").pop() ?? ""}`;
    }
    return machineId && cwd
      ? `${machine?.hostname ?? machineId} · ${cwd.replace(homePrefix, "~")}`
      : "Choose a machine and directory";
  });
  const reading = $derived(
    whiffle.hub === "connected"
      ? error ||
          locationReading ||
          (locationUnverified ? "Reading…" : "") ||
          (permissionMode === "bypassPermissions"
            ? "Every tool runs unprompted."
            : "")
      : "No spawn while the hub is unreachable. Reconnect to continue."
  );
  const rowClip = $derived(
    computeStaticTimeline(
      parseTimelineConfig({
        rows: {
          at: timeline.rows.at,
          duration: timeline.rows.duration,
          from: { ...timeline.rows.from },
          to: { ...timeline.rows.to },
          transition: timeline.rows.transition,
        },
      }),
      {}
    ).clips[0]
  );
  function rowStyle(index: number) {
    const current =
      index === 0
        ? timeline.rows.current
        : (computeClipState(
            rowClip,
            timeline.time - index * params.open.rowStagger
          ).current as { opacity: number; y: number });
    return prefersReducedMotion.current
      ? "opacity:1;transform:none"
      : `opacity:${current.opacity};transform:translateY(${current.y ?? 0}px)`;
  }
  function chooseHarness(value: HarnessKind) {
    harness = value;
    model = "";
    effort = null;
  }
  let lastMachine = "";
  $effect(() => {
    const id = machineId;
    const installed = installedHarnesses;
    if (id === lastMachine) {
      return;
    }
    lastMachine = id;
    untrack(() => {
      if (!installed.includes(harness)) {
        chooseHarness(installed[0] ?? "claude");
      }
    });
  });
  $effect(() => {
    if (
      effort &&
      !stops.some((stop) => stop.reachable && stop.value === effort)
    ) {
      effort = null;
    }
  });
  $effect(() => {
    const first = modes.find((mode) => !mode.disabled);
    if (
      first &&
      !modes.some((mode) => mode.value === permissionMode && !mode.disabled)
    ) {
      permissionMode = first.value;
    }
  });
  $effect(() => {
    if (!open) {
      return;
    }
    untrack(() => {
      opener = document.activeElement as HTMLElement;
      const seeded = prefill?.projectId
        ? whiffle.project(prefill.projectId)
        : undefined;
      projectId = seeded?.id;
      machineId =
        prefill?.machineId ||
        seeded?.machineId ||
        whiffle.onlineMachines[0]?.machineId ||
        "";
      cwd = prefill?.cwd || seeded?.cwd || "";
      ({ harness, permissionMode } = spawnPrefs);
      model = "";
      effort = null;
      prompt = "";
      repo = undefined;
      editing = false;
      sideQuest = false;
      worktree = false;
      saveAsProject = false;
      busy = false;
      error = "";
      popover = null;
      verifiedLocation = "";
    });
    return () => {
      submission += 1;
      opener?.focus();
    };
  });
  let focused = false;
  $effect(() => {
    if (!(open && timeline.focus.started)) {
      focused = false;
    }
    if (
      open &&
      timeline.focus.started &&
      timeline.interactive.started &&
      !focused
    ) {
      focused = true;
      untrack(() => card?.querySelector("textarea")?.focus());
    }
  });
  $effect(() => {
    const id = machineId;
    const path = cwd;
    const key = locationKey;
    unreadable = false;
    if (
      !(open && id && path) ||
      machine?.status !== "online" ||
      verifiedLocation === key
    ) {
      return;
    }
    let stale = false;
    const timer = setTimeout(() => {
      Promise.all([inspectMachine(id, path), machineFs(id, "list", path)])
        .then(() => {
          if (!stale) {
            verifiedLocation = key;
          }
        })
        .catch(() => {
          if (!stale) {
            unreadable = true;
          }
        });
    }, 600);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  });
  function closePopover() {
    const anchor = popover === "model" ? modelAnchor : locationAnchor;
    popover = null;
    anchor?.focus();
  }
  function validate() {
    if (popover === "location") {
      closePopover();
      return "Finish choosing a location before starting.";
    }
    if (!machineId) {
      return "Choose a machine to run this session on.";
    }
    if (repo !== undefined && !repo.trim()) {
      return "Choose a repository, or paste the URL of one.";
    }
    if (!cwd.trim()) {
      return "Enter the directory this session should work in.";
    }
    if (unreadable) {
      return locationReading;
    }
    return locationUnverified ? "Reading…" : "";
  }
  function close() {
    submission += 1;
    onclose();
  }
  function chooseLocation(value: {
    machineId: string;
    cwd: string;
    repo?: string;
  }) {
    ({ machineId, cwd, repo } = value);
    verifiedLocation =
      repo === undefined ? JSON.stringify([machineId, cwd.trim()]) : "";
    projectId =
      repo === undefined
        ? whiffle.projects.find(
            (row) => row.machineId === machineId && row.cwd === cwd
          )?.id
        : undefined;
    closePopover();
  }
  async function verifyBeforeSpawn(
    id: string,
    path: string,
    current: () => boolean
  ) {
    try {
      await Promise.all([
        inspectMachine(id, path),
        machineFs(id, "list", path),
      ]);
      return current();
    } catch {
      if (!current()) {
        return false;
      }
      unreadable = true;
      busy = false;
      await tick();
      if (!current()) {
        return false;
      }
      locationAnchor?.focus();
      return false;
    }
  }
  async function start() {
    if (busy || whiffle.hub !== "connected") {
      return;
    }
    error = validate();
    if (error) {
      locationAnchor?.focus();
      return;
    }
    submission += 1;
    const id = submission;
    const current = () => open && id === submission;
    const draft = {
      machineId,
      baseCwd: cwd.trim(),
      cwd: workdir,
      prompt,
      harness,
      permissionMode,
      model,
      effort,
      scratch: sideQuest ? { worktree, baseCwd: workdir } : undefined,
      repo: repo?.trim(),
      projectId,
      saveAsProject,
      usedModel: selected?.id ?? model,
    };
    busy = true;
    popover = null;
    if (
      !(
        (await verifyBeforeSpawn(draft.machineId, draft.baseCwd, current)) &&
        current()
      )
    ) {
      return;
    }
    try {
      let toAttach = draft.projectId;
      if (draft.saveAsProject && !toAttach) {
        toAttach = (
          await createProject({
            machineId: draft.machineId,
            cwd: draft.cwd,
            name: draft.cwd.split("/").filter(Boolean).pop() ?? draft.cwd,
          })
        ).id;
        if (!current()) {
          return;
        }
      }
      const instanceId = spawnSession({
        machineId: draft.machineId,
        cwd: draft.cwd,
        prompt: draft.prompt,
        harness: draft.harness,
        permissionMode: draft.permissionMode,
        ...(draft.model ? { model: draft.model } : {}),
        ...(draft.effort ? { effort: draft.effort } : {}),
        scratch: draft.scratch,
        bootstrap:
          draft.repo === undefined
            ? undefined
            : { repo: draft.repo, baseDir: draft.baseCwd },
        projectId: toAttach,
      });
      recordModelUse(draft.harness, draft.usedModel);
      rememberSpawn({
        harness: draft.harness,
        model: draft.model,
        permissionMode: draft.permissionMode,
        effort: draft.effort,
      });
      await exitTo(instanceId, current);
    } catch (cause) {
      if (!current()) {
        return;
      }
      error = cause instanceof Error ? cause.message : String(cause);
      busy = false;
    }
  }
  async function exitTo(instanceId: string, current: () => boolean) {
    if (card) {
      const css = getComputedStyle(card);
      await card.animate(
        [
          { opacity: 1, transform: "scale(1)" },
          { opacity: 0, transform: "scale(.98)" },
        ],
        {
          duration: prefersReducedMotion.current
            ? 1
            : Number.parseFloat(css.getPropertyValue("--c-300")),
          easing: css.getPropertyValue("--e-out").trim(),
          fill: "forwards",
        }
      ).finished;
      if (!current()) {
        return;
      }
    }
    if (!current()) {
      return;
    }
    close();
    await goto(`/session/${instanceId}`);
  }
  function keydown(event: KeyboardEvent) {
    if (!open || event.defaultPrevented) {
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      if (popover) {
        closePopover();
      } else {
        close();
      }
    }
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      start();
    }
    const focusScope = popover
      ? document.getElementById(`session-${popover}-popover`)
      : card;
    if (event.key === "Tab" && focusScope) {
      const controls = [
        ...focusScope.querySelectorAll<HTMLElement>(
          'input:not(:disabled), textarea, button:not(:disabled), [tabindex="0"]'
        ),
      ].filter(
        (node) => node.tabIndex >= 0 && node.getClientRects().length > 0
      );
      const current = controls.indexOf(document.activeElement as HTMLElement);
      event.preventDefault();
      controls[
        (current + (event.shiftKey ? -1 : 1) + controls.length) %
          controls.length
      ]?.focus();
    }
  }
</script>

<svelte:window onkeydown={keydown} />
{#snippet claudeMark()}
  <HarnessGlyph harness="claude" />
{/snippet}
{#snippet opencodeMark()}
  <HarnessGlyph harness="opencode" />
{/snippet}
{#snippet piMark()}
  <HarnessGlyph harness="pi" />
{/snippet}
{#snippet modelMark()}
  <ProviderLogo model={selected?.id ?? model} size={16} />
{/snippet}
{#snippet locationMark()}
  <span class="online" class:offline={machine?.status !== "online"}></span>
{/snippet}
{#if open}
  <div
    class="scrim"
    style:opacity={prefersReducedMotion.current ? 1 : timeline.scrim.current.opacity}
  ></div>
  <div
    aria-labelledby="new-session-title"
    aria-modal="true"
    class="session-card"
    inert={busy || !(timeline.interactive.started || prefersReducedMotion.current)}
    role="dialog"
    tabindex="-1"
    bind:this={card}
    style:opacity={prefersReducedMotion.current ? 1 : timeline.card.current.opacity}
    style:transform={prefersReducedMotion.current ? "none" : `translateY(${timeline.card.current.y}px) scale(${timeline.card.current.scale})`}
  >
    <header><h2 id="new-session-title">New session</h2></header>
    <div style={rowStyle(0)}>
      <PromptWell
        maxRows={10}
        minRows={5}
        onsubmit={start}
        placeholder="What should this session do?"
        bind:value={prompt}
      />
    </div>
    <div class="ledger">
      <div style={rowStyle(1)}>
        <LedgerRow controlId="session-agent" label="Agent"
          ><Segmented
            aria-label="Agent"
            id="session-agent"
            onchange={chooseHarness}
            options={HARNESSES.map((value) => ({ value, label: { claude: "Claude", opencode: "OpenCode", pi: "pi" }[value], mark: { claude: claudeMark, opencode: opencodeMark, pi: piMark }[value], disabled: !installedHarnesses.includes(value), reason: installedHarnesses.includes(value) ? undefined : `Not installed on ${machine?.hostname ?? machineId}` }))}
            spring={params.seg.thumb}
            value={harness}
          /></LedgerRow
        >
      </div>
      <div style={rowStyle(2)}>
        <LedgerRow controlId="session-model" label="Model"
          ><div>
            <ValueButton
              empty={!(selected || model)}
              expanded={popover === "model"}
              id="session-model"
              label={selected?.name ?? (model || "Choose a model")}
              mark={modelMark}
              onclick={() => { popover = popover === "model" ? null : "model"; }}
              bind:element={modelAnchor}
            />
          </div></LedgerRow
        >
      </div>
      <div style={rowStyle(3)}>
        <LedgerRow controlId="session-location" label="Location"
          ><div class="location-value">
            <ValueButton
              expanded={popover === "location"}
              id="session-location"
              label={locationLabel}
              mark={locationMark}
              onclick={() => { if (!locked) { popover = popover === "location" ? null : "location"; } }}
              reason={locationReading}
              bind:element={locationAnchor}
            />
            {#if locked}
              <button onclick={() => { editing = true; }} type="button">
                Edit
              </button>
            {/if}
          </div></LedgerRow
        >
      </div>
      <div style={rowStyle(4)}>
        <LedgerRow controlId="session-permissions" label="Permissions"
          ><Segmented
            aria-label="Permissions"
            id="session-permissions"
            onchange={(value) => { permissionMode = value; }}
            options={modes}
            spring={params.seg.thumb}
            value={permissionMode}
          /></LedgerRow
        >
      </div>
      <div style={rowStyle(5)}>
        <LedgerRow controlId="session-effort" label="Effort"
          ><StopSlider
            id="session-effort"
            onchange={(value) => { effort = value as EffortLevel | null; }}
            readout={scale ? effort ?? "Harness default" : "No effort scale on this model"}
            spring={params.slider.thumb}
            {stops}
            value={effort}
          /></LedgerRow
        >
      </div>
      <div style={rowStyle(6)}>
        <LedgerRow controlId="session-options" label="Options"
          ><fieldset aria-label="Options" class="chips" id="session-options">
            <ToggleChip
              checked={sideQuest}
              label="Side quest"
              onchange={(value) => { sideQuest = value; if (!value) { worktree = false; } }}
            /><ToggleChip
              checked={worktree}
              disabled={!sideQuest}
              label="Worktree"
              onchange={(value) => { worktree = value; }}
              reason="Worktree needs Side quest."
            /><ToggleChip
              checked={saveAsProject}
              disabled={Boolean(project)}
              label="Save as project"
              onchange={(value) => { saveAsProject = value; }}
              reason="A project is already attached."
            /><ToggleChip
              checked={repo !== undefined}
              label="Clone repo"
              onchange={(value) => { repo = value ? "" : undefined; projectId = undefined; editing = true; if (value) { cwd ||= "~"; popover = "location"; } }}
            />
          </fieldset></LedgerRow
        >
      </div>
    </div>
    <footer style={rowStyle(7)}>
      <p aria-live="polite" title={reading}>{reading || "\u00a0"}</p>
      <div class="actions">
        <ActionButton
          {busy}
          disabled={whiffle.hub !== "connected" || unreadable || locationUnverified}
          label="Start session"
          onclick={start}
        />
      </div>
    </footer>
    <button
      aria-label="Close new session"
      class="close"
      onclick={close}
      type="button"
    >
      <IconClose />
    </button>
  </div>
  {#if modelAnchor}
    <AnchoredPopover
      anchor={modelAnchor}
      id="session-model-popover"
      onclose={closePopover}
      open={popover === "model"}
      spring={params.pop.open}
      ><ModelPicker
        {harness}
        onselect={(id) => { model = id; closePopover(); }}
        spring={params.list.highlight}
        stagger={params.pop.rowStagger}
        swapSpring={params.swap.spring}
        swapStagger={params.swap.stagger}
        value={model}
      /></AnchoredPopover
    >
  {/if}
  {#if locationAnchor}
    <AnchoredPopover
      anchor={locationAnchor}
      id="session-location-popover"
      onclose={closePopover}
      open={popover === "location"}
      spring={params.pop.open}
      ><LocationPicker
        {cwd}
        {machineId}
        mode={repo === undefined ? "directory" : "repository"}
        onmodechange={(mode) => { repo = mode === "repository" ? repo ?? "" : undefined; projectId = undefined; editing = true; }}
        onselect={chooseLocation}
        {repo}
        spring={params.list.highlight}
        stagger={params.pop.rowStagger}
      /></AnchoredPopover
    >
  {/if}
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 80;
    background: var(--scrim);
  }
  .session-card {
    position: fixed;
    z-index: 81;
    top: 12vh;
    left: 0;
    right: 0;
    margin-inline: auto;
    width: clamp(640px, 72vw, 760px);
    max-width: calc(100vw - 16px);
    max-height: 86dvh;
    overflow-y: auto;
    padding: var(--space-2);
    border-radius: var(--radius-panel);
    background: var(--surface-raised);
    box-shadow: var(--shadow-overlay);
    transform-origin: top center;
  }
  header {
    height: 44px;
    display: flex;
    align-items: center;
    padding-inline: var(--space-5);
  }
  h2 {
    margin: 0;
    color: var(--ink-strong);
    font-size: var(--text-lg);
    font-weight: 500;
    line-height: var(--leading-ui);
  }
  .ledger {
    margin-top: var(--space-3);
    border-radius: var(--radius-well);
  }
  .chips,
  .actions,
  .location-value {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }
  .location-value > :global(:first-child) {
    flex: 1;
    min-width: 0;
  }
  footer {
    height: 52px;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding-inline: var(--space-3);
  }
  footer p {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
    font-size: var(--text-sm);
    color: var(--ink-muted);
    line-height: var(--leading-ui);
    margin: 0;
  }
  .close {
    position: absolute;
    top: var(--space-2);
    right: var(--space-3);
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-well);
    color: var(--ink-muted);
  }
  .close :global(svg) {
    width: 16px;
    height: 16px;
  }
  .online {
    width: 7px;
    height: 7px;
    border-radius: var(--radius-pill);
    background: var(--status-live-bg);
  }
  .offline {
    background: var(--ink-muted);
  }
  button:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
  @media (hover: hover) {
    .close:hover {
      background: var(--surface-hover);
    }
  }
  @media (max-width: 479px) {
    .session-card {
      top: auto;
      bottom: 0;
      width: 100%;
      max-width: 100%;
      max-height: 94dvh;
      border-radius: var(--radius-shell) var(--radius-shell) 0 0;
      box-shadow: var(--shadow-drawer);
    }
    .session-card :global(textarea) {
      border-radius: calc(var(--radius-shell) - var(--space-2));
      font-size: 16px;
    }
    .ledger {
      margin-inline: 6px;
    }
    .chips {
      flex-wrap: wrap;
    }
    footer {
      height: auto;
      min-height: 92px;
      flex-direction: column;
      align-items: stretch;
      padding-block: var(--space-2)
        calc(var(--space-2) + env(safe-area-inset-bottom));
    }
    footer p {
      min-height: 1lh;
    }
    .actions > :global(*) {
      flex: 1;
    }
  }
</style>
