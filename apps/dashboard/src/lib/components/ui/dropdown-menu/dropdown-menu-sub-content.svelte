<script lang="ts">
  import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";
  import { cn } from "$lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    ...restProps
  }: DropdownMenuPrimitive.SubContentProps = $props();
</script>

<DropdownMenuPrimitive.SubContent
  class={cn("kit-pop relative w-auto min-w-36 origin-(--bits-dropdown-menu-content-transform-origin)", className)}
  data-slot="dropdown-menu-sub-content"
  bind:ref
  {...restProps}
/>
