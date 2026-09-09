<script lang="ts">
  let {
    value = $bindable(""),
    placeholder = "What should the agent do?",
    minRows = 8,
    maxRows = 10,
    onsubmit,
    element = $bindable(),
    id,
  }: {
    value?: string;
    placeholder?: string;
    minRows?: number;
    maxRows?: number;
    onsubmit: () => void;
    element?: HTMLTextAreaElement;
    id?: string;
  } = $props();
  function resize(_value = value) {
    if (!element) {
      return;
    }
    const css = getComputedStyle(element);
    const line = Number.parseFloat(css.lineHeight);
    const inset =
      Number.parseFloat(css.paddingTop) +
      Number.parseFloat(css.paddingBottom) +
      2;
    element.style.height = "0px";
    element.style.height = `${Math.max(minRows * line + inset, Math.min(element.scrollHeight + 2, maxRows * line + inset))}px`;
  }
  $effect(() => {
    resize(value);
  });
  $effect(() => {
    if (!element) {
      return;
    }
    let width = element.clientWidth;
    const observer = new ResizeObserver(() => {
      if (element && element.clientWidth !== width) {
        width = element.clientWidth;
        resize();
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  });
</script>

<textarea
  aria-label={placeholder}
  {id}
  onkeydown={(event) => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !event.isComposing) { event.preventDefault(); onsubmit(); } }}
  {placeholder}
  rows={minRows}
  bind:this={element}
  bind:value
></textarea>

<style>
  textarea {
    display: block;
    box-sizing: border-box;
    width: 100%;
    resize: none;
    overflow-y: auto;
    padding: var(--space-4);
    border: 0;
    border-radius: var(--radius-well);
    background: var(--surface-well);
    color: var(--ink-strong);
    font: 400 var(--text-md) / var(--leading-body) var(--font-body);
    box-shadow: var(--shadow-inset-sel);
    transition:
      color var(--c-100) var(--e-toggle),
      box-shadow var(--c-100) var(--e-toggle);
  }
  textarea::placeholder {
    color: var(--ink-muted);
  }
  /* A text field shows focus with its caret and a darkened edge, the same
     treatment as the popover search field; the ring is for non-text controls. */
  textarea:focus,
  textarea:focus-visible {
    outline: none;
    box-shadow: inset 0 1px 2px var(--shadow-tint-2);
  }
  @media (max-width: 479px) {
    textarea {
      font-size: 16px;
    }
  }
</style>
