<script lang="ts">
  import {
    type EffortLevel,
    HARNESSES,
    type HarnessKind,
    type PermissionMode,
    repoPath,
  } from "@whiffle/core";
  import { Dialog as DialogPrimitive } from "bits-ui";
  import type { TransitionConfig } from "dialkit";
  import {
    computeClipState,
    computeStaticTimeline,
    parseTimelineConfig,
  } from "dialkit/timeline";
  import { tick, untrack } from "svelte";
  import { prefersReducedMotion } from "svelte/motion";
  import { MediaQuery } from "svelte/reactivity";
  import { goto } from "$app/navigation";
  import {
    Dialog,
    DialogOverlay,
    DialogPortal,
    DialogTitle,
  } from "$lib/components/ui/dialog";
  import {
    createProject,
    machineFs,
    spawnSession,
    whiffle,
  } from "../client.svelte";
  import { EFFORT_LEVELS } from "../effort-levels";
  import { inspectMachine } from "../fleet";
  import { models } from "../models.svelte";
  import { PERMISSION_MODES } from "../permission-modes";
  import { rememberSpawn, spawnPrefs } from "../spawnPrefs.svelte";
  import ComposerBar from "./ComposerBar.svelte";
  import { deriveModelEntries } from "./model-entries";
  import { lastSpawnAt, lastUsedAt, recordModelUse } from "./modelUse.svelte";
  import PromptWell from "./PromptWell.svelte";

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
    slider: { thumb: SpringParams };
    swap: { spring: SpringParams; stagger: number };
    toggle: { thumb: SpringParams };
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
  let card = $state<HTMLElement | null>(null);
  const mobile = new MediaQuery("(max-width: 600px)");
  $effect(() => {
    if (!(open && mobile.current)) {
      return;
    }
    const viewport = window.visualViewport;
    const root = document.documentElement.style;
    const measure = () => {
      root.setProperty(
        "--ns-viewport-height",
        `${viewport?.height ?? window.innerHeight}px`
      );
      root.setProperty("--ns-viewport-top", `${viewport?.offsetTop ?? 0}px`);
    };
    measure();
    viewport?.addEventListener("resize", measure);
    viewport?.addEventListener("scroll", measure);
    window.addEventListener("resize", measure);
    return () => {
      viewport?.removeEventListener("resize", measure);
      viewport?.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      root.removeProperty("--ns-viewport-height");
      root.removeProperty("--ns-viewport-top");
    };
  });
  let modelAnchor = $state<HTMLButtonElement | null>(null);
  let locationAnchor = $state<HTMLButtonElement | null>(null);
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
  let popover = $state<"model" | "location" | "mode" | "options" | null>(null);
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
      ? error || locationReading || (locationUnverified ? "Reading…" : "")
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
      if (
        !(prefill?.machineId || prefill?.cwd || prefill?.projectId) &&
        spawnPrefs.machineId &&
        spawnPrefs.cwd
      ) {
        restoreLocation(
          { machineId: spawnPrefs.machineId, cwd: spawnPrefs.cwd },
          submission,
          machineId
        );
      }
    });
    return () => {
      submission += 1;
      opener?.focus();
    };
  });
  async function restoreLocation(
    saved: { machineId: string; cwd: string },
    request: number,
    initialMachine: string
  ) {
    try {
      await Promise.all([
        inspectMachine(saved.machineId, saved.cwd),
        machineFs(saved.machineId, "list", saved.cwd),
      ]);
      if (
        !open ||
        request !== submission ||
        machineId !== initialMachine ||
        cwd ||
        popover
      ) {
        return;
      }
      ({ machineId, cwd } = saved);
      verifiedLocation = JSON.stringify([machineId, cwd.trim()]);
      projectId = whiffle.projects.find(
        (row) => row.machineId === machineId && row.cwd === cwd
      )?.id;
      error = "";
    } catch {
      // A stale saved directory leaves the location picker available for a fresh choice.
    }
  }
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
    const anchor = document.getElementById(`session-${popover}`);
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
    editing = true;
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
    if (busy || popover || whiffle.hub !== "connected") {
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
        machineId: draft.machineId,
        cwd: draft.cwd,
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
    if (!open || event.defaultPrevented || event.isComposing) {
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      start();
    }
  }
</script>

<svelte:window onkeydown={keydown} />
<Dialog onOpenChange={(value) => { if (!value) { close(); } }} {open}>
  <DialogPortal>
    <DialogOverlay
      class="session-scrim"
      style={`opacity:${prefersReducedMotion.current ? 1 : timeline.scrim.current.opacity}`}
    />
    <DialogPrimitive.Content
      class="session-card"
      inert={busy || !(timeline.interactive.started || prefersReducedMotion.current)}
      onOpenAutoFocus={(event) => { event.preventDefault(); card?.querySelector('textarea')?.focus(); }}
      style={`opacity:${prefersReducedMotion.current ? 1 : timeline.card.current.opacity};scale:${prefersReducedMotion.current || mobile.current ? 1 : timeline.card.current.scale};--sheet-enter:${prefersReducedMotion.current ? 0 : (1 - timeline.card.current.opacity) * 48}px`}
      bind:ref={card}
    >
      <DialogTitle class="sr-only">New session</DialogTitle>
      <div class="prompt-region" style={rowStyle(0)}>
        <PromptWell
          maxRows={10}
          minRows={mobile.current ? 6 : 8}
          onsubmit={start}
          placeholder="What should the agent do?"
          bind:value={prompt}
        />
      </div>
      <div class="bar-region">
        <p aria-live="polite" class="reading" title={reading}>
          {reading || "\u00a0"}
        </p>
        <ComposerBar
          {busy}
          {cwd}
          disabled={whiffle.hub !== "connected" || unreadable || locationUnverified}
          {effort}
          {harness}
          {installedHarnesses}
          {locationLabel}
          {locked}
          {machineId}
          machineName={machine?.hostname ?? machineId}
          {model}
          modelName={selected?.name ?? (model || "Choose model")}
          {modes}
          onbootstrap={(value) => { repo = value ? "" : undefined; projectId = undefined; editing = true; if (value) { cwd ||= "~"; popover = "location"; } }}
          oneffort={(value) => { effort = value; }}
          onharness={chooseHarness}
          online={machine?.status === "online"}
          onlocation={chooseLocation}
          onlocationmode={(mode) => { repo = mode === "repository" ? repo ?? "" : undefined; projectId = undefined; editing = true; }}
          onmode={(value) => { permissionMode = value; }}
          onmodel={(id) => { model = id; closePopover(); }}
          onscratch={(value) => { sideQuest = value; if (!value) { worktree = false; } }}
          onstart={start}
          {params}
          {permissionMode}
          projectName={project?.name ?? cwd.split('/').pop() ?? ''}
          {repo}
          {rowStyle}
          {scale}
          {sideQuest}
          {stops}
          bind:locationAnchor
          bind:modelAnchor
          bind:popover
        />
      </div>
    </DialogPrimitive.Content>
  </DialogPortal>
</Dialog>

<style>
  :global(.session-scrim) {
    position: fixed;
    inset: 0;
    z-index: 80;
    background: var(--scrim);
    animation: none !important;
  }
  :global(.session-card) {
    position: fixed;
    z-index: 81;
    top: 50%;
    left: 50%;
    translate: -50% -50%;
    width: 640px;
    max-width: calc(100vw - var(--space-4));
    max-height: calc(100dvh - var(--space-4));
    overflow-y: auto;
    padding: var(--space-2);
    border-radius: var(--radius-modal);
    background: var(--surface-raised);
    box-shadow: var(--shadow-modal);
    outline: none;
    transform-origin: center;
  }
  .bar-region {
    padding: var(--space-2) var(--space-1) var(--space-1);
  }
  .reading {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: var(--text-sm);
    color: var(--ink-muted);
    line-height: var(--leading-ui);
    margin: 0;
    height: var(--space-5);
  }
  @media (max-width: 600px) {
    :global(.session-card) {
      top: auto;
      bottom: calc(
        100% -
        var(--ns-viewport-height, 100dvh) -
        var(--ns-viewport-top, 0px)
      );
      left: 0;
      translate: 0 var(--sheet-enter);
      width: 100%;
      max-width: 100%;
      max-height: var(--ns-viewport-height, 100dvh);
      display: flex;
      flex-direction: column;
      overflow-x: hidden;
      padding: var(--space-2) 0
        calc(var(--space-2) + env(safe-area-inset-bottom));
      border-radius: var(--radius-modal) var(--radius-modal) 0 0;
    }
    .prompt-region {
      margin-inline: var(--space-2);
      min-height: 0;
      overflow: auto;
    }
    .prompt-region :global(textarea) {
      max-height: max(
        44px,
        calc(
          var(--ns-viewport-height, 100dvh) -
          160px -
          env(safe-area-inset-bottom)
        )
      );
      font-size: 16px;
    }
    .bar-region {
      padding: var(--space-2) 0 0;
      flex: none;
      min-width: 0;
    }
    .reading {
      margin-inline: 16px;
    }
  }
</style>
