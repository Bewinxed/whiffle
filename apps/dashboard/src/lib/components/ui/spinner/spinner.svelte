<script lang="ts">
  import { IconSpinner } from "$lib/icons";
  import type { SVGAttributes } from "svelte/elements";
  import { cn } from "$lib/utils.js";

  let {
    class: className,
    role = "status",
    // we add name, color, and stroke for compatibility with different icon libraries props
    name,
    color,
    stroke,
    "aria-label": ariaLabel = "Loading",
    ...restProps
  }: SVGAttributes<SVGSVGElement> = $props();
</script>

<IconSpinner
  aria-label={ariaLabel}
  class={cn("size-4 animate-spin", className)}
  style:color={color === null ? undefined : color}
  name={name === null ? undefined : name}
  {role}
  stroke={stroke === null ? undefined : stroke}
  {...(restProps as Record<string, unknown>)} />
