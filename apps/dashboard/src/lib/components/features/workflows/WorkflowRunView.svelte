<script lang="ts">
  import { renderPrompt, type WorkflowNode } from "@whiffle/core";
  import { onMount, untrack } from "svelte";
  import { MediaQuery } from "svelte/reactivity";
  import { goto } from "$app/navigation";
  // biome-ignore lint/performance/noNamespaceImport: shadcn-svelte component group
  import * as Dialog from "$lib/components/ui/dialog";
  import { whiffle } from "$lib/whiffle/client.svelte";
  import { confirm } from "$lib/whiffle/confirm.svelte";
  import { message } from "$lib/whiffle/delegate-types";
  import type { UsageSummary } from "$lib/whiffle/usage";
  import {
    refreshWorkflowRun,
    workflowState,
  } from "$lib/whiffle/workflow-state.svelte";
  import {
    answerWorkflow,
    cancelWorkflowRun,
    rerunWorkflow,
  } from "$lib/whiffle/workflows";
  import WorkflowCanvas from "./WorkflowCanvas.svelte";
  import WorkflowStatus from "./WorkflowStatus.svelte";
  import { duration } from "./workflow-ui";

  let { runId }: { runId: string } = $props();
  const narrow = new MediaQuery("(max-width: 1023px)");
  let selected = $state<string>();
  let selectedEnd = $state(false);
  let stepsOpen = $state(true);
  let tab = $state("steps");
  let errorMessage = $state("");
  let busy = $state(false);
  let now = $state(Date.now());
  let other = $state("");
  let note = $state("");
  let sessionCosts = $state<Record<string, number>>({});
  const costs = $derived(
    Object.fromEntries(
      whiffle.instances
        .filter(
          (entry) =>
            entry.sessionId && sessionCosts[entry.sessionId] !== undefined
        )
        .map((entry) => [entry.id, sessionCosts[entry.sessionId as string]])
    )
  );
  let scope = $state("root");
  const run = $derived(workflowState.details[runId]);
  const workflow = $derived(
    workflowState.workflows.find((entry) => entry.id === run?.workflowId)
  );
  const sorted = $derived(
    run
      ? [...run.steps].sort(
          (a, b) =>
            +(a.startedAt ? new Date(a.startedAt) : Number.MAX_SAFE_INTEGER) -
            +(b.startedAt ? new Date(b.startedAt) : Number.MAX_SAFE_INTEGER)
        )
      : []
  );
  const step = $derived(run?.steps.find((entry) => entry.id === selected));
  const node = $derived(
    run?.graph?.nodes.find((entry) => entry.id === step?.nodeId)
  );
  const attempts = $derived(
    run?.attempts
      .filter((entry) => entry.stepId === step?.id)
      .sort((a, b) => a.number - b.number) ?? []
  );
  const waiting = $derived(
    run?.steps.filter(
      (entry) => entry.kind === "ask" && entry.status === "waiting"
    ) ?? []
  );
  const live = $derived(whiffle.hub === "connected");
  const graph = $derived.by(() => {
    if (!run || scope === "root") {
      return run?.graph;
    }
    const id = scope.slice(0, scope.lastIndexOf("["));
    const map = run.graph?.nodes.find((entry) => entry.id === id);
    return map?.kind === "map" ? map.body : run.graph;
  });
  const scopedSteps = $derived(
    scope === "root"
      ? sorted.filter((entry) => entry.mapIndex === null)
      : sorted.filter(
          (entry) =>
            entry.mapIndex ===
              Number(scope.slice(scope.lastIndexOf("[") + 1, -1)) &&
            graph?.nodes.some((item) => item.id === entry.nodeId)
        )
  );
  $effect(() => {
    const id = runId;
    refreshWorkflowRun(id).catch((caught) => {
      errorMessage = message(caught);
    });
  });
  $effect(() => {
    // Narrow shows the drawer as a modal sheet; opening one unasked on arrival
    // would bury the run behind a dialog the operator never opened.
    if (run?.status === "done" && !(selectedEnd || narrow.current)) {
      selectedEnd = true;
      selected = run.steps.find(
        (entry) => entry.kind === "end" && entry.status === "passed"
      )?.id;
    }
  });
  onMount(() => {
    const timer = setInterval(() => {
      now = Date.now();
    }, 1000);
    return () => clearInterval(timer);
  });
  $effect(() => {
    const current = run;
    if (current) {
      untrack(refreshCosts);
    }
  });
  function refreshCosts() {
    fetch("/api/usage/summary?groupBy=session")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(await response.text());
        }
        const summary = (await response.json()) as UsageSummary;
        sessionCosts = Object.fromEntries(
          summary.rows.map((row) => [String(row.key), row.costUsd])
        );
      })
      .catch((caught) => {
        errorMessage = message(caught);
      });
  }
  function question(askNode: Extract<WorkflowNode, { kind: "ask" }>) {
    if (!run) {
      return { question: "", options: [] };
    }
    const context = {
      inputs: run.inputs,
      workspace: run.workspace,
      steps: Object.fromEntries(
        run.steps.map((entry) => [entry.nodeId, { result: entry.result }])
      ),
      attempt: { number: 1, previousError: "", gateFindings: [] },
      supervisor: { note: "" },
    };
    try {
      return {
        question: renderPrompt(askNode.question, context),
        options: askNode.options.map((option) => ({
          ...option,
          label: renderPrompt(option.label, context),
        })),
      };
    } catch (caught) {
      return { question: message(caught), options: [] };
    }
  }
  async function act(action: () => Promise<unknown>) {
    busy = true;
    errorMessage = "";
    try {
      await action();
      await refreshWorkflowRun(runId);
    } catch (caught) {
      errorMessage = message(caught);
    } finally {
      busy = false;
    }
  }
  async function cancel() {
    const names = sorted
      .filter((entry) => entry.status === "running" && entry.instanceId)
      .map(
        (entry) =>
          `${run?.graph?.nodes.find((item) => item.id === entry.nodeId)?.title ?? entry.nodeId} (${entry.instanceId})`
      );
    if (
      await confirm({
        title: "Cancel workflow run?",
        body: `Stops these live sessions and any child runs: ${names.length ? names.join(", ") : "No live step sessions reported"}. Pending steps will be skipped.`,
        confirmLabel: "Cancel run",
        destructive: true,
      })
    ) {
      await act(() => cancelWorkflowRun(runId));
    }
  }
  async function rerun() {
    if (!(step && run)) {
      return;
    }
    const selectedNode = step.nodeId;
    const { workflowId } = run;
    await act(async () => {
      const result = await rerunWorkflow(runId, selectedNode);
      await goto(`/workflows/${workflowId}/runs/${result.runId}`);
    });
  }
</script>
{#snippet drawer()}
  {#if step && run}
    <div class="wf wf-stack drawer">
      <div class="wf-row wf-spread">
        <h2>{node?.title ?? step.nodeId}</h2>
        <WorkflowStatus status={step.status} />
      </div>
      <p class="wf-muted">
        {#if node?.kind === 'step'}
          Attempt
          {attempts.at(-1)?.number ?? 0}/{(node.retries ?? 2) + 1}
          ·
          {duration(step.startedAt, step.endedAt, now)}
          ·
          {step.instanceId && costs[step.instanceId] !== undefined ? `$${costs[step.instanceId].toFixed(4)}` : 'Cost unreported'}
        {:else}
          {duration(step.startedAt, step.endedAt, now)}
        {/if}
      </p>
      {#if attempts.at(-1)?.renderedPrompt}
        <section class="wf-stack">
          <h3>Told</h3>
          <pre class="wf-well">{attempts.at(-1)?.renderedPrompt}</pre>
        </section>
      {/if}
      <section class="wf-stack">
        <h3>Returned</h3>
        {#if step.failure}
          <p class="wf-error">Step failed: {step.failure}</p>
        {:else}
          <pre
            class="wf-well"
          >{JSON.stringify(step.kind === 'end' ? run.result : step.result, null, 2) ?? 'No result reported.'}</pre>
        {/if}
      </section>
      {#if step.instanceId}
        <a class="wf-btn" href="/session/{step.instanceId}">Open session</a>
      {/if}
      {#if step.childRunId && workflowState.runs[step.childRunId]}
        {@const child = workflowState.runs[step.childRunId]}
        <div class="wf-row">
          <WorkflowStatus status={child.status} />
          <a class="wf-btn" href="/workflows/{child.workflowId}/runs/{child.id}"
            >Open child run</a
          >
        </div>
      {/if}
      {#if attempts.length}
        <h3>Attempts</h3>
      {/if}
      {#each attempts as attempt (attempt.id)}
        <details class="wf-well">
          <summary>
            Attempt {attempt.number} ·
            {duration(attempt.startedAt, attempt.endedAt, now)}
          </summary>
          <h3>Told</h3>
          <pre>{attempt.renderedPrompt}</pre>
          <h3>Returned</h3>
          <pre
          >{attempt.failure ?? JSON.stringify(attempt.result, null, 2)}</pre>
        </details>
      {/each}
      {#if step.kind !== 'start'}
        <button
          class="wf-btn"
          disabled={busy || !live}
          onclick={rerun}
          type="button"
        >
          Re-run from step
        </button>
      {/if}
      <button
        class="wf-btn"
        onclick={() => { selected = undefined; }}
        type="button"
      >
        Close step
      </button>
    </div>
  {/if}
{/snippet}
<div class="wf run-view">
  {#if errorMessage}
    <p class="wf-error" role="alert">{errorMessage}</p>
  {/if}
  {#if !run}
    <div
      aria-label="Loading workflow run"
      class="wf-stack loading"
      role="status"
    >
      <div class="wf-skeleton"></div>
      <div class="wf-skeleton"></div>
      <p>Loading workflow run…</p>
    </div>
  {:else}
    <header class="wf-stack">
      <div class="wf-row wf-spread">
        <div>
          <a class="wf-muted" href="/workflows/{run.workflowId}"
            >{workflow?.name ?? 'Workflow'}</a
          >
          <h1>Workflow run {run.id.slice(0, 8)}</h1>
        </div>
        <WorkflowStatus status={run.status} />
      </div>
      <div class="wf-row wf-spread">
        <div class="wf-row">
          {#if run.status === 'running' || run.status === 'waiting'}
            <button
              class="wf-btn"
              disabled={busy || !live}
              onclick={cancel}
              type="button"
            >
              Cancel run
            </button>
          {/if}
          <span class="wf-muted"
            >{run.steps.filter((entry) => entry.status === 'passed').length}/{run.steps.length}
            steps passed · {duration(run.startedAt, run.endedAt, now)}</span
          >
        </div>
        {#if run.supervisorInstanceId}
          <a class="wf-btn" href="/session/{run.supervisorInstanceId}"
            >Supervisor</a
          >
        {/if}
      </div>
    </header>
    {#if !live}
      <p class="wf-band">
        Hub {whiffle.hub}. Showing the last reported state; reconnect to act.
      </p>
    {/if}
    {#if run.failure}
      <p class="wf-error">Workflow run failed: {run.failure}</p>
    {/if}
    {#each waiting as ask (ask.id)}
      {@const askNode = run.graph?.nodes.find((entry) => entry.id === ask.nodeId)}
      {#if askNode?.kind === 'ask'}
        {@const text = question(askNode)}
        <section class="answer wf-stack">
          <h2>Answer · {text.question}</h2>
          <div class="options">
            {#each text.options as option (option.label)}
              <button
                class="wf-btn"
                disabled={busy || !live}
                onclick={() => act(() => answerWorkflow(runId, ask.id, option.label, note))}
                type="button"
              >
                <span>{option.label}</span>
                {#if option.description}
                  <small>{option.description}</small>
                {/if}
              </button>
            {/each}
          </div>
          <label>Note (optional)<input bind:value={note}></label>
          {#if askNode.allowOther}
            <div class="wf-row">
              <label>Other answer<input bind:value={other}></label
              ><button
                class="wf-btn"
                disabled={!other || busy || !live}
                onclick={() => act(() => answerWorkflow(runId, ask.id, other, note))}
                type="button"
              >
                Send answer
              </button>
            </div>
          {/if}
        </section>
      {/if}
    {/each}
    {#if narrow.current}
      <div class="wf-row tabs">
        <button
          aria-pressed={tab === 'steps'}
          class="wf-btn"
          onclick={() => { tab = 'steps'; }}
          type="button"
        >
          Steps
        </button><button
          aria-pressed={tab === 'canvas'}
          class="wf-btn"
          onclick={() => { tab = 'canvas'; }}
          type="button"
        >
          Canvas
        </button>
      </div>
    {/if}
    <div class="run-body">
      {#if !narrow.current || tab === 'steps'}
        <aside class="steps" class:collapsed={!(stepsOpen || narrow.current)}>
          {#if !narrow.current}
            <button
              aria-expanded={stepsOpen}
              class="wf-btn"
              onclick={() => { stepsOpen = !stepsOpen; }}
              type="button"
            >
              Steps
            </button>
          {/if}
          {#if stepsOpen || narrow.current}
            {#each sorted as entry (entry.id)}
              <button
                class="step-row"
                onclick={() => { selected = entry.id; }}
                type="button"
                class:chosen={entry.id === selected}
              >
                <span
                  >{run.graph?.nodes.find((item) => item.id === entry.nodeId)?.title ?? entry.nodeId}{entry.mapIndex === null ? '' : ` [${entry.mapIndex}]`}</span
                ><WorkflowStatus status={entry.status} />
                <small>{duration(entry.startedAt, entry.endedAt, now)}</small>
              </button>
            {/each}
          {/if}
        </aside>
      {/if}
      {#if graph && (!narrow.current || tab === 'canvas')}
        <div class="graph">
          <label class="scope"
            >Scope<select bind:value={scope}>
              {#each Object.keys(run.edges) as key (key)}
                <option>{key}</option>
              {/each}
            </select></label
          ><WorkflowCanvas
            {costs}
            executionScope={scope}
            {graph}
            {now}
            onselect={(id) => { selected = scopedSteps.find((entry) => entry.nodeId === id)?.id; }}
            readonly
            {run}
            selection={step?.nodeId}
            steps={scopedSteps}
          />
        </div>
      {/if}
      {#if step && !narrow.current}
        <aside class="detail">{@render drawer()}</aside>
      {/if}
    </div>
  {/if}
</div>
{#if narrow.current && step}
  <Dialog.Root
    onOpenChange={(open) => { if (!open) { selected = undefined; } }}
    open
    ><Dialog.Content class="max-h-[90dvh] overflow-y-auto"
      ><Dialog.Title>Step details</Dialog.Title
      ><Dialog.Description
        >The prompt, result and attempts recorded by the
        hub.</Dialog.Description
      >{@render drawer()}</Dialog.Content
    ></Dialog.Root
  >
{/if}
<style>
  .run-view {
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;
    overflow-y: auto;
  }
  header {
    padding: var(--space-4) var(--space-5);
    border-bottom: 1px solid var(--border-divider);
  }
  header a {
    display: inline-flex;
    min-height: 24px;
    align-items: center;
  }
  .run-body {
    display: flex;
    flex: 1;
    min-height: 350px;
  }
  .steps {
    width: 232px;
    flex-shrink: 0;
    padding: var(--space-3);
    overflow-y: auto;
    border-right: 1px solid var(--border-divider);
  }
  .steps h2 {
    padding: var(--space-2);
  }
  .steps.collapsed {
    width: 86px;
  }
  .step-row {
    width: 100%;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    text-align: left;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-2);
    min-height: 60px;
    border-radius: var(--radius-control);
  }
  .step-row span {
    overflow-wrap: anywhere;
  }
  .step-row small {
    color: var(--ink-muted);
    font-variant-numeric: tabular-nums;
  }
  .step-row:hover,
  .chosen {
    background: var(--surface-hover);
  }
  .graph {
    position: relative;
    flex: 1;
    min-width: 0;
  }
  .scope {
    position: absolute;
    top: var(--space-2);
    left: var(--space-2);
    z-index: 5;
    max-width: 180px;
  }
  .detail {
    width: 340px;
    flex-shrink: 0;
    overflow-y: auto;
    border-left: 1px solid var(--border-divider);
  }
  .drawer {
    padding: var(--space-4);
  }
  .answer {
    padding: var(--space-4) var(--space-5);
    background: var(--surface-raised);
    border-bottom: 1px solid var(--border-divider);
  }
  /* The options are peers the workflow author wrote, not one recommended
     action, so none of them takes the never-flat graphite. On a waiting run
     the needs-you chip is the only thing that should be loud. */
  .options {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
  }
  .answer .options button {
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: var(--space-1);
    min-height: 44px;
    padding: var(--space-3);
    max-width: 320px;
    text-align: left;
  }
  .answer .options small {
    color: var(--ink-muted);
    font-size: var(--text-sm);
    line-height: 1.4;
    overflow-wrap: anywhere;
  }
  .tabs,
  .loading {
    padding: var(--space-4);
  }
  @media (max-width: 1023px) {
    .steps {
      width: 100%;
      border: 0;
    }
    .graph {
      min-height: 450px;
    }
    .run-body {
      min-height: 0;
    }
  }
</style>
