<script lang="ts">
  /** Footer (§1.9): Cancel and Start. Lifetime lives in the composer's chips. */
  let {
    oncancel,
    onstart,
    startLabel,
    disabled,
    busy,
  }: {
    oncancel: () => void;
    onstart: () => void;
    startLabel: string;
    disabled: boolean;
    busy: boolean;
  } = $props();
</script>

<div class="footer" data-ns-footer>
  <button class="ns-btn" onclick={oncancel} type="button">Cancel</button>
  <button
    aria-busy={busy}
    class="ns-btn primary"
    {disabled}
    id="session-start"
    onclick={onstart}
    type="button"
  >
    {busy ? "Starting…" : startLabel}
  </button>
</div>

<style>
  .footer {
    flex: none;
    margin-top: 6px;
    background: var(--fai-surface);
    border-radius: var(--fai-radius-lg);
    padding: 10px 12px;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
  }
  #session-start {
    min-width: 96px;
  }
  @media (max-width: 640px) {
    .footer {
      padding-bottom: max(10px, env(safe-area-inset-bottom));
    }
    .ns-btn {
      height: 44px;
      flex: 1;
    }
  }
</style>
