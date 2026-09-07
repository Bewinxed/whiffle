<script lang="ts">
  /**
   * A turn's words — plain running text at 74ch, no card, no bubble. Markdown
   * so a fenced block or a list reads as one, and the `.msg` frame carries the
   * mock's inline-code and measure.
   *
   * The type and rhythm rules below are `:global` on purpose. Streamdown puts
   * the `prose prose-sm …` class (see `$lib/prose`) on its own root div, and
   * `prose-sm` declares its own font-size, line-height and per-element em
   * margins there — so anything set on `.msg` alone is inherited into that root
   * and then immediately overridden. The scale lives on the token sheet, not in
   * the typography plugin, so the root is restated here.
   */
  import { Markdown } from "$lib/components/ui/markdown";
  import { useCascade } from "$lib/whiffle/motion/cascade.svelte";

  let { source, streaming = false }: { source: string; streaming?: boolean } =
    $props();

  /**
   * A clock above this component means the row is arriving, which is the only
   * time the words need to be separable. History renders as plain text.
   */
  const arriving = !!useCascade();

  /**
   * Past this much text the words stop blurring and only fade.
   *
   * `filter` is per-element and the fade outlives the spread, so on a long
   * message every word is blurring at the same moment — a hundred and twenty
   * compositing layers for one paragraph, which is felt as lag on exactly the
   * messages worth reading. The reveal itself stays: it is the blur that has
   * to go, and at the tuned 1px it was the part nobody could see anyway.
   */
  const HEAVY = 500;
  const heavy = $derived(source.length > HEAVY);
</script>

<div class="msg" class:plain={heavy}>
  <Markdown animated={arriving} {source} {streaming} />
</div>

<style>
  /* ---- The word reveal.
     Streamdown emits one span per token with the animation inline; the delay
     is ours, so prose resolves left to right like every other row rather than
     every word at once. `sibling-index()` is what makes that possible without
     a per-word component or a fork of the renderer — where it is missing the
     words still resolve, just together. The cap keeps a long paragraph's tail
     from queueing behind a delay that grows with its length.
     The timing function needs `!important` because streamdown writes its own
     inline, and inline beats a stylesheet. */
  .msg.plain {
    --word-blur: 0px;
  }
  .msg :global(.prose span[style*="sd-"]) {
    animation-delay: var(--content-delay, 0ms);
    animation-timing-function: var(--word-ease, ease-out) !important;
    /* The renderer's own blur is a fixed 5px; this is the tuned one, so prose
       resolves out of exactly the same haze as every other word in the
       transcript. */
    animation-name: msg-word !important;
    /* Same reason as Stream's: a forwards fill would leave every word span
       holding a filter, and a message is hundreds of them. Streamdown writes
       the fill inline, so this has to shout. */
    animation-fill-mode: backwards !important;
  }
  @keyframes msg-word {
    from {
      opacity: 0;
      filter: blur(var(--word-blur, 1px));
    }
    to {
      opacity: 1;
      filter: blur(0);
    }
  }
  @supports (animation-delay: calc(sibling-index() * 1ms)) {
    .msg.plain {
      --word-blur: 0px;
    }
    .msg :global(.prose span[style*="sd-"]) {
      animation-delay: calc(
        var(--content-delay, 0ms) +
        min(sibling-index() * var(--word-step, 20ms), var(--word-spread, 330ms))
      );
    }
  }
  .msg {
    font-size: var(--text-md);
    line-height: var(--leading-body);
    color: var(--ink-strong);
    max-width: 74ch;
  }
  .msg :global(.prose) {
    font-size: var(--text-md);
    line-height: var(--leading-body);
    color: var(--ink-strong);
  }

  /* ---- Block rhythm. The plugin's em-scaled margins are off the --space
     ladder; one gap between every pair of blocks puts them back on it, and
     `* + *` means a turn never opens or closes with dead space. */
  .msg :global(.prose > * + *) {
    margin-top: var(--space-3);
  }
  .msg :global(.prose > :first-child) {
    margin-top: 0;
  }
  .msg :global(.prose > :last-child) {
    margin-bottom: 0;
  }
  .msg :global(p),
  .msg :global(ul),
  .msg :global(ol),
  .msg :global(blockquote) {
    margin-block: 0;
  }
  /* Nested rhythm the top-level `> * + *` rule cannot reach. */
  .msg :global(p + p) {
    margin-top: var(--space-3);
  }
  .msg :global(li + li) {
    margin-top: var(--space-1);
  }
  .msg :global(li > ul),
  .msg :global(li > ol) {
    margin-top: var(--space-1);
  }
  .msg :global(ul),
  .msg :global(ol) {
    padding-left: var(--space-5);
  }

  /* A reply is not a document: its headings are emphasis, not a title page. */
  .msg :global(.prose h1),
  .msg :global(.prose h2),
  .msg :global(.prose h3),
  .msg :global(.prose h4),
  .msg :global(.prose h5),
  .msg :global(.prose h6) {
    font-size: var(--text-md);
    line-height: var(--leading-ui);
    font-weight: var(--weight-strong);
    color: var(--ink-strong);
  }
  .msg :global(.prose > * + h1),
  .msg :global(.prose > * + h2),
  .msg :global(.prose > * + h3),
  .msg :global(.prose > * + h4),
  .msg :global(.prose > * + h5),
  .msg :global(.prose > * + h6) {
    margin-top: var(--space-5);
  }

  .msg :global(code) {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    background: var(--surface-sunken);
    padding: 1px 4px;
    border-radius: var(--radius-mark);
  }
  /* A fence renders through OutputBlock, which paints its own well inside a
     `.not-prose` wrapper; the direct-child selector is the fallback for any
     `pre` that reaches prose itself, and leaves OutputBlock's alone. */
  .msg :global(.prose > pre) {
    font-family: var(--font-mono);
    font-size: var(--text-sm);
    line-height: var(--leading-body);
    background: var(--surface-sunken);
    border-radius: var(--radius-well);
    padding: var(--space-3);
    overflow-x: auto;
  }
  .msg :global(.prose > pre code) {
    background: none;
    padding: 0;
    font-size: inherit;
  }
</style>
