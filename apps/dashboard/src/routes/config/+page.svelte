<script lang="ts">
  import ConfigRail from "$lib/whiffle/config/ConfigRail.svelte";
</script>

<svelte:head><title>Configure · Whiffle</title></svelte:head>

<div class="list"><ConfigRail variant="list" /></div>

<style>
  .list {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
  }
</style>
