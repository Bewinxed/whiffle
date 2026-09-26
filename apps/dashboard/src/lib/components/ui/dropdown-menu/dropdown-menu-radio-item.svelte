<script lang="ts">
  import { IconTick } from "$lib/icons";
  import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";
  import { cn, type WithoutChild } from "$lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    children: childrenProp,
    ...restProps
  }: WithoutChild<DropdownMenuPrimitive.RadioItemProps> = $props();
</script>

<DropdownMenuPrimitive.RadioItem
  class={cn(
		"kit-item relative flex cursor-default select-none items-center gap-2.5 pr-8 text-label outline-hidden data-[disabled]:pointer-events-none data-inset:pl-9.5 data-[disabled]:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0 pl-2.5",
		className
	)}
  data-slot="dropdown-menu-radio-item"
  bind:ref
  {...restProps}
>
  {#snippet children({ checked })}
    <span
      class="absolute right-2 flex items-center justify-center pointer-events-none"
      data-slot="dropdown-menu-radio-item-indicator"
    >
      {#if checked}
        <IconTick />
      {/if}
    </span>
    {@render childrenProp?.({ checked })}
  {/snippet}
</DropdownMenuPrimitive.RadioItem>
