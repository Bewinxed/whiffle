<script lang="ts">
  import { IconChevronRight } from "$lib/icons";
  import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";
  import { cn } from "$lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    inset,
    children,
    ...restProps
  }: DropdownMenuPrimitive.SubTriggerProps & {
    inset?: boolean;
  } = $props();
</script>

<DropdownMenuPrimitive.SubTrigger
  class={cn(
		"kit-item flex cursor-default select-none items-center gap-2 text-label outline-hidden data-[inset]:pl-8 data-inset:pl-9.5 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0 px-2.5 data-open:bg-[var(--surface-hover)]",
		className
	)}
  data-inset={inset}
  data-slot="dropdown-menu-sub-trigger"
  bind:ref
  {...restProps}
>
  {@render children?.()}
  <IconChevronRight class="ml-auto" />
</DropdownMenuPrimitive.SubTrigger>
