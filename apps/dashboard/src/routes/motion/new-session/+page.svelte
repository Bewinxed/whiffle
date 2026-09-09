<script lang="ts">
  import {
    createDialKit,
    createDialTimeline,
    DialRoot,
    DialStore,
    DialTimeline,
  } from "dialkit/svelte";
  import { prefersReducedMotion } from "svelte/motion";
  import { MediaQuery } from "svelte/reactivity";
  import { page } from "$app/state";
  import NewSessionDialog from "$lib/whiffle/spawn/NewSessionDialog.svelte";
  import "dialkit/styles.css";

  const TIMELINE_ID = "new-session-open-v3";
  const PARAMS_ID = "new-session-params-v2";
  const desktop = new MediaQuery("(min-width: 481px)");
  let open = $state(false);
  // TODO(production): DialKit clip.current values are the scrubbable authoring preview. Replace with the app's real transitions using the tuned timings, then remove createDialTimeline and <DialTimeline />.
  const timeline = createDialTimeline(
    "New session",
    {
      // Keep the last row scrubbable at the largest exposed stagger (7 × 100ms).
      duration: 1.1,
      scrim: {
        at: 0,
        duration: 0.3,
        from: { opacity: 0 },
        to: { opacity: 1 },
        transition: { type: "easing", duration: 0.3, ease: [0.16, 1, 0.3, 1] },
      },
      card: {
        at: 0.04,
        duration: 0.32,
        from: { opacity: 0, scale: 0.98, y: 8 },
        to: { opacity: 1, scale: 1, y: 0 },
        transition: { type: "spring", visualDuration: 0.32, bounce: 0 },
      },
      rows: {
        at: 0.06,
        duration: 0.28,
        from: { opacity: 0, y: 6 },
        to: { opacity: 1, y: 0 },
        transition: { type: "spring", visualDuration: 0.28, bounce: 0 },
      },
      focus: { at: 0.5, duration: 0 },
      interactive: { at: 0.5, duration: 0 },
    },
    { autoplay: false, id: TIMELINE_ID, persist: import.meta.env.DEV }
  );
  const params = createDialKit(
    "New session",
    {
      open: { rowStagger: [0.024, 0, 0.1, 0.002] },
      seg: { thumb: { type: "spring", visualDuration: 0.26, bounce: 0 } },
      pop: {
        open: { type: "spring", visualDuration: 0.2, bounce: 0 },
        rowStagger: [0.014, 0, 0.05, 0.002],
      },
      swap: {
        spring: { type: "spring", visualDuration: 0.24, bounce: 0 },
        stagger: [0.018, 0, 0.08, 0.002],
      },
      list: { highlight: { type: "spring", visualDuration: 0.22, bounce: 0 } },
      slider: { thumb: { type: "spring", visualDuration: 0.22, bounce: 0 } },
      replay: { type: "action" },
    },
    { id: PARAMS_ID, onAction: replay }
  );
  function replay() {
    open = true;
    timeline.replay();
    if (prefersReducedMotion.current) {
      timeline.pause();
      timeline.seek(timeline.duration);
    }
  }
  function close() {
    open = false;
  }
  $effect(() => {
    let pending: ReturnType<typeof setTimeout>;
    const watch = (id: string) => {
      let seen = JSON.stringify(DialStore.getValues(id));
      return DialStore.subscribe(id, () => {
        const next = JSON.stringify(DialStore.getValues(id));
        if (next === seen) {
          return;
        }
        seen = next;
        clearTimeout(pending);
        pending = setTimeout(replay, 120);
      });
    };
    const stop = [watch(PARAMS_ID), watch(TIMELINE_ID)];
    return () => {
      clearTimeout(pending);
      for (const unsubscribe of stop) {
        unsubscribe();
      }
    };
  });
</script>

<svelte:head><title>New session motion | Whiffle</title></svelte:head>
<main>
  <h1>New session</h1>
  <p>Tune the opening sequence and session controls.</p>
  <button onclick={replay} type="button">New session</button>
</main>
<NewSessionDialog
  onclose={close}
  {open}
  {params}
  prefill={page.url.searchParams.has("projectId") ? { projectId: page.url.searchParams.get("projectId") ?? undefined } : undefined}
  {timeline}
/>
{#if desktop.current}
  <DialRoot position="top-right" productionEnabled />
  <DialTimeline productionEnabled />
{/if}

<style>
  @media (prefers-reduced-motion: reduce) {
    /* The global 1ms rule restarts inherited-color transitions down the SVG tree. */
    :global(body:has(.session-card) *:not([data-motion-loop])) {
      transition-duration: 0ms !important;
      animation-duration: 0ms !important;
    }
  }
  main {
    padding: var(--space-8);
    color: var(--ink-body);
  }
  h1 {
    font-size: var(--text-xl);
    font-weight: 500;
    color: var(--ink-strong);
  }
  p {
    margin-block: var(--space-4);
  }
  button {
    height: 36px;
    padding-inline: var(--space-4);
    border-radius: var(--radius-control);
    background: var(--gradient-action);
    box-shadow: var(--shadow-action);
    color: var(--on-brand);
    font-size: var(--text-base);
  }
</style>
