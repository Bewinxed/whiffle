<script lang="ts">
  import type { PreviewElement, PreviewSource } from "@whiffle/core";
  import { env } from "$env/dynamic/public";
  import {
    closePreview,
    commandRecord,
    hidePreview,
    openPreview,
    type SendExtras,
    whiffle,
  } from "../client.svelte";
  import { previewElement, previewError, previewPng, previewUrl } from "./wire";

  let {
    instanceId,
    machineId,
    onsubmit,
    sending,
  }: {
    instanceId: string;
    machineId: string | undefined;
    onsubmit: (text: string, extras: SendExtras) => Promise<string | undefined>;
    sending: boolean;
  } = $props();
  let iframe = $state<HTMLIFrameElement>();
  let selecting = $state(false);
  let connected = $state(false);
  let currentUrl = $state("");
  let comment = $state("");
  let selections = $state<{ element: PreviewElement; png: string | null }[]>(
    []
  );
  let submitting = $state(false);
  let commandId = $state<string>();
  const record = $derived(commandId ? commandRecord(commandId) : null);
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
    connected = false;
    post({ type: "whiffle:hello" });
  }
  /**
   * Where the frame is, in one line: the source the preview was opened on,
   * then the path the app has navigated to inside it. The path comes from the
   * overlay's `whiffle:ready` / `whiffle:navigated`, so a static directory or
   * a page that has not answered yet shows the source alone.
   */
  const label = $derived.by(() => {
    if (!source) {
      return "Preview";
    }
    const base =
      "port" in source
        ? `localhost:${source.port}`
        : source.dir.split("/").filter(Boolean).at(-1) || "/";
    if (!currentUrl) {
      return base;
    }
    const { pathname, search, hash } = new URL(currentUrl);
    const path = `${pathname}${search}${hash}`;
    return path === "/" ? base : `${base}${path}`;
  });
  const origin = $derived(
    env.PUBLIC_WHIFFLE_PREVIEW_ORIGIN ||
      `${location.protocol}//${location.hostname}:${preview?.previewPort}`
  );
  const url = $derived(preview ? `${origin}${preview.open}` : "");
  const previewOrigin = $derived(new URL(origin).origin);
  const SELECTIONS_MAX = 12;

  /** Which document the iframe holds: the source it shows, and how often it was reloaded. */
  const frameKey = $derived(`${identity}:${reload}`);

  // A frame being replaced or reloaded has no overlay listening yet; Select
  // waits for the new document's ready rather than posting into the gap
  // between the old page going and the new one answering.
  $effect(() => {
    if (frameKey) {
      connected = false;
    }
  });

  function post(message: object) {
    iframe?.contentWindow?.postMessage(message, previewOrigin);
  }

  function select(on: boolean) {
    selecting = on;
    post({ type: "whiffle:mode", mode: on ? "select" : "off" });
  }

  /**
   * One click in select mode. A click that lands while a send is in flight,
   * or after Select was left, is not a selection; the same element twice is
   * one selection; and the list stops growing at what one turn can use.
   */
  function selected(message: {
    element?: unknown;
    png?: unknown;
    error?: unknown;
  }) {
    const open =
      selecting &&
      !submitting &&
      !commandId &&
      selections.length < SELECTIONS_MAX;
    const element = open
      ? previewElement(message.element, previewOrigin)
      : null;
    if (element) {
      const known = selections.some(
        (entry) =>
          entry.element.url === element.url &&
          entry.element.selector === element.selector
      );
      if (!known) {
        selections.push({ element, png: previewPng(message.png) });
      }
    }
    const error = previewError(message.error);
    if (error) {
      failure = error;
    }
  }

  /**
   * Messages from the frame. The source and origin checks say which window
   * is talking; they cannot say whether the overlay or the app sharing its
   * window sent a message, so every payload goes through `wire.ts` before it
   * touches state (see the note there).
   */
  function receive(event: MessageEvent) {
    if (
      event.source !== iframe?.contentWindow ||
      event.origin !== previewOrigin
    ) {
      return;
    }
    const message = event.data;
    switch (message?.type) {
      case "whiffle:ready": {
        // The overlay's first ready, sent before it knows who to talk to,
        // carries no URL; the answer is a hello so it learns our origin.
        if (message.url === undefined) {
          post({ type: "whiffle:hello" });
          return;
        }
        const at = previewUrl(message.url, previewOrigin);
        if (at) {
          connected = true;
          currentUrl = at;
          select(selecting);
        }
        break;
      }
      case "whiffle:navigated": {
        const at = previewUrl(message.url, previewOrigin);
        if (at) {
          currentUrl = at;
        }
        break;
      }
      case "whiffle:selected":
        selected(message);
        break;
      case "whiffle:escape":
        selecting = false;
        break;
      case "whiffle:error": {
        const error = previewError(message.message);
        if (error) {
          failure = error;
        }
        break;
      }
      default:
        break;
    }
  }

  $effect(() => {
    if (record?.stage === "accepted" || record?.stage === "applied") {
      selections = [];
      comment = "";
      select(false);
      commandId = undefined;
    } else if (record?.stage === "failed") {
      failure = record.reason || "The selection could not be sent.";
      commandId = undefined;
    }
  });

  async function sendSelection() {
    submitting = true;
    failure = "";
    try {
      await submitSelection();
    } finally {
      submitting = false;
    }
  }

  async function submitSelection() {
    const sections = selections.map(({ element: el }, index) => {
      const { source: metadata } = el;
      const location = metadata?.file
        ? `${metadata.file}:${metadata.line ?? "?"}:${metadata.column ?? "?"} (${metadata.framework}, ${metadata.of})`
        : `unknown (the app exposes no dev source metadata)${metadata?.component ? `; component: ${metadata.component} (${metadata.framework}, ${metadata.of})` : ""}`;
      const style = el.styles;
      // A fence longer than anything captured keeps app HTML inside its code block.
      const fence = "`".repeat(
        Math.max(
          3,
          ...Array.from(el.html.matchAll(/`+/g), ([match]) => match.length + 1)
        )
      );
      return `## ${index + 1}. ${el.selector}\n- source: ${location}\n- url: ${el.url}\n- size: ${el.rect.width}×${el.rect.height} at (${el.page.x},${el.page.y}) in the page\n- text: ${JSON.stringify(el.text)}\n- styles: color ${style.color}; background ${style.backgroundColor}; font ${style.fontFamily} ${style.fontSize}/${style.lineHeight} ${style.fontWeight}\n\n${fence}html\n${el.html}\n${fence}`;
    });
    const extras: SendExtras = {
      attachments: [
        {
          kind: "text",
          name: "selection.md",
          content: `# Selected in the preview (${currentUrl})\n\n${sections.join("\n\n")}`,
        },
      ],
      images: selections.flatMap(({ png }) =>
        png ? [{ mediaType: "image/png", data: png }] : []
      ),
    };
    commandId = await onsubmit(
      comment.trim() ||
        `Look at the selected element${selections.length === 1 ? "" : "s"}.`,
      extras
    );
  }

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

<svelte:window onmessage={receive} />

<section aria-label="Preview" class="preview-pane">
  <header>
    <span
      class="source"
      title={currentUrl || (source && 'dir' in source ? source.dir : label)}
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
    <div class="mode-bar">
      <button
        aria-pressed={selecting}
        disabled={!connected || submitting || !!commandId}
        onclick={() => select(!selecting)}
        type="button"
      >
        Select
      </button>
      <textarea
        aria-label="What should change?"
        disabled={submitting || !!commandId}
        placeholder="What should change?"
        rows="1"
        bind:value={comment}
      ></textarea>
      <button
        disabled={!machineId || sending || submitting || !!commandId || selections.length === 0}
        onclick={sendSelection}
        type="button"
      >
        Send
      </button>
    </div>
    {#if selections.length}
      <ul aria-label="Selected elements" class="selections">
        {#each selections as selection (`${selection.element.url}:${selection.element.selector}`)}
          {@const el = selection.element}
          <li>
            {#if selection.png}
              <img alt="" src={`data:image/png;base64,${selection.png}`}>
            {/if}
            <span class="selection-label">
              <span
                class="selection-name"
                title={`${el.tag}${el.id ? `#${el.id}` : ''}${el.classes.map(name => `.${name}`).join('')}`}
                >{`${el.tag}${el.id ? `#${el.id}` : ''}${el.classes.length ? `.${el.classes[0]}` : ''}`}</span
              >
              {#if el.source?.file}
                <span class="selection-source"
                  >{el.source.file}:{el.source.line ?? '?'}</span
                >
              {/if}
            </span>
            <button
              aria-label="Remove"
              disabled={submitting || !!commandId}
              onclick={() => { selections = selections.filter(item => item !== selection); }}
              type="button"
            >
              Remove
            </button>
          </li>
        {/each}
      </ul>
    {/if}
    {#key frameKey}
      <!-- biome-ignore lint/a11y/noNoninteractiveElementInteractions: load is the moment the routing cookie landed, not user interaction. -->
      <iframe
        allow="clipboard-write"
        onload={announce}
        src={url}
        title="Preview"
        bind:this={iframe}
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
  input,
  textarea {
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
  textarea:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
  .mode-bar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-bottom: 1px solid var(--border-subtle);
  }
  textarea {
    flex: 1;
    min-inline-size: 0;
    resize: vertical;
    font-family: var(--font-body);
    caret-color: var(--ink-strong);
  }
  textarea::placeholder {
    color: var(--ink-muted);
  }
  button[aria-pressed="true"] {
    background: var(--surface-active);
    border-color: var(--ink-muted);
  }
  .selections {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    margin: 0;
    list-style: none;
    max-block-size: 25%;
    overflow-y: auto;
    flex-shrink: 0;
  }
  .selections li {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1);
    min-inline-size: 0;
    max-inline-size: 100%;
    border: 1px solid var(--border-control);
    border-radius: var(--radius-control);
    background: var(--surface-raised);
  }
  .selections img {
    inline-size: var(--space-8);
    block-size: var(--space-8);
    object-fit: contain;
    flex-shrink: 0;
  }
  .selections button {
    flex-shrink: 0;
  }
  .selection-label {
    min-inline-size: 0;
    overflow-wrap: anywhere;
    color: var(--ink-body);
    font: var(--text-xs) var(--font-mono);
  }
  .selection-source {
    display: block;
    color: var(--ink-muted);
  }
  .selection-name {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
    input,
    textarea {
      min-height: 44px;
    }
  }
</style>
