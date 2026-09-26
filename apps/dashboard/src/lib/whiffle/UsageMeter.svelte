<script lang="ts">
  import type { ClaudeLimits, LimitWindow } from "@whiffle/core";
  /**
   * How full the machine's Claude limits are, on the dock next to ContextMeter.
   * The two answer the same "am I about to hit a wall?" question for the same
   * session, so this reads as its sibling — but where ContextMeter is one bar
   * for one window, this is a segmented rail per window: the 5-hour, the weekly,
   * and each scoped weekly window (the model scopes) ride their own strip, each
   * strip filling green → amber → red down its own length. That structure is what
   * separates it from a sidebar row: segmented, severity-hued, and never one
   * collapsed number.
   *
   * The limits arrive live over the socket (the hub's `kind: 'usage'` frame),
   * folded into `whiffle.usageLimitsFor` — no polling. The opencode spend is
   * fetched on open, once, because it is a heavy REST aggregate rather than a
   * pushed number.
   */
  import { onMount } from "svelte";
  import { Badge } from "$lib/components/ui/badge";
  // biome-ignore lint/performance/noNamespaceImport: shadcn-svelte convention for component groups
  import * as Popover from "$lib/components/ui/popover";
  import IconClock from "~icons/solar/clock-circle-linear";
  import IconDollar from "~icons/solar/dollar-linear";
  import { whiffle } from "./client.svelte";
  import UsageRail from "./UsageRail.svelte";
  import { band, resetsIn, usd } from "./usage";

  const DEFAULT_CLAUDE_TIER_PREFIX = /^default_claude_/;
  const UNDERSCORE = /_/g;
  const WORD_START = /\b\w/g;

  interface Props {
    /**
     * Optional, and usually absent. Limits are account-scoped, not
     * machine-scoped — every host signed in to the same account reads the same
     * numbers — so the chrome asks for whichever reading exists rather than
     * naming a machine.
     */
    machineId?: string;
  }

  let { machineId }: Props = $props();

  const limits: ClaudeLimits | null = $derived(
    machineId ? whiffle.usageLimitsFor(machineId) : whiffle.usageLimitsAny()
  );

  /** Value ink: colour only where the band earns it. */
  const TEXT: Record<string, string> = {
    calm: "text-muted-foreground",
    warn: "text-warning",
    critical: "text-destructive",
  };

  const windows = $derived(limits?.windows ?? []);

  /**
   * What the compact surface shows: the windows that will stop you first,
   * fullest down. Everything else is one tap away in the popover.
   */
  const visible = $derived.by(() => {
    const scored = windows.filter((w) => typeof w.percent === "number");
    return scored
      .sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0))
      .slice(0, 3);
  });
  const hiddenCount = $derived(windows.length - visible.length);

  /** Short strip labels: 5h / Wk / the scope name. */
  const compactLabel = (w: LimitWindow): string => {
    if (w.group === "session") {
      return "5h";
    }
    if (w.group === "weekly") {
      return w.scopeLabel ?? "Wk";
    }
    return w.kind;
  };

  /** Why there is nothing to meter — a normal state, never a fake 0%. */
  const emptyReason = $derived.by(() => {
    if (limits === null) {
      return "No limit reading yet.";
    }
    if (limits.error === "not signed in") {
      return "No limit reading — this machine is not signed in to Claude.";
    }
    if (limits.error === "token expired") {
      return "The Claude login on this machine has expired.";
    }
    if (limits.error) {
      // A stale reading still has its windows; show them and flag the age.
      if (limits.stale && windows.length > 0) {
        return null;
      }
      return limits.error;
    }
    return null;
  });

  /** Surfaced only when the windows shown are a stale last-good reading. */
  const staleNote = $derived(
    limits?.stale && limits.error ? `last good reading · ${limits.error}` : null
  );

  /** There are real windows to show; anything else is an empty state. */
  const hasReading = $derived(emptyReason === null);

  /** A live clock for the countdowns; minute granularity is all they show. */
  let now = $state(Date.now());
  onMount(() => {
    const timer = setInterval(() => {
      now = Date.now();
    }, 30_000);
    return () => clearInterval(timer);
  });

  const planLabel = (tier: string | null): string | null => {
    if (!tier) {
      return null;
    }
    return tier
      .replace(DEFAULT_CLAUDE_TIER_PREFIX, "")
      .replace(UNDERSCORE, " ")
      .replace(WORD_START, (c) => c.toUpperCase());
  };

  /** The opencode spend, fetched on open — real dollars, never a guess. */
  let spend = $state<{ today: number; total: number } | null>(null);

  async function refreshSpend(): Promise<void> {
    const day = new Date();
    day.setUTCHours(0, 0, 0, 0);
    const since = day.getTime();
    const query = machineId
      ? `harness=opencode&machineId=${encodeURIComponent(machineId)}`
      : "harness=opencode";
    try {
      const [totalRes, todayRes] = await Promise.all([
        fetch(`/api/usage/summary?${query}`).then((r) =>
          r.ok ? r.json() : null
        ),
        fetch(`/api/usage/summary?${query}&since=${since}`).then((r) =>
          r.ok ? r.json() : null
        ),
      ]);
      spend = {
        total: totalRes?.totals?.costUsd ?? 0,
        today: todayRes?.totals?.costUsd ?? 0,
      };
    } catch {
      // Keep the last reading; the meter is a glance, not a report.
    }
  }
</script>

<Popover.Root
  onOpenChange={(open) => {
    if (open) {
      // biome-ignore lint/complexity/noVoid: fire-and-forget — refreshSpend() manages its own loading/error state
      void refreshSpend();
    }
  }}
>
  <Popover.Trigger
    aria-label={hasReading
        ? `Claude limits. ${visible
            .map((w) => `${compactLabel(w)} ${Math.round(w.percent)} percent`)
            .join(", ")}${
            hiddenCount > 0 ? `, ${hiddenCount} more` : ""
          }. Show them all.${staleNote ? ` ${staleNote}.` : ''}`
        : `Claude usage limits. ${emptyReason}`}
    class="flex min-w-0 flex-col gap-0.5 rounded-[var(--radius-sm)] px-1.5 py-1
           text-label tabular-nums
           hover:bg-muted
           focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
           transition-[background-color] duration-150 ease-out"
    title={hasReading
        ? `${visible[0]
          ? `${compactLabel(visible[0])} limit — ${Math.round(visible[0].percent)}% used, ${
            resetsIn(visible[0].resetsAt, now)
          }`
          : "Claude limits"}${
          staleNote ? ` · ${staleNote}` : ""
        }`
        : "Claude usage limits"}
  >
    {#if hasReading}
      {#each visible as window (window.kind)}
        <span class="flex min-w-0 items-center gap-1.5">
          <span
            aria-hidden="true"
            class="shrink-0 font-medium {TEXT[band(window.percent)]}"
            >{compactLabel(window)}</span
          >
          <UsageRail compact label="Usage" value={window.percent} />
          <span class="shrink-0 {TEXT[band(window.percent)]}"
            >{Math.round(window.percent)}%</span
          >
        </span>
      {/each}
    {:else}
      <span class="text-muted-foreground">—</span>
    {/if}
  </Popover.Trigger>

  <Popover.Content
    align="end"
    class="w-80 rounded-[var(--radius-lg)] p-0 shadow-lg"
    side="top"
  >
    <div class="flex items-center gap-2 border-b border-border px-3 py-2.5">
      <IconClock class="size-4 text-muted-foreground" />
      <span class="text-label font-medium">Usage limits</span>
      {#if hasReading && limits && planLabel(limits.planTier)}
        <Badge class="ml-auto font-mono text-label" variant="outline"
          >{planLabel(limits.planTier)}</Badge
        >
      {/if}
    </div>

    {#if staleNote}
      <p
        class="border-b border-border px-3 py-1.5 text-[11px] text-muted-foreground"
      >
        {staleNote}
      </p>
    {/if}

    {#if emptyReason}
      <p class="px-3 py-4 text-label text-muted-foreground">{emptyReason}</p>
    {:else}
      <ul class="px-3 py-2">
        {#each windows as window (window.kind)}
          <li class="flex flex-col gap-1 py-1.5">
            <div class="flex items-center gap-1.5">
              <span class="min-w-0 truncate text-label font-medium"
                >{compactLabel(window)}</span
              >
              {#if window.isActive}
                <span
                  class="rounded-full bg-primary/10 px-1.5 text-[10px] font-medium text-primary"
                >
                  active
                </span>
              {/if}
            </div>
            <div class="flex min-w-0 items-center gap-2">
              <UsageRail label="Usage" value={window.percent} />
              <span
                class="shrink-0 text-label tabular-nums {TEXT[band(window.percent)]}"
              >
                {Math.round(window.percent)}%
              </span>
            </div>
            {#if window.resetsAt}
              <span class="text-label tabular-nums text-muted-foreground">
                {resetsIn(window.resetsAt, now)}
              </span>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}

    <div class="border-t border-border px-3 py-2.5">
      <div class="flex items-center gap-2">
        <IconDollar class="size-3.5 text-muted-foreground" />
        <span class="text-label font-medium">opencode</span>
        <span class="ml-auto text-label tabular-nums text-muted-foreground">
          {#if spend}
            {usd(spend.today)}
            today · {usd(spend.total)} total
          {:else}
            —
          {/if}
        </span>
      </div>
    </div>

    <a
      class="flex items-center justify-between border-t border-border px-3 py-2
             text-label font-medium text-primary
             transition-colors duration-150 ease-out hover:bg-muted"
      href="/usage"
    >
      Open full usage
      <span aria-hidden="true">→</span>
    </a>
  </Popover.Content>
</Popover.Root>
