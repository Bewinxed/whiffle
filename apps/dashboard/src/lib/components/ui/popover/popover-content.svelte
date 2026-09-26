<script lang="ts">
  import { Popover as PopoverPrimitive } from "bits-ui";
  import type { ComponentProps } from "svelte";
  import { cn, type WithoutChildrenOrChild } from "$lib/utils.js";
  import PopoverPortal from "./popover-portal.svelte";

  let {
    ref = $bindable(null),
    class: className,
    sideOffset = 4,
    align = "center",
    portalProps,
    ...restProps
  }: PopoverPrimitive.ContentProps & {
    portalProps?: WithoutChildrenOrChild<ComponentProps<typeof PopoverPortal>>;
  } = $props();
</script>

<PopoverPortal {...portalProps}>
  <PopoverPrimitive.Content
    {align}
    class={cn(
			"kit-pop z-50 flex w-72 origin-(--bits-popover-content-transform-origin) flex-col gap-4 text-label outline-hidden",
			className
		)}
    data-slot="popover-content"
    {sideOffset}
    bind:ref
    {...restProps}
  />
</PopoverPortal>
