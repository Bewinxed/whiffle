<script lang="ts">
  /** Footer (§1.9): lifetime segmented, Cancel, Start. */
  import Database from "~icons/solar/database-bold-duotone";
  import Fire from "~icons/solar/fire-bold-duotone";
  import Segmented from "./Segmented.svelte";

  let {
    ephemeral,
    onlifetime,
    oncancel,
    onstart,
    startLabel,
    disabled,
    busy,
  }: {
    ephemeral: boolean;
    onlifetime: (ephemeral: boolean) => void;
    oncancel: () => void;
    onstart: () => void;
    startLabel: string;
    disabled: boolean;
    busy: boolean;
  } = $props();
</script>

<div class="footer" data-ns-footer>
  <div class="lifetime" data-ns-summary>
    <Segmented
      items={[{ value: "ephemeral", label: "Ephemeral" }, { value: "persistent", label: "Persistent" }]}
      label="Session lifetime"
      onchange={(value) => onlifetime(value === "ephemeral")}
      size="md"
      value={ephemeral ? "ephemeral" : "persistent"}
    >
      {#snippet icon(value)}
        {#if value === "ephemeral"}
          <Fire style="color:var(--fai-orange-500)" />
        {:else}
          <Database style="color:var(--fai-blue-500)" />
        {/if}
      {/snippet}
    </Segmented>
  </div>
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
  .lifetime {
    margin-right: auto;
  }
  .lifetime :global(.tab svg) {
    width: 15px;
    height: 15px;
  }
  #session-start {
    min-width: 96px;
  }
  @media (max-width: 640px) {
    .footer {
      flex-wrap: wrap;
      padding-bottom: max(10px, env(safe-area-inset-bottom));
    }
    .lifetime {
      width: 100%;
      order: -1;
      margin-right: 0;
    }
    .ns-btn {
      height: 44px;
      flex: 1;
    }
  }
</style>
