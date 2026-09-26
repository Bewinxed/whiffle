<script lang="ts">
  import { whiffle } from "$lib/whiffle/client.svelte";
  import SectionFrame from "$lib/whiffle/config/SectionFrame.svelte";
  import { sectionOf } from "$lib/whiffle/config/sections";
  import { configStore } from "$lib/whiffle/config/store.svelte";
  import { orderMachines } from "$lib/whiffle/rail.svelte";
  import ToolMatrix from "$lib/whiffle/ToolMatrix.svelte";

  /**
   * The CLIs each machine carries, machine by machine. Require one on every
   * machine and the hub puts it there — on the machines online now, and on the
   * rest as they come back.
   */
  const store = configStore();
  const section = sectionOf("cli-tools");
  const machines = $derived(orderMachines(whiffle.machines));
</script>

<SectionFrame
  problem={store.tools.error}
  purpose={section.purpose}
  ready={store.tools.value !== null}
  title={section.label}
>
  {#if store.tools.value}
    <ToolMatrix
      catalog={store.tools.value.catalog}
      {machines}
      policies={store.tools.value.policies}
    />
  {/if}
</SectionFrame>
