<script lang="ts">
  import type { FsEntry, RepoInfo, ReposResult } from "@whiffle/core";
  import { ToggleGroup } from "bits-ui";
  import { flushSync, onDestroy, tick, untrack } from "svelte";
  import { Spring } from "svelte/motion";
  import IconFolder from "~icons/solar/folder-linear";
  import IconServer from "~icons/solar/server-linear";
  import { machineControl, machineFs, whiffle } from "../client.svelte";
  import { inspectMachine } from "../fleet";
  import { reducedMotion } from "../motion.svelte";
  import { springFromVisual } from "./motion";
  import SearchField from "./SearchField.svelte";

  let {
    machineId,
    cwd,
    repo,
    locked,
    onselect,
    mode = "directory",
    onmodechange,
    spring = { visualDuration: 0.22, bounce: 0 },
    stagger = 0.014,
  }: {
    machineId: string;
    cwd: string;
    repo?: string;
    locked?: { projectName: string };
    mode?: "directory" | "repository";
    onmodechange: (mode: "directory" | "repository") => void;
    onselect: (value: {
      machineId: string;
      cwd: string;
      repo?: string;
    }) => void;
    spring?: { visualDuration: number; bounce: number };
    stagger?: number;
  } = $props();

  const uid = $props.id();
  const trailingSlashes = /\/+$/;
  const leadingSlash = /^\//;
  const scratchPath = /^\/tmp(?:\/|$)|(?:^|\/)\.claude\/jobs(?:\/|$)/;
  interface LocationRow {
    cwd: string;
    group: string;
    machineId: string;
    meta: string;
    name: string;
    repo?: string;
  }
  let generation = 0;
  let previousContext = "";
  let selectedMachine = $state("");
  let query = $state("");
  let unlocked = $state(false);
  let active = $state(0);
  let repos = $state<RepoInfo[]>([]);
  let browse = $state<{ name: string; cwd: string }[]>([]);
  let notice = $state("");
  let pathError = $state("");
  let loading = $state(false);
  let rail = $state<HTMLDivElement>();
  let list = $state<HTMLDivElement>();
  let railHeight = $state(36);
  let rowHeight = $state(36);
  const railY = new Spring(0);
  const rowY = new Spring(0);
  let railReady = $state(false);
  let measuredDirectory = $state("");
  const directoryKey = $derived(JSON.stringify([selectedMachine, mode]));
  const machine = $derived(
    whiffle.machines.find((row) => row.machineId === selectedMachine)
  );
  const typedPath = $derived(mode === "directory" && /^[~/]/.test(query));
  const lockedNow = $derived(locked && !unlocked);
  const host = $derived(machine?.hostname ?? selectedMachine);
  const projectHits = $derived(
    whiffle.machines.flatMap((hostRow) =>
      whiffle
        .projectsOn(hostRow.machineId)
        .filter((project) =>
          `${hostRow.hostname} ${project.name} ${project.cwd}`
            .toLowerCase()
            .includes(query.toLowerCase())
        )
    )
  );
  const recent = $derived(
    whiffle.machines.flatMap((hostRow) => {
      const projects = whiffle.projectsOn(hostRow.machineId);
      const scratchDirs = whiffle.instances
        .filter(
          (session) =>
            session.machineId === hostRow.machineId &&
            session.kind === "scratch"
        )
        .map((session) => session.cwd.replace(trailingSlashes, ""));
      const paths = [
        ...new Set(
          [...whiffle.catalogOf(hostRow.machineId)]
            .sort((a, b) => b.lastModified - a.lastModified)
            .flatMap((session) => (session.cwd ? [session.cwd] : []))
        ),
      ];
      return paths
        .filter(
          (path) =>
            !(
              scratchPath.test(path) ||
              scratchDirs.some(
                (dir) => path === dir || path.startsWith(`${dir}/`)
              ) ||
              projects.some((project) => project.cwd === path)
            )
        )
        .map((path) => ({
          machineId: hostRow.machineId,
          name: path.split("/").filter(Boolean).at(-1) || path,
          cwd: path,
          meta: `${hostRow.hostname} · ${path}`,
          group: "Recent",
        }));
    })
  );
  const rows = $derived.by<LocationRow[]>(() => {
    if (mode === "repository") {
      return repos
        .filter((row) =>
          row.nameWithOwner.toLowerCase().includes(query.toLowerCase())
        )
        .map((row) => ({
          machineId: selectedMachine,
          name: row.nameWithOwner,
          cwd: cwd || "~",
          repo: row.nameWithOwner,
          meta: row.visibility.toLowerCase(),
          group: "Repositories",
        }));
    }
    if (typedPath) {
      return browse.map((row) => ({
        ...row,
        machineId: selectedMachine,
        repo: undefined,
        meta: row.cwd,
        group: "Browse",
      }));
    }
    const projects = projectHits
      .filter((row) => query || row.machineId === selectedMachine)
      .map((row) => ({
        machineId: row.machineId,
        name: row.name,
        cwd: row.cwd,
        repo: undefined,
        meta: `${whiffle.machines.find((hostRow) => hostRow.machineId === row.machineId)?.hostname ?? row.machineId} · ${row.cwd}`,
        group: "Projects",
      }));
    const history = recent.filter((row) =>
      query
        ? `${row.name} ${row.meta}`.toLowerCase().includes(query.toLowerCase())
        : row.machineId === selectedMachine
    );
    const directories = browse
      .filter((row) =>
        `${host} ${row.name} ${row.cwd}`
          .toLowerCase()
          .includes(query.toLowerCase())
      )
      .map((row) => ({
        ...row,
        machineId: selectedMachine,
        meta: `${host} · ${row.cwd}`,
        group: "Browse",
      }));
    return [...projects, ...history, ...directories];
  });

  const optionId = (row: LocationRow) =>
    `${uid}-directory-${encodeURIComponent(JSON.stringify([row.group, row.machineId, row.cwd, row.repo]))}`;
  $effect.pre(() => {
    const context = JSON.stringify([query, selectedMachine, mode]);
    if (context !== previousContext) {
      previousContext = context;
      generation += 1;
      pathError = "";
    }
  });
  onDestroy(() => {
    generation += 1;
  });

  $effect(() => {
    selectedMachine = machineId;
  });
  $effect(() => {
    if (!query || typedPath || mode !== "directory") {
      return;
    }
    const hit =
      projectHits[0]?.machineId ??
      recent.find((row) =>
        `${row.name} ${row.meta}`.toLowerCase().includes(query.toLowerCase())
      )?.machineId ??
      whiffle.machines.find((row) =>
        row.hostname.toLowerCase().includes(query.toLowerCase())
      )?.machineId;
    const currentMachine = untrack(() => selectedMachine);
    if (hit && !projectHits.some((row) => row.machineId === currentMachine)) {
      selectedMachine = hit;
    }
  });
  $effect(() => {
    const id = selectedMachine;
    const pane = mode;
    repos = [];
    notice = "";
    loading = false;
    if (pane !== "repository" || !id) {
      return;
    }
    let cancelled = false;
    loading = true;
    machineControl<ReposResult>(id, "listRepos")
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (Array.isArray(result)) {
          repos = result;
        } else {
          notice =
            result.error === "gh-missing"
              ? `The GitHub CLI is not installed on ${host}. Install gh there, or paste a clone URL.`
              : `Run gh auth login on ${host} to list its repositories, or paste a clone URL.`;
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          notice = String(error);
        }
      })
      .finally(() => {
        if (!cancelled) {
          loading = false;
        }
      });
    return () => {
      cancelled = true;
    };
  });

  async function findPrefix(
    id: string,
    path: string
  ): Promise<{ prefix: string; children: FsEntry[] }> {
    try {
      return {
        prefix: path,
        children: await machineFs<FsEntry[]>(id, "list", path),
      };
    } catch (error) {
      if (path === "/" || path === "~") {
        throw error;
      }
      return findPrefix(id, path.slice(0, path.lastIndexOf("/")) || "/");
    }
  }

  $effect(() => {
    const id = selectedMachine;
    const hostname = host;
    const typed = typedPath;
    const current = cwd.replace(trailingSlashes, "");
    const base =
      id === machineId && cwd.includes("/")
        ? current.slice(0, current.lastIndexOf("/")) || "/"
        : "~";
    const path = typed ? query : base;
    browse = [];
    pathError = "";
    if (!id || mode !== "directory" || machine?.status !== "online") {
      return;
    }
    notice = "";
    let cancelled = false;
    const timer = setTimeout(() => {
      findPrefix(id, path.replace(trailingSlashes, "") || "/")
        .then(({ prefix, children }) => {
          if (cancelled) {
            return;
          }
          const tail = typed
            ? path.slice(prefix.length).replace(leadingSlash, "").toLowerCase()
            : "";
          browse = children
            .filter(
              (row) =>
                row.kind === "dir" && row.name.toLowerCase().startsWith(tail)
            )
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((row) => ({
              name: row.name,
              cwd: `${prefix === "/" ? "" : prefix}/${row.name}`,
            }));
        })
        .catch((error: unknown) => {
          if (!cancelled) {
            notice = String(error);
          }
        });
    }, 100);
    const inspection = setTimeout(() => {
      if (!typed) {
        return;
      }
      Promise.all([
        inspectMachine(id, path),
        machineFs<FsEntry[]>(id, "list", path),
      ]).catch(() => {
        if (!cancelled) {
          pathError = `That directory can't be read on ${hostname}. Check the path and try again.`;
        }
      });
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(inspection);
    };
  });

  $effect(() => {
    active = Math.max(
      0,
      rows.findIndex((row) => row.cwd === cwd && row.repo === repo)
    );
  });
  $effect(() => {
    const index = Math.min(active, rows.length - 1);
    const railNode = rail;
    const listNode = list;
    const key = directoryKey;
    const firstRailMeasure = !untrack(() => railReady);
    const firstDirectoryMeasure = untrack(() => measuredDirectory) !== key;
    let cancelled = false;
    const machineIndex = whiffle.machines.findIndex(
      (row) => row.machineId === selectedMachine
    );
    Object.assign(railY, springFromVisual(spring));
    Object.assign(rowY, springFromVisual(spring));
    tick().then(() => {
      if (cancelled) {
        return;
      }
      const railRow = railNode?.querySelector<HTMLElement>(
        `[data-machine-index="${machineIndex}"]`
      );
      const row = listNode?.querySelector<HTMLElement>(
        `[data-index="${index}"]`
      );
      if (railRow) {
        railHeight = railRow.offsetHeight;
        railY.set(railRow.offsetTop, {
          instant: firstRailMeasure || reducedMotion.current,
        });
        railReady = true;
        railRow.scrollIntoView({ block: "nearest" });
      } else {
        railReady = false;
      }
      if (row) {
        rowHeight = row.offsetHeight;
        rowY.set(row.offsetTop, {
          instant: firstDirectoryMeasure || reducedMotion.current,
        });
        measuredDirectory = key;
        row.scrollIntoView({ block: "nearest" });
      } else {
        measuredDirectory = "";
      }
    });
    return () => {
      cancelled = true;
    };
  });

  function chooseMachine(id: string) {
    selectedMachine = id;
  }
  async function accept(
    path: string,
    repository?: string,
    id = selectedMachine
  ) {
    flushSync(() => {
      selectedMachine = id;
    });
    generation += 1;
    const request = generation;
    const hostname = host;
    pathError = "";
    if (!repository && machine?.status === "online") {
      try {
        await Promise.all([
          inspectMachine(id, path),
          machineFs<FsEntry[]>(id, "list", path),
        ]);
      } catch {
        if (request === generation) {
          pathError = `That directory can't be read on ${hostname}. Check the path and try again.`;
        }
        return;
      }
    }
    if (request !== generation) {
      return;
    }
    onselect({
      machineId: id,
      cwd: path,
      ...(repository ? { repo: repository } : {}),
    });
  }
  function moveMachine(direction: number) {
    const index = whiffle.machines.findIndex(
      (row) => row.machineId === selectedMachine
    );
    const next =
      whiffle.machines[
        (index + direction + whiffle.machines.length) % whiffle.machines.length
      ];
    if (next) {
      chooseMachine(next.machineId);
    }
  }
  function keydown(event: KeyboardEvent) {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      event.stopPropagation();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      if (event.metaKey || event.ctrlKey) {
        moveMachine(direction);
      } else {
        active = Math.max(0, Math.min(rows.length - 1, active + direction));
      }
      return;
    }
    if (event.key === "Tab" && typedPath && rows[active]) {
      event.preventDefault();
      query = `${rows[active].cwd}/`;
      return;
    }
    if (event.key === "Enter" && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      event.stopPropagation();
      if (typedPath) {
        accept(query);
      } else if (rows[active]) {
        accept(rows[active].cwd, rows[active].repo, rows[active].machineId);
      } else if (mode === "repository" && query.trim()) {
        accept(cwd || "~", query.trim());
      }
    }
  }
</script>

<div class="picker">
  {#if lockedNow}
    <div class="locked">
      <span>From project {locked?.projectName}</span
      ><button onclick={() => { unlocked = true; }} type="button">Edit</button
      ><span class="path">{host} · {cwd}</span>
    </div>
  {:else}
    <div class="search">
      <!-- biome-ignore lint/a11y/useAriaActivedescendantWithTabindex: SearchField renders a native focusable input. -->
      <SearchField
        aria-activedescendant={rows[active] ? optionId(rows[active]) : undefined}
        aria-controls={`${uid}-directories`}
        aria-expanded={true}
        onkeydown={keydown}
        placeholder="Search machines, projects, or type a path"
        bind:value={query}
      />
    </div>
    <div class="panes">
      <div class="rail-scroll">
        <div
          aria-activedescendant={machine ? `${uid}-machine-${encodeURIComponent(selectedMachine)}` : undefined}
          aria-label="Machines"
          class="rail"
          onkeydown={keydown}
          role="listbox"
          tabindex="0"
          bind:this={rail}
        >
          {#if machine}
            <div
              class="highlight"
              style:height={`${railHeight}px`}
              style:transform={`translateY(${railY.current}px)`}
              class:ready={railReady}
            ></div>
          {/if}
          {#each whiffle.machines as row, index (row.machineId)}
            <button
              aria-selected={selectedMachine === row.machineId}
              class="row machine"
              data-machine-index={index}
              id={`${uid}-machine-${encodeURIComponent(row.machineId)}`}
              onclick={() => chooseMachine(row.machineId)}
              role="option"
              tabindex="-1"
              type="button"
              style:--delay={`${reducedMotion.current ? 0 : Math.min(index, 12) * stagger}s`}
              class:offline={row.status !== 'online'}
            >
              <span class="mark"><IconServer /></span
              ><span class="name">{row.hostname}</span
              ><span
                aria-label={row.status}
                class="dot"
                role="img"
                class:online={row.status === 'online'}
              ></span>
            </button>
          {/each}
        </div>
      </div>
      <div class="pane">
        <div class="pane-head">
          <ToggleGroup.Root
            aria-label="Location type"
            class="location-types"
            onValueChange={(value) => { if (value) { onmodechange(value as 'directory' | 'repository'); query = ''; } }}
            type="single"
            value={mode}
          >
            <ToggleGroup.Item value="directory">Directory</ToggleGroup.Item>
            <ToggleGroup.Item value="repository">Repository</ToggleGroup.Item>
          </ToggleGroup.Root>
        </div>
        <div class="directory-scroll">
          <div
            aria-activedescendant={rows[active] ? optionId(rows[active]) : undefined}
            aria-label={mode === 'directory' ? 'Directories' : 'Repositories'}
            class="directories"
            id={`${uid}-directories`}
            onkeydown={keydown}
            role="listbox"
            tabindex="0"
            bind:this={list}
          >
            {#key directoryKey}
              {#if rows.length}
                <div
                  class="highlight"
                  style:height={`${rowHeight}px`}
                  style:transform={`translateY(${rowY.current}px)`}
                  class:ready={measuredDirectory === directoryKey}
                ></div>
              {/if}
            {/key}
            {#each rows as row, index (optionId(row))}
              {#if index === 0 || rows[index - 1].group !== row.group}
                <div class="caption" role="presentation">{row.group}</div>
              {/if}
              <button
                aria-selected={row.cwd === cwd && row.machineId === machineId && row.repo === repo}
                class="row"
                data-index={index}
                id={optionId(row)}
                onclick={() => accept(row.cwd, row.repo, row.machineId)}
                onpointermove={() => { active = index; }}
                role="option"
                tabindex="-1"
                type="button"
                style:--delay={`${reducedMotion.current ? 0 : Math.min(index, 12) * stagger}s`}
              >
                <span class="mark"><IconFolder /></span
                ><span class="name">{row.name}</span
                ><span class="meta">{row.meta}</span>
              </button>
            {/each}
          </div>
          {#if loading}
            <p>Reading repositories…</p>
          {:else if notice}
            <p role="status">{notice}</p>
          {:else if rows.length === 0}
            <p>
              {mode === 'repository' ? 'No repository by that name here — it is cloned as you wrote it.' : 'No directories found.'}
            </p>
          {/if}
        </div>
        {#if mode === 'repository'}
          <div class="clone">
            Clone into <span class="path">{cwd || '~'}</span>
          </div>
        {/if}
      </div>
    </div>
    {#if pathError}
      <p class="error" role="alert">{pathError}</p>
    {:else if machine && machine.status !== 'online'}
      <p role="status">
        {host}
        is offline. Pick another machine, or start when it returns.
      </p>
    {/if}
  {/if}
</div>

<style>
  .picker {
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 360px;
    max-height: 100%;
    color: var(--ink-strong);
    font: var(--text-base) / var(--leading-ui) var(--font-body);
  }
  .search,
  .pane-head {
    flex: none;
    padding: var(--space-2);
  }
  :global(.location-types) {
    display: flex;
    gap: var(--space-1);
  }
  :global(.location-types button) {
    padding: var(--space-2);
    border-radius: var(--radius-control);
    color: var(--ink-body);
  }
  :global(.location-types button[data-state="on"]) {
    background: var(--surface-active);
  }
  .panes {
    display: flex;
    flex: 1;
    min-height: 0;
  }
  .rail-scroll {
    flex: 0 0 168px;
    min-width: 0;
    overflow: auto;
    padding: var(--space-1);
  }
  .rail,
  .directories {
    position: relative;
  }
  .pane {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }
  .directory-scroll {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: var(--space-1);
  }
  .highlight {
    opacity: 0;
    position: absolute;
    inset: 0 0 auto;
    pointer-events: none;
    background: var(--surface-hover);
    border-radius: var(--radius-well);
  }
  .highlight.ready {
    animation: highlight-in var(--c-100) var(--e-in) both;
  }
  @keyframes highlight-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  .row {
    display: flex;
    align-items: center;
    position: relative;
    width: 100%;
    height: 36px;
    gap: var(--space-2);
    padding: 0 var(--space-2);
    border: 0;
    border-radius: var(--radius-well);
    background: transparent;
    color: var(--ink-strong);
    font: inherit;
    text-align: left;
    cursor: pointer;
    animation: arrive var(--c-300) var(--e-in) both;
    animation-delay: var(--delay);
  }
  .mark {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    flex: none;
  }
  .row[aria-selected="true"] {
    background: color-mix(in oklab, var(--brand-solid) 12%, transparent);
  }
  .mark :global(svg) {
    width: 16px;
    height: 16px;
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .meta {
    margin-left: auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--ink-muted);
    font-size: var(--text-sm);
    font-variant-numeric: tabular-nums;
  }
  .caption {
    display: flex;
    align-items: center;
    height: 24px;
    padding-inline: var(--space-2);
    color: var(--ink-label);
    font-size: var(--text-xs);
  }
  .dot {
    flex: none;
    width: 6px;
    height: 6px;
    border-radius: var(--radius-pill);
    background: var(--ink-muted);
    margin-left: auto;
  }
  .dot.online {
    background: var(--status-live-bg);
  }
  .offline {
    opacity: 0.55;
  }
  .clone {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 36px;
    padding: var(--space-2);
    color: var(--ink-muted);
    font-size: var(--text-sm);
  }
  .path {
    font-family: var(--font-mono);
    overflow-wrap: anywhere;
  }
  p {
    padding: var(--space-2);
    margin: 0;
    color: var(--ink-muted);
    font-size: var(--text-sm);
    line-height: var(--leading-body);
  }
  .error {
    color: var(--error-9);
  }
  .locked {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-2);
    padding: var(--space-3);
  }
  .locked .path {
    flex-basis: 100%;
  }
  .locked button {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: auto;
    padding: var(--space-2);
    border: 0;
    border-radius: var(--radius-well);
    background: var(--surface-field);
    box-shadow: var(--shadow-tile);
    color: var(--ink-strong);
    font: inherit;
  }
  button:focus-visible,
  [role="listbox"]:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
  button:active {
    background: var(--surface-active);
    box-shadow: var(--shadow-inset-sel);
  }
  @media (hover: hover) {
    .row:hover:not([aria-selected="true"]) {
      background: var(--surface-hover);
    }
  }
  @media (pointer: coarse) {
    .row {
      height: 44px;
      min-width: 44px;
    }
  }
  @media (max-width: 479px) {
    .picker {
      height: 360px;
    }
    .rail-scroll {
      flex-basis: min(168px, 40%);
    }
  }
  .directories .row {
    flex-wrap: wrap;
    height: auto;
    min-height: 44px;
    padding-block: var(--space-1);
    row-gap: 0;
  }
  .directories .name {
    flex: 1;
    min-width: 0;
  }
  .directories .meta {
    flex-basis: 100%;
    margin-left: calc(16px + var(--space-2));
    font-size: var(--text-xs);
    white-space: normal;
    overflow-wrap: anywhere;
  }
  @media (prefers-reduced-motion: reduce) {
    .row {
      animation-duration: 1ms;
      animation-delay: 0ms;
    }
  }
  @keyframes arrive {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
