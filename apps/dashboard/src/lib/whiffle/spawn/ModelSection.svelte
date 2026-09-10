<script lang="ts">
  /**
   * Model (§1.6, §2.9): harness tabs, one search/custom-id field, the model
   * list with the slide-swap on harness change. Codex is shown but disabled
   * ("Coming soon"); the list is the app's catalogue, canonical names only.
   */
  import { HARNESSES, type HarnessKind } from "@whiffle/core";
  import { untrack } from "svelte";
  import ProviderLogo from "$lib/components/features/ProviderLogo.svelte";
  import OpenAiMark from "~icons/logos/openai-icon";
  import Down from "~icons/solar/alt-arrow-down-linear";
  import Clear from "~icons/solar/close-square-linear";
  import Code from "~icons/solar/code-square-bold-duotone";
  import Cpu from "~icons/solar/cpu-bolt-bold-duotone";
  import Search from "~icons/solar/magnifer-linear";
  import HarnessLogo from "../HarnessLogo.svelte";
  import {
    ensureModels,
    models,
    providerOf,
    rememberModel,
  } from "../models.svelte";
  import { reducedMotion } from "../motion.svelte";
  import { FollowHover } from "./follow-hover.svelte";
  import {
    deriveModelEntries,
    groupModelEntries,
    isIdShaped,
    type ModelEntry,
    matchesQuery,
  } from "./model-entries";
  import { lastSpawnAt, lastUsedAt, type ModelUse } from "./modelUse.svelte";
  import SectionHeader from "./SectionHeader.svelte";

  let {
    harness,
    onharness,
    installed,
    machineName,
    model,
    onmodel,
  }: {
    harness: HarnessKind;
    onharness: (harness: HarnessKind) => void;
    installed: HarnessKind[];
    machineName: string;
    model: string;
    onmodel: (id: string) => void;
  } = $props();
  type TabId = HarnessKind | "codex";
  const TABS: { id: TabId; name: string; soon?: boolean }[] = [
    { id: "claude", name: "Claude Code" },
    { id: "codex", name: "Codex", soon: true },
    { id: "opencode", name: "OpenCode" },
    { id: "pi", name: "Pi" },
  ];
  const VENDOR: Record<string, string> = {
    anthropic: "Anthropic",
    openai: "OpenAI",
    google: "Google",
    deepseek: "DeepSeek",
    moonshot: "Moonshot AI",
    qwen: "Qwen",
    xai: "xAI",
    zhipu: "Z.ai",
    minimax: "MiniMax",
    mistral: "Mistral",
    meta: "Meta",
    nvidia: "NVIDIA",
  };
  const harnessName = (kind: HarnessKind) =>
    TABS.find((tab) => tab.id === kind)?.name ?? kind;
  let listHarness = $state<HarnessKind>(untrack(() => harness));
  let phase = $state<"in" | "out" | "idle">("in");
  let slideDir = $state(1);
  let gen = $state(0);
  let query = $state("");
  let searchFocus = $state(false);
  let list = $state<HTMLDivElement>();
  const harnessIdx = $derived(TABS.findIndex((tab) => tab.id === harness));
  const fhHarness = new FollowHover("x");
  const fhModels = new FollowHover("y");

  $effect(() => {
    const next = harness;
    ensureModels(next);
    if (next === untrack(() => listHarness)) {
      return;
    }
    slideDir =
      HARNESSES.indexOf(next) > HARNESSES.indexOf(untrack(() => listHarness))
        ? 1
        : -1;
    phase = "out";
    const swap = setTimeout(
      () => {
        listHarness = next;
        gen += 1;
        query = "";
        phase = "in";
      },
      reducedMotion.current ? 0 : 200
    );
    return () => clearTimeout(swap);
  });
  $effect(() => {
    if (phase !== "in") {
      return;
    }
    const idle = setTimeout(
      () => {
        phase = "idle";
      },
      reducedMotion.current ? 0 : 700
    );
    return () => clearTimeout(idle);
  });

  const catalog = $derived(models.forHarness(listHarness));
  const use = $derived.by<ModelUse>(() => ({
    lastSpawnAt: lastSpawnAt(listHarness),
    lastUsedAt: Object.fromEntries(
      [
        ...catalog.map((row) => row.resolvedModel ?? row.value),
        ...models.recent,
      ].flatMap((id) => {
        const used = lastUsedAt(listHarness, id);
        return used ? [[id, used]] : [];
      })
    ),
  }));
  const entries = $derived(deriveModelEntries(catalog, use));
  const q = $derived(query.trim().toLowerCase());
  const rows = $derived(
    groupModelEntries(entries, use, models.recent).flatMap((group) =>
      group.entries.filter((entry) => !q || matchesQuery(entry, q))
    )
  );
  const selectedId = $derived(
    model || entries.find((entry) => entry.isDefault)?.id || ""
  );
  const exact = $derived(
    entries.some(
      (entry) =>
        entry.id.toLowerCase() === q ||
        entry.aliases.some((alias) => alias.toLowerCase() === q)
    ) || models.recent.some((id) => id.toLowerCase() === q)
  );
  const showCustomRow = $derived(
    q.length > 2 && !exact && isIdShaped(query.trim())
  );
  const noResults = $derived(rows.length === 0 && !showCustomRow);
  const modelIdx = $derived(
    Math.max(
      0,
      rows.findIndex((row) => row.id === selectedId)
    ) + (showCustomRow ? 1 : 0)
  );
  const hiOpacity = $derived(
    phase === "out" || !rows.some((row) => row.id === selectedId) ? 0 : 1
  );
  const ctx = (entry: ModelEntry) => (entry.name.endsWith("· 1M") ? "1M" : "");
  const vendor = (id: string) => VENDOR[providerOf(id) ?? ""] ?? "";
  function pick(entry: ModelEntry) {
    if (listHarness !== harness) {
      return;
    }
    if (entry.isCustom) {
      rememberModel(entry.id);
    }
    onmodel(entry.id);
  }
  function pickCustom() {
    const id = query.trim();
    rememberModel(id);
    onmodel(id);
    query = "";
  }
  function tabKey(event: KeyboardEvent) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[
      event.key
    ];
    if (!step) {
      return;
    }
    event.preventDefault();
    const enabled = TABS.filter(
      (tab) => !tab.soon && installed.includes(tab.id as HarnessKind)
    );
    const at = enabled.findIndex((tab) => tab.id === harness);
    const next = enabled[(at + step + enabled.length) % enabled.length];
    if (next) {
      onharness(next.id as HarnessKind);
      (event.currentTarget as HTMLElement)
        .querySelector<HTMLButtonElement>(`[data-harness="${next.id}"]`)
        ?.focus();
    }
  }
  function rowAnim(i: number) {
    if (phase === "out") {
      return `${slideDir > 0 ? "ns-out-l" : "ns-out-r"} 160ms var(--ns-ease-out) both ${i * 14}ms`;
    }
    if (phase === "in") {
      return `${slideDir > 0 ? "ns-in-r" : "ns-in-l"} 260ms var(--ns-ease-out) both ${40 + i * 32}ms`;
    }
    return "none";
  }
</script>

<section class="model">
  <SectionHeader hue="var(--fai-violet-500)" icon={Cpu} label="Model" />
  <div
    aria-label="Harness"
    class="tabs"
    onkeydown={tabKey}
    onmouseleave={fhHarness.leave}
    onmousemove={fhHarness.move}
    role="radiogroup"
    tabindex="-1"
  >
    <span
      aria-hidden="true"
      class="ns-ghost harness-ghost"
      style={fhHarness.style}
    ></span>
    <span
      aria-hidden="true"
      class="thumb"
      style={`transform:translateX(calc(${harnessIdx} * (100% + 2px)))`}
    ></span>
    {#each TABS as tab, i (tab.id)}
      {@const available = !tab.soon && installed.includes(tab.id as HarnessKind)}
      <!-- biome-ignore lint/a11y/useSemanticElements: the harness tabs are a designed segmented control; a native radio cannot carry the logo, thumb and disabled reason -->
      <button
        aria-checked={tab.id === harness}
        aria-describedby={available ? undefined : `harness-${tab.id}-why`}
        class="tab ns-in"
        data-fh={available ? "1" : undefined}
        data-harness={tab.id}
        disabled={!available}
        onclick={() => onharness(tab.id as HarnessKind)}
        role="radio"
        style={`--delay:${i * 30}ms`}
        tabindex={tab.id === harness ? 0 : -1}
        title={tab.name}
        type="button"
        class:on={tab.id === harness}
      >
        {#if tab.id === "codex"}
          <OpenAiMark aria-hidden="true" class="codex-mark" />
        {:else}
          <HarnessLogo harness={tab.id as HarnessKind} />
        {/if}
        <span class="tab-name">{tab.name}</span>
        {#if tab.soon}
          <span class="soon">soon</span>
        {/if}
        {#if !available}
          <span class="sr-only" id={`harness-${tab.id}-why`}
            >{tab.soon ? "Coming soon" : `Not installed on ${machineName}`}</span
          >
        {/if}
      </button>
    {/each}
  </div>

  <div class="search" class:focus={searchFocus}>
    <Search class="lead" />
    <input
      aria-controls="session-models"
      aria-label="Search models"
      autocapitalize="off"
      autocorrect="off"
      id="session-model-search"
      onblur={() => { searchFocus = false; }}
      onfocus={() => { searchFocus = true; }}
      oninput={(event) => { query = event.currentTarget.value; }}
      onkeydown={(event) => { if (event.key === 'Enter' && showCustomRow) { event.preventDefault(); pickCustom(); } else if (event.key === 'Escape' && query) { event.stopPropagation(); query = ''; } }}
      placeholder="Search models or paste a custom model id..."
      spellcheck="false"
      value={query}
    >
    {#if query}
      <button
        aria-label="Clear"
        class="clear"
        onclick={() => { query = ''; }}
        type="button"
      >
        <Clear />
      </button>
    {/if}
  </div>

  <div
    aria-label={`${harnessName(listHarness)} models`}
    class="list fai-scroll"
    id="session-models"
    onmouseleave={fhModels.leave}
    onmousemove={fhModels.move}
    role="listbox"
    tabindex="-1"
    bind:this={list}
  >
    <span aria-hidden="true" class="ns-ghost" style={fhModels.style}></span>
    <span
      aria-hidden="true"
      class="fill"
      style={`transform:translateY(calc(${modelIdx} * 46px));opacity:${hiOpacity}`}
    ></span>
    {#if showCustomRow}
      <button
        class="row custom ns-in"
        data-fh="1"
        onclick={pickCustom}
        type="button"
      >
        <span class="ns-tile tile ink"><Code /></span>
        <span class="text">
          <span class="name">Use custom model id</span>
          <span class="meta mono">{query}</span>
        </span>
        <span class="hint">↵ Enter</span>
      </button>
    {/if}
    {#each rows as entry, i (`${gen}:${entry.id}`)}
      {@const provider = providerOf(entry.id)}
      <button
        aria-selected={entry.id === selectedId}
        class="row"
        data-fh="1"
        data-model={entry.id}
        onclick={() => pick(entry)}
        role="option"
        style={`animation:${rowAnim(i)}`}
        type="button"
      >
        <span class="ns-tile tile vendor">
          {#if provider}
            <ProviderLogo model={entry.id} size={16} />
          {:else}
            <HarnessLogo harness={listHarness} />
          {/if}
        </span>
        <span class="text">
          <span class="name" class:mono={entry.mono}>{entry.name}</span>
          <span class="meta"
            ><span class="mono">{entry.id}</span>
            {vendor(entry.id) ? ` · ${vendor(entry.id)}` : ""}</span
          >
        </span>
        {#if ctx(entry)}
          <span class="ctx">{ctx(entry)}</span>
        {/if}
      </button>
    {/each}
    {#if noResults}
      <div class="none ns-in">
        {#if q}
          No {harnessName(listHarness)} models match "{query}"
        {:else}
          No {harnessName(listHarness)} models reported yet
        {/if}
      </div>
    {/if}
  </div>
</section>

<style>
  .model {
    display: grid;
    gap: 8px;
  }
  .tabs {
    position: relative;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 2px;
    padding: 3px;
    background: var(--fai-recess);
    border-radius: var(--fai-radius-md);
  }
  .harness-ghost {
    background: oklch(from var(--fai-raised) l c h / 0.5);
  }
  .thumb {
    position: absolute;
    top: 3px;
    bottom: 3px;
    left: 3px;
    width: calc((100% - 12px) / 4);
    background: var(--fai-raised);
    border-radius: var(--fai-radius-sm);
    box-shadow: var(--fai-shadow-raised);
    transition: transform 160ms var(--ns-ease-in-out);
    pointer-events: none;
  }
  .tab {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 32px;
    padding: 0 6px;
    min-width: 0;
    background: transparent;
    border: 0;
    border-radius: var(--fai-radius-sm);
    cursor: pointer;
    color: var(--fai-text-muted);
  }
  .tab.on {
    color: var(--fai-grey-900);
  }
  .tab:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
  .tab :global(.harness-logo) {
    width: 16px;
    height: 16px;
  }
  .tab :global(.codex-mark) {
    width: 16px;
    height: 16px;
    flex: none;
  }
  .tab-name {
    font: 500 12px / 1 var(--fai-font-sans);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }
  /* The disabled tab still has to read as "Codex": the tag gives up room first. */
  .tab:has(.soon) {
    gap: 4px;
    padding: 0 4px;
  }
  .tab:has(.soon) .tab-name {
    flex: none;
  }
  .soon {
    flex: none;
    font: 500 8px / 1 var(--fai-font-sans);
    letter-spacing: 0.02em;
    text-transform: uppercase;
    padding: 3px 3px;
    border-radius: 4px;
    background: var(--fai-grey-200);
    color: var(--fai-text-muted);
    white-space: nowrap;
  }
  .search {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 38px;
    padding: 0 10px;
    background: var(--fai-surface);
    border: 1px solid var(--fai-border);
    border-radius: var(--fai-radius-md);
    box-shadow: var(--fai-shadow-xs);
    transition: var(--fai-transition-control);
  }
  .search.focus {
    border-color: var(--fai-grey-400);
  }
  .search :global(svg.lead) {
    width: 15px;
    height: 15px;
    flex: none;
    color: var(--fai-text-subtle);
  }
  .search input {
    flex: 1;
    min-width: 0;
    border: 0;
    outline: none;
    background: transparent;
    font: 400 13px / 1.4 var(--fai-font-sans);
    color: var(--fai-text);
    padding: 0;
  }
  .clear {
    display: inline-flex;
    width: 22px;
    height: 22px;
    align-items: center;
    justify-content: center;
    border: 0;
    background: transparent;
    color: var(--fai-text-subtle);
    cursor: pointer;
    border-radius: var(--fai-radius-xs);
  }
  .clear :global(svg) {
    width: 14px;
    height: 14px;
  }
  @media (hover: hover) {
    .clear:hover {
      color: var(--fai-text);
    }
    .custom:hover {
      background: var(--fai-hover);
    }
  }
  .list {
    position: relative;
    display: grid;
    gap: 2px;
    align-content: start;
    height: 220px;
    overflow: auto;
    padding: 4px;
    background: var(--fai-surface);
    border: 1px solid var(--fai-border);
    border-radius: var(--fai-radius-md);
    box-shadow: var(--fai-shadow-xs);
  }
  .fill {
    position: absolute;
    left: 4px;
    right: 4px;
    top: 4px;
    height: 44px;
    background: var(--fai-fill);
    border-radius: var(--fai-radius-sm);
    transition:
      transform 160ms var(--ns-ease-in-out),
      opacity 120ms ease;
    pointer-events: none;
  }
  .row {
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    height: 44px;
    padding: 6px 8px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: var(--fai-radius-sm);
    cursor: pointer;
    text-align: left;
    color: var(--fai-text);
  }
  .custom {
    background: var(--fai-surface);
    border: 1px dashed var(--fai-grey-400);
  }
  .tile {
    width: 26px;
    height: 26px;
  }
  .tile :global(svg) {
    width: 14px;
    height: 14px;
  }
  .vendor {
    overflow: hidden;
  }
  .vendor :global(svg),
  .vendor :global(.harness-logo) {
    width: 16px;
    height: 16px;
  }
  .text {
    flex: 1;
    min-width: 0;
  }
  .name {
    display: block;
    font: 500 13px / 1.3 var(--fai-font-sans);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .meta {
    display: block;
    font: var(--fai-type-meta);
    color: var(--fai-text-subtle);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .mono {
    font-family: var(--fai-font-mono);
  }
  .custom .meta {
    color: var(--fai-text-muted);
  }
  .hint,
  .ctx {
    font: 400 12px / 1 var(--fai-font-mono);
    color: var(--fai-text-subtle);
    white-space: nowrap;
  }
  .hint {
    font-family: var(--fai-font-sans);
  }
  .none {
    display: grid;
    place-items: center;
    gap: 6px;
    padding: 22px 12px;
    color: var(--fai-text-subtle);
    font: var(--fai-type-meta);
    text-align: center;
    text-wrap: pretty;
  }
  @media (max-width: 640px) {
    .tabs {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .thumb {
      display: none;
    }
    .tab {
      height: 44px;
    }
    .tab.on {
      background: var(--fai-raised);
      box-shadow: var(--fai-shadow-raised);
    }
    .search {
      height: 44px;
    }
    .search input {
      font-size: 16px;
    }
  }
</style>
