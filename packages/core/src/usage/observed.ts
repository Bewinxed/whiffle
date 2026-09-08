import type { ClaudeLimits, LimitWindow } from "./types";

/**
 * Rate-limit windows observed from the session stream, rather than polled.
 *
 * Claude Code emits a `rate_limit_event` whenever a window's rounded percentage
 * or reset time moves, carrying `rate_limit_info.unifiedWindows` — the
 * utilizations it read from the `anthropic-ratelimit-unified-*` headers on its
 * own inference responses. That is the same account state
 * `/api/oauth/usage` reports, arriving for free on a socket we already read,
 * with no request of our own to be rate-limited.
 *
 * So this module is the primary source and {@link fetchClaudeLimits} the
 * fallback: the poll still runs (it alone carries plan tier, spend, and the
 * per-model scoped windows), and {@link mergeObserved} lays the live numbers
 * over it.
 */

/** Epoch-seconds → ISO, the shape {@link LimitWindow.resetsAt} is stored in. */
const iso = (seconds: number | undefined): string | null =>
  seconds === undefined ? null : new Date(seconds * 1000).toISOString();

/**
 * `unifiedWindows` utilizations are a FRACTION of the window (0–1), unlike the
 * `/api/oauth/usage` `percent` fields, which are already 0–100. Values above 1
 * are legitimate — a lower-priority episode can run past the 5-hour cap — so
 * this scales without clamping and leaves presentation to the reader.
 */
const percent = (utilization: number): number => utilization * 100;

/**
 * The two windows carried by every observation, and the {@link LimitWindow}
 * identity each maps onto.
 *
 * `unifiedWindows` also carries `seven_day_overage_included`, which is
 * deliberately not mapped. The poll reports that window as a `weekly_scoped`
 * entry tagged with the model's display name ("Fable"), and the stream gives no
 * name to match it by — so an observed copy could not be told apart from a
 * genuinely different scoped window, and would collide with it in a list the
 * dashboard keys by `kind`. The poll owns scoped windows; the stream owns these
 * two, which are the ones the meter puts on screen.
 */
const MAPPED = [
  { key: "five_hour", kind: "session", group: "session" },
  { key: "seven_day", kind: "weekly_all", group: "weekly" },
] as const;

/**
 * The `rate_limit_info` payload, structurally. Not imported from the agent SDK:
 * `unifiedWindows` is marked `@internal` there, so it is stripped from the
 * published `.d.ts` (it survives as a blank line in `SDKRateLimitInfo`) even
 * though the CLI emits it. This is that field, declared where it is used.
 */
export interface ObservedRateLimitInfo {
  rateLimitType?: string;
  status?: string;
  unifiedWindows?: {
    five_hour?: { utilization: number; resetsAt: number };
    seven_day?: { utilization: number; resetsAt: number };
  };
}

let observed: { at: number; windows: LimitWindow[] } | null = null;

const severity = (status: string | undefined): string => {
  if (status === "rejected") {
    return "critical";
  }
  if (status === "allowed_warning") {
    return "warning";
  }
  return "normal";
};

/**
 * Records one `rate_limit_event`. Called per event from the Claude harness;
 * events arrive on any session, and every one of them describes the whole
 * account, so the newest simply replaces the last.
 */
export function observeRateLimit(info: ObservedRateLimitInfo): void {
  const unified = info.unifiedWindows;
  if (!unified) {
    return;
  }

  const windows: LimitWindow[] = [];
  for (const { key, kind, group } of MAPPED) {
    const window = unified[key];
    if (!window) {
      continue;
    }
    windows.push({
      kind,
      group,
      percent: percent(window.utilization),
      // `status` describes only the window currently doing the limiting, which
      // `rateLimitType` names; every other window is unremarkable by
      // definition.
      severity: info.rateLimitType === key ? severity(info.status) : "normal",
      resetsAt: iso(window.resetsAt),
      scopeLabel: null,
      isActive: info.rateLimitType === key,
    });
  }

  if (windows.length > 0) {
    observed = { at: Date.now(), windows };
  }
}

/**
 * Lays the observed windows over a polled reading.
 *
 * An observation is strictly fresher than the poll it overlays — it is read
 * from a response header at the moment of the call, where the poll is a cached
 * snapshot — so it wins on every window it covers, and the reading it produces
 * is live rather than stale. That is why `error` and `stale` clear: with both
 * headline windows observed, a 429 on the poll is a fact about our own request
 * budget, not about the numbers being shown.
 *
 * `planTier`, `subscription` and spend are left as the poll found them; the
 * stream does not carry them.
 */
export function mergeObserved(fetched: ClaudeLimits): ClaudeLimits {
  const snapshot = observed;
  if (snapshot === null) {
    return fetched;
  }
  // Only a SUCCESSFUL poll can be newer than the observation on its own
  // timestamp. A failed one stamps `fetchedAt` at the moment it gave up —
  // `errorResult` does this with no windows at all — so comparing timestamps
  // alone would let a fresh 429 outrank live data, which is precisely the case
  // this exists to cover.
  if (fetched.error === null && snapshot.at <= fetched.fetchedAt) {
    return fetched;
  }

  const windows = fetched.windows.map((window) => {
    const live = snapshot.windows.find((w) => w.kind === window.kind);
    return live ? { ...window, ...live } : window;
  });
  for (const live of snapshot.windows) {
    if (!windows.some((w) => w.kind === live.kind)) {
      windows.push(live);
    }
  }

  const covered = MAPPED.every(({ kind }) =>
    snapshot.windows.some((w) => w.kind === kind)
  );

  return {
    ...fetched,
    fetchedAt: snapshot.at,
    windows,
    ...(covered ? { error: null, stale: undefined } : {}),
  };
}
