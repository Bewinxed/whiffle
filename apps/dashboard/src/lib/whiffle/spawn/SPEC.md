# New session — surface spec (Quiet Ledger)

Authored by the design delegate from PRODUCT.md, DESIGN.md, JOURNEY.md, WORDS.md and the facts in SpawnPanel.svelte. Implement verbatim. Tokens come from DESIGN.md / app.css only.

## 1. The decision

The operator is writing a brief; the settings are usually last time's. So: one recessed well for the prompt, then a **ledger** of six one-line rows, each stating a setting as a fact and each a control. What fits one line is visible; only the two long lists are disclosed.

| Setting | Tier | Why |
|---|---|---|
| Prompt | the well | It is the task. Empty prompt starts an idle session using the same Start button or submit shortcut. |
| Agent | 3-segment | Root setting: re-derives models and modes; three marks cost one line. |
| Model | value button; list disclosed | 20+ rows are long; "Opus 5 · 1M" is not. |
| Location | value button; picker disclosed | 10 machines × 100 dirs are long; "nixbox · ~/cockpit" is not. |
| Permissions | 4-segment | Consequential; `Bypass all` must be read, never found. |
| Effort | slider, constant height | Five stops fit one line; a row appearing per model would shift the card. |
| Side quest · Worktree · Save as project · Clone repo | toggle chips, one row | Rare but cheap; each changes another row's reading, never adds a field. |

## 2. Layout

Card: `--surface-raised`, radius `--radius-panel` 14, `--shadow-overlay`, over `--scrim`. Width `clamp(640px, 72vw, 760px)`, **anchored `top: 12vh`, never vertically centred**, so growth (prompt 5→10 lines) extends downward only. Padding `--space-2` 7 → every interior surface is radius `--radius-well` 7 (14 − 7). Header 44px: "New session" `--text-lg` 500 `--ink-strong`; close trailing. Title, prompt text and ledger labels share one content edge: `--space-4` plus the prompt's 1px hairline inset.

Prompt well: `--surface-field`, 1px `--border-hairline`, radius 7, padding `--space-4`, `--text-md` 400 `--leading-body`; placeholder `--ink-muted` "What should this session do?"; 5–10 lines.

Ledger: one quiet `--surface-field` group, radius 7, no row dividers, even `--space-1` (4px) gaps between 40px rows, grid `96px 1fr`, margin-top `--space-3`; labels `--text-sm` 450 `--ink-label`, values `--text-base` `--ink-row`. Controls are vertically centred in each row.

Footer 52px: a reading slot (`--text-sm` `--ink-muted`, one line always reserved) shows actual problems only (unverified or unreadable location, offline machine, unreachable hub, submit failure). No always-on permission explanation. `Start session` trailing — 36px, `--gradient-action` + `--shadow-action`, `--on-brand`, radius `--radius-control` 8.

**Below 480px**: bottom sheet, `--radius-shell` 20 top corners, `--shadow-drawer`, 7px padding (interior 13, ledger 7 inside a 6px frame). Labels stack above values (pitch 56); Permissions fixed 2×2; Start full-width above the safe area; prompt 16px; pickers are full-height panels sliding over the sheet.

## 3. Controls

Shared states: hover `--surface-hover` (off under `hover: none`); active `--surface-active` + `--shadow-inset-sel`; focus-visible 2px `--focus-ring`, 2px offset; disabled `--ink-muted` at 0.55, `reason` via `aria-describedby`; targets ≥44px under `pointer: coarse`.

**Segmented** (Agent, Permissions). Track `--surface-field`, radius 7, 1px `--border-control`, 2px inset; one travelling thumb `--surface-raised` + `--shadow-tile`, radius 5. Agent marks are 16px at `--ink-body`: Claude uses the anthropic mark from ProviderLogo, monochrome via currentColor; OpenCode and pi use HarnessGlyph. Content gap 6px; padding-inline 12/11 (mark side −1, optical). Selected `--ink-strong` 450; rest `--ink-body`. `Bypass all` selected takes `--status-attn-bg`/`--status-attn-ink` without an explanatory footer. Modes the harness cannot honour are disabled, not removed. `radiogroup`/`radio`, roving tabindex, ←→ live, Home/End.

**Value button** (Model, Location). Full-width 32px, `--surface-field`, radius 7, hairline; 16px mark (`ProviderLogo`; online dot `--status-live-bg` for location), label, muted meta, chevron. Empty: "Choose a model" / "Choose a machine and directory" in `--ink-muted`. Loading: meta "Reading…". `aria-haspopup=listbox aria-expanded`.

**Anchored popover**. `--surface-overlay`, radius `--radius-modal` 12, `--shadow-overlay`, width = anchor, 6px below; flips above when <320px remain; max-height `min(420px, viewport − anchor − 16px)`, scrolls inside; viewport-positioned, never clipped. Esc/outside click close.

**Model list**. Search pinned (`combobox` → `listbox`, `aria-activedescendant`), placeholder "Search, or type a model id". Rows 36px: mark 16 · name `--ink-strong` · meta `--text-sm` `--ink-muted` right, tabular; captions `--text-xs` `--ink-label`. Empty catalog: "No models reported for {agent}." → [Refresh models]. ↑↓, Enter, type-to-filter.

**Location picker**. Search pinned. Machine rail 168px (`listbox`: hostname, online dot; offline dimmed, selectable) beside a directory `listbox` captioned Projects / Recent / Browse. Pane head: 2-segment `Directory | Repository`; Repository lists `listRepos` (name, visibility) with a reserved "Clone into" line at the foot. ↑↓ directories; ⌘/Ctrl+↑↓ machines; Enter accepts.

**Effort slider**. 2px track `--border-control`, five ticks: reachable filled `--ink-body`, unreachable hollow, inert; labels `--text-xs` (`low medium high xhigh max`). Thumb 14px `--brand-solid` ring on `--surface-raised`. Unset = no thumb, readout "Harness default", "Reset" once set. No scale: ticks hollow, readout "No effort scale on this model", same height. `slider` 0–4, `aria-valuetext`, ←→ Home End, Backspace resets.

**Toggle chips**. `--radius-pill`, 28px, `--surface-field`, hairline; on: `--surface-active`, `--ink-strong`, check glyph. `Worktree` needs `Side quest`; `Save as project` disabled with a project attached (name = directory leaf); `Clone repo` ↔ Repository mode. `role=switch`.

**Dialog**. `dialog aria-modal aria-labelledby`, focus trap, initial focus on the prompt; Esc closes an open popover first; ⌘/Ctrl+Enter starts. Hub unreachable: Start disabled, reading "No spawn while the hub is unreachable. Reconnect to continue."

## 4. Model list

`deriveModelEntries`, pure over `models.forHarness(harness)`:

1. **Canonical id** = `resolvedModel ?? value`; dedupe on it, merging `supportedEffortLevels` (union) and `released`. Alias rows (`default`, `sonnet`) collapse into their canonical row; the one `default` resolves to carries a "default" tag.
2. **Name** from the canonical id, never `displayName`: route prefix (`opencode-go/`) → meta; strip `claude-`; family Title-cased; version tokens joined by `.`; `[1m]` → ` · 1M`. `claude-opus-5[1m]` → **Opus 5 · 1M**, `claude-fable-5-1` → **Fable 5.1**, `deepseek-v4-pro` → **DeepSeek V4 Pro**. Unrecognised family → merged `displayName`, else the id in `--font-mono`.
3. **Order**: (a) `released` after the operator's last spawn on this harness → "New since you last used {agent}"; (b) `lastUsedAt` desc → "Recent"; (c) `released` desc, undated last → "All"; (d) `models.recent` → "Typed", mono. Needs `modelUse.svelte.ts`: `recordModelUse(harness, id)` on spawn, `lastSpawnAt(harness)`, `lastUsedAt(harness, id)`.
4. **Meta**: released relative ("2d ago") or "—"; "used 3h ago"; "default"; `max` when reached.
5. **Search/custom**: one field matching name, id, aliases, provider. No match and id-shaped → single row "Use `{query}`" (mono, meta "custom"); Enter submits; `rememberModel` stores.
6. **Submitted**: canonical id, never an alias; `""` when untouched.

## 5. Location

One value `{ machineId, cwd, repo? }`; the button reads `hostname · ~/path`. Search matches hostname, project name and path segments across **all** machines; a hit elsewhere moves the rail highlight. Prefill locks the value under "From project {name}" with "Edit".

Typed path: a query starting `/` or `~` lists `machineFs(list)` children of the longest existing prefix, filtered by the tail; Tab completes; Enter accepts verbatim. After 600ms `inspectMachine` runs; unreadable → reading under the button "That directory can't be read on {host}. Check the path and try again.", submit blocked. Offline machine: allowed, reading "{host} is offline. Pick another machine, or start when it returns."

## 6. Motion

Springs default `bounce: 0` (DESIGN.md bans elastic easing); DialKit range 0–0.15 is for auditioning.

| Moment | Property | Value | Param |
|---|---|---|---|
| Open scrim | opacity | `--c-300` `--e-in` | `open.scrim.ms` |
| Open card | opacity, scale .98→1, y 8→0 | spring vd .32 | `open.card.*` |
| Open rows (well, 6 rows, footer) | opacity, y 6→0 | spring vd .28, stagger 24ms from t+60; caret at t+120 | `open.rows.*`, `open.focus.at` |
| Segment thumb | x, width | spring vd .26 | `seg.thumb.*` |
| Segment ink / attn tint | color / background + reading | `--c-100` `--e-toggle` / `--c-300` `--e-in` | `seg.ink.ms`, `attn.ms` |
| Popover open / close | opacity, scale .98→1 from anchor edge | spring vd .20 / `--c-100` `--e-out` | `pop.*` |
| Popover rows | opacity, y 6→0 | stagger 14ms, first 12 then simultaneous | `pop.rows.stagger` |
| List swap on harness change | out: opacity, x ∓8 `--c-100` `--e-out`; in: opacity, x ±8→0 (sign = travel direction), spring vd .24, stagger 18ms | | `swap.*` |
| List highlight | y | spring vd .22 | `list.hl.vd` |
| Slider thumb/fill, readout | x/width; cross-fade | spring vd .22; `--c-100` | `slider.*` |
| Thumb appear/reset | scale | spring vd .18 / `--c-100` `--e-out` | `slider.thumb.*` |
| Chip | background; check stroke-dashoffset | `--c-100` `--e-toggle`; `--c-300` `--e-in` | `chip.*` |
| Press / chevron | y .5px + `--shadow-inset-sel` / rotate 180° | `--c-100` / `--c-300` `--e-in` | `press.ms`, `chev.ms` |
| Error | outline 0→2px `--error-9`; reading | `--c-300` `--e-in` | `err.ms` |
| Start | label "Starting…"; card opacity, scale 1→.98 | `--c-300` `--e-out` | `exit.*` |

Reduced motion: durations 0/1ms, springs at end state, stagger 0.

## 7. Component tree

```
NewSessionDialog { open: boolean; prefill?: { machineId?: string; cwd?: string; projectId?: string }; onclose(): void }
├ PromptWell { value: string; placeholder: string; minRows: number; maxRows: number; onsubmit: () => void }
├ LedgerRow { label: string; controlId: string; reading?: string } ×6
│ ├ Segmented<T> { options: { value: T; label: string; mark?: Snippet; disabled?: boolean; reason?: string; tone?: 'neutral'|'attn' }[]; value: T; onchange: (v: T) => void }  reusable — Agent, Permissions
│ ├ ValueButton { label: string; meta?: string; mark?: Snippet; empty?: boolean; expanded: boolean; onclick: () => void }  reusable — Model, Location
│ ├ AnchoredPopover { anchor: HTMLElement; open: boolean; onclose: () => void; children }  reusable
│ │ ├ ModelPicker { harness: HarnessKind; value: string; onselect: (id: string) => void }
│ │ │ └ SearchField · ModelRow { entry: ModelEntry; selected: boolean; active: boolean }
│ │ └ LocationPicker { machineId: string; cwd: string; repo?: string; locked?: { projectName: string }; onselect: (v: { machineId: string; cwd: string; repo?: string }) => void }
│ │   └ SearchField · MachineRail · DirectoryList
│ ├ StopSlider { stops: { value: string; label: string; reachable: boolean }[]; value: string | null; readout: string; onchange: (v: string | null) => void }  reusable
│ └ ToggleChip { label: string; checked: boolean; disabled?: boolean; reason?: string; onchange: (c: boolean) => void }  reusable
└ ActionButton { label: string; busy?: boolean; disabled?: boolean; onclick: () => void }  reusable, never-flat
SearchField, HarnessGlyph, ProviderLogo: reusable/existing.
deriveModelEntries(rows: ModelInfo[], use: ModelUse): ModelEntry[]
type ModelEntry = { id: string; name: string; provider: string | null; released?: string; lastUsedAt?: string; isDefault: boolean; isCustom: boolean; effort: EffortLevel[]; aliases: string[] }
```

## 8. Acceptance checks (headless)

1. **Stillness**: card rect byte-equal at rest and after: open/close each popover, Repository mode, each harness, a model without effort, `Bypass all`, each chip, prefill lock/edit — at 1440×900 and 1024×768.
2. **Containment**: above 480px, every popover ⊂ viewport with ≥8px margin. At ≤480px, each picker fills the viewport minus safe-area insets (0px margin when insets are 0). Check 1440×900, 1024×640, 768×1024, 390×844, 320×568, card scrolled top and bottom.
3. **Centering**: every segment, chip, value button, Start: |content centre − control centre| ≤1px both axes; each slider stop |thumb − tick| ≤1px.
4. **Radii**: card 14, well/ledger/controls 7, thumb 5, popover 12.
5. **Stagger both ways**: Claude→pi and pi→Claude; sample the entering list at `t = 3 × stagger + 60ms` (114ms at the default 18ms stagger): `opacity(row0) > opacity(row3) > opacity(row8)`, with row8 allowed to be 0. All rows opacity 1 by 600ms after the harness change; `translateX` sign matches travel.
6. **Naming**: fixture `[default→claude-opus-5[1m], opus→claude-opus-5[1m], claude-opus-5[1m], sonnet→claude-sonnet-5, claude-fable-5-1]` renders exactly "Opus 5 · 1M" (tag default), "Sonnet 5", "Fable 5.1"; no row contains "Default (recommended)".
7. **Submitted**: selecting Opus via query "default" spawns `model: "claude-opus-5[1m]"`; `foo/bar-9` + Enter spawns `model: "foo/bar-9"`; untouched sends no `model`/`effort` keys.
8. **Keyboard**: Tab order prompt → Agent → Model → Location → Permissions → Effort → chips → Start → close; Esc closes only the popover; ⌘Enter spawns; focus returns to the trigger.
9. **Typed path**: `/definitely/missing` → no `spawn` frame; reading and focus on Location.
10. **Reduced motion**: all above pass with transitions ≤1ms. **Tokens**: `mocks/literalcheck.py` and `typecheck.mjs` clean.

Notes from the designer: effort `null` is honest (the harness decides; no thumb rather than a guessed stop). The DESIGN.md "structure never moves" rule is deliberately crossed on this surface only, by the owner's mandate; every animation is confined to this surface and to token durations/easings.
