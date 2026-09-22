<script lang="ts">
  import type { Workflow } from "@whiffle/core";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import WorkflowLaunch from "$lib/components/features/workflows/WorkflowLaunch.svelte";
  import WorkflowStatus from "$lib/components/features/workflows/WorkflowStatus.svelte";
  import { newNode } from "$lib/components/features/workflows/workflow-ui";
  import { formatDistanceToNow } from "$lib/utils/time";
  import { whiffle } from "$lib/whiffle/client.svelte";
  import { message } from "$lib/whiffle/delegate-types";
  import {
    refreshWorkflows,
    workflowState,
  } from "$lib/whiffle/workflow-state.svelte";
  import { createWorkflow } from "$lib/whiffle/workflows";
  import "$lib/components/features/workflows/workflows.css";

  let loading = $state(true);
  let busy = $state(false);
  let errorMessage = $state("");
  let launch = $state<Workflow>();
  const live = $derived(whiffle.hub === "connected");
  const rows = $derived(
    workflowState.workflows.map((workflow) => {
      const runs = Object.values(workflowState.runs)
        .filter((run) => run.workflowId === workflow.id)
        .sort((a, b) => +new Date(b.startedAt) - +new Date(a.startedAt));
      return { workflow, runs, last: runs[0] };
    })
  );
  onMount(() => {
    refreshWorkflows().finally(() => {
      loading = false;
    });
  });
  async function create() {
    busy = true;
    errorMessage = "";
    try {
      const workflow = await createWorkflow({
        name: "Untitled workflow",
        graph: { nodes: [newNode("start")], edges: [] },
      });
      await goto(`/workflows/${workflow.id}`);
    } catch (caught) {
      errorMessage = message(caught);
    } finally {
      busy = false;
    }
  }
</script>
<svelte:head><title>Workflows · Whiffle</title></svelte:head>
<div class="wf list-page">
  <header class="wf-row wf-spread">
    <div>
      <h1>Workflows</h1>
      <p class="wf-muted">Reusable steps across your fleet.</p>
    </div>
    <div class="wf-row">
      <button
        class="wf-btn wf-primary"
        disabled={!live || busy}
        onclick={() => create()}
        type="button"
      >
        New workflow
      </button>
    </div>
  </header>
  {#if !live}
    <p class="wf-band">
      The hub is {whiffle.hub}. Reconnect to create or run a workflow.
    </p>
  {/if}
  {#if errorMessage || workflowState.error}
    <p class="wf-error" role="alert">{errorMessage || workflowState.error}</p>
  {/if}
  {#if loading}
    <p class="wf-muted" role="status">Loading workflows…</p>
  {:else if !rows.length}
    <section class="empty">
      <h2>No workflows yet.</h2>
      <p>
        A workflow is a graph of steps that run one after another across your
        fleet.
      </p>
      <button
        class="wf-btn wf-primary"
        disabled={!live || busy}
        onclick={() => create()}
        type="button"
      >
        New workflow
      </button>
    </section>
  {:else}
    <table aria-label="Workflows" class="table">
      <thead>
        <tr class="heading">
          <th scope="col">Name</th>
          <th scope="col">Last run</th>
          <th scope="col">Started</th>
          <th scope="col">Runs</th>
          <th scope="col">Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each rows as { workflow, runs, last } (workflow.id)}
          <tr class="workflow-row">
            <td>
              <a class="name" href="/workflows/{workflow.id}"
                >{workflow.name}
                <span class="wf-muted">{workflow.description}</span></a
              >
            </td>
            <td>
              {#if last}
                <WorkflowStatus status={last.status} />
              {:else}
                <span class="wf-muted">No runs</span>
              {/if}
            </td>
            <td class="age wf-muted">
              {last ? formatDistanceToNow(new Date(last.startedAt)) : '—'}
              <span class="mobile"
                >{` · ${runs.length} ${runs.length === 1 ? 'run' : 'runs'}`}</span
              >
            </td>
            <td class="count">{runs.length}</td>
            <td>
              <button
                class="wf-btn desktop"
                disabled={!live}
                onclick={() => { launch = workflow; }}
                type="button"
              >
                Run
              </button>
              <details class="mobile">
                <summary aria-label="Actions for {workflow.name}">
                  Actions
                </summary>
                <button
                  class="wf-btn"
                  disabled={!live}
                  onclick={() => { launch = workflow; }}
                  type="button"
                >
                  Run
                </button>
              </details>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>
{#if launch}
  <WorkflowLaunch onclose={() => { launch = undefined; }} workflow={launch} />
{/if}
<style>
  .list-page {
    padding: var(--space-7) var(--space-6);
    overflow-y: auto;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }
  header h1 {
    margin-bottom: var(--space-1);
  }
  .table {
    display: block;
    width: 100%;
    background: var(--surface-raised);
    border-radius: var(--radius-panel);
    padding: var(--space-3);
    box-shadow: var(--shadow-tile);
  }
  .heading,
  .workflow-row {
    display: grid;
    grid-template-columns: minmax(180px, 1fr) 110px 110px 60px 70px;
    gap: var(--space-3);
    align-items: center;
    padding: var(--space-3);
  }
  .heading {
    text-align: left;
    font-size: var(--text-sm);
    color: var(--ink-muted);
  }
  .workflow-row {
    border-top: 1px solid var(--border-hairline);
    min-height: 64px;
  }
  th {
    font-weight: 500;
  }
  .name {
    min-height: 24px;
    display: grid;
    color: var(--ink-strong);
    font-weight: 500;
    overflow-wrap: anywhere;
  }
  .count {
    font-variant-numeric: tabular-nums;
  }
  .empty {
    margin: auto;
    max-width: 420px;
    display: grid;
    justify-items: start;
    gap: var(--space-4);
    padding-block: var(--space-8);
  }
  .mobile {
    display: none;
  }
  @media (max-width: 760px) {
    .heading,
    .desktop {
      display: none !important;
    }
    span.mobile {
      display: inline;
    }
    details.mobile {
      display: block;
    }
    .count {
      display: none;
    }
    thead,
    tbody {
      display: block;
      width: 100%;
    }
    .workflow-row {
      grid-template-columns: 1fr auto;
    }
    .name {
      grid-column: 1;
    }
    .age {
      grid-column: 1;
    }
    .workflow-row > :last-child {
      grid-column: 2;
      grid-row: 2;
    }
    summary {
      min-height: 44px;
      display: flex;
      align-items: center;
    }
    .list-page {
      padding: var(--space-4);
    }
  }
</style>
