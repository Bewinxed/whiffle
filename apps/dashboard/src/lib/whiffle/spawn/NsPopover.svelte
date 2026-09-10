<script lang="ts">
  /**
   * The modal's popover shell: a portaled bits-ui Popover anchored to its
   * trigger (or a caret rect), collision-handled, scaled from the trigger side,
   * and a full-viewport panel on small screens. Decision §8.6: the design's
   * `fixedOrigin` maths is unnecessary here because the content is portaled.
   */
  import { Popover as PopoverPrimitive } from "bits-ui";
  import type { Snippet } from "svelte";
  import { MediaQuery } from "svelte/reactivity";
  import Back from "~icons/solar/alt-arrow-left-linear";

  let {
    id,
    open,
    onchange,
    trigger,
    children,
    width = 320,
    gap = 0,
    align = "start",
    trapFocus = true,
    anchor = null,
    label,
    triggerClass = "",
    triggerStyle,
    onmousemove,
    onmouseleave,
    ...rest
  }: {
    id: string;
    open: boolean;
    onchange: (open: boolean) => void;
    trigger?: Snippet;
    children: Snippet;
    width?: number;
    gap?: number;
    align?: "start" | "end" | "center";
    trapFocus?: boolean;
    anchor?: { getBoundingClientRect: () => DOMRect } | HTMLElement | null;
    label?: string;
    triggerClass?: string;
    triggerStyle?: string;
    onmousemove?: (event: MouseEvent) => void;
    onmouseleave?: (event: MouseEvent) => void;
    "aria-label"?: string;
  } = $props();
  const mobile = new MediaQuery("(max-width: 640px)");
</script>

<PopoverPrimitive.Root onOpenChange={onchange} {open}>
  {#if trigger}
    <PopoverPrimitive.Trigger
      aria-label={label}
      class={triggerClass}
      {id}
      style={triggerStyle}
    >
      {@render trigger()}
    </PopoverPrimitive.Trigger>
  {/if}
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      {align}
      aria-label={rest["aria-label"]}
      class="ns-theme ns-pop"
      collisionPadding={8}
      customAnchor={anchor}
      id={`${id}-popover`}
      onOpenAutoFocus={(event) => { if (!trapFocus) { event.preventDefault(); } }}
      side="bottom"
      sideOffset={6}
      style={`--ns-pop-width:${width}px;--ns-pop-gap:${gap}px`}
      {trapFocus}
    >
      {#snippet child({ props, wrapperProps })}
        <div {...wrapperProps} class="ns-pop-shell">
          <div
            {...props}
            id={`${id}-popover`}
            {onmouseleave}
            {onmousemove}
            role="presentation"
          >
            {#if mobile.current && trapFocus}
              <button
                class="ns-pop-back"
                onclick={() => onchange(false)}
                type="button"
              >
                <Back />Back
              </button>
            {/if}
            {@render children()}
          </div>
        </div>
      {/snippet}
    </PopoverPrimitive.Content>
  </PopoverPrimitive.Portal>
</PopoverPrimitive.Root>

<style>
  .ns-pop-back {
    display: none;
    align-items: center;
    gap: 6px;
    height: 44px;
    padding: 0 8px;
    border: 0;
    border-radius: var(--fai-radius-sm);
    background: transparent;
    color: var(--fai-text);
    font: 500 13px / 1 var(--fai-font-sans);
    text-align: left;
    cursor: pointer;
  }
  .ns-pop-back :global(svg) {
    width: 16px;
    height: 16px;
  }
  @media (max-width: 640px) {
    .ns-pop-back {
      display: flex;
    }
  }
</style>
