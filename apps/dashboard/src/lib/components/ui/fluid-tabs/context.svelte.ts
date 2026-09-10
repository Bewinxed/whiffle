/**
 * Shared state for the Fluid Functionalism tabs: which value is chosen and
 * in what order the items sit (the root), and which item the pointer is
 * nearest (the list). Set by the root and the list, read by the items.
 */
import { getContext, setContext } from "svelte";
import type { ProximityHover } from "$lib/hooks/proximity-hover.svelte";

export type TabsSize = "default" | "compact";

export class TabsState {
  order = $state<string[]>([]);
  uncontrolled = $state<string | undefined>(undefined);
  controlled = $state<string | undefined>(undefined);
  selectedIndex = $state<number | undefined>(undefined);
  size = $state<TabsSize>("default");
  onValueChange: ((value: string) => void) | undefined;
  onSelect: ((index: number) => void) | undefined;

  constructor(defaultValue: string | undefined) {
    this.uncontrolled = defaultValue;
  }

  /** value > selectedIndex > uncontrolled > the first item. */
  get value(): string | undefined {
    if (this.controlled !== undefined) {
      return this.controlled;
    }
    if (this.selectedIndex !== undefined) {
      return this.order[this.selectedIndex];
    }
    return this.uncontrolled ?? this.order[0];
  }

  select(value: string): void {
    if (this.controlled === undefined && this.selectedIndex === undefined) {
      this.uncontrolled = value;
    }
    this.onValueChange?.(value);
    if (this.onSelect) {
      const index = this.order.indexOf(value);
      if (index !== -1) {
        this.onSelect(index);
      }
    }
  }

  setOrder(next: string[]): void {
    const same =
      next.length === this.order.length &&
      next.every((v, i) => v === this.order[i]);
    if (!same) {
      this.order = next;
    }
  }
}

export class TabsListState {
  hover: ProximityHover;
  /** Where the indicator is drawn — moved on click, ahead of the value. */
  optimisticIndex = $state<number | null>(null);
  focusedIndex = $state<number | null>(null);
  #next = 0;

  constructor(hover: ProximityHover) {
    this.hover = hover;
  }

  /** Items take an index in mount order. */
  claim(): number {
    const index = this.#next;
    this.#next += 1;
    return index;
  }
}

const TABS = Symbol("fluid-tabs");
const LIST = Symbol("fluid-tabs-list");

export function provideTabs(state: TabsState): void {
  setContext(TABS, state);
}
export function useTabs(): TabsState {
  return getContext<TabsState>(TABS);
}
export function provideList(state: TabsListState): void {
  setContext(LIST, state);
}
export function useList(): TabsListState {
  return getContext<TabsListState>(LIST);
}
