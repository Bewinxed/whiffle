<script lang="ts">
  /**
   * Model (§1.6, §2.9): harness tabs, one search/custom-id field, the model
   * list with the slide-swap on harness change. Codex is shown but disabled
   * ("Coming soon"); the list is the app's catalogue, canonical names only.
   */
  import {
    type EffortLevel,
    HARNESSES,
    type HarnessKind,
    type PermissionMode,
  } from "@whiffle/core";
  import { untrack } from "svelte";
  import ProviderLogo from "$lib/components/features/ProviderLogo.svelte";
  import OpenAiMark from "~icons/logos/openai-icon";
  import Down from "~icons/solar/alt-arrow-down-linear";
  import Clear from "~icons/solar/close-square-linear";
  import Code from "~icons/solar/code-square-bold-duotone";
  import Cpu from "~icons/solar/cpu-bolt-bold-duotone";
  import Search from "~icons/solar/magnifer-linear";
  import Tuning from "~icons/solar/tuning-2-bold-duotone";
  import HarnessLogo from "../HarnessLogo.svelte";
  import {
    ensureModels,
    models,
    providerOf,
    rememberModel,
  } from "../models.svelte";
  import { reducedMotion } from "../motion.svelte";
  import EffortPips from "./EffortPips.svelte";
  import { FollowHover } from "./follow-hover.svelte";
  import {
    deriveModelEntries,
    groupModelEntries,
    isIdShaped,
    type ModelEntry,
    matchesQuery,
  } from "./model-entries";
  import { lastSpawnAt, lastUsedAt, type ModelUse } from "./modelUse.svelte";
  import NsPopover from "./NsPopover.svelte";
  import NsPopoverGroup from "./NsPopoverGroup.svelte";
  import PermissionSection from "./PermissionSection.svelte";
  import { permissionLook } from "./permission-look";
  import SectionHeader from "./SectionHeader.svelte";

  /**
   * The run settings that ride on the chosen model: its effort and the
   * session's permission mode, as chips on the selected row. Only the new
   * session form passes them; a running session sets these elsewhere.
   */
  interface ModelTools {
    effort: EffortLevel | null;
    efforts: EffortLevel[];
    modes: { value: PermissionMode; disabled: boolean; reason?: string }[];
    oneffort: (level: EffortLevel) => void;
    onpermission: (mode: PermissionMode) => void;
    permission: PermissionMode;
  }

  let {
    harness,
    onharness,
    installed,
    machineName,
    model,
    onmodel,
    runtime = false,
    tools,
  }: {
    harness: HarnessKind;
    onharness: (harness: HarnessKind) => void;
    installed: HarnessKind[];
    machineName: string;
    model: string;
    onmodel: (id: string) => void;
    runtime?: boolean;
    tools?: ModelTools;
  } = $props();
  const uid = $props.id();
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
  /**
   * Exit and entrance run over each other. The entrance takes a short lead so
   * the exit is visibly under way first — overlapping them without one made
   * the whole swap land ~240ms sooner than before and read as hurried.
   */
  const OUT_MS = 200;
  const OUT_STAGGER = 18;
  const IN_LEAD = 80;
  const IN_MS = 300;
  const IN_STAGGER = 40;
  /** Rows past this all leave together; a stagger that keeps growing down a
      forty-model list is a wait, not a rhythm. */
  const STAGGER_CAP = 9;
  /** How many leaving rows keep animating. The list shows about five. */
  const LEAVING = 8;
  let listHarness = $state<HarnessKind>(untrack(() => harness));
  let phase = $state<"in" | "idle">(untrack(() => (runtime ? "idle" : "in")));
  let slideDir = $state(1);
  let gen = $state(0);
  let query = $state("");
  let searchFocus = $state(false);
  let list = $state<HTMLDivElement>();
  /** The rows the last harness had, still on screen while the new ones arrive. */
  let leaving = $state<ModelEntry[]>([]);
  const harnessIdx = $derived(TABS.findIndex((tab) => tab.id === harness));
  /**
   * The rail shows marks only; the name rides one tooltip that slides and
   * re-labels between them rather than a tooltip per mark popping in and out.
   * `tip` is the mark under the pointer or keyboard focus; `shownTip` holds
   * the last one so the tooltip fades out where it was instead of jumping.
   */
  let tip = $state(-1);
  let shownTip = $state(0);
  let tipWidth = $state(0);
  $effect(() => {
    if (tip >= 0) {
      shownTip = tip;
    }
  });
  const RAIL_PAD = 6;
  const RAIL_STEP = 40;
  function railMove(event: MouseEvent) {
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const at = Math.floor((event.clientY - box.top - RAIL_PAD) / RAIL_STEP);
    tip = at >= 0 && at < TABS.length ? at : -1;
  }
  let pop = $state<"effort" | "permission" | null>(null);
  let toolsWidth = $state(0);
  const look = $derived(permissionLook(tools?.permission ?? ""));
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
    // The new list mounts immediately and the old rows keep animating in a
    // layer above it, so the two staggers overlap. Swapping only after the
    // exit finished left a dead beat between them, and it also froze `pick`
    // for the whole of that wait.
    leaving = untrack(() => rows.slice(0, LEAVING));
    listHarness = next;
    gen += 1;
    query = "";
    phase = "in";
    // A different catalogue entirely; keeping the old scroll offset would
    // land mid-list and misalign the layer that is animating out.
    untrack(() => list)?.scrollTo({ top: 0 });
    const clear = setTimeout(
      () => {
        leaving = [];
      },
      reducedMotion.current ? 0 : OUT_MS + OUT_STAGGER * LEAVING
    );
    return () => clearTimeout(clear);
  });
  $effect(() => {
    if (phase !== "in") {
      return;
    }
    const idle = setTimeout(
      () => {
        phase = "idle";
      },
      reducedMotion.current ? 0 : IN_LEAD + STAGGER_CAP * IN_STAGGER + IN_MS
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
  const hiOpacity = $derived(rows.some((row) => row.id === selectedId) ? 1 : 0);
  const ctx = (entry: ModelEntry) => (entry.name.endsWith("· 1M") ? "1M" : "");
  const vendor = (id: string) => VENDOR[providerOf(id) ?? ""] ?? "";
  /** One maker for the whole list says nothing per row; mixed lists do. */
  const mixedMakers = $derived(
    new Set(entries.map((entry) => providerOf(entry.id) ?? "")).size > 1
  );
  function pick(entry: ModelEntry) {
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
    if (phase !== "in") {
      return "none";
    }
    const step = Math.min(i, STAGGER_CAP);
    return `${slideDir > 0 ? "ns-in-r" : "ns-in-l"} ${IN_MS}ms var(--ns-ease-out) both ${IN_LEAD + step * IN_STAGGER}ms`;
  }
  const leaveAnim = (i: number) =>
    `${slideDir > 0 ? "ns-out-l" : "ns-out-r"} ${OUT_MS}ms var(--ns-ease-out) both ${i * OUT_STAGGER}ms`;
</script>

<section class="model">
  {#if !runtime}
    <SectionHeader hue="var(--fai-violet-500)" icon={Cpu} label="Model" />
  {/if}
  <div class="picker" class:railed={!runtime}>
    {#if !runtime}
      <div
        aria-label="Harness"
        class="rail"
        onfocusout={() => { tip = -1; }}
        onkeydown={tabKey}
        onmouseleave={() => { tip = -1; }}
        onmousemove={railMove}
        role="radiogroup"
        tabindex="-1"
      >
        <span
          aria-hidden="true"
          class="thumb"
          style={`transform:translateY(${harnessIdx * RAIL_STEP}px)`}
        ></span>
        {#each TABS as tab, i (tab.id)}
          {@const available = !tab.soon && installed.includes(tab.id as HarnessKind)}
          <!-- biome-ignore lint/a11y/useSemanticElements: the harness rail is a designed radio group; a native radio cannot carry the mark, thumb and disabled reason -->
          <button
            aria-checked={tab.id === harness}
            aria-describedby={available ? undefined : `harness-${tab.id}-why`}
            aria-label={tab.name}
            class="tab ns-in"
            data-harness={tab.id}
            disabled={!available}
            onclick={() => onharness(tab.id as HarnessKind)}
            onfocus={(event) => { if (event.currentTarget.matches(':focus-visible')) { tip = i; } }}
            role="radio"
            style={`--delay:${i * 30}ms`}
            tabindex={tab.id === harness ? 0 : -1}
            type="button"
            class:on={tab.id === harness}
          >
            {#if tab.id === "codex"}
              <OpenAiMark aria-hidden="true" class="codex-mark" />
            {:else}
              <HarnessLogo harness={tab.id as HarnessKind} />
            {/if}
            {#if !available}
              <span class="sr-only" id={`harness-${tab.id}-why`}
                >{tab.soon ? "Coming soon" : `Not installed on ${machineName}`}</span
              >
            {/if}
          </button>
        {/each}
        <span
          aria-hidden="true"
          class="tip"
          style={`transform:translateY(${shownTip * RAIL_STEP}px);width:${tipWidth}px;opacity:${tip >= 0 ? 1 : 0}`}
        >
          {#key shownTip}
            <span class="tip-text" bind:offsetWidth={tipWidth}
              >{TABS[shownTip]?.name}
              {#if TABS[shownTip]?.soon}
                <span class="soon">soon</span>
              {:else if !installed.includes(TABS[shownTip]?.id as HarnessKind)}
                <span class="soon">not installed</span>
              {/if}</span
            >
          {/key}
        </span>
      </div>
    {/if}
    <div class="pick">
      <label class="search" class:focus={searchFocus}>
        <Search class="lead" />
        <input
          aria-controls={`${uid}-models`}
          aria-label="Search models"
          autocapitalize="off"
          autocorrect="off"
          id={`${uid}-search`}
          onblur={() => { searchFocus = false; }}
          onfocus={() => { searchFocus = true; }}
          oninput={(event) => { query = event.currentTarget.value; }}
          onkeydown={(event) => { if (event.key === 'Enter' && showCustomRow) { event.preventDefault(); pickCustom(); } else if (event.key === 'Escape' && query) { event.stopPropagation(); query = ''; } }}
          placeholder={`Search ${harnessName(listHarness)} models or paste a model id…`}
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
      </label>

      <div
        aria-label={`${harnessName(listHarness)} models`}
        class="list fai-scroll"
        id={`${uid}-models`}
        onmouseleave={fhModels.leave}
        onmousemove={fhModels.move}
        role="listbox"
        style={`--tools-w:${tools && hiOpacity ? toolsWidth : 0}px`}
        tabindex="-1"
        bind:this={list}
      >
        <span aria-hidden="true" class="ns-ghost" style={fhModels.style}></span>
        <span
          aria-hidden="true"
          class="fill"
          style={`transform:translateY(calc(${modelIdx} * 46px));opacity:${hiOpacity}`}
        ></span>
        {#if tools}
          <!-- The chosen model's run settings travel with the selection fill, so
           picking another model carries them across rather than redrawing. -->
          <div
            class="tools"
            inert={!hiOpacity}
            style={`transform:translateY(calc(${modelIdx} * 46px));opacity:${hiOpacity}`}
            bind:clientWidth={toolsWidth}
          >
            <NsPopoverGroup>
              {#if tools.efforts.length}
                <NsPopover
                  align="end"
                  id="session-effort"
                  label="Effort"
                  onchange={(value) => { pop = value ? 'effort' : null; }}
                  open={pop === "effort"}
                  triggerClass="ns-chip-btn tool"
                  width={300}
                >
                  {#snippet trigger()}
                    <Tuning style="color:var(--fai-orange-500)" />
                    <span class="chip-label level"
                      >{tools.effort ?? "Default"}</span
                    >
                    <Down class="chevron" />
                  {/snippet}
                  <div class="effort-pop">
                    <EffortPips
                      efforts={tools.efforts}
                      embedded
                      onchange={tools.oneffort}
                      value={tools.effort}
                    />
                  </div>
                </NsPopover>
              {/if}
              <NsPopover
                align="end"
                id="session-permission"
                label="Permission mode"
                onchange={(value) => { pop = value ? 'permission' : null; }}
                open={pop === "permission"}
                triggerClass="ns-chip-btn tool"
                width={340}
              >
                {#snippet trigger()}
                  {@const Icon = look.icon}
                  <Icon style={`color:${look.hue}`} />
                  <span class="chip-label">{look.short}</span>
                  <Down class="chevron" />
                {/snippet}
                <PermissionSection
                  embedded
                  modes={tools.modes}
                  onchange={(mode) => { tools.onpermission(mode); pop = null; }}
                  value={tools.permission}
                />
              </NsPopover>
            </NsPopoverGroup>
          </div>
        {/if}
        {#if leaving.length}
          <div aria-hidden="true" class="leaving" inert>
            {#each leaving as entry, i (entry.id)}
              <div class="row" style={`animation:${leaveAnim(i)}`}>
                {@render rowBody(entry)}
              </div>
            {/each}
          </div>
        {/if}
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
          <button
            aria-selected={entry.id === selectedId}
            class="row"
            data-fh="1"
            data-model={entry.id}
            onclick={() => pick(entry)}
            role="option"
            style={`animation:${rowAnim(i)}`}
            type="button"
            class:picked={entry.id === selectedId}
          >
            {@render rowBody(entry)}
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
    </div>
  </div>
</section>

{#snippet rowBody(entry: ModelEntry)}
  {@const provider = providerOf(entry.id)}
  {#if mixedMakers}
    <span class="ns-tile tile vendor">
      {#if provider}
        <ProviderLogo model={entry.id} size={16} />
      {:else}
        <HarnessLogo harness={listHarness} />
      {/if}
    </span>
  {/if}
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
{/snippet}

<style>
  .model {
    display: grid;
    gap: 8px;
  }
  /* One panel: the harness rail down its left edge, search and list beside. */
  .picker {
    position: relative;
    display: grid;
    background: var(--fai-surface);
    border: 1px solid var(--fai-border);
    border-radius: var(--fai-radius-md);
    box-shadow: var(--fai-shadow-xs);
  }
  .picker.railed {
    grid-template-columns: auto minmax(0, 1fr);
  }
  .pick {
    display: grid;
    min-width: 0;
  }
  .rail {
    position: relative;
    display: grid;
    align-content: start;
    gap: 4px;
    padding: 6px;
    border-right: 1px solid var(--fai-border-subtle);
    background: var(--fai-recess);
    border-radius: var(--fai-radius-md) 0 0 var(--fai-radius-md);
  }
  .thumb {
    position: absolute;
    top: 6px;
    left: 6px;
    width: 36px;
    height: 36px;
    background: var(--fai-raised);
    border-radius: var(--fai-radius-sm);
    box-shadow: var(--fai-shadow-raised);
    transition: transform 180ms var(--ns-ease-in-out);
    pointer-events: none;
  }
  .tab {
    position: relative;
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    padding: 0;
    background: transparent;
    border: 0;
    border-radius: var(--fai-radius-sm);
    cursor: pointer;
    color: var(--fai-text-muted);
    transition: background-color 120ms ease;
  }
  @media (hover: hover) {
    .tab:not(.on):not(:disabled):hover {
      background: var(--fai-hover);
    }
  }
  .tab:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
  .tab :global(.harness-logo),
  .tab :global(.codex-mark) {
    width: 18px;
    height: 18px;
    flex: none;
  }
  /* One tooltip for the whole rail: it slides to the mark under the pointer
     and re-sizes to its name, so moving down the rail reads as one label
     travelling, not four appearing and vanishing. */
  .tip {
    position: absolute;
    top: 6px;
    left: calc(100% + 6px);
    z-index: 5;
    display: flex;
    align-items: center;
    height: 36px;
    overflow: hidden;
    background: var(--fai-grey-900);
    color: var(--fai-grey-50, #fff);
    border-radius: var(--fai-radius-sm);
    box-shadow: var(--fai-shadow-raised);
    pointer-events: none;
    transition:
      transform 180ms var(--ns-ease-in-out),
      width 180ms var(--ns-ease-in-out),
      opacity 120ms ease;
  }
  .tip-text {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0 10px;
    font: 500 12px / 1 var(--fai-font-sans);
    white-space: nowrap;
    animation: ns-in 160ms var(--ns-ease-out) both;
  }
  .soon {
    font: 500 9px / 1 var(--fai-font-sans);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    opacity: 0.6;
  }
  .search {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 42px;
    padding: 0 12px;
    border-bottom: 1px solid var(--fai-border-subtle);
  }
  .search :global(svg.lead) {
    width: 15px;
    height: 15px;
    flex: none;
    color: var(--fai-text-subtle);
  }
  .search.focus :global(svg.lead) {
    color: var(--fai-text);
  }
  .search input {
    flex: 1;
    height: 100%;
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
    height: 300px;
    overflow: auto;
    padding: 4px;
  }
  /* The outgoing rows, over the incoming ones so both staggers run at once. */
  .leaving {
    position: absolute;
    left: 4px;
    right: 4px;
    top: 4px;
    display: grid;
    gap: 2px;
    align-content: start;
    pointer-events: none;
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
  /* The chosen row's run settings: effort and permission chips, riding the
     selection fill's transform so they slide to whichever model is picked. */
  .tools {
    position: absolute;
    top: 4px;
    right: 10px;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 4px;
    height: 44px;
    transition:
      transform 160ms var(--ns-ease-in-out),
      opacity 120ms ease;
  }
  .tools :global(.ns-chip-btn.tool) {
    height: 28px;
    background: var(--fai-surface);
  }
  .tools .level {
    text-transform: capitalize;
  }
  .effort-pop {
    padding: 8px 6px 6px;
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
  /* Room for the chips, so the chosen row's name ends before them. */
  .row.picked {
    padding-right: calc(var(--tools-w, 0px) + 14px);
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
    .search {
      height: 44px;
    }
    .search input {
      font-size: 16px;
    }
  }
</style>
