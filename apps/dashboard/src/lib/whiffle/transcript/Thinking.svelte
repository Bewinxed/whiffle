<script lang="ts">
  import { untrack } from "svelte";
  import { ThinkingIndicator } from "$lib/components/ui/thinking-indicator";
  import {
    ThinkingStep,
    ThinkingSteps,
    ThinkingStepsContent,
    ThinkingStepsHeader,
  } from "$lib/components/ui/thinking-steps";
  import { IconCpu } from "$lib/icons";

  let {
    text,
    live = false,
    announce = false,
  }: { text: string; live?: boolean; announce?: boolean } = $props();
  const FENCE = /^\s*(```|~~~)/;
  /** Emphasis, code ticks and heading marks: noise in a three-line glimpse. */
  const MARKUP = /[*_`#>]/g;
  const TAIL_CHARS = 480;

  /**
   * One step per block: blocks part on blank lines, except inside a fenced
   * code block, where a blank line is part of the code.
   */
  function splitBlocks(source: string): string[] {
    const blocks: string[] = [];
    let current: string[] = [];
    let fenced = false;
    for (const line of source.split("\n")) {
      if (FENCE.test(line)) {
        fenced = !fenced;
      }
      if (!fenced && line.trim() === "") {
        if (current.length) {
          blocks.push(current.join("\n"));
        }
        current = [];
        continue;
      }
      current.push(line);
    }
    if (current.some((line) => line.trim())) {
      blocks.push(current.join("\n"));
    }
    return blocks;
  }

  const paragraphs = $derived(splitBlocks(text));
  /** A running block starts open; a finished one folds to its tail. */
  let expanded = $state(untrack(() => live));
  /**
   * What a folded block shows: the end of its last thought, as plain text. The
   * box pins it to the bottom and fades the top, so the latest line reads and
   * the rest trails off above it.
   */
  const tail = $derived(
    (paragraphs.at(-1) ?? "").replace(MARKUP, "").slice(-TAIL_CHARS)
  );
</script>

<div class="think">
  <ThinkingSteps
    onOpenChange={(value) => { expanded = value; }}
    open={expanded}
    size="default"
  >
    <ThinkingStepsHeader disabled={!text.trim()}>
      {#if live}
        <ThinkingIndicator
          aria-live={announce ? 'polite' : 'off'}
          class="rail-indicator"
        />
      {:else}
        <span class="identity"
          ><span class="icon"><IconCpu /></span>Reasoning</span
        >
      {/if}
    </ThinkingStepsHeader>
    {#if !expanded && tail}
      <button class="tail" onclick={() => { expanded = true; }} type="button">
        <span>{tail}</span>
      </button>
    {/if}
    <ThinkingStepsContent>
      {#each paragraphs as paragraph, i (i)}
        <ThinkingStep
          description={paragraph}
          isLast={i === paragraphs.length - 1}
          markdown
          status={live && i === paragraphs.length - 1 ? "active" : "complete"}
        />
      {/each}
    </ThinkingStepsContent>
  </ThinkingSteps>
</div>

<style>
  .think {
    margin: var(--rail-gap, var(--space-4)) 0 0 var(--space-2);
    padding-left: var(--space-3);
    background: var(--rail-head, var(--rail)) left top / 2px 100% no-repeat;
    max-width: 70ch;
  }
  .identity {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .icon {
    display: grid;
    place-items: center;
    width: 15px;
    height: 15px;
  }
  .icon :global(svg) {
    width: 15px;
    height: 15px;
  }
  .think :global(.rail-indicator) {
    padding: 0;
    gap: var(--space-2);
    --thinking-icon-size: 15px;
  }
  /* Pinned to the bottom so the last line always shows; the mask fades the
     lines above it into the rail instead of cutting them. */
  .tail {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    width: 100%;
    max-height: calc(3 * var(--leading-body) * 1em);
    margin-top: var(--space-1);
    padding: 0;
    overflow: hidden;
    border: 0;
    background: none;
    color: var(--ink-muted);
    font: inherit;
    font-size: var(--text-sm);
    line-height: var(--leading-body);
    text-align: left;
    white-space: pre-line;
    cursor: pointer;
    mask-image: linear-gradient(to bottom, transparent, #000 75%);
  }
  .tail:hover {
    color: var(--ink-strong);
  }
  @media (max-width: 900px) {
    .think {
      margin-left: 0;
    }
  }
</style>
