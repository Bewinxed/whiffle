# FlowAI Design System

A dense, hairline-drawn workspace UI system for a **cross-machine, cross-harness agent orchestration platform**. The visual language is recreated 1:1 from a set of product screenshots shipped under the name **FlowAI** (a sidebar workspace app: dashboard, workflow library, team members, integrations/API keys, settings). FlowAI is the **design and UI reference** — the surface vocabulary, not the product story. Where this readme talks about "workflows" and "runs", read them as agent runs dispatched across machines and harnesses; the components are domain-neutral.

## Sources given

Screenshots only — no codebase, no Figma file, no font binaries, no logo asset:

- https://pbs.twimg.com/media/HPXWXK7aAAAMYYq?format=jpg&name=4096x4096 — Team Members
- https://pbs.twimg.com/media/HQEUrZqbYAAdHX8?format=jpg&name=4096x4096 — Team Members (duplicate framing)
- https://pbs.twimg.com/media/HQAt0StXQAAqSso?format=jpg&name=4096x4096 — Settings → Danger Zone + Transfer Ownership dialog
- https://pbs.twimg.com/media/HQAt0SeW4AAIQs9?format=jpg&name=4096x4096 — Settings → Password & Security + Change Password dialog
- https://pbs.twimg.com/media/HHDGalibcAAmeQg?format=jpg&name=4096x4096 — Dashboard + Ask AI assistant drawer
- https://pbs.twimg.com/media/HQIxI8aaEAA1WsA?format=jpg&name=4096x4096 — Integrations → API Keys
- https://pbs.twimg.com/media/HPaT7G7XoAAG9iG?format=jpg&name=4096x4096 — Workflow Library
- https://x.com/Tanjim38/status/2051162304050303343 and https://x.com/Tanjim38/status/2088842230530527424 — source posts (not fetchable from here; the media URLs above were)

Values (radii, paddings, sizes, hexes) were sampled from \~1.75× exports of the artboards. Every number in `tokens/` traces to a measured pixel in those images, not to a framework default.

## Substitutions (please confirm or replace)

- **Typeface** — no binaries supplied. The grotesque in the screenshots is closest to **Geist** (single-storey `g`, straight-tailed `y`, flat `2` terminal), loaded from Google Fonts in `tokens/fonts.css`. Swap in the real family or binaries and the whole system follows.
- **Icons** — the source's own glyphs weren't extractable from images, and several card headers in the exports render as missing-glyph placeholders. The set is **Lucide** (line, uniform stroke, 16px) loaded from `unpkg.com/lucide-static@0.469.0` and tinted via CSS mask. Drop the real sprite/SVGs into `assets/` and point `Icon.jsx` at them.
- **Logo** — no mark was supplied. The wordmark is set in type (`components/core/Logo.jsx`); nothing was drawn or reconstructed. `assets/` is intentionally empty for this reason.

## Content fundamentals

Voice is flat, operational and slightly terse — a control panel, not a marketing page.

- **Casing** — Title Case for page titles, card titles and buttons ("Team Members", "Seat Usage", "Invite Member", "Generate API Key"). Sentence case for helper copy.
- **Person** — second person, implicit: "Manage who has access to your workspace." Never "we", rarely "I". The assistant is the one exception: "Hey there!" then "Ask me anything about your workflows…".
- **Page subtitle pattern** — one sentence, ends in a period, states the job: "Automate tasks using AI in minutes. No code required." / "Connect FlowForge to your tools and automate workflows."
- **Numbers do the talking** — figures are always concrete and formatted: `12,847`, `98.2%`, `842K`, `$94.40`, `35/50 of Seats`, `891/1000`. Two-digit counts in lists are zero-padded: `02 Away`, `08 Pending Invite`, `04` keys. Deltas carry a sign and a window: "+12% from last week".
- **Meta lines** — middle-dot separated fragments, no verbs: "Created Jan 15, 2026 · Last used 2 min ago · 38,210 calls/mo". Relative time everywhere ("2 min ago", "3hr ago", "Yesterday", "1 week ago").
- **Placeholders** trail an ellipsis: "Search Workflow...", "Select an Admin...", "Ask anything about your workflows...".match 
- **Warnings are plain and consequence-first**: "You will become an Admin after this transfer. You cannot undo this without the new owner's permission." / "Never expose API keys in client-side code or public repositories."
- **No emoji.** One exception in the source: a 🔥 flame beside a hot nav item — in this system that is a Lucide `flame` glyph in orange, not an emoji.
- The source screenshots contain designer typos ("Cancle", "Repoart", "Summery", "Pro Plant", "Renewd"). They are reproduced verbatim in the UI kit for fidelity — **do not** copy them into real product copy.

## Visual foundations

**Palette.** Effectively monochrome. A grey ramp (`--fai-grey-25` → `--fai-ink`) carries every surface, border and text colour; near-black `--fai-grey-900` is the only "primary". Colour appears in three narrow roles: status tints (green/amber/red/blue at 50-level fills with 600/700-level text), decorative identity hues on workflow chips, and a single blue sparkle on the Ask AI control. Never gradients — no bluish-purple washes, no tinted panels. At most two background values on screen: desk grey `#ececec` behind the shell, page grey `#f4f5f5` inside it.

**Type.** One family (Geist). 14px body, 13px labels, 12px meta, 16px card titles, 20px page titles, 24px metrics; weights stop at 500/600 — no ultra-bold display type. Slight negative tracking on titles and metrics. Mono only for API keys and IDs.

**Layout.** A fixed 260px white sidebar and a 44px topbar inside a 20px-radius white shell that floats on the desk grey with a soft drop shadow — the app is a card on a desk, inset \~26px on all sides. Page content is a 24px-padded column; most pages wrap their content in one large `grey-25` page card, then nest white section cards inside it (double-nesting is a signature: outer white card → inner grey inset panel). KPI tiles run 3-5 across with 10-14px gaps. Rows are 44px. Tables have a grey header band, hairline row rules, no zebra, no vertical rules.

**Backgrounds and texture.** No photography, no illustration, no pattern fills. Texture comes from three line-based motifs: the **comb rule** (1px ticks at 6px pitch under every card header), **crosshair guides** (one horizontal + one vertical hairline through the centre of empty/preview panels), and **discrete bar meters** (2px-gapped bars, filled near-black, remaining grey-300) instead of continuous progress tracks. Template artwork in the source is a small isometric 3D render centred on a grey panel — none was supplied, so `TemplateCard` accepts an `art` src and falls back to a grey glyph tile.

**Borders and shadows.** A 1px `--fai-border` / `--fai-border-subtle` hairline defines nearly everything. Shadows are almost invisible (`0 1px 2px rgba(16,18,20,.05)`) on cards; only the app shell and dialogs cast a real shadow (`--fai-shadow-shell`, `--fai-shadow-modal`). No inner shadows anywhere; no glow.

**Corner radii.** Nested and consistent: shell 20 → card 14 → inner panel/control 10 → chip/badge 8 → 18px-and- smaller glyph tiles 5. Pills are reserved for switches, avatars and the round assistant send button.

**Cards.** White, 1px subtle border, 12-14px radius, 12px padding, whisper shadow. A card header is a 16px medium title with a 16px grey glyph on the left and a filter select or overflow button on the right, then the comb rule, then content. Inset rows inside cards are `--fai-surface-subtle` with their own hairline and 10px radius.

**Transparency and blur.** Used once: the modal scrim is a light grey wash (`rgba(240,241,241,.72)`) with a 2px backdrop blur — never a dark overlay. No frosted panels, no translucent chrome.

**Motion.** Fast and flat: 80ms press, 120ms hover, 160ms state, 280ms for the assistant drawer, easing `cubic-bezier(.2,.8,.3,1)`. No bounce, no spring, no load-in animation, no skeleton shimmer.

**Hover / press / focus / disabled.** Hover = one step of fill (transparent → grey-50/100, white → grey-50), plus text grey-600 → grey-900; primary goes near-black → ink. Never opacity fades, never scale-ups. Press shrinks 1% (`--fai-press-scale: .99`). Focus is a 3px soft blue ring plus a grey-400 border. Disabled is grey-100 fill with 0.6 opacity and a subtle border.

**Imagery.** None in the source beyond avatar photos and small 3D template renders; avatars are round with an optional presence dot. Colour temperature of the whole UI is neutral-cool, no grain, no duotone.

## Iconography

- Single family, **Lucide**, line style, one stroke weight, 13-18px (14px in dense rows, 16px in controls and card headers, 18px in page-level contexts). Tinted with `currentColor` through a CSS mask, so an icon inherits its row's text colour.
- Loaded from CDN (`unpkg.com/lucide-static@0.469.0/icons/<name>.svg`) — **substitution, flagged above**.
- Glyphs used in the reference screens: `layout-grid`, `workflow`, `git-branch`, `layers`, `chart-line`, `users`, `plug`, `settings`, `life-buoy`, `sun`, `sparkles`, `calendar`, `search`, `upload`, `download`, `clock`, `key`, `zap`, `flame`, `star`, `plus`, `copy`, `rotate-cw`, `ban`, `triangle-alert`, `shield`, `eye` / `eye-off`, `chevron-down` / `chevron-left` / `chevron-right`, `ellipsis`, `x`, `arrow-up`, `panel-left`, `refresh-cw`, `circle-check`, `circle-dot`, `trophy`, `crown`.
- **No emoji, no unicode symbol substitutes, no filled/duotone icons, no icon font.** Colour on an icon means either identity (chip hues) or status — never decoration.
- Icons are never the only label on a destructive action; text always accompanies them.

## Index

| Path | What |
| --- | --- |
| `styles.css` | Entry point — `@import`s only. Consumers link this file. |
| `tokens/` | `fonts.css`, `colors.css`, `typography.css`, `spacing.css`, `radius.css`, `elevation.css`, `motion.css`, `base.css` (resets + `.fai-icon` mask + `.fai-comb`). |
| `guidelines/` | 20 specimen cards: colours, type, spacing, radii, elevation, motion, brand motifs, iconography. |
| `components/` | React primitives, grouped by concern (below). |
| `ui_kits/flowai_app/` | Click-through recreation of the five reference screens (`index.html` + one JSX per screen + `README.md`). |
| `assets/` | Empty by design — no logo or imagery was supplied. |
| `SKILL.md` | Agent Skills entry point. |
| `thumbnail.html` | Homepage tile. |

### Components

**core/** — `Icon`, `Button`, `IconButton`, `Badge`, `IconChip`, `Avatar`, `CombRule`, `Meter`, `Logo` **forms/** — `Input`, `PasswordInput`, `Select`, `Switch`, `SearchInput`, `SegmentedTabs` **data/** — `StatCard`, `SectionCard`, `ListRow` (+ `StatusDot`), `DataTable`, `Pagination`, `TemplateCard` **feedback/** — `Alert`, `Modal`, `EmptyState`, `AssistantPanel` **navigation/** — `NavItem`, `Sidebar` (+ `NavGroupLabel`), `Topbar`, `PageHeader`, `UsageQuota`

Every component has a sibling `.d.ts` (props contract) and `.prompt.md` (when to use, example, variants), and each directory has one `@dsCard` HTML showing its states.

**Intentional additions** (no direct counterpart in the screenshots, added because the system needs them): `Icon` (wrapper for the glyph set), `CombRule` and `Meter` (extracted motifs that appear inline in the source), `EmptyState` (generalised from the assistant's crosshair panel), `Logo` (wordmark placeholder).

## Adapting to agent orchestration

Keep the chrome and swap the nouns: nav becomes fleet / runs / harnesses / agents; `IconChip` hues identify harnesses instead of workflow types; `Meter` shows machine capacity rather than seats; `DataTable` status tones map to run states (active / paused / expired / draft → running / queued / failed / draft); `StatCard` carries run throughput, success rate, token spend. The `AssistantPanel` is already an agent surface. Nothing in the components hard-codes workflow vocabulary — only the UI kit's sample data does.
