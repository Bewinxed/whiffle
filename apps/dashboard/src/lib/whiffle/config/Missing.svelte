<script lang="ts">
  /** What an editor URL shows when the row it names is not in the list. */
  import { Button } from "$lib/components/ui/button";
  import EmptyHead from "./EmptyHead.svelte";
  import SectionFrame from "./SectionFrame.svelte";

  let { title, what, back }: { title: string; what: string; back: string } =
    $props();
</script>

<SectionFrame purpose="" {title}>
  <EmptyHead
    line="It was deleted, or the link is from another hub."
    title="That {what} is gone"
  />
  <div><Button href={back} variant="outline">Back to {title}</Button></div>
</SectionFrame>
