<script lang="ts">
  import {
    IconClose,
    IconCursor,
    IconExternalLink,
    IconRefresh,
  } from "$lib/icons";
  import { closePreview, whiffle } from "../client.svelte";
  import type { CapturedSelection } from "./selection";
  import {
    previewElement,
    previewError,
    previewPng,
    previewTitle,
    previewUrl,
  } from "./wire";

  let {
    instanceId,
    onselect,
    onescape,
  }: {
    instanceId: string;
    onselect: (
      selection: CapturedSelection
    ) => "added" | "duplicate" | "full" | undefined;
    onescape: () => boolean;
  } = $props();
  let iframe = $state<HTMLIFrameElement>();
  let selecting = $state(false);
  let connected = $state(false);
  let captured = false;
  let reload = $state(0);
  let failure = $state("");
  let well = $state<HTMLDivElement>();
  const preview = $derived(whiffle.previews[instanceId]);
  const source = $derived(preview?.source);
  const identity = $derived(JSON.stringify(source));
  /** The base preview URL (always under /preview/<id>/). */
  const previewBase = $derived(
    whiffle.previews[instanceId]
      ? `/preview/${encodeURIComponent(instanceId)}/`
      : ""
  );
  /** Iframe src uses the base; the header shows the app's own path. */
  const url = $derived(previewBase);
  let displayPath = $state("");
  const title = $derived(
    preview?.title ||
      (connected && source && "dir" in source
        ? source.dir.split("/").filter(Boolean).at(-1)
        : "Preview") ||
      "Preview"
  );
  const frameKey = $derived(`${identity}:${reload}`);

  $effect(() => {
    if (frameKey) {
      connected = false;
      captured = false;
    }
  });
  function post(message: object) {
    iframe?.contentWindow?.postMessage(message, location.origin);
  }
  function announce() {
    connected = false;
    post({ type: "whiffle:hello" });
  }
  function select(on: boolean) {
    selecting = on;
    post({ type: "whiffle:mode", mode: on ? "select" : "off" });
  }
  export function parentEscape(event: KeyboardEvent) {
    if (
      event.key !== "Escape" ||
      event.defaultPrevented ||
      (event.target instanceof Element && event.target.closest("dialog[open]"))
    ) {
      return;
    }
    if (onescape()) {
      event.preventDefault();
      return;
    }
    if (selecting) {
      select(false);
      event.preventDefault();
    }
  }
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: one validated dispatch for the overlay's wire protocol.
  function receive(event: MessageEvent) {
    if (
      event.source !== iframe?.contentWindow ||
      event.origin !== location.origin
    ) {
      return;
    }
    const message = event.data;
    switch (message?.type) {
      case "whiffle:ready":
      case "whiffle:navigated": {
        if (message.type === "whiffle:ready" && message.url === undefined) {
          post({ type: "whiffle:hello" });
          return;
        }
        const at = previewUrl(message.url, location.origin);
        if (!at) {
          return;
        }
        const parsed = new URL(at);
        displayPath = `${parsed.pathname}${parsed.search}${parsed.hash}`;
        preview.title = previewTitle(message.title) ?? "";
        if (message.type === "whiffle:ready") {
          connected = true;
          select(selecting);
          if (!captured) {
            captured = true;
            post({ type: "whiffle:capture" });
          }
        }
        break;
      }
      case "whiffle:capture": {
        const png = previewPng(message.png);
        if (png) {
          preview.thumbnail = png;
        }
        const error = previewError(message.error);
        if (error) {
          failure = error;
        }
        break;
      }
      case "whiffle:selected": {
        if (!selecting) {
          return;
        }
        const element = previewElement(message.element, location.origin);
        if (
          well &&
          element &&
          onselect({
            element,
            png: previewPng(message.png),
            note: "",
            scale: Math.min(2, devicePixelRatio),
          }) === "full"
        ) {
          const style = getComputedStyle(well);
          well?.animate(
            [
              { outlineColor: style.getPropertyValue("--accent") },
              { outlineColor: style.getPropertyValue("--focus-ring") },
              { outlineColor: style.getPropertyValue("--accent") },
            ],
            {
              duration: matchMedia("(prefers-reduced-motion: reduce)").matches
                ? 1
                : Number.parseFloat(style.getPropertyValue("--c-300")),
            }
          );
        }
        const error = previewError(message.error);
        if (error) {
          failure = error;
        }
        break;
      }
      case "whiffle:escape":
        select(false);
        break;
      case "whiffle:error":
        failure = previewError(message.message) ?? "";
        break;
      default:
        break;
    }
  }
  async function close() {
    try {
      await closePreview(instanceId);
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
    }
  }
</script>

<svelte:window onkeydown={parentEscape} onmessage={receive} />

<section aria-label="Preview" class="preview-pane" class:selecting>
  <header>
    <div class="identity">
      <span class="title">{title}</span
      ><span class="path"
        >{displayPath || (source && 'dir' in source ? source.dir.split('/').filter(Boolean).at(-1) : '')}</span
      >
    </div>
    <button
      aria-pressed={selecting}
      disabled={!connected}
      onclick={() => select(!selecting)}
      title="Select"
      type="button"
    >
      <IconCursor /><span class="select-label">Select</span>
    </button>
    <button
      aria-label="Reload"
      class="other"
      onclick={() => { reload += 1; }}
      title="Reload"
      type="button"
    >
      <IconRefresh />
    </button>
    <a
      aria-label="Open in new tab"
      class="other"
      href={url}
      rel="noopener noreferrer"
      target="_blank"
      title="Open in new tab"
      ><IconExternalLink /></a
    >
    <button
      aria-label="Close"
      class="other"
      onclick={close}
      title="Close"
      type="button"
    >
      <IconClose />
    </button>
  </header>
  <div class="well" bind:this={well}>
    {#key frameKey}
      <!-- biome-ignore lint/a11y/noNoninteractiveElementInteractions: load starts the overlay handshake. -->
      <iframe
        allow="clipboard-write"
        onload={announce}
        src={url}
        title="Preview"
        bind:this={iframe}
        class:ready={connected}
      ></iframe>
    {/key}
    <div aria-hidden="true" class="skeleton" class:ready={connected}>
      <span></span>
    </div>
    {#if failure}
      <p class="error" role="alert">{failure}</p>
    {/if}
  </div>
</section>

<style>
  .preview-pane {
    container-type: inline-size;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    height: 100%;
    padding: 0 var(--space-2) var(--space-2);
    background: var(--surface-raised);
    border-radius: var(--radius-panel);
    box-shadow: var(--shadow-drawer);
  }
  header {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    height: 44px;
    flex-shrink: 0;
  }
  .identity {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    padding-left: var(--space-1);
  }
  .title,
  .path {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .title {
    color: var(--ink-body);
    font-size: var(--text-base);
    font-weight: var(--weight-medium);
  }
  .path {
    color: var(--ink-muted);
    font: var(--text-xs) var(--font-mono);
  }
  button,
  a {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-1);
    min-width: 30px;
    height: 30px;
    padding: 0 var(--space-2);
    border: 0;
    border-radius: var(--radius-control);
    color: var(--ink-muted);
    background: transparent;
    cursor: pointer;
    text-decoration: none;
    font: inherit;
    font-size: var(--text-sm);
    transition:
      background-color var(--c-100) var(--e-in),
      color var(--c-100) var(--e-in),
      transform var(--c-100) var(--e-in),
      opacity var(--c-100) var(--e-toggle);
  }
  button :global(svg),
  a :global(svg) {
    width: 17px;
    height: 17px;
  }
  button:focus-visible,
  a:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
  button:active,
  a:active {
    transform: scale(0.96);
  }
  button[aria-pressed="true"] {
    background: var(--surface-active);
    color: var(--ink-strong);
  }
  button:disabled,
  .selecting .other {
    opacity: 0.5;
  }
  .well {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow: hidden;
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-well);
    background: var(--surface-field);
    outline: 2px solid transparent;
    transition: outline-color var(--c-100) var(--e-toggle);
  }
  .selecting .well {
    outline-color: var(--accent);
    cursor: crosshair;
  }
  iframe {
    color-scheme: light;
    background: Canvas;
    display: block;
    width: 100%;
    height: 100%;
    border: 0;
    opacity: 0;
    transition: opacity var(--c-100) var(--e-in);
  }
  iframe.ready {
    opacity: 1;
  }
  .skeleton {
    position: absolute;
    inset: 0;
    padding: var(--space-5);
    background: var(--surface-field);
    pointer-events: none;
    transition: opacity var(--c-100) var(--e-in);
  }
  .skeleton.ready {
    opacity: 0;
  }
  .skeleton span {
    display: block;
    width: 42%;
    height: var(--space-3);
    background: var(--surface-sunken);
    border-radius: var(--radius-mark);
  }
  .empty {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-4);
    color: var(--ink-muted);
    font-size: var(--text-sm);
  }
  .error {
    position: absolute;
    bottom: 0;
    padding: var(--space-2);
    background: var(--surface-raised);
    color: var(--data-bad);
    font-size: var(--text-sm);
  }
  @container (max-width: 469px) {
    .select-label {
      display: none;
    }
  }
  @media (hover: hover) {
    button:hover,
    a:hover {
      background: var(--surface-hover);
    }
  }
  @media (pointer: coarse) {
    button,
    a {
      min-width: 44px;
      height: 44px;
    }
  }
</style>
