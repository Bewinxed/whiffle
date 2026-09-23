<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { flip } from "svelte/animate";
  import { IconToolGeneric, IconToolMcp, IconToolSkill } from "$lib/icons";
  import {
    askSuggestions,
    SUGGEST_PAUSE_MS,
    type SuggestCandidate,
    suggestionLine,
  } from "../suggest.svelte";

  /**
   * The row of suggested skills and MCP servers above the composer's input.
   *
   * Asks Jev once the operator stops typing, about the whole prompt,
   * and shows what it would need as chips. A chip click adds one plain
   * sentence to the prompt; nothing about the session's tools changes.
   */
  let {
    text,
    candidates,
    oninsert,
  }: {
    /** The composer's current draft. */
    text: string;
    candidates: SuggestCandidate[];
    oninsert: (line: string) => void;
  } = $props();

  const MIN_CHARS = 12;
  /** The shimmer waits this long, so a fast answer never flashes it. */
  const SHIMMER_AFTER_MS = 150;
  /** `--c-300` and `--c-100`, for Svelte's JS-driven flip and exit. */
  const GLIDE_MS = 300;
  const LEAVE_MS = 100;

  /** A cubic-bezier easing, so the JS motion runs on the house curves. */
  function bezier(x1: number, y1: number, x2: number, y2: number) {
    const at = (a: number, b: number, t: number) =>
      3 * a * (1 - t) ** 2 * t + 3 * b * (1 - t) * t ** 2 + t ** 3;
    return (x: number): number => {
      let lo = 0;
      let hi = 1;
      for (let i = 0; i < 24; i += 1) {
        const mid = (lo + hi) / 2;
        if (at(x1, x2, mid) < x) {
          lo = mid;
        } else {
          hi = mid;
        }
      }
      return at(y1, y2, (lo + hi) / 2);
    };
  }
  /** `--e-in` and `--e-out` from app.css. */
  const easeIn = bezier(0.16, 1, 0.3, 1);
  const easeOut = bezier(0.7, 0, 0.84, 0);

  let still = $state(false);
  onMount(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    still = query.matches;
    const follow = () => {
      still = query.matches;
    };
    query.addEventListener("change", follow);
    return () => query.removeEventListener("change", follow);
  });

  let ranked = $state<{ id: string; noul: number }[]>([]);
  let failure = $state<string | null>(null);
  let slow = $state(false);
  let asked = "";
  let controller: AbortController | undefined;
  let quiet: ReturnType<typeof setTimeout> | undefined;
  let shimmer: ReturnType<typeof setTimeout> | undefined;

  const byId = $derived(new Map(candidates.map((c) => [c.id, c])));
  /** What to show: ranked, still a candidate, and not already named in the draft. */
  const shown = $derived(
    ranked
      .map((entry) => byId.get(entry.id))
      .filter(
        (candidate): candidate is SuggestCandidate =>
          candidate !== undefined &&
          !text.toLowerCase().includes(candidate.name.toLowerCase())
      )
  );

  function settle() {
    controller?.abort();
    clearTimeout(quiet);
    clearTimeout(shimmer);
    slow = false;
  }

  async function ask(draft: string) {
    asked = draft;
    controller = new AbortController();
    const { signal } = controller;
    shimmer = setTimeout(() => {
      slow = true;
    }, SHIMMER_AFTER_MS);
    try {
      const answer = await askSuggestions({ text: draft, candidates }, signal);
      // A reply to words that are no longer in the composer is not an answer.
      if (text.trim() === draft) {
        ranked = answer;
        failure = null;
      }
    } catch (error) {
      if (!signal.aborted && text.trim() === draft) {
        failure = error instanceof Error ? error.message : String(error);
      }
    } finally {
      if (!signal.aborted) {
        clearTimeout(shimmer);
        slow = false;
      }
    }
  }

  $effect(() => {
    const draft = text.trim();
    settle();
    if (draft === "") {
      ranked = [];
      failure = null;
      asked = "";
      return;
    }
    if (
      draft.length < MIN_CHARS ||
      draft === asked ||
      untrack(() => candidates.length) === 0
    ) {
      return;
    }
    quiet = setTimeout(() => {
      // biome-ignore lint/complexity/noVoid: the ask reports its own outcome in component state
      void ask(draft);
    }, SUGGEST_PAUSE_MS);
  });

  $effect(() => settle);

  function choose(candidate: SuggestCandidate) {
    ranked = ranked.filter((entry) => entry.id !== candidate.id);
    oninsert(suggestionLine(candidate));
  }

  /**
   * A leaving chip steps out of flow at its last box, so the survivors glide
   * into the gap straight away instead of waiting for it to go.
   */
  function leave(node: HTMLElement) {
    const box = node.getBoundingClientRect();
    const frame = (
      node.offsetParent ?? node.parentElement
    )?.getBoundingClientRect();
    node.style.position = "absolute";
    node.style.insetInlineStart = `${box.left - (frame?.left ?? 0)}px`;
    node.style.insetBlockStart = `${box.top - (frame?.top ?? 0)}px`;
    node.style.inlineSize = `${box.width}px`;
    return {
      duration: still ? 0 : LEAVE_MS,
      easing: easeOut,
      css: (t: number) =>
        `opacity: ${t}; transform: scale(${0.96 + 0.04 * t});`,
    };
  }

  /** The row's height follows its content, measured, so a wrap never jumps. */
  let trackHeight = $state(0);
</script>

<div
  class="suggest"
  style:block-size={trackHeight ? `${trackHeight}px` : undefined}
>
  <fieldset class="track" bind:clientHeight={trackHeight}>
    <legend class="sr-only">Suggested skills, tools and MCP servers</legend>
    {#each shown as candidate, i (candidate.id)}
      <button
        class="chip"
        onclick={() => choose(candidate)}
        title={candidate.description}
        type="button"
        style:--i={i}
        out:leave
        animate:flip={{ duration: still ? 0 : GLIDE_MS, easing: easeIn }}
      >
        {#if candidate.kind === 'skill'}
          <IconToolSkill aria-hidden="true" class="glyph" />
        {:else if candidate.kind === 'tool'}
          <IconToolGeneric aria-hidden="true" class="glyph" />
        {:else}
          <IconToolMcp aria-hidden="true" class="glyph" />
        {/if}
        <span class="name">{candidate.name}</span>
        <span class="sr-only"
          >— add “{suggestionLine(candidate)}” to the message</span
        >
      </button>
    {/each}
    {#if slow && shown.length === 0}
      <span aria-hidden="true" class="shimmer"></span>
    {/if}
    {#if failure}
      <p class="fail" role="status">Suggestions failed: {failure}</p>
    {/if}
  </fieldset>
</div>

<style>
  .suggest {
    interpolate-size: allow-keywords;
    overflow: clip;
    overflow-clip-margin: var(--space-2);

    @media (prefers-reduced-motion: no-preference) {
      transition: block-size var(--c-300) var(--e-in);
    }
  }

  .track {
    position: relative;
    min-inline-size: 0;
    margin: 0;
    border: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    padding-block: 0;
    padding-inline: var(--space-1);

    &:has(.chip, .shimmer, .fail) {
      padding-block: var(--space-1);
    }
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    max-inline-size: 100%;
    padding-block: var(--space-1);
    padding-inline: var(--space-2) var(--space-3);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-control);
    background: var(--surface-raised);
    box-shadow: var(--shadow-tile);
    color: var(--ink-body);
    font-size: var(--text-sm);
    white-space: nowrap;
    cursor: pointer;
    opacity: 1;
    transform: none;
    transition:
      opacity var(--c-300) var(--e-in),
      background-color var(--c-100) var(--e-in),
      color var(--c-100) var(--e-in);

    @starting-style {
      opacity: 0;
    }

    @media (prefers-reduced-motion: no-preference) {
      transition:
        opacity var(--c-300) var(--e-in) calc(var(--i) * 30ms),
        transform var(--c-300) var(--e-in) calc(var(--i) * 30ms),
        background-color var(--c-100) var(--e-in),
        color var(--c-100) var(--e-in);

      @starting-style {
        opacity: 0;
        transform: translateY(4px) scale(0.96);
      }

      &:active {
        transform: scale(0.97);
        transition-delay: 0ms;
      }
    }

    &:hover {
      background: color-mix(
        in oklab,
        var(--surface-raised) 70%,
        var(--surface-sunken)
      );
      color: var(--ink-strong);
    }

    &:focus-visible {
      outline: 2px solid var(--focus-ring);
      outline-offset: 2px;
    }

    & :global(.glyph) {
      inline-size: 14px;
      block-size: 14px;
      flex: none;
      color: var(--ink-muted);
    }

    @media (pointer: coarse) {
      min-block-size: 44px;
    }
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* One low-contrast sweep, only while an ask is slow. */
  .shimmer {
    inline-size: 9rem;
    block-size: calc(var(--text-sm) + var(--space-1) * 2 + 2px);
    border-radius: var(--radius-control);
    background: var(--surface-sunken);
    opacity: 0.8;

    @starting-style {
      opacity: 0;
    }

    transition: opacity var(--c-300) var(--e-in);

    @media (prefers-reduced-motion: no-preference) {
      background: linear-gradient(
          90deg,
          transparent 0%,
          color-mix(in oklab, var(--surface-raised) 70%, transparent) 50%,
          transparent 100%
        )
        var(--surface-sunken);
      background-size: 200% 100%;
      animation: sweep calc(var(--c-500) * 3) var(--e-toggle) infinite;
    }
  }

  @keyframes sweep {
    from {
      background-position: 150% 0;
    }
    to {
      background-position: -50% 0;
    }
  }

  .fail {
    margin: 0;
    color: var(--ink-muted);
    font-size: var(--text-sm);
    text-wrap: pretty;
    opacity: 1;
    transition: opacity var(--c-300) var(--e-in);

    @starting-style {
      opacity: 0;
    }
  }
</style>
