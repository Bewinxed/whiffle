<script lang="ts">
  import { Collapsible } from "bits-ui";

  let { class: className = "", ...rest }: Collapsible.ContentProps = $props();
</script>

<Collapsible.Content
  {...rest}
  class="thinking-content {className}"
  data-slot="thinking-steps-content"
/>

<style>
  :global(.thinking-content) {
    overflow: hidden;
  }
  @media (prefers-reduced-motion: no-preference) {
    :global(.thinking-content[data-state="open"]) {
      animation: thinking-open-reserve calc(var(--dur-control) * 2)
        var(--ease-out);
    }
    :global(.thinking-content[data-state="closed"]) {
      animation: thinking-close-reserve var(--dur-exit) var(--ease-out);
    }
  }
  @keyframes thinking-open-reserve {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  @keyframes thinking-close-reserve {
    from {
      opacity: 1;
    }
    to {
      opacity: 0;
    }
  }
</style>
