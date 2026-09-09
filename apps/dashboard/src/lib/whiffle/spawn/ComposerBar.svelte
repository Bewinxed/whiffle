<script lang="ts">
  import type { EffortLevel, HarnessKind, PermissionMode } from "@whiffle/core";
  import { prefersReducedMotion, Spring } from "svelte/motion";
  import { Button } from "$lib/components/ui/button";
  import { Switch } from "$lib/components/ui/switch";
  import Dots from "~icons/solar/menu-dots-bold";
  import Notes from "~icons/solar/notes-linear";
  import Pen from "~icons/solar/pen-linear";
  import Shield from "~icons/solar/shield-check-linear";
  import Warning from "~icons/solar/shield-warning-linear";
  import type { EffortStop } from "../effort-levels";
  import HarnessLogo from "../HarnessLogo.svelte";
  import ComposerEffort from "./ComposerEffort.svelte";
  import ComposerPopover from "./ComposerPopover.svelte";
  import LocationPicker from "./LocationPicker.svelte";
  import ModelPicker from "./ModelPicker.svelte";
  import ModePicker from "./ModePicker.svelte";
  import { type SpringSpec, springFromVisual } from "./motion";

  let {
    harness,
    model,
    modelName,
    installedHarnesses,
    machineName,
    machineId,
    cwd,
    repo,
    locked,
    projectName,
    online,
    locationLabel,
    permissionMode,
    modes,
    effort,
    stops,
    scale,
    sideQuest,
    busy,
    disabled,
    params,
    popover = $bindable(null),
    modelAnchor = $bindable(null),
    locationAnchor = $bindable(null),
    rowStyle,
    onharness,
    onmodel,
    onlocation,
    onmode,
    oneffort,
    onscratch,
    onbootstrap,
    onlocationmode,
    onstart,
  }: {
    harness: HarnessKind;
    model: string;
    modelName: string;
    installedHarnesses: HarnessKind[];
    machineName: string;
    machineId: string;
    cwd: string;
    repo?: string;
    locked: boolean;
    projectName: string;
    online: boolean;
    locationLabel: string;
    permissionMode: PermissionMode;
    modes: {
      value: PermissionMode;
      label: string;
      disabled: boolean;
      reason?: string;
    }[];
    effort: EffortLevel | null;
    stops: EffortStop[];
    scale: boolean;
    sideQuest: boolean;
    busy: boolean;
    disabled: boolean;
    params: {
      toggle: { thumb: SpringSpec };
      pop: { open: SpringSpec; rowStagger: number };
      list: { highlight: SpringSpec };
      slider: { thumb: SpringSpec };
      swap: { spring: SpringSpec; stagger: number };
    };
    popover?: "model" | "location" | "mode" | "options" | null;
    modelAnchor?: HTMLButtonElement | null;
    locationAnchor?: HTMLButtonElement | null;
    rowStyle: (index: number) => string;
    onharness: (value: HarnessKind) => void;
    onmodel: (value: string) => void;
    onlocation: (value: {
      machineId: string;
      cwd: string;
      repo?: string;
    }) => void;
    onmode: (value: PermissionMode) => void;
    oneffort: (value: EffortLevel | null) => void;
    onscratch: (value: boolean) => void;
    onbootstrap: (value: boolean) => void;
    onlocationmode: (value: "directory" | "repository") => void;
    onstart: () => void;
  } = $props();
  const icons = {
    default: Shield,
    plan: Notes,
    acceptEdits: Pen,
    bypassPermissions: Warning,
  };
  const ModeIcon = $derived(icons[permissionMode as keyof typeof icons]);
  const scratchThumb = new Spring(0);
  const bootstrapThumb = new Spring(0);
  $effect(() => {
    Object.assign(scratchThumb, springFromVisual(params.toggle.thumb));
    Object.assign(bootstrapThumb, springFromVisual(params.toggle.thumb));
    scratchThumb.set(sideQuest ? 14 : 0, {
      instant: prefersReducedMotion.current,
    });
    bootstrapThumb.set(repo === undefined ? 0 : 14, {
      instant: prefersReducedMotion.current,
    });
  });
  function change(name: NonNullable<typeof popover>, open: boolean) {
    if (open) {
      popover = name;
    } else if (popover === name) {
      popover = null;
    }
  }
</script>

<div class="composer-bar">
  <div class="settings-row">
    <ComposerPopover
      id="session-model"
      label="Agent and model"
      onchange={(open) => change("model", open)}
      open={popover === "model"}
      spring={params.pop.open}
      style={rowStyle(1)}
      bind:anchor={modelAnchor}
    >
      {#snippet trigger()}
        <HarnessLogo {harness} /><span class="model-label">{modelName}</span>
      {/snippet}
      <ModelPicker
        {harness}
        {installedHarnesses}
        {machineName}
        {onharness}
        onselect={onmodel}
        spring={params.list.highlight}
        stagger={params.pop.rowStagger}
        swapSpring={params.swap.spring}
        swapStagger={params.swap.stagger}
        value={model}
      />
    </ComposerPopover>
    <ComposerPopover
      id="session-location"
      label={`Location: ${locationLabel}`}
      onchange={(open) => change("location", open)}
      open={popover === "location"}
      spring={params.pop.open}
      style={rowStyle(2)}
      width={520}
      bind:anchor={locationAnchor}
    >
      {#snippet trigger()}
        <span
          aria-hidden="true"
          class="machine-dot"
          class:online={online}
        ></span><span class="location-label desktop-location"
          >{cwd ? cwd.replace(/^\/home\/[^/]+/, "~") : "Location"}</span
        >
        <span class="location-label mobile-location"
          >{cwd.split('/').filter(Boolean).at(-1) || cwd || "Location"}</span
        >
      {/snippet}
      <LocationPicker
        {cwd}
        locked={locked ? { projectName } : undefined}
        {machineId}
        mode={repo === undefined ? "directory" : "repository"}
        onmodechange={onlocationmode}
        onselect={onlocation}
        {repo}
        spring={params.list.highlight}
        stagger={params.pop.rowStagger}
      />
    </ComposerPopover>
    <ComposerPopover
      attention={permissionMode === "bypassPermissions"}
      id="session-mode"
      label="Permission mode"
      onchange={(open) => change("mode", open)}
      open={popover === "mode"}
      spring={params.pop.open}
      style={rowStyle(3)}
      width={220}
    >
      {#snippet trigger()}
        <ModeIcon />
        <span class="mode-label"
          >{modes.find((mode) => mode.value === permissionMode)?.label}</span
        >
      {/snippet}
      <ModePicker
        {modes}
        onselect={(value) => { onmode(value); popover = null; }}
        spring={params.list.highlight}
        stagger={params.pop.rowStagger}
        value={permissionMode}
      />
    </ComposerPopover>
  </div>
  <div class="actions-row">
    <div class="effort-slot" style={rowStyle(4)}>
      <div class="effort-collapse" inert={!scale} class:collapsed={!scale}>
        <ComposerEffort
          {harness}
          onchange={oneffort}
          spring={params.slider.thumb}
          {stops}
          value={effort}
        />
      </div>
    </div>
    <ComposerPopover
      align="end"
      id="session-options"
      label="Options"
      onchange={(open) => change("options", open)}
      open={popover === "options"}
      spring={params.pop.open}
      style={rowStyle(5)}
      width={240}
    >
      {#snippet trigger()}
        <Dots />
      {/snippet}
      <div class="option-row">
        <label for="session-scratch">Scratch</label>
        <Switch
          checked={sideQuest}
          class="composer-switch"
          id="session-scratch"
          onCheckedChange={onscratch}
          style={`--thumb-x:${scratchThumb.current}px`}
        />
      </div>
      <div class="option-row">
        <label for="session-bootstrap">Bootstrap</label>
        <Switch
          checked={repo !== undefined}
          class="composer-switch"
          id="session-bootstrap"
          onCheckedChange={onbootstrap}
          style={`--thumb-x:${bootstrapThumb.current}px`}
        />
      </div>
    </ComposerPopover>
    <span class="start-slot" style={rowStyle(6)}
      ><Button
        class="composer-start"
        disabled={busy || disabled || popover !== null}
        id="session-start"
        onclick={onstart}
        >{busy ? "Starting…" : "Start"}<kbd>⌘↵</kbd></Button
      ></span
    >
  </div>
</div>

<style>
  .composer-bar {
    display: flex;
    align-items: center;
    flex-wrap: nowrap;
    height: 40px;
    gap: var(--space-1);
    width: 100%;
  }
  .settings-row,
  .actions-row {
    display: contents;
  }
  .mobile-location {
    display: none;
  }
  .model-label {
    max-width: 132px;
  }
  .location-label {
    max-width: 100px;
  }
  .machine-dot {
    width: var(--space-2);
    height: var(--space-2);
    flex: none;
    border-radius: var(--radius-pill);
    background: var(--ink-muted);
  }
  .machine-dot.online {
    background: var(--status-live-bg);
  }
  .effort-slot {
    flex: 1;
    min-width: 150px;
  }
  .effort-collapse {
    width: 150px;
    opacity: 1;
    transition:
      width var(--c-300) var(--e-out),
      opacity var(--c-100) var(--e-out);
  }
  .effort-collapse.collapsed {
    width: 0;
    opacity: 0;
    overflow: hidden;
  }
  :global(.composer-start) {
    height: 40px;
    padding-inline: var(--space-3);
    gap: var(--space-2);
    border: 0;
    font-size: var(--text-sm);
  }
  .start-slot {
    flex: none;
    margin-left: auto;
  }
  kbd {
    font: inherit;
  }
  .option-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 40px;
    gap: var(--space-4);
    padding-inline: var(--space-2);
  }
  :global(.composer-switch) {
    border: 0;
    background: var(--border-control);
    box-shadow: none;
  }
  :global(.composer-switch[data-state="checked"]) {
    background: var(--brand-solid);
  }
  :global(.composer-switch [data-slot="switch-thumb"]) {
    translate: none !important;
    transform: translateX(var(--thumb-x)) !important;
    transition: none;
    background: var(--surface-raised);
  }
  :global(
    .dark .composer-switch[data-state="unchecked"] [data-slot="switch-thumb"]
  ) {
    background: var(--ink-muted);
  }
  @media (max-width: 600px) {
    :global(.composer-pill) {
      height: 44px;
      min-width: 44px;
      padding-inline: var(--space-2);
      gap: var(--space-2);
    }
    .model-label {
      max-width: 22ch;
    }
    .location-label {
      max-width: 22ch;
    }
    .desktop-location {
      display: none;
    }
    .mobile-location {
      display: inline;
    }
    .composer-bar {
      flex-direction: column;
      height: auto;
      gap: 8px;
    }
    .settings-row,
    .actions-row {
      display: flex;
      align-items: center;
      width: 100%;
      height: 44px;
      flex: none;
      padding-inline: 16px;
    }
    .settings-row {
      overflow-x: auto;
      overscroll-behavior-inline: contain;
      scrollbar-width: none;
      scroll-padding-inline: 16px;
    }
    .settings-row::-webkit-scrollbar {
      display: none;
    }
    .settings-row :global(.composer-pill) {
      flex: 1 0 auto;
    }
    .actions-row {
      gap: var(--space-1);
    }
    .actions-row :global(#session-options) {
      width: 44px;
      flex: 0 0 44px;
    }
    .option-row {
      min-height: 44px;
    }
    :global(.composer-switch) {
      width: 44px;
      height: 44px;
      padding-inline: var(--space-2);
      background: transparent !important;
    }
    :global(.composer-switch::before) {
      content: "";
      position: absolute;
      inset: 10px 0;
      border-radius: var(--radius-pill);
      background: var(--border-control);
    }
    :global(.composer-switch[data-state="checked"]::before) {
      background: var(--brand-solid);
    }
    :global(.composer-switch [data-slot="switch-thumb"]) {
      z-index: 1;
    }
    .effort-collapse {
      width: 100%;
    }
    .start-slot {
      height: 44px;
    }
    :global(.composer-start) {
      min-width: 96px;
      height: 44px;
      padding-inline: var(--space-3);
    }
    .effort-slot {
      min-width: 160px;
      flex: 1;
    }
    kbd {
      display: none;
    }
  }
  @media (max-width: 360px) {
    .actions-row {
      padding-inline: var(--space-1);
      gap: 0;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .effort-collapse {
      transition-duration: 1ms;
    }
  }
</style>
