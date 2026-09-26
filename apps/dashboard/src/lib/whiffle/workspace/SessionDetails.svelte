<script lang="ts">
  import type { EffortLevel, HarnessKind, PermissionMode } from "@whiffle/core";
  import { untrack } from "svelte";
  import ProviderLogo from "$lib/components/features/ProviderLogo.svelte";
  import Down from "~icons/solar/alt-arrow-down-linear";
  import External from "~icons/solar/arrow-right-up-linear";
  import Close from "~icons/solar/close-circle-bold-duotone";
  import Copy from "~icons/solar/copy-bold-duotone";
  import Link from "~icons/solar/link-bold-duotone";
  import Machine from "~icons/solar/server-square-bold-duotone";
  import Shield from "~icons/solar/shield-check-bold-duotone";
  import {
    latestCommandFor,
    refreshContext,
    relaunchSession,
    streamCapable,
    submitCommand,
    whiffle,
  } from "../client.svelte";
  import { copyToClipboard } from "../copy";
  import HarnessLogo from "../HarnessLogo.svelte";
  import { describingRow, ensureModels, modelLabel } from "../models.svelte";
  import { PERMISSION_MODES } from "../permission-modes";
  import EffortPips from "../spawn/EffortPips.svelte";
  import ModelSection from "../spawn/ModelSection.svelte";
  import PermissionSection from "../spawn/PermissionSection.svelte";
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
  const harnessName = $derived(
    harness
      ? { claude: "Claude Code", opencode: "OpenCode", pi: "Pi" }[harness]
      : "Not reported"
  );
  const permissionNames: Record<string, string> = {
    default: "Ask before edits",
    plan: "Plan first",
    acceptEdits: "Auto-accept edits",
    bypassPermissions: "Full access",
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
  const number = (value: number) =>
    new Intl.NumberFormat(undefined, {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
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
  const permissionName = $derived(
    shownPermission
      ? (permissionNames[shownPermission] ?? shownPermission)
      : "Not reported"
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
      <h2 id={`${uid}-title`}>{title}</h2>
      <button
        aria-label="Close session details"
        class="icon-action dismiss"
        onclick={onclose}
        type="button"
      >
        <Close />
      </button>
      <SessionStatus {sessionId} />
    </div>
    <div class="location">
      <span class="machine"
        ><Machine />
        {machine?.hostname || machineId || 'Machine not reported'}</span
      >
      <div class="directory">
        <code>{cwd || 'Working directory not reported'}</code>
        {#if cwd}
          <button
            aria-label="Copy working directory"
            class="icon-action"
            onclick={() => copyToClipboard('Working directory', cwd)}
            type="button"
          >
            <Copy />
          </button>
        {/if}
      </div>
    </div>

    <div class="configuration">
      <details class="setting" name={`${uid}-settings`}>
        <summary>
          <span class="setting-icon"
            ><ProviderLogo model={model ?? ''} size={20} /></span
          ><span class="setting-text"
            ><span class="label">Model</span
            ><span class="value"
              >{model ? modelLabel(model) : 'Not reported'}</span
            ></span
          ><Down />
        </summary>
        {#if harness}
          <fieldset
            aria-busy={pending('model')}
            disabled={!editable || pending('model')}
          >
            <ModelSection
              {harness}
              installed={[harness]}
              machineName={machine?.hostname ?? ''}
              model={model ?? ''}
              onharness={() => { /* Running sessions retain their harness. */ }}
              onmodel={changeModel}
              runtime
            />
          </fieldset>
        {/if}
      </details>
      {@render feedback('model')}
      <details class="setting" name={`${uid}-settings`}>
        <summary>
          <span class="setting-icon"><Shield /></span
          ><span class="setting-text"
            ><span class="label">Permissions</span
            ><span class="value">{permissionName}</span></span
          ><Down />
        </summary>
        {#if modes.length}
          <fieldset
            aria-busy={pending('permission')}
            disabled={!editable || pending('permission')}
          >
            <PermissionSection
              embedded
              modes={modes.map(mode => ({ value: mode.value, disabled: !editable || pending('permission') }))}
              onchange={changePermission}
              value={shownPermission}
            />
          </fieldset>
        {:else}
          <p class="feedback">
            This harness has not reported its permission choices.
          </p>
        {/if}
      </details>
      {@render feedback('permission')}
      {#if report?.capabilities.effort !== false}
        <div class="effort">
          <span class="label"
            >Reasoning effort
            {#if !efforts.length}
              <span class="applied">{session?.effort ?? 'Not reported'}</span>
            {/if}</span
          >
          {#if efforts.length && session?.effort}
            <fieldset
              aria-busy={pending('effort')}
              disabled={!editable || pending('effort')}
            >
              <EffortPips
                {efforts}
                embedded
                onchange={changeEffort}
                oncommit={changeEffort}
                value={session.effort}
              />
            </fieldset>
          {:else}
            <p class="feedback">
              {efforts.length ? 'Waiting for the applied effort level.' : 'No effort scale reported for this model.'}
            </p>
          {/if}
          {@render feedback('effort')}
        </div>
      {/if}
      {#if !editable}
        <p class="feedback">
          Runtime controls are available when this session is running and
          connected.
        </p>
      {/if}
    </div>

    <div class="readings">
      <div class="harness">
        {#if harness}
          <HarnessLogo {harness} />
        {/if}
        <span>{harnessName}</span>
      </div>
      <dl>
        <div>
          <dt>Turns</dt>
          <dd>{stats.turns ?? '—'}</dd>
        </div>
        <div>
          <dt>Cost</dt>
          <dd>{stats.cost === null ? '—' : `$${stats.cost.toFixed(2)}`}</dd>
        </div>
        <div class="context">
          <dt>Context used</dt>
          <dd>
            {#if percent !== null && stats.totalTokens !== null && stats.maxTokens !== null}
              {`${percent}% · ${number(stats.totalTokens)} / ${number(stats.maxTokens)}`}
              {#if readAt}
                {` · read ${readAt}`}
              {/if}
            {:else if reading}
              Reading…
            {:else if refusal}
              {refusal}
            {:else}
              Not reported
            {/if}
          </dd>
          {#if percent !== null}
            <meter aria-label="Context used" max="100" min="0" value={percent}>
              {percent}%
            </meter>
          {/if}
        </div>
      </dl>
    </div>
  </div>
  <div class="footer">
    <a href="/tools"
      >{session?.mcp ? `${session.mcp.length} connected servers` : 'Connected tools'}<External
        aria-hidden="true"
      /></a
    >
    <button
      onclick={() => copyToClipboard('Link', new URL(href, location.origin).href)}
      type="button"
    >
      <Link />
      Copy link
    </button>
  </div>
</div>

<style>
  .session-details {
    --permission-row-height: 58px;
    color: var(--ink-strong);
    min-width: 0;
    min-height: 0;
    width: 100%;
    max-height: inherit;
    display: flex;
    flex-direction: column;
    font-size: var(--text-label);
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
    position: relative;
    display: grid;
    gap: var(--space-2);
    padding: var(--space-5) var(--space-5) var(--space-3);
  }
  h2 {
    padding-right: var(--space-8);
    margin: 0;
    color: var(--ink-strong);
    font-size: var(--text-title);
    font-weight: var(--weight-strong);
    line-height: var(--leading-body);
    overflow-wrap: anywhere;
  }
  .dismiss {
    position: absolute;
    top: var(--space-3);
    right: var(--space-3);
  }
  .location {
    padding: 0 var(--space-5) var(--space-4);
    display: grid;
    gap: var(--space-2);
  }
  .machine {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-label);
    overflow-wrap: anywhere;
  }
  .machine :global(svg) {
    flex: none;
    width: 16px;
    height: 16px;
    color: var(--ink-muted);
  }
  .directory {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: var(--surface-recess);
    border-radius: var(--radius-sm);
  }
  code {
    flex: 1;
    min-width: 0;
    align-self: center;
    font-family: var(--font-mono);
    font-size: var(--text-label);
    line-height: var(--leading-body);
    overflow-wrap: anywhere;
    white-space: pre-wrap;
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
    border-radius: var(--radius-sm);
    color: var(--ink-muted);
    background: transparent;
  }
  .icon-action :global(svg) {
    width: 18px;
    height: 18px;
  }
  .configuration {
    border-top: 1px solid var(--border-hairline);
    padding: var(--space-3) var(--space-5) var(--space-4);
  }
  .setting + .setting {
    margin-top: var(--space-1);
  }
  summary {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2);
    border-radius: var(--radius-sm);
    cursor: pointer;
    list-style: none;
  }
  summary::-webkit-details-marker {
    display: none;
  }
  .setting summary > :global(svg) {
    width: 14px;
    height: 14px;
    flex: none;
    transition: transform var(--dur-control) var(--ease-out);
  }
  details[open] summary > :global(svg) {
    transform: rotate(180deg);
  }
  .setting-icon {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    border-radius: var(--radius-sm);
    background: var(--surface-recess);
    flex: none;
  }
  .setting-icon :global(svg) {
    width: 20px;
    height: 20px;
  }
  .setting-text {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 2px;
  }
  .label {
    font-size: var(--text-label);
    color: var(--ink-muted);
  }
  .value {
    color: var(--ink-strong);
    font-weight: var(--weight-medium);
    overflow-wrap: anywhere;
    line-height: var(--leading-body);
  }
  fieldset {
    min-width: 0;
    padding: 0;
    border: 0;
    margin: var(--space-2) 0;
  }
  fieldset:disabled {
    opacity: 0.55;
    pointer-events: none;
  }
  .effort {
    margin-top: var(--space-3);
  }
  .effort > .label {
    display: flex;
    justify-content: space-between;
    gap: var(--space-2);
  }
  .applied {
    text-transform: capitalize;
    color: var(--ink-strong);
  }
  .feedback,
  .failure {
    margin-top: var(--space-2);
    font-size: var(--text-label);
    line-height: var(--leading-body);
    overflow-wrap: anywhere;
  }
  .feedback {
    color: var(--ink-muted);
  }
  .failure {
    color: var(--status-fail-ink);
  }
  .session-details :global(.perms .desc) {
    white-space: normal;
    overflow: visible;
  }
  .readings {
    padding: var(--space-4) var(--space-5);
    border-top: 1px solid var(--border-hairline);
    background: var(--surface-recess);
  }
  .harness {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-label);
    color: var(--ink-strong);
  }
  dl {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
    margin-top: var(--space-3);
  }
  dl > div {
    display: grid;
    gap: var(--space-1);
  }
  dt {
    font-size: var(--text-label);
    color: var(--ink-muted);
  }
  dd {
    font-size: var(--text-label);
    font-weight: var(--weight-medium);
    font-variant-numeric: tabular-nums;
    color: var(--ink-strong);
  }
  .context {
    grid-column: 1 / -1;
    grid-template-columns: auto 1fr;
    align-items: baseline;
  }
  .context dd {
    text-align: right;
    font-size: var(--text-label);
  }
  meter {
    grid-column: 1 / -1;
    width: 100%;
    height: 8px;
    appearance: none;
    background: var(--border-control);
    border-radius: var(--radius-pill);
    overflow: hidden;
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
  .footer {
    flex: none;
    background: var(--surface-raised);
    display: flex;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-5);
    border-top: 1px solid var(--border-hairline);
  }
  .footer a,
  .footer button {
    display: inline-flex;
    gap: var(--space-2);
    align-items: center;
    min-height: 32px;
    font-size: var(--text-label);
    text-decoration: none;
    background: transparent;
    border: 0;
    color: var(--ink-strong);
  }
  .footer :global(svg) {
    width: 16px;
    height: 16px;
  }
  button:focus-visible,
  summary:focus-visible,
  a:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
  @media (hover: hover) {
    summary:hover,
    .icon-action:hover {
      background: var(--surface-hover);
    }
    .footer a:hover,
    .footer button:hover {
      color: var(--ink-strong);
    }
  }
  @media (pointer: coarse) {
    .icon-action {
      width: 44px;
      height: 44px;
    }
    h2 {
      padding-right: 44px;
    }
    .footer a,
    .footer button {
      min-height: 44px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .setting summary > :global(svg) {
      transition: none;
    }
  }
</style>
