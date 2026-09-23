<script lang="ts" module>
  const HOME = /^\/(home|Users)\/[^/]+/;
</script>

<script lang="ts">
  import type { EffortLevel, HarnessKind, PermissionMode } from "@whiffle/core";
  import { untrack } from "svelte";
  import Link from "~icons/solar/link-bold-duotone";
  import {
    latestCommandFor,
    refreshContext,
    relaunchSession,
    streamCapable,
    submitCommand,
    whiffle,
  } from "../client.svelte";
  import { continueInNewSession, continueSourceOf } from "../continue.svelte";
  import { copyToClipboard } from "../copy";
  import HarnessLogo from "../HarnessLogo.svelte";
  import { describingRow, ensureModels } from "../models.svelte";
  import { PERMISSION_MODES } from "../permission-modes";
  import ModelSection from "../spawn/ModelSection.svelte";
  import "../spawn/ns-theme.css";
  import SessionStatus from "./SessionStatus.svelte";
  import { contextOf } from "./workspace.svelte";

  let {
    sessionId,
    title,
    href,
    onclose,
  }: {
    sessionId: string;
    title: string;
    href: string;
    onclose: () => void;
  } = $props();
  const uid = $props.id();
  const session = $derived(whiffle.session(sessionId));
  const row = $derived(whiffle.instanceIndex.byId.get(sessionId));
  const context = $derived(contextOf(sessionId));
  const machineId = $derived(
    session?.machineId || row?.machineId || context?.machine
  );
  const machine = $derived(
    whiffle.machines.find((item) => item.machineId === machineId)
  );
  const harness = $derived(
    (session?.harness || row?.harness || context?.harness) as
      | HarnessKind
      | undefined
  );
  const report = $derived(
    machine?.harnesses?.find((item) => item.harness === harness)
  );
  const cwd = $derived(session?.cwd || row?.cwd || context?.cwd || "");
  const stats = $derived(whiffle.statsOf(sessionId));
  const model = $derived(session?.model ?? null);
  const modelInfo = $derived(model ? describingRow(model) : null);
  const efforts = $derived(
    report?.capabilities.effort ? (modelInfo?.supportedEffortLevels ?? []) : []
  );
  const modes = $derived(
    PERMISSION_MODES.filter((mode) =>
      report?.capabilities.permissionModes.includes(mode.value)
    )
  );
  const editable = $derived(
    whiffle.status === "connected" &&
      !!machineId &&
      whiffle.runningInstances.some((item) => item.id === sessionId)
  );
  const harnessNames: Record<HarnessKind, string> = {
    claude: "Claude Code",
    opencode: "OpenCode",
    pi: "Pi",
  };
  /** `~/…/leaf`: the folder name is what tells sessions apart. */
  const shortPath = (path: string) => {
    const parts = path.replace(HOME, "~").split("/");
    return parts.length > 3 ? `${parts[0]}/…/${parts.at(-1)}` : parts.join("/");
  };
  /*
   * The reading only arrives when something asks for it, and the transcript
   * asks at the end of a turn it watched. A tab opened after a reload, or a
   * session mid-way through a long turn, has had nothing ask — so opening the
   * details asks, once per session shown, as soon as the session can answer.
   * Once: `editable` re-derives on every change to the running list, and each
   * of those is not a reason to ask again.
   */
  let asked: string | null = null;
  $effect(() => {
    const id = sessionId;
    const mid = machineId;
    if (editable && mid && asked !== id) {
      asked = id;
      // biome-ignore lint/complexity/noVoid: fire-and-forget — the reading lands in the session's state and the popover follows it
      untrack(() => void refreshContext(id, mid));
    }
  });
  const reading = $derived(
    !!session?.contextPending && stats.totalTokens === null
  );
  /** Why there is no reading, when the session said why. */
  const refusal = $derived.by(() => {
    const error = session?.contextError;
    if (!error) {
      return null;
    }
    // Custody: the agent restarted under a running turn and holds the session
    // until that turn hands it back; the SDK cannot be asked until then.
    return error.includes("(custody)")
      ? "Unavailable until this turn ends"
      : `Couldn't read: ${error}`;
  });
  /** When a session that can no longer answer was last read. */
  const readAt = $derived(
    !editable && session?.context?.readAt
      ? new Date(session.context.readAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : null
  );
  const percent = $derived(
    stats.totalTokens !== null && stats.maxTokens
      ? Math.min(100, Math.round((stats.totalTokens / stats.maxTokens) * 100))
      : null
  );
  function tokens(value: number) {
    if (value >= 1_000_000) {
      return `${Number((value / 1_000_000).toFixed(1))}M`;
    }
    return value >= 1000 ? `${Math.round(value / 1000)}k` : `${value}`;
  }
  type Slot = "model" | "permission" | "effort";
  const kinds = {
    model: "set-model",
    permission: "set-permission-mode",
    effort: "set-effort",
  } as const;
  let relaunching = $state(false);
  let relaunchFailure = $state<string | null>(null);
  let permissionBeforeRelaunch = $state<PermissionMode | null>(null);
  const shownPermission = $derived(
    relaunching ? permissionBeforeRelaunch : (session?.permissionMode ?? null)
  );

  $effect(() => {
    const kind = harness;
    if (kind) {
      untrack(() => ensureModels(kind));
    }
  });

  function pending(slot: Slot) {
    if (slot === "permission" && relaunching) {
      return true;
    }
    const record = latestCommandFor(sessionId, kinds[slot]);
    return (
      record?.stage === "submitted" ||
      (streamCapable() && record?.stage === "accepted")
    );
  }
  function failure(slot: Slot) {
    if (slot === "permission" && relaunchFailure) {
      return relaunchFailure;
    }
    const record = latestCommandFor(sessionId, kinds[slot]);
    return record?.stage === "failed"
      ? record.reason || "Change refused. Try again."
      : null;
  }
  function changeModel(next: string) {
    if (!(editable && machineId) || pending("model") || next === model) {
      return;
    }
    submitCommand(sessionId, machineId, "set-model", { model: next });
  }
  function changeEffort(next: EffortLevel) {
    if (
      !(editable && machineId) ||
      pending("effort") ||
      next === session?.effort
    ) {
      return;
    }
    submitCommand(sessionId, machineId, "set-effort", { effort: next });
  }
  async function changePermission(next: PermissionMode) {
    if (
      !(editable && machineId) ||
      pending("permission") ||
      next === session?.permissionMode
    ) {
      return;
    }
    relaunchFailure = null;
    if (next !== "bypassPermissions") {
      submitCommand(sessionId, machineId, "set-permission-mode", {
        mode: next,
      });
      return;
    }
    // Full access is a launch-time decision for the harness.
    permissionBeforeRelaunch = session?.permissionMode ?? null;
    relaunching = true;
    try {
      await relaunchSession(sessionId, machineId, next);
    } catch (error) {
      relaunchFailure =
        error instanceof Error ? error.message : "Change refused. Try again.";
    } finally {
      relaunching = false;
    }
  }
</script>

{#snippet feedback(slot: Slot)}
  {#if failure(slot)}
    <p class="failure" role="alert">{failure(slot)}</p>
  {:else if pending(slot)}
    <p class="feedback" role="status">Applying change…</p>
  {/if}
{/snippet}

<div class="session-details ns-theme">
  <div class="details-body">
    <div class="identity">
      <div class="title">
        <h2 id={`${uid}-title`} {title}>{title}</h2>
        <button
          aria-label="Copy link"
          class="icon-action"
          onclick={() => copyToClipboard('Link', new URL(href, location.origin).href)}
          type="button"
        >
          <Link />
        </button>
      </div>
      {#if harness}
        <span
          aria-label={harnessNames[harness]}
          class="harness"
          role="img"
          title={harnessNames[harness]}
        >
          <HarnessLogo {harness} />
        </span>
      {/if}
    </div>
    <p class="meta">
      <SessionStatus {sessionId} />
      {#if machine?.hostname || machineId}
        <span aria-hidden="true" class="sep">·</span>
        <span class="host">{machine?.hostname || machineId}</span>
      {/if}
      {#if cwd}
        <span aria-hidden="true" class="sep">·</span>
        <button
          aria-label={`Copy working directory ${cwd}`}
          class="cwd"
          onclick={() => copyToClipboard('Working directory', cwd)}
          title={cwd}
          type="button"
        >
          {shortPath(cwd)}
        </button>
      {/if}
    </p>

    {#if harness}
      <div class="configuration">
        <fieldset disabled={!editable}>
          <ModelSection
            {harness}
            installed={[harness]}
            machineName={machine?.hostname ?? ''}
            model={model ?? ''}
            onharness={() => { /* Running sessions retain their harness. */ }}
            onmodel={changeModel}
            runtime
            tools={{
            efforts,
            effort: session?.effort ?? null,
            oneffort: changeEffort,
            modes: modes.map(mode => ({ value: mode.value, disabled: !editable || pending('permission') })),
            permission: shownPermission,
            onpermission: changePermission,
          }}
          />
        </fieldset>
        {@render feedback('model')}
        {@render feedback('effort')}
        {@render feedback('permission')}
        {#if !editable}
          <p class="feedback">Controls unlock while the session is running.</p>
        {/if}
      </div>
    {/if}
  </div>
  <div class="stats">
    <div class="context">
      {#if percent !== null && stats.totalTokens !== null && stats.maxTokens !== null}
        <meter
          aria-label="Context used"
          max="100"
          min="0"
          title={readAt ? `Read at ${readAt}` : undefined}
          value={percent}
        >
          {percent}%
        </meter>
        <span
          >{`${percent}% · ${tokens(stats.totalTokens)}/${tokens(stats.maxTokens)}`}</span
        >
      {:else if reading}
        <span>Reading…</span>
      {:else if refusal}
        <span class="refusal" title={refusal}>{refusal}</span>
      {:else}
        <span>Context not reported</span>
      {/if}
    </div>
    {#if session?.mcp}
      <a class="tools" href="/tools">{session.mcp.length} MCP</a>
    {/if}
    {#if stats.cost !== null}
      <span class="cost">{`$${stats.cost.toFixed(2)}`}</span>
    {/if}
  </div>
  <div class="footer">
    <button
      class="ns-btn primary"
      onclick={() => { onclose(); continueInNewSession(continueSourceOf(sessionId, title)); }}
      type="button"
    >
      Continue in new session…
    </button>
  </div>
</div>

<style>
  .session-details {
    color: var(--ink-body);
    min-width: 0;
    min-height: 0;
    width: 100%;
    max-height: inherit;
    display: flex;
    flex-direction: column;
    font-size: var(--text-base);
  }
  .details-body {
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    touch-action: pan-y;
    scrollbar-width: thin;
    scrollbar-color: var(--border-control) transparent;
  }
  .identity {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-4) var(--space-5) var(--space-1);
  }
  .title {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }
  h2 {
    min-width: 0;
    margin: 0;
    color: var(--ink-strong);
    font-size: var(--text-lg);
    font-weight: var(--weight-strong);
    line-height: var(--leading-body);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .harness {
    display: inline-flex;
    flex: none;
  }
  .meta {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin: 0;
    padding: 0 var(--space-5) var(--space-3);
    font-size: var(--text-sm);
    line-height: var(--leading-body);
    color: var(--ink-muted);
    white-space: nowrap;
  }
  .host {
    flex: none;
    max-width: 40%;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .cwd {
    min-width: 0;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    overflow: hidden;
    text-overflow: ellipsis;
  }
  button {
    cursor: pointer;
  }
  .icon-action {
    display: grid;
    place-items: center;
    flex: none;
    width: 28px;
    height: 28px;
    border: 0;
    border-radius: var(--radius-control);
    color: var(--ink-muted);
    background: transparent;
  }
  .icon-action :global(svg) {
    width: 18px;
    height: 18px;
  }
  .configuration {
    border-top: 1px solid var(--border-hairline);
    padding: var(--space-3) var(--space-5);
  }
  fieldset {
    min-width: 0;
    padding: 0;
    border: 0;
    margin: 0;
  }
  fieldset:disabled {
    opacity: 0.55;
    pointer-events: none;
  }
  .feedback,
  .failure {
    margin-top: var(--space-2);
    font-size: var(--text-sm);
    line-height: var(--leading-body);
    overflow-wrap: anywhere;
  }
  .feedback {
    color: var(--ink-muted);
  }
  .failure {
    color: var(--status-fail-ink);
  }
  .stats {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-3) var(--space-5);
    border-top: 1px solid var(--border-hairline);
    background: var(--surface-field);
    font-size: var(--text-sm);
    line-height: var(--leading-body);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    color: var(--ink-body);
  }
  .context {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .refusal {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .tools {
    display: inline-flex;
    align-items: center;
    color: var(--ink-body);
  }
  .cost {
    margin-left: auto;
    color: var(--ink-strong);
    font-weight: var(--weight-medium);
  }
  meter {
    flex: 1;
    min-width: 48px;
    max-width: 96px;
    height: 4px;
    appearance: none;
    border: 0;
    border-radius: 999px;
    overflow: hidden;
    background: var(--border-control);
  }
  meter::-webkit-meter-bar {
    background: var(--border-control);
    border: 0;
  }
  meter::-webkit-meter-optimum-value {
    background: var(--ink-muted);
  }
  meter::-moz-meter-bar {
    background: var(--ink-muted);
  }
  /* The modal's action row (SessionFooter): right-aligned, 8px apart. */
  .footer {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    padding: var(--space-3) var(--space-5);
    border-top: 1px solid var(--border-hairline);
    background: var(--surface-raised);
  }
  button:focus-visible,
  a:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
  @media (hover: hover) {
    .icon-action:hover {
      background: var(--surface-hover);
    }
    .cwd:hover,
    .tools:hover {
      color: var(--ink-strong);
    }
  }
  @media (pointer: coarse) {
    .icon-action {
      width: 44px;
      height: 44px;
    }
  }
  @media (max-width: 640px) {
    .footer {
      padding-bottom: max(var(--space-3), env(safe-area-inset-bottom));
    }
    .ns-btn {
      height: 44px;
      flex: 1;
    }
  }
</style>
