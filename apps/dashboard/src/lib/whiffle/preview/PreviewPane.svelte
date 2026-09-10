<script lang="ts">
  import type { PreviewSource } from "@whiffle/core";
  import { env } from "$env/dynamic/public";
  import {
    closePreview,
    hidePreview,
    openPreview,
    whiffle,
  } from "../client.svelte";

  let { instanceId }: { instanceId: string } = $props();
  let port = $state<number | undefined>(5173);
  let reload = $state(0);
  let busy = $state(false);
  let failure = $state("");
  /**
   * Every preview in this browser shares one routing cookie (hub preview.ts),
   * so a pane that loads its open URL takes the cookie from every other pane.
   * Panes tell each other over a BroadcastChannel; the one taken over says so
   * and offers to take it back.
   */
  let takenOver = $state(false);
  const preview = $derived(whiffle.previews[instanceId]);
  const source = $derived(preview?.source);
  const identity = $derived.by(() => {
    if (!source) {
      return "";
    }
    return "port" in source ? `port:${source.port}` : `dir:${source.dir}`;
  });
  const insecure = $derived(
    !env.PUBLIC_WHIFFLE_PREVIEW_ORIGIN && location.protocol === "https:"
  );

  $effect(() => {
    const channel = new BroadcastChannel("whiffle-preview");
    channel.onmessage = (event: MessageEvent<{ instanceId: string }>) => {
      takenOver = event.data.instanceId !== instanceId;
    };
    return () => channel.close();
  });

  function announce() {
    takenOver = false;
    const channel = new BroadcastChannel("whiffle-preview");
    channel.postMessage({ instanceId });
    channel.close();
  }
  const label = $derived.by(() => {
    if (!source) {
      return "Preview";
    }
    return "port" in source
      ? `localhost:${source.port}`
      : source.dir.split("/").filter(Boolean).at(-1) || "/";
  });
  const origin = $derived(
    env.PUBLIC_WHIFFLE_PREVIEW_ORIGIN ||
      `${location.protocol}//${location.hostname}:${preview?.previewPort}`
  );
  const url = $derived(preview ? `${origin}${preview.open}` : "");

  async function show(next: PreviewSource) {
    busy = true;
    failure = "";
    try {
      await openPreview(instanceId, next);
    } catch (reason) {
      failure = reason instanceof Error ? reason.message : String(reason);
    } finally {
      busy = false;
    }
  }

  async function close() {
    busy = true;
    failure = "";
    try {
      await closePreview(instanceId);
      hidePreview(instanceId);
    } catch (reason) {
      failure = reason instanceof Error ? reason.message : String(reason);
    } finally {
      busy = false;
    }
  }
</script>

<section aria-label="Preview" class="preview-pane">
  <header>
    <span class="source" title={source && 'dir' in source ? source.dir : label}
      >{label}</span
    >
    {#if preview?.state === 'open'}
      <button onclick={() => { reload += 1; }} type="button">Reload</button>
      <a href={url} rel="noopener noreferrer" target="_blank"
        >Open in new tab</a
      >
    {/if}
    <button disabled={busy} onclick={close} type="button">Close</button>
  </header>
  {#if failure}
    <p class="error" role="alert">{failure}</p>
  {/if}
  {#if preview?.state === 'open' && insecure}
    <p class="empty">
      This dashboard is served over HTTPS. Set PUBLIC_WHIFFLE_PREVIEW_ORIGIN to
      an https origin that reaches the hub's preview port ({preview.previewPort}).
    </p>
  {:else if preview?.state === 'open' && takenOver}
    <div class="empty">
      <p>Another session's preview is showing in this browser.</p>
      <button onclick={() => { reload += 1; }} type="button">Show</button>
    </div>
  {:else if preview?.state === 'open'}
    {#key `${identity}:${reload}`}
      <!-- biome-ignore lint/a11y/noNoninteractiveElementInteractions: load is the moment the routing cookie landed, not user interaction. -->
      <iframe
        allow="clipboard-write"
        onload={announce}
        src={url}
        title="Preview"
      ></iframe>
    {/key}
  {:else if preview?.state === 'closed' && source}
    <div class="empty">
      <p>Preview closed.</p>
      <button disabled={busy} onclick={() => show(source)} type="button">
        Show
      </button>
    </div>
  {:else}
    <form
      onsubmit={(event) => { event.preventDefault(); show({ port: port as number }); }}
    >
      <label
        >Port
        <input
          max="65535"
          min="1"
          required
          step="1"
          type="number"
          bind:value={port}
        ></label
      >
      <button disabled={busy} type="submit">Show</button>
    </form>
  {/if}
</section>

<style>
  .preview-pane {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    height: 100%;
    background: var(--surface-field);
  }
  header {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-bottom: 1px solid var(--border-subtle);
  }
  .source {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--ink-muted);
    font: var(--text-xs) var(--font-mono);
  }
  button,
  a,
  input {
    min-height: 34px;
    border: 1px solid var(--border-control);
    border-radius: var(--radius-control);
    padding: var(--space-1) var(--space-2);
    background: var(--surface-raised);
    color: var(--ink-body);
    font-size: var(--text-xs);
  }
  button,
  a {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    text-decoration: none;
  }
  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  button:focus-visible,
  a:focus-visible,
  input:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
  iframe {
    flex: 1;
    width: 100%;
    min-height: 0;
    border: 0;
  }
  form,
  .empty {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-3);
    padding: var(--space-4);
    color: var(--ink-muted);
    font-size: var(--text-sm);
  }
  label {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  input {
    width: 8ch;
  }
  .error {
    padding: var(--space-3);
    color: var(--data-bad);
    font-size: var(--text-sm);
  }
  @media (hover: hover) {
    button:hover,
    a:hover {
      background: var(--surface-hover);
    }
  }
  @media (pointer: coarse) {
    button,
    a,
    input {
      min-height: 44px;
    }
  }
</style>
