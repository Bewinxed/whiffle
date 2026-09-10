<script generics="T" lang="ts">
  // biome-ignore-all lint/style/useAtIndex: faces always has a current face; indexed access retains its required type.
  import { type Snippet, untrack } from "svelte";
  import { ARRIVAL } from "./arrival";

  let {
    phase,
    value,
    children,
  }: { phase: string; value: T; children: Snippet<[T]> } = $props();
  let box = $state<HTMLElement>();
  let previous = untrack(() => phase);
  let serial = 0;
  let faces = $state([
    {
      id: serial,
      value: untrack(() => value),
      leaving: false,
      element: undefined as HTMLElement | undefined,
    },
  ]);
  const content = $derived(faces[faces.length - 1].element);
  let from: number | null = null;
  let changing = $state(false);

  // Outgoing faces retain their data while the incoming face streams. A
  // snippet reading the parent's current row would erase the outgoing text.
  $effect.pre(() => {
    const next = value;
    const nextPhase = phase;
    untrack(() => {
      if (nextPhase === previous) {
        faces[faces.length - 1].value = next;
        return;
      }
      previous = nextPhase;
      from = box?.getBoundingClientRect().height ?? 0;
      serial += 1;
      faces = [
        { ...faces[faces.length - 1], leaving: true },
        { id: serial, value: next, leaving: false, element: undefined },
      ];
    });
  });

  $effect(() => {
    const outer = box;
    const inner = content;
    if (!(outer && inner)) {
      return;
    }
    const measure = () => {
      outer.style.setProperty("--swap-to", `${inner.offsetHeight}px`);
      if (from !== null) {
        outer.style.setProperty("--swap-from", `${from}px`);
        outer.style.animation = "none";
        outer.getBoundingClientRect();
        outer.style.animation = "";
        changing = true;
        from = null;
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(inner);
    return () => observer.disconnect();
  });

  $effect(() => {
    if (!faces.some((face) => face.leaving)) {
      return;
    }
    const timer = setTimeout(
      settle,
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 0
        : ARRIVAL.reserveMs + 50
    );
    return () => clearTimeout(timer);
  });

  function settle() {
    faces = untrack(() => faces.filter((face) => !face.leaving));
    changing = false;
  }
</script>

<div
  class="swap"
  onanimationend={(event) => {
  if (event.target === box && event.animationName.endsWith("reserve")) {
    settle();
  }
}}
  bind:this={box}
  style:--swap-ms={`${ARRIVAL.reserveMs}ms`}
  class:changing={changing}
>
  {#each faces as face (face.id)}
    <div
      aria-hidden={face.leaving ? true : undefined}
      class="face"
      inert={face.leaving}
      bind:this={face.element}
      class:entering={face.id > 0 && !face.leaving}
      class:leaving={face.leaving}
    >
      {@render children(face.value)}
    </div>
  {/each}
</div>

<style>
  .swap {
    position: relative;
    overflow: hidden;
  }
  .face {
    min-width: 0;
    display: flow-root;
  }
  .leaving {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .changing {
    height: var(--swap-to);
  }
  @media (prefers-reduced-motion: no-preference) {
    .changing {
      animation: swap-reserve var(--swap-ms) linear;
    }
    .leaving {
      animation: leave 160ms var(--e-out) forwards;
    }
    .entering {
      animation: enter 160ms var(--e-in);
    }
  }
  @keyframes swap-reserve {
    from {
      height: var(--swap-from);
    }
    to {
      height: var(--swap-to);
    }
  }
  @keyframes leave {
    to {
      opacity: 0;
    }
  }
  @keyframes enter {
    from {
      opacity: 0;
    }
  }
</style>
