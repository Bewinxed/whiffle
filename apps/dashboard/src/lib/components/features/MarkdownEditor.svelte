<script lang="ts">
  /**
   * The WYSIWYG editor behind every markdown card. Milkdown's Crepe: you edit
   * the rendered document — headings look like headings, bold is bold, code
   * blocks are code blocks — and markdown is what comes back out, because
   * markdown is Crepe's own document format rather than an export target.
   *
   * `value` stays a plain markdown string, so everything upstream (dirty
   * tracking, the save contract, the conflict diff) is unchanged.
   *
   * Crepe reaches for `document` when it is constructed, so it is imported
   * inside `onMount`: this editor never runs on the server.
   */
  import { onMount } from "svelte";
  // Structure only. Crepe's own theme files are nothing but a palette, and the
  // palette this app already has is the one below — so none is imported, and
  // there is no second light/dark theme to keep in step with the first.
  import "@milkdown/crepe/theme/common/style.css";

  let {
    value = $bindable(),
    label,
  }: {
    /** The markdown. Bound both ways: typing in the editor writes it back. */
    value: string;
    label?: string;
  } = $props();

  let host = $state<HTMLDivElement | null>(null);
  let failed = $state<string | null>(null);

  onMount(() => {
    let editor: { destroy: () => Promise<unknown> } | null = null;
    let dropped = false;

    void (async () => {
      try {
        const { Crepe } = await import("@milkdown/crepe");
        if (dropped || !host) {
          return;
        }
        const instance = new Crepe({ defaultValue: value, root: host });
        // Only a real edit writes back. Crepe does not fire this for its
        // initial parse, so opening a card and closing it again leaves
        // `value` exactly as it was read and Save stays correctly disabled.
        instance.on((api) => {
          api.markdownUpdated((_ctx, markdown) => {
            value = markdown;
          });
        });
        await instance.create();
        if (dropped) {
          await instance.destroy();
          return;
        }
        editor = instance;
      } catch (caught) {
        failed = caught instanceof Error ? caught.message : String(caught);
      }
    })();

    return () => {
      dropped = true;
      void editor?.destroy();
    };
  });
</script>

{#if failed}
  <p
    class="px-[var(--space-4)] py-[var(--space-3)] text-caption text-warning"
    role="alert"
  >
    The editor did not load: {failed}
  </p>
{/if}
<div aria-label={label} bind:this={host} class="crepe-host min-h-72"></div>

<style>
  /* Crepe's structural CSS reads these off `.milkdown` itself, so they are set
     there rather than on the host — a theme file would otherwise win by
     sitting closer to the element. Every value is an app token, so the editor
     follows light and dark with everything else. */
  .crepe-host :global(.milkdown) {
    --crepe-color-background: var(--surface-raised);
    --crepe-color-on-background: var(--ink-strong);
    --crepe-color-surface: var(--surface-raised);
    --crepe-color-surface-low: var(--surface-sunken);
    --crepe-color-on-surface: var(--ink-strong);
    --crepe-color-on-surface-variant: var(--ink-muted);
    --crepe-color-outline: var(--border-hairline);
    --crepe-color-primary: var(--accent-9);
    --crepe-color-secondary: var(--surface-hover);
    --crepe-color-on-secondary: var(--ink-strong);
    --crepe-color-inverse: var(--ink-strong);
    --crepe-color-on-inverse: var(--surface-raised);
    --crepe-color-inline-code: var(--ink-body);
    --crepe-color-inline-area: var(--surface-sunken);
    --crepe-color-error: var(--warning-11);
    --crepe-color-hover: var(--surface-hover);
    --crepe-color-selected: var(--surface-active);

    --crepe-base-font-size: var(--text-base);
    --crepe-font-title: var(--font-body);
    --crepe-font-default: var(--font-body);
    --crepe-font-code: var(--font-mono);

    --crepe-shadow-1: var(--shadow-sm);
    --crepe-shadow-2: var(--shadow-md);

    /* The card already draws the frame; the editor must not draw a second. */
    background: transparent;
    box-shadow: none;
  }
  .crepe-host :global(.milkdown .ProseMirror) {
    padding: var(--space-4);
    outline: none;
  }
</style>
