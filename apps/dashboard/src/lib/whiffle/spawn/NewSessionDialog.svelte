<script lang="ts">
  /**
   * The New Session modal. This file owns the logic — open-reset boundary,
   * submission generation guard, draft snapshot, dual location verification,
   * the exact `spawnSession` payload — and composes the designed sections.
   */
  import {
    type EffortLevel,
    HARNESSES,
    type HarnessKind,
    type PermissionMode,
    repoPath,
  } from "@whiffle/core";
  import { Dialog as DialogPrimitive } from "bits-ui";
  import { tick, untrack } from "svelte";
  import { MediaQuery } from "svelte/reactivity";
  import { Drawer } from "vaul-svelte";
  import { goto } from "$app/navigation";
  import { Dialog, DialogPortal, DialogTitle } from "$lib/components/ui/dialog";
  import { IconClose as X } from "$lib/icons";
  import Bolt from "~icons/solar/bolt-bold-duotone";
  import Book from "~icons/solar/book-2-bold-duotone";
  import Chat from "~icons/solar/chat-round-line-bold-duotone";
  import Cpu from "~icons/solar/cpu-bold-duotone";
  import Files from "~icons/solar/folder-with-files-bold-duotone";
  import Laptop from "~icons/solar/laptop-bold-duotone";
  import Monitor from "~icons/solar/monitor-bold-duotone";
  import Server from "~icons/solar/server-square-bold-duotone";
  import Shield from "~icons/solar/shield-keyhole-bold-duotone";
  import Stars from "~icons/solar/stars-bold-duotone";
  import Tuning from "~icons/solar/tuning-2-bold-duotone";
  import {
    createProject,
    machineFs,
    spawnSession,
    whiffle,
  } from "../client.svelte";
  import { EFFORT_LEVELS } from "../effort-levels";
  import { type FleetSnapshot, inspectMachine } from "../fleet";
  import { conversationHref } from "../links";
  import { models } from "../models.svelte";
  import { PERMISSION_MODES } from "../permission-modes";
  import { rememberSpawn, spawnPrefs } from "../spawnPrefs.svelte";
  import EffortPips from "./EffortPips.svelte";
  import LocationSection from "./LocationSection.svelte";
  import MachinesChip from "./MachinesChip.svelte";
  import ModelSection from "./ModelSection.svelte";
  import { deriveModelEntries } from "./model-entries";
  import { lastSpawnAt, lastUsedAt, recordModelUse } from "./modelUse.svelte";
  import type { MachineItem, MenuItem, ProjectItem } from "./ns-types";
  import PermissionSection from "./PermissionSection.svelte";
  import ProjectChip from "./ProjectChip.svelte";
  import PromptEditor from "./PromptEditor.svelte";
  import SectionHeader from "./SectionHeader.svelte";
  import SessionFooter from "./SessionFooter.svelte";
  import "./ns-theme.css";

  let {
    open,
    prefill,
    onclose,
  }: {
    open: boolean;
    prefill?: { machineId?: string; cwd?: string; projectId?: string };
    onclose: () => void;
  } = $props();
  const REPO = /^[\w.-]+\/[\w.-]+$/;
  let card = $state<HTMLElement | null>(null);
  let editor = $state<HTMLDivElement>();
  const mobile = new MediaQuery("(max-width: 640px)");
  $effect(() => {
    // Keep the viewport geometry until the closing sheet has left the DOM.
    if (!(card && mobile.current)) {
      return;
    }
    const viewport = window.visualViewport;
    const root = document.documentElement.style;
    let viewportFrame = 0;
    let settleTimer: ReturnType<typeof setTimeout>;
    let blurredField = false;
    let height = 0;
    const textEntry =
      "input:not([type=range]), textarea, [contenteditable=true]";
    const writeHeight = (next: number) => {
      if (height !== next) {
        height = next;
        root.setProperty("--ns-viewport-height", `${height}px`);
      }
    };
    const focusedRect = (active: HTMLElement) => {
      const field = active.getBoundingClientRect();
      const selection = window.getSelection();
      if (
        !(
          active.isContentEditable &&
          selection?.rangeCount &&
          active.contains(selection.focusNode)
        )
      ) {
        return field;
      }
      const range = selection.getRangeAt(0).cloneRange();
      range.setStart(selection.focusNode as Node, selection.focusOffset);
      range.collapse(true);
      const caret = range.getBoundingClientRect();
      if (!caret.height) {
        return field;
      }
      if (caret.bottom > field.bottom) {
        active.scrollTop += Math.ceil(caret.bottom - field.bottom);
      } else if (caret.top < field.top) {
        active.scrollTop += Math.floor(caret.top - field.top);
      }
      return range.getBoundingClientRect();
    };
    const settled = () => {
      clearTimeout(settleTimer);
      // Let WebKit finish its keyboard animation and native caret scrolling.
      settleTimer = setTimeout(() => {
        if (!open || (viewport && viewport.scale > 1)) {
          return;
        }
        const active = document.activeElement;
        if (blurredField && !active?.matches(textEntry)) {
          cancelAnimationFrame(viewportFrame);
          viewportFrame = requestAnimationFrame(() => {
            writeHeight(document.documentElement.clientHeight);
          });
        }
        blurredField = false;
        const body = active?.closest<HTMLElement>(".session-card .body");
        if (
          !(body && active instanceof HTMLElement && active.matches(textEntry))
        ) {
          return;
        }
        const field = focusedRect(active);
        const visible = body.getBoundingClientRect();
        if (field.bottom > visible.bottom) {
          body.scrollTop += Math.ceil(field.bottom - visible.bottom);
        } else if (field.top < visible.top) {
          body.scrollTop += Math.floor(field.top - visible.top);
        }
      }, 120);
    };
    const measure = () => {
      cancelAnimationFrame(viewportFrame);
      viewportFrame = requestAnimationFrame(() => {
        if (!open || (viewport && viewport.scale > 1)) {
          return;
        }
        writeHeight(
          viewport ? viewport.height * viewport.scale : window.innerHeight
        );
      });
      settled();
    };
    const measurePage = () => {
      const page = document.scrollingElement ?? document.documentElement;
      root.setProperty("--ns-page-height", `${page.scrollHeight}px`);
      root.setProperty("--ns-page-width", `${page.scrollWidth}px`);
      measure();
    };
    const blurred = (event: FocusEvent) => {
      if (
        !(
          event.target instanceof HTMLElement && event.target.matches(textEntry)
        )
      ) {
        return;
      }
      blurredField = true;
      settled();
    };
    measurePage();
    viewport?.addEventListener("resize", measure);
    viewport?.addEventListener("scroll", settled);
    window.addEventListener("resize", measurePage);
    window.addEventListener("blur", blurred, true);
    window.addEventListener("focusin", settled);
    return () => {
      viewport?.removeEventListener("resize", measure);
      viewport?.removeEventListener("scroll", settled);
      window.removeEventListener("resize", measurePage);
      window.removeEventListener("blur", blurred, true);
      window.removeEventListener("focusin", settled);
      clearTimeout(settleTimer);
      cancelAnimationFrame(viewportFrame);
      root.removeProperty("--ns-viewport-height");
      root.removeProperty("--ns-page-height");
      root.removeProperty("--ns-page-width");
    };
  });
  let opener: HTMLElement | null = null;
  let submission = 0;
  let prompt = $state("");
  let machineIds = $state<string[]>([]);
  /** Set once the operator picks machines themselves; stops the late-arrival adoption below. */
  let machinesTouched = $state(false);
  let cwd = $state("");
  let repo = $state<string>();
  let harness = $state<HarnessKind>(spawnPrefs.harness);
  let model = $state("");
  let effort = $state<EffortLevel | null>(null);
  let permissionMode = $state<PermissionMode>(spawnPrefs.permissionMode);
  let projectId = $state<string>();
  let editing = $state(false);
  let sideQuest = $state(false);
  let busy = $state(false);
  let error = $state("");
  let unreadable = $state(false);
  let missingMachines = $state<string[]>([]);
  let verifiedLocation = $state("");
  let popover = $state<"machines" | "project" | null>(null);
  let menuOpen = $state(false);
  let skills = $state<string[]>([]);
  let plugins = $state<string[]>([]);
  const machineId = $derived(machineIds[0] ?? "");
  const locationKey = $derived(JSON.stringify([machineIds, cwd.trim()]));
  const locationUnverified = $derived(
    Boolean(machineIds.length && cwd.trim()) && verifiedLocation !== locationKey
  );
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
  const efforts = $derived(
    stops.filter((stop) => stop.reachable).map((stop) => stop.value)
  );
  /** What the slider shows while `effort` is untouched (`null`, omitted from the payload). */
  const effortShown = $derived.by((): EffortLevel | null => {
    if (effort) {
      return effort;
    }
    if (harness === "claude" && efforts.includes("xhigh")) {
      return "xhigh";
    }
    return efforts.includes("high") ? "high" : (efforts[0] ?? null);
  });
  const modes = $derived(
    PERMISSION_MODES.map((mode) => ({
      value: mode.value,
      disabled: report
        ? !report.capabilities.permissionModes.includes(mode.value)
        : false,
      reason:
        report && !report.capabilities.permissionModes.includes(mode.value)
          ? "This agent cannot honor this permission mode."
          : undefined,
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
      (prefill?.machineId || prefill?.cwd || prefill?.projectId || projectId) &&
        !editing
    ) && repo === undefined
  );
  const HUES = [
    "var(--fai-violet-400)",
    "var(--fai-green-500)",
    "var(--fai-cyan-400)",
    "var(--fai-blue-500)",
    "var(--fai-orange-500)",
  ];
  const machineIcon = (os: string) => {
    const platform = os.trim().toLowerCase();
    if (platform.startsWith("darwin") || platform.startsWith("mac")) {
      return Laptop;
    }
    if (platform.startsWith("win")) {
      return Monitor;
    }
    return platform.startsWith("linux") ? Server : Cpu;
  };
  const loadLabel = (online: boolean, running: number) => {
    if (!online) {
      return "Offline";
    }
    return running === 0
      ? "Idle"
      : `${running} session${running === 1 ? "" : "s"}`;
  };
  const machineItems = $derived<MachineItem[]>(
    whiffle.machines.map((row, i) => {
      const online = row.status === "online";
      const running = whiffle.liveOn(row.machineId).length;
      return {
        id: row.machineId,
        name: row.hostname,
        os: row.os,
        icon: machineIcon(row.os),
        online,
        load: loadLabel(online, running),
        hue: online ? HUES[i % 3] : "var(--fai-grey-500)",
      };
    })
  );
  const projectItems = $derived<ProjectItem[]>(
    whiffle.projects
      .filter((row) => machineIds.includes(row.machineId))
      .map((row, i) => ({
        id: row.id,
        machineId: row.machineId,
        name: row.name,
        path: row.cwd,
        hue: HUES[(i + 3) % 5],
      }))
  );
  const locationReading = $derived.by(() => {
    if (unreadable) {
      return `That directory can't be read on ${machine?.hostname ?? machineId}. Check the path and try again.`;
    }
    if (!locationUnverified && missingMachines.length) {
      const names = missingMachines.map(
        (id) =>
          whiffle.machines.find((row) => row.machineId === id)?.hostname ?? id
      );
      return `This folder doesn't exist on ${names.join(", ")}. It will be created when the session starts.`;
    }
    return machine && machine.status !== "online"
      ? `${machine.hostname} is offline. Pick another machine, or start when it returns.`
      : "";
  });
  const reading = $derived(
    whiffle.hub === "connected"
      ? error || locationReading || (locationUnverified ? "Reading…" : "")
      : "No spawn while the hub is unreachable. Reconnect to continue."
  );
  const locationInformational = $derived(
    Boolean(
      !(error || locationUnverified || unreadable) &&
        missingMachines.length &&
        whiffle.hub === "connected"
    )
  );
  const cantStart = $derived(
    busy ||
      whiffle.hub !== "connected" ||
      machineIds.length === 0 ||
      unreadable ||
      locationUnverified ||
      (repo !== undefined && !REPO.test(repo.trim()))
  );
  const startLabel = $derived(
    machineIds.length > 1
      ? `Start ${machineIds.length} sessions`
      : "Start session"
  );
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
      const first =
        prefill?.machineId ||
        seeded?.machineId ||
        whiffle.onlineMachines[0]?.machineId ||
        "";
      machineIds = first ? [first] : [];
      machinesTouched = false;
      cwd = prefill?.cwd || seeded?.cwd || "";
      ({ harness, permissionMode } = spawnPrefs);
      model = "";
      effort = null;
      prompt = "";
      repo = undefined;
      editing = false;
      sideQuest = false;
      busy = false;
      error = "";
      popover = null;
      menuOpen = false;
      verifiedLocation = "";
      if (
        !(prefill?.machineId || prefill?.cwd || prefill?.projectId) &&
        spawnPrefs.machineId &&
        spawnPrefs.cwd
      ) {
        restoreLocation(
          { machineId: spawnPrefs.machineId, cwd: spawnPrefs.cwd },
          submission,
          first
        );
      }
      loadFleetMenu(submission);
    });
    return () => {
      submission += 1;
    };
  });
  // The fleet arrives over the websocket, so the dialog can open before any
  // machine is known. Adopt the first one that shows up until the operator picks.
  $effect(() => {
    const fallback = whiffle.onlineMachines[0]?.machineId;
    if (open && !machinesTouched && !machineIds.length && fallback) {
      untrack(() => {
        machineIds = [fallback];
      });
    }
  });
  async function loadFleetMenu(request: number) {
    try {
      const response = await fetch("/api/fleet");
      if (!response.ok) {
        return;
      }
      const snapshot = (await response.json()) as FleetSnapshot;
      if (request !== submission) {
        return;
      }
      skills = snapshot.skills.map((row) => row.name);
      plugins = snapshot.config.plugins.map((row) => row.id);
    } catch {
      // A hub without a fleet catalog leaves the `/` menu with nothing to offer.
    }
  }
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
        machineIds.length > 1 ||
        cwd ||
        popover
      ) {
        return;
      }
      machineIds = [saved.machineId];
      ({ cwd } = saved);
      verifiedLocation = JSON.stringify([machineIds, cwd.trim()]);
      projectId = whiffle.projects.find(
        (row) => row.machineId === machineId && row.cwd === cwd
      )?.id;
      error = "";
    } catch {
      // A stale saved directory leaves the location free for a fresh choice.
    }
  }
  $effect(() => {
    const ids = machineIds;
    const path = cwd.trim();
    const key = locationKey;
    if (verifiedLocation === key) {
      return;
    }
    unreadable = false;
    missingMachines = [];
    if (!(open && ids.length && path) || machine?.status !== "online") {
      return;
    }
    let stale = false;
    const timer = setTimeout(() => {
      Promise.all(ids.map((id) => inspectLocation(id, path)))
        .then((missing) => {
          if (!stale) {
            missingMachines = ids.filter((_, index) => missing[index]);
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
  function validate() {
    if (!machineIds.length) {
      return "Choose a machine to run this session on.";
    }
    if (repo !== undefined && !REPO.test(repo.trim())) {
      return "Enter a repository as owner/repository.";
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
  function toggleMachine(id: string) {
    machinesTouched = true;
    machineIds = machineIds.includes(id)
      ? machineIds.filter((row) => row !== id)
      : [...machineIds, id];
    if (project && !machineIds.includes(project.machineId)) {
      projectId = undefined;
    }
    editing = true;
  }
  function pickProject(row: ProjectItem) {
    projectId = row.id;
    if (!machineIds.includes(row.machineId)) {
      machineIds = [row.machineId, ...machineIds];
    }
    cwd = row.path;
    repo = undefined;
    editing = false;
    popover = null;
  }
  function clearProject() {
    projectId = undefined;
    cwd = "";
    editing = true;
    popover = null;
  }
  async function createFromChip(draft: { name: string; path: string }) {
    const created = await createProject({
      machineId,
      cwd: draft.path,
      name: draft.name,
    });
    pickProject({
      id: created.id,
      machineId: created.machineId,
      name: created.name,
      path: created.cwd,
      hue: HUES[0],
    });
  }
  function menuItems(type: "@" | "/", query: string): MenuItem[] {
    const q = query.toLowerCase();
    const hit = (text: string) => !q || text.toLowerCase().includes(q);
    if (type === "@") {
      return [
        ...machineItems
          .filter((row) => row.online && hit(row.name))
          .map((row) => ({
            key: `machine:${row.id}`,
            label: row.name,
            kind: "Machine" as const,
            icon: row.icon,
            hue: row.hue,
            serial: `@${row.name}`,
            apply: () => {
              if (!machineIds.includes(row.id)) {
                machineIds = [...machineIds, row.id];
              }
            },
          })),
        ...projectItems
          .filter((row) => hit(row.name))
          .map((row) => ({
            key: `project:${row.id}`,
            label: row.name,
            kind: "Project" as const,
            icon: Files,
            hue: row.hue,
            serial: `@${row.name}`,
            apply: () => pickProject(row),
          })),
      ];
    }
    return [
      ...skills.filter(hit).map((name, i) => ({
        key: `skill:${name}`,
        label: `/${name}`,
        kind: "Skill" as const,
        icon: Stars,
        hue: HUES[i % 5],
        serial: `/${name}`,
        apply: () => {
          // A skill chip only changes the prompt text.
        },
      })),
      ...plugins.filter(hit).map((id, i) => ({
        key: `plugin:${id}`,
        label: id,
        kind: "Plugin" as const,
        icon: Book,
        hue: HUES[(i + 2) % 5],
        serial: `/${id}`,
        apply: () => {
          // A plugin chip only changes the prompt text.
        },
      })),
    ];
  }
  async function inspectLocation(id: string, path: string): Promise<boolean> {
    const [, missing] = await Promise.all([
      inspectMachine(id, path),
      machineFs(id, "list", path).then(
        () => false,
        (cause: unknown) => {
          if (cause instanceof Error && cause.message.startsWith("ENOENT:")) {
            return true;
          }
          throw cause;
        }
      ),
    ]);
    return missing;
  }
  async function verifyBeforeSpawn(
    id: string,
    path: string,
    current: () => boolean
  ) {
    try {
      await inspectLocation(id, path);
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
      document.getElementById("session-dir")?.focus();
      return false;
    }
  }
  interface Draft {
    baseCwd: string;
    cwd: string;
    effort: EffortLevel | null;
    harness: HarnessKind;
    machineIds: string[];
    model: string;
    permissionMode: PermissionMode;
    projectId: string | undefined;
    prompt: string;
    repo: string | undefined;
    scratch: { baseCwd: string; worktree: boolean } | undefined;
    usedModel: string;
  }

  function spawnOne(target: string, draft: Draft): string {
    const toAttach =
      draft.projectId && whiffle.project(draft.projectId)?.machineId === target
        ? draft.projectId
        : undefined;
    return spawnSession({
      machineId: target,
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
  }
  async function start() {
    if (busy || whiffle.hub !== "connected") {
      return;
    }
    error = validate();
    if (error) {
      document.getElementById("session-dir")?.focus();
      return;
    }
    submission += 1;
    const id = submission;
    const current = () => open && id === submission;
    const draft: Draft = {
      machineIds: [...machineIds],
      baseCwd: cwd.trim(),
      cwd: workdir,
      prompt,
      harness,
      permissionMode,
      model,
      effort,
      scratch: sideQuest ? { worktree: false, baseCwd: workdir } : undefined,
      repo: repo?.trim(),
      projectId,
      usedModel: selected?.id ?? model,
    };
    busy = true;
    popover = null;
    let first = "";
    try {
      for (const target of draft.machineIds) {
        // biome-ignore lint/performance/noAwaitInLoops: each machine is verified, then spawned, in order — one failure must stop the batch before the next spawn.
        const ok = await verifyBeforeSpawn(target, draft.baseCwd, current);
        if (!(ok && current())) {
          return;
        }
        // Every machine gets spawned; `first` only remembers which one to
        // open. `first ||= spawnOne(…)` short-circuited after machine one, so
        // "Start 3 sessions" started exactly one.
        const spawned = spawnOne(target, draft);
        first ||= spawned;
      }
      recordModelUse(draft.harness, draft.usedModel);
      rememberSpawn({
        machineId: draft.machineIds[0],
        cwd: draft.cwd,
        harness: draft.harness,
        model: draft.model,
        permissionMode: draft.permissionMode,
        effort: draft.effort,
      });
      await exitTo(first, current);
    } catch (cause) {
      if (!current()) {
        return;
      }
      error = cause instanceof Error ? cause.message : String(cause);
      busy = false;
    }
  }
  async function exitTo(instanceId: string, current: () => boolean) {
    if (!current()) {
      return;
    }
    const panel = card;
    close();
    await tick();
    const request = submission;
    await Promise.allSettled(
      panel?.getAnimations().map((animation) => animation.finished) ?? []
    );
    if (open || request !== submission) {
      return;
    }
    await goto(conversationHref(instanceId, whiffle.instances));
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
  function bodyScroll() {
    if (popover) {
      popover = null;
    }
  }
</script>

<svelte:window onkeydown={keydown} />
{#if mobile.current}
  <Drawer.Root
    noBodyStyles
    onOpenChange={(value) => { if (!value) { close(); } }}
    {open}
    repositionInputs={false}
    shouldScaleBackground={false}
  >
    <Drawer.Portal>
      <div class="session-viewport">
        <Drawer.Overlay class="session-scrim ns-theme" />
        <Drawer.Content
          aria-label="New Session"
          class="session-card ns-theme"
          data-ns-dialog
          inert={busy}
          onCloseAutoFocus={(event) => { event.preventDefault(); opener?.focus({ preventScroll: true }); }}
          onOpenAutoFocus={(event) => { event.preventDefault(); card?.focus({ preventScroll: true }); }}
          bind:ref={card}
        >
          <Drawer.Title class="sr-only">New session</Drawer.Title>
          <Drawer.Handle class="session-handle" preventCycle />
          {@render formContent()}
        </Drawer.Content>
      </div>
    </Drawer.Portal>
  </Drawer.Root>
{:else}
  <Dialog onOpenChange={(value) => { if (!value) { close(); } }} {open}>
    <DialogPortal>
      <DialogPrimitive.Overlay class="session-scrim ns-theme" />
      <DialogPrimitive.Content
        aria-label="New Session"
        class="session-card ns-theme"
        data-ns-dialog
        inert={busy}
        onCloseAutoFocus={(event) => { event.preventDefault(); opener?.focus({ preventScroll: true }); }}
        onOpenAutoFocus={(event) => { event.preventDefault(); card?.focus({ preventScroll: true }); }}
        bind:ref={card}
      >
        <DialogTitle class="sr-only">New session</DialogTitle>
        {@render formContent()}
      </DialogPrimitive.Content>
    </DialogPortal>
  </Dialog>
{/if}

{#snippet formContent()}
  <div class="head">
    <div class="head-left">
      <span class="bolt"><Bolt /></span>
      <span class="title">Sessions · New</span>
    </div>
    <button
      aria-label="Close"
      class="close"
      data-vaul-no-drag
      onclick={close}
      title="Close"
      type="button"
    >
      <X />
    </button>
  </div>
  <div class="body fai-scroll" data-vaul-no-drag onscroll={bodyScroll}>
    <h2>New Session</h2>
    <section class="sec prompt-sec" style="--delay:0ms">
      <SectionHeader
        hue="var(--fai-blue-500)"
        icon={Chat}
        label="First prompt"
      />
      <div class="fai-comb"></div>
      <div
        class="composer"
        class:focus={editor === document.activeElement || menuOpen}
      >
        <PromptEditor
          {menuItems}
          onmenu={(value) => { menuOpen = value; }}
          onsubmit={start}
          bind:element={editor}
          bind:value={prompt}
        />
        <div class="chips">
          <MachinesChip
            machines={machineItems}
            onchange={(value) => { popover = value ? "machines" : null; }}
            ontoggle={toggleMachine}
            open={popover === "machines"}
            selected={machineIds}
          />
          <ProjectChip
            onchange={(value) => { popover = value ? "project" : null; }}
            onclear={clearProject}
            oncreate={createFromChip}
            onpick={pickProject}
            open={popover === "project"}
            {projectId}
            projects={projectItems}
          />
        </div>
      </div>
    </section>
    <div class="fai-comb comb-gap"></div>
    <div class="stack">
      <div class="sec" style="--delay:60ms">
        <LocationSection
          dir={cwd}
          informational={locationInformational}
          {locked}
          {machineId}
          machineName={machine?.hostname ?? ""}
          mode={repo === undefined ? "dir" : "repo"}
          ondir={(value) => { cwd = value; editing = true; projectId = undefined; }}
          onmode={(value) => { repo = value === "repo" ? (repo ?? "") : undefined; if (value === "repo") { projectId = undefined; editing = true; cwd ||= "~"; } }}
          onoverride={() => { editing = true; }}
          onrepo={(value) => { repo = value; }}
          {reading}
          repo={repo ?? ""}
        />
      </div>
      <div class="fai-comb"></div>
      <div class="sec" style="--delay:140ms">
        <div class="columns">
          <div class="col">
            <div class="sec" style="--delay:40ms">
              <ModelSection
                {harness}
                installed={installedHarnesses}
                machineName={machine?.hostname ?? machineId}
                {model}
                onharness={chooseHarness}
                onmodel={(id) => { model = id; effort = null; }}
              />
            </div>
          </div>
          <div class="col">
            <section class="sec" style="--delay:80ms">
              <SectionHeader
                hue="var(--fai-orange-500)"
                icon={Tuning}
                label="Effort"
              />
              <EffortPips
                {efforts}
                onchange={(level) => { effort = level; }}
                value={effortShown}
              />
            </section>
            <section class="sec" style="--delay:120ms">
              <SectionHeader
                hue="var(--fai-green-600)"
                icon={Shield}
                label="Permission mode"
              />
              <PermissionSection
                {modes}
                onchange={(value) => { permissionMode = value; }}
                value={permissionMode}
              />
            </section>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="footer" data-vaul-no-drag>
    <SessionFooter
      {busy}
      disabled={cantStart}
      ephemeral={sideQuest}
      oncancel={close}
      onlifetime={(value) => { sideQuest = value; }}
      onstart={start}
      {startLabel}
    />
  </div>
{/snippet}

<style>
  .footer {
    display: contents;
  }
  :global(.session-scrim) {
    position: fixed;
    inset: 0;
    z-index: 80;
    background: var(--fai-scrim);
    backdrop-filter: blur(var(--fai-scrim-blur));
    -webkit-backdrop-filter: blur(var(--fai-scrim-blur));
  }
  :global(.session-card) {
    position: fixed;
    inset: 0;
    z-index: 81;
    margin: auto;
    width: min(980px, 100vw - 48px);
    height: fit-content;
    max-height: calc(100dvh - 48px);
    display: flex;
    flex-direction: column;
    background: var(--fai-recess);
    border-radius: var(--fai-radius-modal);
    padding: 7px;
    box-shadow: var(--fai-shadow-modal);
    outline: none;
    transform-origin: center;
  }
  :global(.session-card:not([data-vaul-drawer])[data-state="open"]) {
    animation: ns-panel var(--ns-panel-ms) var(--ns-ease-out) both;
  }
  :global(.session-card:not([data-vaul-drawer])[data-state="closed"]) {
    animation: ns-panel-out var(--ns-panel-ms) var(--ns-ease-out) both;
  }
  :global(.session-scrim:not([data-vaul-overlay])[data-state="open"]) {
    animation: ns-scrim var(--ns-panel-ms) var(--ns-ease-out) both;
  }
  :global(.session-scrim:not([data-vaul-overlay])[data-state="closed"]) {
    animation: ns-scrim-out var(--ns-panel-ms) var(--ns-ease-out) both;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 3px 4px 8px;
    flex: none;
  }
  .head-left {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }
  .bolt {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: var(--fai-radius-xs);
    background: var(--fai-grey-900);
    color: var(--fai-text-inverse);
    flex: none;
  }
  .bolt :global(svg) {
    width: 13px;
    height: 13px;
  }
  .title {
    font: 500 13px / 1 var(--fai-font-sans);
    color: var(--fai-text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: 1px solid transparent;
    border-radius: var(--fai-radius-sm);
    background: transparent;
    color: var(--fai-text-muted);
    cursor: pointer;
  }
  .close :global(svg) {
    width: 14px;
    height: 14px;
  }
  @media (hover: hover) {
    .close:hover {
      background: var(--fai-hover);
      color: var(--fai-text);
    }
  }
  .body {
    flex: 1;
    min-height: 0;
    overflow: auto;
    background: var(--fai-surface);
    border-radius: var(--fai-radius-lg);
    padding: 18px 18px 20px;
  }
  h2 {
    margin: 0;
    font: 500 20px / 1.25 var(--fai-font-sans);
    letter-spacing: -0.01em;
    color: var(--fai-text);
  }
  .sec {
    display: grid;
    gap: 8px;
    animation: ns-in 260ms var(--ns-ease-out) both;
    animation-delay: var(--delay, 0ms);
  }
  .prompt-sec {
    margin-top: 16px;
    position: relative;
    z-index: 30;
  }
  .comb-gap {
    margin-top: 18px;
  }
  .stack {
    display: grid;
    gap: 18px;
    margin-top: 18px;
  }
  .columns {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
    gap: 16px 20px;
  }
  .col {
    display: grid;
    gap: 16px;
    align-content: start;
    min-width: 0;
  }
  .composer {
    position: relative;
    display: grid;
    background: var(--fai-surface);
    border: 1px solid var(--fai-border);
    border-radius: var(--fai-radius-lg);
    box-shadow: var(--fai-shadow-xs);
    transition:
      var(--fai-transition-control),
      box-shadow 120ms ease;
  }
  .composer:focus-within,
  .composer.focus {
    border-color: var(--fai-grey-400);
    box-shadow: 0 0 0 3px var(--fai-focus-ring);
  }
  .chips {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    padding: 8px 10px 10px;
  }
  @media (max-width: 640px) {
    /* Page-sized containment keeps the sheet clear of iOS fixed-overlay clipping. */
    .session-viewport:has(:global(.session-card)) {
      display: block;
      position: absolute;
      top: 0;
      left: 0;
      width: var(--ns-page-width, 100%);
      height: var(--ns-page-height, 100%);
      isolation: isolate;
      z-index: 80;
      overflow: clip;
    }
    :global(.session-scrim) {
      position: absolute;
    }
    :global(.session-card[data-vaul-drawer]) {
      position: sticky;
      inset: 0 0 auto;
      margin: 0;
      width: 100%;
      height: var(--ns-viewport-height, 100dvh);
      max-height: var(--ns-viewport-height, 100dvh);
      border-radius: 0;
      padding: max(env(safe-area-inset-top), 7px) 7px
        max(env(safe-area-inset-bottom), 7px);
      touch-action: pan-y;
    }
    :global(.session-card[data-vaul-drawer])::after {
      display: none;
    }
    :global(.session-card[data-vaul-drawer][data-state="closed"]),
    :global(.session-scrim[data-vaul-overlay][data-state="closed"]) {
      animation-fill-mode: forwards;
    }
    :global(.session-handle[data-vaul-handle]) {
      flex: none;
      margin: 4px auto 10px;
      background: var(--fai-grey-400);
      border-radius: var(--fai-radius-pill);
      touch-action: none;
    }
    /* Keep the expanded drag area inside the full-height sheet's top edge. */
    :global(.session-handle [data-vaul-handle-hitarea]) {
      top: -11px;
      transform: translateX(-50%);
    }
    .head {
      touch-action: none;
    }
    .body {
      padding: 14px 12px 16px;
      touch-action: pan-y;
      overscroll-behavior: contain;
    }
  }
  @keyframes ns-panel-out {
    to {
      transform: translateY(6px) scale(0.98);
      opacity: 0;
    }
  }
  @keyframes ns-scrim {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  @keyframes ns-scrim-out {
    to {
      opacity: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    :global(.session-card),
    :global(.session-scrim) {
      animation: none !important;
      transition: none !important;
    }
  }
</style>
