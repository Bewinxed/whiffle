<script lang="ts">
  /** A flat card holding one figure: label, value in the KPI role, unit. */
  // biome-ignore lint/performance/noNamespaceImport: shadcn-svelte convention for component groups
  import * as Card from "$lib/components/ui/card";

  interface Props {
    label: string;
    unit?: string;
    value: string | number;
  }

  let { label, value, unit }: Props = $props();
</script>

<Card.Root class="st-card">
  <span class="st-label">{label}</span>
  <span class="st-value">{value}</span>
  {#if unit}
    <span class="st-unit">{unit}</span>
  {/if}
</Card.Root>

<style>
  :global(.st-card) {
    height: 100%;
    justify-content: center;
    gap: 10px;
    padding-inline: 18px;
  }
  .st-label {
    font: var(--type-label);
    color: var(--ink-muted);
  }
  .st-value {
    font: var(--type-kpi);
    font-variant-numeric: tabular-nums;
    color: var(--ink-strong);
  }
  .st-unit {
    font: var(--type-meta);
    color: var(--ink-muted);
  }
  @media (max-width: 900px) {
    .st-value {
      font: var(--type-title);
    }
  }
</style>
