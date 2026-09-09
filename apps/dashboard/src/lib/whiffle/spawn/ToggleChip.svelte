<script lang="ts">
  let {
    label,
    checked,
    disabled = false,
    reason,
    onchange,
    id,
  }: {
    label: string;
    checked: boolean;
    disabled?: boolean;
    reason?: string;
    onchange: (checked: boolean) => void;
    id?: string;
  } = $props();
  const uid = $props.id();
</script>

<button
  aria-checked={checked}
  aria-describedby={reason ? `${uid}-reason` : undefined}
  {disabled}
  {id}
  onclick={() => onchange(!checked)}
  role="switch"
  type="button"
>
  <svg
    aria-hidden="true"
    fill="none"
    height="14"
    viewBox="0 0 14 14"
    width="14"
  >
    <path d="m3 7 2.5 2.5L11 4" pathLength="1" />
  </svg>
  {label}
</button>
{#if reason}
  <span class="reason" id={`${uid}-reason`}>{reason}</span>
{/if}

<style>
  button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 28px;
    padding: 0 var(--space-3);
    border: 1px solid var(--border-hairline);
    border-radius: var(--radius-pill);
    background: var(--surface-field);
    color: var(--ink-body);
    font: 400 var(--text-sm) / var(--leading-ui) var(--font-body);
    cursor: pointer;
    transition: background var(--c-100) var(--e-toggle);
  }
  button[aria-checked="true"] {
    background: var(--surface-active);
    color: var(--ink-strong);
  }
  svg {
    flex-shrink: 0;
  }
  path {
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-dasharray: 1;
    stroke-dashoffset: 1;
    transition: stroke-dashoffset var(--c-300) var(--e-in);
  }
  [aria-checked="true"] path {
    stroke-dashoffset: 0;
  }
  button:active:not(:disabled) {
    background: var(--surface-active);
    box-shadow: var(--shadow-inset-sel);
  }
  button:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }
  button:disabled {
    color: var(--ink-muted);
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
  @media (hover: hover) {
    button:hover:not(:disabled) {
      background: var(--surface-hover);
    }
  }
  @media (pointer: coarse) {
    button {
      min-height: 44px;
      min-width: 44px;
    }
  }
</style>
