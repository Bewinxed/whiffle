<script lang="ts">
  import Reveal from "$lib/whiffle/motion/Reveal.svelte";
  import { lightbox } from "./lightbox-state.svelte";

  let {
    src,
    alt,
    caption,
    path,
    size = "card",
  }: {
    src: string;
    alt: string;
    caption?: string;
    path?: string;
    size?: "thumb" | "card";
  } = $props();

  let loaded = $state<string>();
  let failed = $state<string>();
</script>

<Reveal block>
  <figure class:thumb={size === 'thumb'}>
    {#if failed === src}
      <div class="box missing">
        <span>Image not available</span>
        {#if path}
          <span class="path">{path}</span>
        {/if}
      </div>
    {:else}
      <button
        aria-label={`Open ${alt}`}
        class="box"
        onclick={() => lightbox.open({ src, alt, caption, path })}
        type="button"
      >
        {#if loaded !== src}
          <span aria-hidden="true" class="skeleton"></span>
        {/if}
        <!-- biome-ignore lint/a11y/noNoninteractiveElementInteractions: image load/error lifecycle events; the containing button owns interaction. -->
        <img
          {alt}
          decoding="async"
          loading="lazy"
          onerror={() => { failed = src; }}
          onload={() => { loaded = src; }}
          {src}
          class:loaded={loaded === src}
        >
      </button>
    {/if}
    {#if caption || path}
      <figcaption>
        {#if caption}
          <span>{caption}</span>
        {/if}
        {#if path}
          <span class="path">{path}</span>
        {/if}
      </figcaption>
    {/if}
  </figure>
</Reveal>

<style>
  figure {
    margin: 0;
    width: 100%;
    max-width: 100%;
  }
  .box {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    width: 100%;
    height: 240px;
    padding: 0;
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-sm);
    overflow: hidden;
    background: transparent;
    color: var(--ink-muted);
  }
  button {
    cursor: pointer;
  }
  button:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
  img {
    display: block;
    max-width: 100%;
    max-height: 240px;
    object-fit: contain;
    opacity: 0;
    filter: blur(6px);
    transition:
      opacity calc(var(--dur-control) * 3) var(--ease-out),
      filter calc(var(--dur-control) * 3) var(--ease-out);
  }
  img.loaded {
    opacity: 1;
    filter: blur(0);
  }
  .skeleton {
    position: absolute;
    inset: 0;
    background: var(--surface-recess);
    animation: pulse calc(var(--dur-control) * 10) var(--ease-out) infinite
      alternate;
  }
  .missing {
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    padding: var(--space-3);
    background: var(--surface-recess);
    font-size: var(--text-meta);
  }
  .path {
    font-family: var(--font-mono);
    overflow-wrap: anywhere;
  }
  figcaption {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin-top: var(--space-2);
    font-size: var(--text-meta);
    color: var(--ink-muted);
  }
  .thumb .box {
    width: 48px;
    height: 48px;
  }
  .thumb {
    width: 48px;
  }
  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  @keyframes pulse {
    from {
      opacity: 0.4;
    }
    to {
      opacity: 1;
    }
  }
</style>
