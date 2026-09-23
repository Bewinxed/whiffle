<script lang="ts">
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
</script>

<div class="think">
  <ThinkingSteps defaultOpen={live} size="default">
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
  @media (max-width: 900px) {
    .think {
      margin-left: 0;
    }
  }
</style>
