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
  const TAIL_CHARS = 240;

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
   * What a folded block shows past its chevron: the end of its last thought on
   * one line. The line is pinned to its right edge and fades out on the left,
   * so the latest words read and the rest trails off behind the label.
   */
  const tail = $derived(
    (paragraphs.at(-1) ?? "")
      .replace(MARKUP, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(-TAIL_CHARS)
  );
</script>

<div class="think">
  <ThinkingSteps
    onOpenChange={(value) => { expanded = value; }}
    open={expanded}
    size="default"
  >
    <ThinkingStepsHeader disabled={!text.trim()}>
      {#snippet after()}
        {#if !expanded && tail}
          <span class="tail"><span>{tail}</span></span>
        {/if}
      {/snippet}
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
  /* One line past the chevron, pinned right so the newest words show; the
     start fades out rather than cutting. Quieter than a tool row's text, so
     the fold reads as an aside and not as the next step. */
  .tail {
    display: flex;
    justify-content: flex-end;
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    color: var(--ink-muted);
    font-size: var(--text-xs);
    white-space: nowrap;
    mask-image: linear-gradient(to right, transparent, #000 30%);
  }
  /* The header spans the row so the tail has the width to read into. */
  .think :global(.thinking-header) {
    width: 100%;
  }
  .tail > span {
    flex: 0 0 auto;
  }
  @media (max-width: 900px) {
    .think {
      margin-left: 0;
    }
  }
</style>
