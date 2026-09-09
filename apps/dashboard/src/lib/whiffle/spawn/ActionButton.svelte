<script lang="ts">
  let {
    label,
    busy = false,
    busyLabel = "Starting…",
    disabled = false,
    onclick,
    reason,
    id,
  }: {
    label: string;
    busy?: boolean;
    busyLabel?: string;
    disabled?: boolean;
    onclick: () => void;
    reason?: string;
    id?: string;
  } = $props();
  const uid = $props.id();
</script>

<button
  aria-busy={busy}
  aria-describedby={reason ? `${uid}-reason` : undefined}
  aria-label={busy ? busyLabel : label}
  disabled={disabled || busy}
  {id}
  {onclick}
  type="button"
>
  <span aria-hidden="true" class="labels"
    ><span class:visible={!busy}>{label}</span
    ><span class:visible={busy}>{busyLabel}</span></span
  >
</button>
{#if reason}
  <span class="reason" id={`${uid}-reason`}>{reason}</span>
{/if}

<style>
  button {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 36px;
    padding: 0 var(--space-4);
    border: 0;
    border-radius: var(--radius-control);
    background: var(--gradient-action);
    box-shadow: var(--shadow-action);
    color: var(--on-brand);
    font: 450 var(--text-base) / var(--leading-ui) var(--font-body);
    cursor: pointer;
    transition:
      transform var(--c-100) var(--e-in),
      box-shadow var(--c-100) var(--e-in);
  }
  .labels {
    display: grid;
    align-items: center;
    justify-items: center;
  }
  .labels > span {
    display: flex;
    align-items: center;
    justify-content: center;
    grid-area: 1 / 1;
    opacity: 0;
    transition: opacity var(--c-100) var(--e-toggle);
  }
  .labels > .visible {
    opacity: 1;
  }
  button:active:not(:disabled) {
    transform: translateY(0.5px);
    box-shadow: var(--shadow-inset-sel);
  }
  button:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
  button:disabled {
    opacity: 0.55;
    cursor: default;
  }
  .reason {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
  @media (pointer: coarse) {
    button {
      min-height: 44px;
      min-width: 44px;
    }
  }
</style>
