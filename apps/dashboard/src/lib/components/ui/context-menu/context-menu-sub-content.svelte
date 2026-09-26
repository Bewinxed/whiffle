<script lang="ts">
  import { ContextMenu as ContextMenuPrimitive } from "bits-ui";
  import { cn } from "$lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: ContextMenuPrimitive.SubContentProps = $props();
</script>

<ContextMenuPrimitive.SubContent
  class={cn("kit-pop relative min-w-32 origin-(--bits-context-menu-content-transform-origin)", className)}
  data-slot="context-menu-sub-content"
  bind:ref
  {...restProps}
/>
