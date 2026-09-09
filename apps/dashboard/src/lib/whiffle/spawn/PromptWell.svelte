<script lang="ts">
  let {
    value = $bindable(""),
    placeholder = "What should this session do?",
    minRows = 5,
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
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-well);
    background: var(--surface-field);
    color: var(--ink-strong);
    font: 400 var(--text-md) / var(--leading-body) var(--font-body);
  }
  textarea::placeholder {
    color: var(--ink-muted);
  }
  textarea:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
  @media (max-width: 479px) {
    textarea {
      font-size: 16px;
    }
  }
</style>
