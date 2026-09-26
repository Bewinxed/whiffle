<script lang="ts">
  import { IconChevronRight } from "$lib/icons";
  import { ContextMenu as ContextMenuPrimitive } from "bits-ui";
  import { cn, type WithoutChild } from "$lib/utils.js";

  let {
    ref = $bindable(null),
    class: className,
    inset,
    children,
    ...restProps
  }: WithoutChild<ContextMenuPrimitive.SubTriggerProps> & {
    inset?: boolean;
  } = $props();
</script>

<ContextMenuPrimitive.SubTrigger
  class={cn(
		"kit-item flex cursor-default select-none items-center text-label outline-hidden data-inset:ps-8 data-inset:pl-9.5 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0 px-2.5 data-open:bg-[var(--surface-hover)]",
		className
	)}
  data-inset={inset}
  data-slot="context-menu-sub-trigger"
  bind:ref
  {...restProps}
>
  {@render children?.()}
  <IconChevronRight class="ml-auto" />
</ContextMenuPrimitive.SubTrigger>
