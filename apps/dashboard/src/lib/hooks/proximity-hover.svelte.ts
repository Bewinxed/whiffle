/**
 * Proximity hover: which registered item is nearest the pointer inside a
 * container, so a highlight can follow the hand rather than the exact box
 * under it — the gaps between items are never dead.
 *
 * A port of Fluid Functionalism's `useProximityHover`. Rects are layout
 * values (`offset*`), accumulated up to the container, so they are in the
 * container's own coordinate space — the space an absolutely positioned
 * indicator lives in — and unaffected by transforms on ancestors.
 */

export interface ItemRect {
  height: number;
  left: number;
  top: number;
  width: number;
}

export type Axis = "x" | "y" | "xy";

export class ProximityHover {
  activeIndex = $state<number | null>(null);
  rects = $state<ItemRect[]>([]);
  /** True once every registered item has a measured box. */
  measured = $state(false);
  /** The container's own inner size, re-read with the items: a track that
      narrows moves what is in view even when no item moved. */
  viewport = $state({ width: 0, height: 0 });

  readonly #axis: Axis;
  #container: HTMLElement | null = null;
  #items = new Map<number, HTMLElement>();
  #frame: number | null = null;
  #measureFrame: number | null = null;
  #observer: ResizeObserver | null = null;
  #inside = false;

  constructor(axis: Axis = "y") {
    this.#axis = axis;
  }

  get inside(): boolean {
    return this.#inside;
  }

  /** Svelte action for the container. */
  container = (node: HTMLElement) => {
    this.#container = node;
    this.#observer = new ResizeObserver(() => this.#schedule());
    this.#observer.observe(node);
    for (const el of this.#items.values()) {
      this.#observer.observe(el);
    }
    const onmove = (event: PointerEvent) => this.#move(event);
    const onenter = () => {
      this.#inside = true;
    };
    const onleave = () => {
      this.#inside = false;
      this.leave();
    };
    node.addEventListener("pointermove", onmove);
    node.addEventListener("pointerenter", onenter);
    node.addEventListener("pointerleave", onleave);
    this.#schedule();
    return {
      destroy: () => {
        node.removeEventListener("pointermove", onmove);
        node.removeEventListener("pointerenter", onenter);
        node.removeEventListener("pointerleave", onleave);
        this.#observer?.disconnect();
        this.#observer = null;
        this.#container = null;
        if (this.#frame !== null) {
          cancelAnimationFrame(this.#frame);
        }
        if (this.#measureFrame !== null) {
          cancelAnimationFrame(this.#measureFrame);
        }
      },
    };
  };

  /** Registers an item at an index for as long as it is mounted. */
  register(index: number, element: HTMLElement): () => void {
    this.#items.set(index, element);
    this.#observer?.observe(element);
    this.#schedule();
    return () => {
      if (this.#items.get(index) === element) {
        this.#items.delete(index);
      }
      this.#observer?.unobserve(element);
      this.#schedule();
    };
  }

  leave(): void {
    if (this.#frame !== null) {
      cancelAnimationFrame(this.#frame);
      this.#frame = null;
    }
    this.activeIndex = null;
  }

  #schedule(): void {
    if (this.#measureFrame !== null) {
      cancelAnimationFrame(this.#measureFrame);
    }
    this.#measureFrame = requestAnimationFrame(() => {
      this.#measureFrame = null;
      this.measure();
    });
  }

  measure(): void {
    const container = this.#container;
    if (!container) {
      return;
    }
    const rects: ItemRect[] = [];
    let complete = true;
    for (const [index, element] of this.#items) {
      if (
        element.offsetParent === null &&
        element.offsetWidth === 0 &&
        element.offsetHeight === 0
      ) {
        complete = false;
        continue;
      }
      let top = element.offsetTop;
      let left = element.offsetLeft;
      let ancestor = element.offsetParent as HTMLElement | null;
      while (
        ancestor &&
        ancestor !== container &&
        container.contains(ancestor)
      ) {
        top += ancestor.offsetTop + ancestor.clientTop;
        left += ancestor.offsetLeft + ancestor.clientLeft;
        ancestor = ancestor.offsetParent as HTMLElement | null;
      }
      rects[index] = {
        top,
        left,
        width: element.offsetWidth,
        height: element.offsetHeight,
      };
    }
    const prev = this.rects;
    let changed = prev.length !== rects.length;
    for (let i = 0; !changed && i < rects.length; i += 1) {
      const p = prev[i];
      const r = rects[i];
      if (p === r) {
        continue;
      }
      changed =
        !(p && r) ||
        p.top !== r.top ||
        p.left !== r.left ||
        p.width !== r.width ||
        p.height !== r.height;
    }
    if (changed) {
      this.rects = rects;
    }
    if (
      container.clientWidth !== this.viewport.width ||
      container.clientHeight !== this.viewport.height
    ) {
      this.viewport = {
        width: container.clientWidth,
        height: container.clientHeight,
      };
    }
    this.measured = complete;
  }

  /** One rect's distance from the pointer along the axis, and whether it contains it. */
  #gauge(
    r: ItemRect,
    view: { box: DOMRect; scaleX: number; scaleY: number; el: HTMLElement },
    x: number,
    y: number
  ): { distance: number; contains: boolean } {
    const { box, scaleX, scaleY, el } = view;
    const left = box.left + (el.clientLeft + r.left - el.scrollLeft) * scaleX;
    const top = box.top + (el.clientTop + r.top - el.scrollTop) * scaleY;
    const width = r.width * scaleX;
    const height = r.height * scaleY;
    const inX = x >= left && x <= left + width;
    const inY = y >= top && y <= top + height;
    const cx = left + width / 2;
    const cy = top + height / 2;
    switch (this.#axis) {
      case "xy":
        return { distance: Math.hypot(x - cx, y - cy), contains: inX && inY };
      case "x":
        return { distance: Math.abs(x - cx), contains: inX };
      default:
        return { distance: Math.abs(y - cy), contains: inY };
    }
  }

  #move(event: PointerEvent): void {
    if (event.pointerType !== "mouse") {
      return;
    }
    const x = event.clientX;
    const y = event.clientY;
    if (this.#frame !== null) {
      cancelAnimationFrame(this.#frame);
    }
    this.#frame = requestAnimationFrame(() => {
      this.#frame = null;
      const el = this.#container;
      if (!el) {
        return;
      }
      const box = el.getBoundingClientRect();
      const view = {
        box,
        el,
        scaleX: el.offsetWidth > 0 ? box.width / el.offsetWidth : 1,
        scaleY: el.offsetHeight > 0 ? box.height / el.offsetHeight : 1,
      };
      let nearest: number | null = null;
      let best = Number.POSITIVE_INFINITY;
      let containing: number | null = null;
      const { rects } = this;
      for (let index = 0; index < rects.length; index += 1) {
        const r = rects[index];
        if (!r) {
          continue;
        }
        const { distance, contains } = this.#gauge(r, view, x, y);
        if (contains) {
          containing = index;
        }
        if (distance < best) {
          best = distance;
          nearest = index;
        }
      }
      this.activeIndex = containing ?? nearest;
    });
  }
}
