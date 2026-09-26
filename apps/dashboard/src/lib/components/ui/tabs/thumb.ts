/**
 * Slides the thumb of a segmented group (tabs, single toggle group) under
 * its selected item. Only `transform` animates: the thumb takes the new size
 * at once and a FLIP scale from the old size covers the change.
 */
export function slideThumb(
  group: HTMLElement,
  thumb: HTMLElement,
  selector: string
): () => void {
  let last: { x: number; y: number; w: number; h: number } | undefined;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  const place = (animate: boolean) => {
    const on = group.querySelector<HTMLElement>(selector);
    if (!on) {
      thumb.style.opacity = "0";
      last = undefined;
      return;
    }
    const next = {
      x: on.offsetLeft,
      y: on.offsetTop,
      w: on.offsetWidth,
      h: on.offsetHeight,
    };
    thumb.style.opacity = "1";
    thumb.style.width = `${next.w}px`;
    thumb.style.height = `${next.h}px`;
    thumb.style.transform = `translate(${next.x}px, ${next.y}px)`;
    if (animate && last && last.x !== next.x && !reduce.matches) {
      thumb.animate(
        [
          {
            transform: `translate(${last.x}px, ${last.y}px) scale(${last.w / next.w}, ${last.h / next.h})`,
          },
          { transform: `translate(${next.x}px, ${next.y}px)` },
        ],
        {
          duration: 240,
          easing: getComputedStyle(group).getPropertyValue("--ease-in-out"),
        }
      );
    }
    last = next;
  };

  place(false);
  const changes = new MutationObserver(() => place(true));
  changes.observe(group, {
    subtree: true,
    attributes: true,
    attributeFilter: ["data-state"],
  });
  const sizes = new ResizeObserver(() => place(false));
  sizes.observe(group);
  return () => {
    changes.disconnect();
    sizes.disconnect();
  };
}
