<script lang="ts">
  import Magnifier from "~icons/solar/magnifer-linear";

  let {
    value = $bindable(""),
    placeholder,
    "aria-controls": controls,
    "aria-expanded": expanded,
    "aria-activedescendant": active,
    onkeydown,
    id,
    element = $bindable(),
  }: {
    value?: string;
    placeholder: string;
    "aria-controls": string;
    "aria-expanded": boolean;
    "aria-activedescendant"?: string;
    onkeydown?: (event: KeyboardEvent) => void;
    id?: string;
    element?: HTMLInputElement;
  } = $props();
</script>

<div class="search">
  <Magnifier />
  <input
    aria-activedescendant={active}
    aria-autocomplete="list"
    aria-controls={controls}
    aria-expanded={expanded}
    aria-label={placeholder}
    {id}
    {onkeydown}
    {placeholder}
    role="combobox"
    bind:this={element}
    bind:value
  >
</div>

<style>
  .search {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    background: var(--surface-overlay);
    border-bottom: 1px solid var(--border-divider);
    color: var(--ink-muted);
  }
  .search :global(svg) {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }
  input {
    width: 100%;
    min-width: 0;
    height: 32px;
    padding: 0 var(--space-1);
    border: 0;
    border-radius: calc(var(--radius-modal) - var(--space-2));
    background: transparent;
    color: var(--ink-strong);
    font: 400 var(--text-base) / var(--leading-ui) var(--font-body);
  }
  input::placeholder {
    color: var(--ink-muted);
  }
  input:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
  @media (pointer: coarse) {
    input {
      min-height: 44px;
    }
  }
  @media (max-width: 479px) {
    input {
      font-size: 16px;
    }
  }
</style>
