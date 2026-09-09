<script lang="ts">
  import {
    createDialKit,
    createDialTimeline,
    DialRoot,
    DialTimeline,
  } from "dialkit/svelte";
  import { prefersReducedMotion } from "svelte/motion";
  import NewSessionModal from "$lib/motion/new-session/NewSessionModal.svelte";
  import "dialkit/styles.css";

  let open = $state(false);
  let submitted = $state(false);
  const section = (at: number, duration: number) => ({
    at,
    duration,
    from: { y: 12, opacity: 0, scale: 0.97 },
    to: { y: 0, opacity: 1, scale: 1 },
    transition: {
      type: "spring" as const,
      visualDuration: duration,
      bounce: 0.18,
    },
  });
  // TODO(production): DialKit clip.current values are the scrubbable authoring preview. Replace with the app's real transitions using the tuned timings, then remove createDialTimeline and <DialTimeline />.
  const timeline = createDialTimeline(
    "New session",
    {
      scrim: {
        at: 0,
        duration: 0.35,
        from: { opacity: 0, blur: 0 },
        to: { opacity: 1, blur: 12 },
        transition: { type: "easing", duration: 0.35, ease: [0.16, 1, 0.3, 1] },
      },
      card: {
        at: 0.04,
        duration: 0.55,
        from: { y: 24, scale: 0.94, opacity: 0 },
        to: { y: 0, scale: 1, opacity: 1 },
        transition: { type: "spring", visualDuration: 0.55, bounce: 0.18 },
      },
      header: {
        at: 0.18,
        duration: 0.35,
        from: { y: 8, opacity: 0 },
        to: { y: 0, opacity: 1 },
      },
      prompt: section(0.24, 0.45),
      chips: section(0.36, 0.45),
      footer: section(0.5, 0.4),
      interactive: { at: 0.5, duration: 0 },
    },
    { autoplay: false, id: "new-session-open-v2", persist: import.meta.env.DEV }
  );
  const params = createDialKit(
    "New session",
    {
      stagger: [0.06, 0, 0.2, 0.005],
      highlightSpring: { type: "spring", visualDuration: 0.35, bounce: 0.15 },
      sliderSpring: { type: "spring", visualDuration: 0.3, bounce: 0.25 },
      panelSpring: { type: "spring", visualDuration: 0.4, bounce: 0.1 },
      card: { radius: [20, 8, 32], blur: [12, 0, 32], scrim: [0.55, 0, 1] },
      highlight: { inset: [3, 0, 8], radius: [12, 4, 24] },
      replay: { type: "action" },
    },
    { onAction: () => replay() }
  );
  function replay() {
    open = true;
    submitted = false;
    timeline.replay();
    if (prefersReducedMotion.current) {
      timeline.pause();
      timeline.seek(timeline.duration);
    }
  }
  function close() {
    open = false;
  }
  function submit() {
    open = false;
    submitted = true;
  }
</script>

<svelte:head><title>New session motion | Whiffle</title></svelte:head>
<main>
  <a href="/motion">Motion</a>
  <h1>New session</h1>
  <p>
    Session controls and opening sequence. Tune parameters or scrub the
    timeline.
  </p>
  <button onclick={replay} type="button">New session</button>
  {#if submitted}
    <p role="status">
      Session configuration submitted. This demo does not start an agent.
    </p>
  {/if}
</main>
{#if open}
  <NewSessionModal onclose={close} onsubmit={submit} {params} {timeline} />
{/if}
<DialRoot position="top-right" productionEnabled />
<DialTimeline productionEnabled />

<style>
  main {
    min-height: 100dvh;
    padding: var(--space-8);
    background: var(--surface-field);
    color: var(--ink-body);
  }
  a {
    color: var(--ink-muted);
    font-size: var(--text-sm);
  }
  h1 {
    margin-top: var(--space-8);
    font-size: var(--text-xl);
    font-weight: var(--weight-strong);
    color: var(--ink-strong);
  }
  p {
    margin-block: var(--space-3) var(--space-6);
    font-size: var(--text-base);
  }
  button {
    min-height: 44px;
    padding: var(--space-3) var(--space-5);
    border: 0;
    border-radius: var(--radius-control);
    background: var(--gradient-action);
    box-shadow: var(--shadow-action);
    color: var(--on-brand);
    cursor: pointer;
  }
  button:focus-visible,
  a:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
</style>
