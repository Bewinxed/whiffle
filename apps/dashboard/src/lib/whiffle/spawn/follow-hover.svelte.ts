/**
 * The follow-hover ghost (PORT-SPEC §2.4): one absolutely positioned span per
 * list that slides to whichever `[data-fh]` row is nearest the pointer, and
 * fades out in place on leave so the exit never jumps.
 */
export class FollowHover {
  x = $state(0);
  y = $state(0);
  w = $state(0);
  h = $state(0);
  o = $state(0);
  i = $state(-1);
  /** `xy` for a grid, where the nearest row can be beside or below. */
  readonly axis: "x" | "y" | "xy";

  constructor(axis: "x" | "y" | "xy" = "y") {
    this.axis = axis;
  }

  get style(): string {
    return `width:${this.w}px;height:${this.h}px;transform:translate(${this.x}px,${this.y}px);opacity:${this.o}`;
  }

  move = (event: MouseEvent): void => {
    const container = event.currentTarget as HTMLElement;
    const box = container.getBoundingClientRect();
    let best: DOMRect | null = null;
    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    const rows = container.querySelectorAll<HTMLElement>("[data-fh]");
    rows.forEach((row, index) => {
      if ((row as HTMLButtonElement).disabled) {
        return;
      }
      const rect = row.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      const distance = {
        x: Math.abs(dx),
        y: Math.abs(dy),
        xy: Math.hypot(dx, dy),
      }[this.axis];
      if (distance < bestDistance) {
        bestDistance = distance;
        best = rect;
        bestIndex = index;
      }
    });
    if (!best || (this.o && this.i === bestIndex)) {
      return;
    }
    const rect: DOMRect = best;
    this.x = rect.left - box.left + container.scrollLeft;
    this.y = rect.top - box.top + container.scrollTop;
    this.w = rect.width;
    this.h = rect.height;
    this.o = 1;
    this.i = bestIndex;
  };

  leave = (): void => {
    this.o = 0;
    this.i = -1;
  };
}
