<script lang="ts">
  import { Portal } from "bits-ui";
  import { tick, untrack } from "svelte";
  import { Drawer } from "vaul-svelte";
  import { hidePreview, whiffle } from "../client.svelte";
  import PreviewPane from "./PreviewPane.svelte";
  import type { CapturedSelection } from "./selection";

  let {
    instanceId,
    open,
    content,
    composerHeight,
    onselect,
    onescape,
  }: {
    instanceId: string;
    open: boolean;
    content?: HTMLDivElement;
    composerHeight: number;
    onselect: (
      selection: CapturedSelection
    ) => "added" | "duplicate" | "full" | undefined;
    onescape: () => boolean;
  } = $props();
  const peek = "106px";
  let snap = $state<number | string | null>(peek);
  let bottom = $state(0);
  let top = $state(0);
  let left = $state(0);
  let width = $state(0);
  let availableHeight = $state(0);
  let host = $state<HTMLDivElement>();
  let drawer = $state<HTMLElement | null>(null);
  let handleStartY = 0;
  let handleDragged = false;
  function reportSnap() {
    whiffle.previewVisible[instanceId] = snap !== peek;
  }
  function cycleSnap() {
    if (handleDragged) {
      return;
    }
    if (snap === peek) {
      snap = 0.6;
    } else if (snap === 0.6) {
      snap = 1;
    } else {
      snap = peek;
    }
    reportSnap();
  }
  let snapPoints = $state<(number | string)[]>([peek, 0.6, 1]);
  $effect(() => {
    const dimensions = bottom + top + width + availableHeight;
    if (dimensions) {
      tick().then(async () => {
        snapPoints = [peek, 0.6, 1];
        await tick();
        if (drawer && host && snap !== null) {
          const { height } = host.getBoundingClientRect();
          const visibleHeight =
            typeof snap === "number" ? height * snap : Number.parseFloat(snap);
          // Vaul snapshots its initial pixel offsets; geometry changes refresh
          // the current position without changing the user's chosen snap.
          drawer.style.transform = `translate3d(0, ${height - visibleHeight}px, 0)`;
        }
      });
    }
  });
  $effect(() => {
    untrack(() => hidePreview(instanceId));
  });
  $effect(() => {
    const request = whiffle.previewRequests[instanceId];
    if (request !== undefined) {
      untrack(() => {
        snap = whiffle.previewVisible[instanceId] ? 0.6 : peek;
      });
    }
  });
  $effect(() => {
    const node = content;
    const height = composerHeight;
    if (!node) {
      return;
    }
    const measure = () => {
      const box = node.getBoundingClientRect();
      const offset = Number.parseFloat(
        getComputedStyle(node).getPropertyValue("--space-4")
      );
      const composerTop =
        node.querySelector(".composer")?.getBoundingClientRect().top ??
        box.bottom - height - offset;
      bottom = innerHeight - composerTop;
      availableHeight = composerTop - box.top;
      ({ top, left, width } = box);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("scroll", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("scroll", measure);
    };
  });
</script>

<Portal
  ><div
    class="preview-sheet-host"
    data-active-snap={snap}
    style={`bottom:${bottom}px;left:${left}px;width:${width}px;top:${top}px`}
    bind:this={host}
  ></div></Portal
>
{#if host && width}
  <Drawer.Root
    container={host}
    dismissible={false}
    handleOnly
    modal={false}
    noBodyStyles
    onRelease={reportSnap}
    {open}
    repositionInputs={false}
    {snapPoints}
    bind:activeSnapPoint={snap}
  >
    <Drawer.Portal>
      <Drawer.Content
        class="preview-sheet"
        onCloseAutoFocus={(event) => event.preventDefault()}
        onOpenAutoFocus={(event) => event.preventDefault()}
        style="inset:0;width:100%;height:100%"
        trapFocus={false}
        bind:ref={drawer}
      >
        <Drawer.Title class="sr-only">Preview</Drawer.Title>
        <Drawer.Handle
          class="preview-grab"
          onclick={cycleSnap}
          onpointerdown={(event) => { handleStartY = event.clientY; handleDragged = false; }}
          onpointermove={(event) => { if (Math.abs(event.clientY - handleStartY) > 8) { handleDragged = true; } }}
          preventCycle
        />
        <PreviewPane {instanceId} {onescape} {onselect} />
      </Drawer.Content>
    </Drawer.Portal>
  </Drawer.Root>
{/if}

<style>
  .preview-sheet-host {
    position: fixed;
    z-index: 40;
    overflow: hidden;
    pointer-events: none;
  }
  :global(.preview-sheet) {
    transition-duration: var(--c-300) !important;
    transition-timing-function: var(--e-in) !important;
    position: absolute;
    z-index: 40;
    display: flex;
    flex-direction: column;
    padding-top: var(--space-3);
    border-radius: var(--radius-panel) var(--radius-panel) 0 0;
    background: var(--surface-raised);
    box-shadow: var(--shadow-drawer);
    outline: none;
  }
  :global(.preview-sheet[data-state="closed"]) {
    transition-timing-function: var(--e-out) !important;
  }
  :global(.preview-sheet .preview-grab[data-vaul-handle]) {
    touch-action: none;
    position: absolute;
    top: var(--space-1);
    left: calc(50% - 50px);
    width: 100px;
    height: 6px;
    border-radius: var(--radius-pill);
    background: var(--border-control);
    margin: 0;
    opacity: 1;
  }
  :global(.preview-sheet [data-vaul-handle-hitarea]) {
    height: 44px;
  }
  :global(.preview-sheet > .preview-pane) {
    flex: 1;
    height: auto;
    box-shadow: none;
  }
</style>
