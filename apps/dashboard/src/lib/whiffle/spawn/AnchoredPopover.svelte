<script lang="ts">
  import { type Snippet, tick, untrack } from "svelte";
  import { prefersReducedMotion, Spring } from "svelte/motion";
  import { type SpringSpec, springFromVisual } from "./motion";

  let {
    anchor,
    open,
    onclose,
    children,
    spring = { visualDuration: 0.2, bounce: 0 },
    id,
  }: {
    anchor: HTMLElement;
    open: boolean;
    onclose: () => void;
    children: Snippet;
    spring?: SpringSpec;
    id?: string;
  } = $props();
  let panel = $state<HTMLDivElement>();
  let present = $state(false);
  let closing = $state(false);
  let above = $state(false);
  let left = $state(0);
  let edge = $state(0);
  let width = $state(0);
  let maxHeight = $state(420);
  let viewportPanel = $state(false);
  const progress = new Spring(0, { precision: 0.001 });
  $effect(() => {
    const media = window.matchMedia("(max-width: 480px)");
    const update = () => {
      viewportPanel = media.matches;
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  });
  function measure() {
    const rect = anchor.getBoundingClientRect();
    const viewport = window.visualViewport;
    const top = viewport?.offsetTop ?? 0;
    const bottom = top + (viewport?.height ?? window.innerHeight);
    const right =
      (viewport?.offsetLeft ?? 0) + (viewport?.width ?? window.innerWidth);
    above = bottom - rect.bottom < 320;
    width = Math.min(rect.width, right - (viewport?.offsetLeft ?? 0) - 16);
    left = Math.max(
      (viewport?.offsetLeft ?? 0) + 8,
      Math.min(rect.left, right - width - 8)
    );
    edge = above
      ? Math.max(top + 8, rect.top - 6)
      : Math.min(bottom - 8, rect.bottom + 6);
    maxHeight = Math.max(
      0,
      Math.min(420, above ? rect.top - top - 16 : bottom - rect.bottom - 16)
    );
  }
  function portal(node: HTMLElement) {
    document.body.append(node);
    return {
      destroy() {
        node.remove();
      },
    };
  }
  $effect(() => {
    Object.assign(
      progress,
      springFromVisual(
        viewportPanel ? { visualDuration: 0.28, bounce: 0 } : spring
      )
    );
  });
  $effect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    present = true;
    closing = false;
    untrack(measure);
    if (prefersReducedMotion.current) {
      // The panel must paint at its end state on its first frame, not one tick later.
      progress.set(1, { instant: true });
    }
    tick().then(() => {
      if (cancelled) {
        return;
      }
      progress.set(1, { instant: prefersReducedMotion.current });
      panel
        ?.querySelector<HTMLElement>(
          'input:not(:disabled), textarea:not(:disabled), button:not(:disabled), [tabindex="0"], a[href]'
        )
        ?.focus();
    });
    function outside(event: PointerEvent) {
      if (
        !event.composedPath().includes(anchor) &&
        panel &&
        !event.composedPath().includes(panel)
      ) {
        onclose();
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      onclose();
    }
    window.addEventListener("scroll", measure, {
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", measure, { passive: true });
    window.visualViewport?.addEventListener("resize", measure, {
      passive: true,
    });
    window.visualViewport?.addEventListener("scroll", measure, {
      passive: true,
    });
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", closeOnEscape, true);
    const observer = new ResizeObserver(measure);
    observer.observe(anchor);
    return () => {
      cancelled = true;
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("scroll", measure);
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("keydown", closeOnEscape, true);
      observer.disconnect();
      anchor.focus();
    };
  });
  $effect(() => {
    if (open || !untrack(() => present)) {
      return;
    }
    closing = true;
    if (!panel) {
      return;
    }
    const css = getComputedStyle(panel);
    const duration = prefersReducedMotion.current
      ? 1
      : Number.parseFloat(css.getPropertyValue("--c-100"));
    const current = untrack(() => progress.current);
    const animation = panel.animate(
      [
        {
          opacity: viewportPanel ? 1 : current,
          transform: viewportPanel
            ? `translateY(${(1 - current) * 100}%)`
            : `scale(${0.98 + 0.02 * current})`,
        },
        {
          opacity: viewportPanel ? 1 : 0,
          transform: viewportPanel ? "translateY(100%)" : "scale(.98)",
        },
      ],
      {
        duration,
        easing: css.getPropertyValue("--e-out").trim(),
        fill: "forwards",
      }
    );
    animation.onfinish = () => {
      present = false;
      progress.set(0, { instant: true });
    };
    return () => animation.cancel();
  });
</script>

{#if present}
  <div
    class="position"
    style:left={viewportPanel ? undefined : `${left}px`}
    style:top={viewportPanel ? undefined : `${edge}px`}
    style:transform={!viewportPanel && above ? "translateY(-100%)" : undefined}
    style:width={viewportPanel ? undefined : `${width}px`}
    class:viewport={viewportPanel}
    use:portal
  >
    <div
      class="panel"
      {id}
      inert={closing}
      bind:this={panel}
      style:max-height={viewportPanel ? undefined : `${maxHeight}px`}
      style:opacity={viewportPanel ? 1 : progress.current}
      style:transform={viewportPanel ? `translateY(${(1 - progress.current) * 100}%)` : `scale(${.98 + .02 * progress.current})`}
      style:transform-origin={above ? "bottom center" : "top center"}
    >
      {@render children()}
    </div>
  </div>
{/if}

<style>
  .position {
    position: fixed;
    z-index: 100;
  }
  .panel {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    overscroll-behavior: contain;
    border-radius: var(--radius-modal);
    background: var(--surface-overlay);
    box-shadow: var(--shadow-overlay);
    color: var(--ink-body);
  }
  .position.viewport {
    inset: 0;
    width: 100%;
    overflow: hidden;
  }
  .viewport .panel {
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px)
      env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px);
    border-radius: var(--radius-shell) var(--radius-shell) 0 0;
  }
</style>
