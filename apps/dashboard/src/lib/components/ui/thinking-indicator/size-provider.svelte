<script lang="ts">
  import type { Snippet } from "svelte";
  import { type SizeVariant, setSizeContext } from "./size-context";

  let {
    size = "default",
    children,
  }: {
    size?: SizeVariant;
    children: Snippet;
  } = $props();

  setSizeContext(() => size);
</script>

{@render children()}
