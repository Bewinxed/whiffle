<script lang="ts">
  /**
   * Configure: every fleet-wide setting behind one rail. The rail and the
   * section share one store, read once when the area opens, so the counts
   * beside each entry are the rows the section shows.
   */
  import { onMount } from "svelte";
  import { page } from "$app/state";
  // biome-ignore lint/performance/noNamespaceImport: shadcn-svelte component-group convention
  import * as Tooltip from "$lib/components/ui/tooltip";
  import ConfigRail from "$lib/whiffle/config/ConfigRail.svelte";
  import {
    LAST_KEY,
    SECTIONS,
    type SectionSlug,
  } from "$lib/whiffle/config/sections";
  import { ConfigStore, provideConfig } from "$lib/whiffle/config/store.svelte";

  let { children } = $props();

  const store = provideConfig(new ConfigStore());
  onMount(() => {
    // biome-ignore lint/complexity/noVoid: each slot reports its own outcome
    void store.loadAll();
  });

  const slug = $derived(
    SECTIONS.find((section) => section.slug === page.url.pathname.split("/")[2])
      ?.slug as SectionSlug | undefined
  );

  $effect(() => {
    if (slug) {
      localStorage.setItem(LAST_KEY, slug);
    }
  });
</script>

<Tooltip.Provider>
  <div class="config">
    {#if slug}
      <div class="side"><ConfigRail current={slug} /></div>
    {/if}
    <div class="pane">{@render children()}</div>
  </div>
</Tooltip.Provider>

<style>
  .config {
    display: flex;
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    background: var(--surface-recess);
  }
  .side {
    display: flex;
    min-height: 0;
  }
  .pane {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
  }
  @media (max-width: 900px) {
    .side {
      display: none;
    }
  }
</style>
