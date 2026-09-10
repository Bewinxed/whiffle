<script lang="ts">
  /**
   * The first-prompt editor (§1.4, §2.3): a contenteditable that grows from
   * 44px to 120px, detects `@` / `/` at the caret and inserts chips. The prompt
   * that is sent is the editor's text with chips serialised as `@name`/`/name`.
   */
  import { mount, unmount } from "svelte";
  import type { MenuItem } from "./ns-types";
  import TriggerMenu from "./TriggerMenu.svelte";

  let {
    value = $bindable(""),
    element = $bindable(),
    menuItems,
    onsubmit,
    onmenu,
  }: {
    value?: string;
    element?: HTMLDivElement;
    menuItems: (type: "@" | "/", query: string) => MenuItem[];
    onsubmit: () => void;
    onmenu?: (open: boolean) => void;
  } = $props();
  interface Menu {
    end: number;
    node: Text;
    query: string;
    rect: DOMRect;
    start: number;
    type: "@" | "/";
  }
  const TRIGGER = /(^|[\s ])([@/])([\w./-]*)$/;
  const NAV = ["ArrowUp", "ArrowDown", "Enter", "Tab", "Escape"];
  let promptFocus = $state(false);
  let menu = $state.raw<Menu | null>(null);
  let menuIdx = $state(0);
  const items = $derived(menu ? menuItems(menu.type, menu.query) : []);
  const promptEmpty = $derived(!value);
  const promptH = $derived(promptFocus || value || menu ? 120 : 44);
  const anchor = $derived(
    menu ? { getBoundingClientRect: () => (menu as Menu).rect } : null
  );
  $effect(() => {
    onmenu?.(menu !== null);
  });
  const chips = new Map<HTMLElement, Record<string, unknown>>();

  function serialize(node: Node): string {
    let out = "";
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        out += child.textContent ?? "";
      } else if (child instanceof HTMLElement) {
        if (child.dataset.serial !== undefined) {
          out += child.dataset.serial;
        } else if (child.tagName === "BR") {
          out += "\n";
        } else {
          if (child.tagName === "DIV" && out && !out.endsWith("\n")) {
            out += "\n";
          }
          out += serialize(child);
        }
      }
    }
    return out;
  }
  const text = () =>
    serialize(element as Node)
      .replace(/ /g, " ")
      .trim();

  function closeMenu() {
    if (menu) {
      menu = null;
    }
  }
  function detectTrigger() {
    const selection = window.getSelection();
    if (
      !(
        element &&
        selection?.rangeCount &&
        element.contains(selection.anchorNode)
      )
    ) {
      closeMenu();
      return;
    }
    const node = selection.anchorNode;
    const offset = selection.anchorOffset;
    if (!(node instanceof Text)) {
      closeMenu();
      return;
    }
    const before = (node.textContent ?? "").slice(0, offset);
    const match = TRIGGER.exec(before);
    if (!match) {
      closeMenu();
      return;
    }
    const range = document.createRange();
    range.setStart(node, offset);
    range.collapse(true);
    const rect = range.getBoundingClientRect();
    const [, , trigger, query] = match;
    const type = trigger as "@" | "/";
    const next = menuItems(type, query);
    menuIdx = Math.min(menu ? menuIdx : 0, Math.max(0, next.length - 1));
    menu = {
      type,
      query,
      node,
      start: offset - match[2].length - match[3].length,
      end: offset,
      rect,
    };
  }
  function insertChip(item: MenuItem) {
    if (!(menu && element)) {
      return;
    }
    const chip = document.createElement("span");
    chip.contentEditable = "false";
    chip.dataset.chip = item.key;
    chip.dataset.serial = item.serial;
    chip.className = "ns-chip";
    const mark = document.createElement("span");
    mark.className = "ns-chip-icon";
    mark.style.color = item.hue;
    chip.append(mark);
    chips.set(chip, mount(item.icon, { target: mark }));
    const label = document.createElement("span");
    label.textContent = item.label;
    chip.append(label);
    const range = document.createRange();
    range.setStart(menu.node, menu.start);
    range.setEnd(menu.node, menu.end);
    range.deleteContents();
    const space = document.createTextNode(" ");
    range.insertNode(space);
    range.insertNode(chip);
    const selection = window.getSelection();
    const after = document.createRange();
    after.setStart(space, 1);
    after.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(after);
    item.apply();
    menu = null;
    value = text();
  }
  function onkeydown(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      onsubmit();
      return;
    }
    if (!menu) {
      return;
    }
    const count = Math.max(1, items.length);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      menuIdx = (menuIdx + 1) % count;
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      menuIdx = (menuIdx - 1 + count) % count;
    } else if ((event.key === "Enter" || event.key === "Tab") && items.length) {
      event.preventDefault();
      insertChip(items[menuIdx] ?? items[0]);
    } else if (event.key === "Escape") {
      // Without this the dialog's own Escape handler closes the whole modal.
      event.preventDefault();
      event.stopPropagation();
      menu = null;
    }
  }
  function caret(event: KeyboardEvent | MouseEvent) {
    if (!("key" in event && NAV.includes(event.key))) {
      detectTrigger();
    }
  }
  $effect(() => {
    if (value === "" && element && element.textContent !== "") {
      element.replaceChildren();
      for (const instance of chips.values()) {
        unmount(instance);
      }
      chips.clear();
    }
  });
</script>

<div class="editor-wrap">
  <!-- biome-ignore lint/a11y/useSemanticElements: a contenteditable is the only element that can hold inline chips; textarea cannot -->
  <div
    aria-label="First prompt"
    aria-multiline="true"
    class="editor fai-scroll"
    contenteditable="true"
    id="session-prompt"
    onblur={() => { promptFocus = false; closeMenu(); }}
    onclick={caret}
    onfocus={() => { promptFocus = true; }}
    oninput={() => { value = text(); detectTrigger(); }}
    {onkeydown}
    onkeyup={caret}
    role="textbox"
    style={`height:${promptH}px`}
    tabindex="0"
    bind:this={element}
  ></div>
  {#if promptEmpty}
    <span aria-hidden="true" class="placeholder"
      >What should the agent do first?
      <span class="hint"
        >@ machine or project · / skills and plugins</span
      ></span
    >
  {/if}
  <TriggerMenu
    {anchor}
    id="trigger-menu"
    index={menuIdx}
    {items}
    onchange={(open) => { if (!open) { closeMenu(); } }}
    onpick={insertChip}
    open={menu !== null}
  />
</div>

<style>
  .editor-wrap {
    position: relative;
  }
  .editor {
    width: 100%;
    padding: 12px 16px 6px;
    overflow: auto;
    outline: none;
    background: transparent;
    border-radius: 12px 12px 0 0;
    font: 400 14px / 1.55 var(--fai-font-sans);
    color: var(--fai-text);
    white-space: pre-wrap;
    word-break: break-word;
    transition: height var(--ns-prompt-ms) var(--ns-ease-in-out);
  }
  .placeholder {
    position: absolute;
    left: 16px;
    top: 12px;
    right: 16px;
    font: 400 14px / 1.55 var(--fai-font-sans);
    color: var(--fai-text-subtle);
    pointer-events: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .hint {
    color: var(--fai-grey-400);
  }
  .editor :global(.ns-chip) {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 22px;
    padding: 0 7px 0 5px;
    margin: 0 1px;
    vertical-align: -5px;
    border-radius: var(--fai-radius-sm);
    background: var(--fai-fill);
    border: 1px solid var(--fai-border);
    font: 500 13px / 1 var(--fai-font-sans);
    color: var(--fai-text);
    white-space: nowrap;
    user-select: all;
  }
  .editor :global(.ns-chip-icon) {
    display: inline-flex;
  }
  .editor :global(.ns-chip-icon svg) {
    width: 13px;
    height: 13px;
  }
  @media (max-width: 640px) {
    .editor,
    .placeholder {
      font-size: 16px;
    }
    /* The hint would only ellipsise at this width; the question survives whole. */
    .hint {
      display: none;
    }
  }
</style>
