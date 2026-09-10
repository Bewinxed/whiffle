# New Session Modal — Port Spec

Source of truth: `New Session Modal.dc.html` (template lines 10–406, script lines 408–711), `support.js` (dc runtime), `_ds/flowai/_ds_bundle.js` (Button / IconButton / Icon), `_ds/flowai/tokens/*.css`, `_ds/flowai/styles.css`.
Everything below is literal. Where a value is computed, the formula is quoted from the script. Numbers are px unless stated.

Conventions used in this document:
- `T:` = FlowAI token → resolved value. e.g. `T:--fai-radius-lg` = 12px.
- "mask icon" = `<span style="display:inline-block;width:Wpx;height:Wpx;background:currentColor;-webkit-mask:url(URL) center/contain no-repeat;mask:url(URL) center/contain no-repeat">` — colour comes from `color:` on that span (or inherited). URL = `https://api.iconify.design/solar:<name>.svg`. Names below are the full iconify id after `solar:`.
- "LOBE(x)" = `https://unpkg.com/@lobehub/icons-static-svg@latest/icons/<x>.svg`.
- INK = `var(--fai-grey-900)` = #1f2224. BORDER = `var(--fai-border)` = #e8e9ea. SURF = `var(--fai-surface)` = #ffffff. SEL = `var(--fai-grey-100)` = #f2f3f3. (These four constants are named so in the script.)
- Font shorthand `W S/L F` = weight W, size S, line-height L, family F. `sans` = `var(--fai-font-sans)` = "Geist","Geist Placeholder",-apple-system,"Segoe UI",sans-serif. `mono` = `var(--fai-font-mono)` = "Geist Mono",ui-monospace,SFMono-Regular,Menlo,monospace.
- Resolved type roles: `--fai-type-label` = 500 13px/1.3 sans. `--fai-type-meta` = 400 12px/1.35 sans. `--fai-type-body` = 400 14px/1.45 sans.
- Resolved motion: `ease-standard` = cubic-bezier(.2,.8,.3,1); `ease-out` = cubic-bezier(.16,1,.3,1); `ease-in-out` = cubic-bezier(.4,0,.2,1); `instant` = 80ms; `fast` = 120ms; `base` = 160ms; `slow` = 240ms; `panel` = 280ms. `--fai-transition-control` = `background-color 120ms ease-standard, border-color 120ms ease-standard, color 120ms ease-standard`.
- Resolved shadows: `xs` = `0 1px 2px rgba(16,18,20,.03)`; `raised` = `0 1px 3px rgba(16,18,20,.08),0 1px 1px rgba(16,18,20,.04)`; `shell` = `0 24px 60px -12px rgba(16,18,20,.16),0 2px 8px rgba(16,18,20,.04)`; `modal` = `0 32px 80px -16px rgba(16,18,20,.28),0 4px 12px rgba(16,18,20,.06)`. "tile shadow" (inline literal used on 22/24/26px icon tiles) = `0 1px 2px rgba(16,18,20,.07),0 0 0 1px rgba(16,18,20,.035)`.
- Resolved radii: xs 5, sm 8, md 10, lg 12, xl 14, 2xl 18, 3xl 20, pill 999; control=md=10, chip=sm=8, badge=sm=8, modal=2xl=18.

---

## 0. Template runtime semantics (support.js) — what the markup actually means

| Construct | Behaviour (from support.js) |
|---|---|
| `<x-dc>` | Root. Replaced at boot by `<div id="dc-root">`; the whole template is compiled to React `createElement` calls (`h`) and rendered as ONE React component (`StreamableComponent`) whose `render()` computes `vals = {...props, ...logic.renderVals()}` and re-evaluates every builder. Every `setState` re-renders the whole subtree; React reconciles DOM (nodes are preserved when key+type match, so CSS transitions continue; a changed `style.animation` string restarts the CSS animation). |
| `{{ expr }}` | NOT arbitrary JS. `resolve()` supports: identifier paths with `.` and `[…]`, literals (`true/false/null/undefined`, numbers, `'str'`/`"str"`), leading `!`, and one top-level `===`/`!==`/`==`/`!=`, and parentheses. Lookup root is `vals` (renderVals() output merged over props). In a text node each hole renders as `<span class="sc-interp">String(v)</span>` (booleans/null render nothing). |
| `attr="{{ x }}"` (whole) | Prop receives the raw resolved value (function, object, number, boolean, ref). This is how handlers (`onClick="{{ fn }}"`), `ref`, `disabled`, `aria-*` are bound. |
| `attr="a {{ x }} b"` (partial) | String join; `undefined` → "". Used in `style="…{{ v }}…"`: the whole style string is then parsed by `cssToObj` into a React style object (kebab→camel; `--custom` kept). |
| `onClick`, `onMouseMove`, `onPointerDown`, `onKeyDown`, `onInput`, `onChange`, `onFocus`, `onBlur`, `onScroll`, … | Camel-case attrs are encoded (`sc-camel-on-click`) then restored; lower-case `onxxx` is mapped through `EVENT_MAP` to React prop names. Handlers are React synthetic-event handlers; `this` is irrelevant (all handlers are arrow closures created in `renderVals()`). `onChange` on `<input>` is React onChange (fires per keystroke). |
| `on-click` (on `<x-import>`) | For non-DOM nodes, kebab keys are camelised → `onClick` prop on the imported React component. |
| `style-hover="css"` | `collectProps` strips `style-<pseudo>`; `createPseudoSheet` generates a class `scpN` with rule `.scpN:hover{ <css with !important on every declaration> }` and adds it to `className`. So hover styles OVERRIDE inline styles (they carry `!important`). Only `style-hover` is used in this file. |
| `sc-if value="{{ x }}"` | Children rendered iff truthy; otherwise `null` (removed from DOM — enter animations restart on re-show). No else used. `hint-placeholder-val` is a streaming-time placeholder only; ignore. |
| `sc-for list="{{ arr }}" as="x"` | Renders children per item with scope `{...vals, x: item, $index: i}`. Rows are keyed by INDEX (`key: i`), not by id. `hint-placeholder-count` is streaming-only; ignore. |
| `ref="{{ editorRef }}"` | Passes a `React.createRef()` object as the `ref` prop; `editorRef.current` is the DOM node after mount. |
| `data-props` on `<script data-dc-script>` | JSON meta: `{ name: { editor, default, options, tsType, section } }`. Defaults are injected as `this.props`. `componentDidUpdate(prevProps)` on the logic is called after every React update with the previous props. |
| `DCLogic` (`StreamableLogic`) | Fields: `props`, `state`, `setState(patchOrFn, cb)` (synchronous shallow merge into `logic.state`, then a React re-render; functional updater receives previous state), `forceUpdate()`, `componentDidMount/Update/WillUnmount`, `renderVals()` (must return a flat object). |
| `x-import component-from-global-scope="NS.Comp" …>children</x-import>` | Resolves `window.NS.Comp` (React component) and renders `h(Comp, props, children)`. All other attributes become props (kebab→camel except `aria-*`/`data-*`; `{{ }}` values raw). `hint-size="w,h"` is consumed (placeholder min-size while loading) and never reaches the component. |
| Element keys | DOM elements whose children are only inline tags get `key = index + "|" + contentHash(template)` — static per template node; no remount on value change. |
| `helmet` | Head content (stylesheets, `<style>` with keyframes + media query). |

Consequences for the Svelte port: (a) all "computed" template values are getters of state — use `$derived`; (b) every closure in `renderVals()` captures `s = this.state` at render time and is recreated every render; (c) `sc-for` index keys mean list rows are re-used across data changes — the model-list swap animation works only because the `animation` inline string changes (see §3); in Svelte key rows by `gen`+id to force remount instead; (d) `style-hover` must be expressed as `:hover` rules with the same specificity as (or `!important` over) inline styles.

---

## 1. Layout tree (top → down)

### 1.1 Global (helmet `<style>`)
```
html,body{height:100%;background:var(--fai-desk)}                 /* #ececec */
body{margin:0;-webkit-text-size-adjust:100%}
a{color:var(--fai-text-link)} a:hover{color:var(--fai-blue-500)}
textarea,input{font-family:var(--fai-font-sans)}
textarea::placeholder,input::placeholder{color:var(--fai-text-subtle)}   /* #9ca1a6 */
```
Plus the 11 keyframes (§3) and the 640px media block (§4). Base css (`_ds/flowai/tokens/base.css`): `*{box-sizing:border-box}`, `button{font:inherit;color:inherit}`, `:focus-visible{outline:2px solid rgba(59,123,255,.28);outline-offset:1px}`, `::selection{background:#dbe6ff}`, `.fai-comb{height:14px;background-image:repeating-linear-gradient(to right,#d8dadb 0 1px,transparent 1px 6px);background-repeat:no-repeat;background-size:100% 100%}`, `.fai-scroll{scrollbar-width:thin;scrollbar-color:#d8dadb transparent} .fai-scroll::-webkit-scrollbar{width:8px;height:8px} ::-webkit-scrollbar-thumb{background:#d8dadb;border-radius:999px;border:2px solid transparent;background-clip:content-box} ::-webkit-scrollbar-track{background:transparent}`.

### 1.2 Scrim → Dialog → Header → Body → Footer

| # | Element | Style (literal) |
|---|---|---|
| S | `div[data-ns-scrim]` | `position:fixed;inset:0;height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:auto;padding:24px;background:var(--fai-scrim)` (=rgba(240,241,241,.72)) `;backdrop-filter:blur(var(--fai-scrim-blur))` (=2px) `;-webkit-backdrop-filter:blur(2px);font:var(--fai-type-body)` (400 14/1.45 sans) `;color:var(--fai-text)` (#1f2224). NOTE: `backdrop-filter` makes the scrim the containing block for all `position:fixed` popovers inside it — the script's `fixedOrigin()` compensates (§2.6). |
| D | `div[data-ns-dialog] role=dialog aria-modal=true aria-label="New Session"` | `width:100%;max-width:980px;max-height:100%;display:flex;flex-direction:column;flex:none;animation:nsPanel 260ms ease-out both;background:var(--fai-grey-100)` (#f2f3f3) `;border-radius:var(--fai-radius-modal)` (18px) `;padding:7px;box-shadow:var(--fai-shadow-modal)`. |
| H | Header row (child of D) | `display:flex;align-items:center;justify-content:space-between;gap:10px;padding:3px 4px 8px;flex:none` |
| H.1 | Left group | `display:flex;align-items:center;gap:10px;min-width:0` |
| H.1a | Bolt tile | `span` `display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:var(--fai-radius-xs)` (5px) `;background:var(--fai-grey-900)` (#1f2224) `;color:#fff;flex:none` containing mask icon 13×13 `bolt-bold-duotone` (white). |
| H.1b | Title | `span` `font:500 13px/1 sans;color:var(--fai-text-muted)` (#6e7378) `;white-space:nowrap;overflow:hidden;text-overflow:ellipsis` text `Sessions · New` (U+00B7 middle dot). |
| H.2 | Close | `<x-import FlowAIDesignSystem_94b032.IconButton icon="x" size="sm" variant="ghost" label="Close">` → see §5 (28×28, ghost, Lucide `x` 14px). No handler wired in the design. |
| B | Scroll body | `div.fai-scroll` `onScroll={onBodyScroll}` `flex:1;min-height:0;overflow:auto;background:var(--fai-surface)` (#fff) `;border-radius:var(--fai-radius-lg)` (12px) `;padding:18px 18px 20px` |
| B.h2 | `h2` | `font:500 20px/1.25 sans;letter-spacing:var(--fai-tracking-snug)` (-0.01em); text `New Session`. (`h2{margin:0}` from base.css.) |
| B.1 | Section "First prompt" | `section` `animation:nsIn 260ms ease-out both 0ms;display:grid;gap:8px;margin-top:16px;position:relative;z-index:30` |
| B.comb1 | `div.fai-comb` | `margin-top:18px` (14px tall comb rule) |
| B.2 | Wrapper | `div` `display:grid;gap:18px;margin-top:18px` containing: |
| B.2a | Location wrapper | `div` `animation:nsIn 260ms ease-out both 60ms;display:grid;gap:16px` → `section` Location `animation:nsIn 260ms ease-out both 0ms;display:grid;gap:8px` |
| B.2comb | `div.fai-comb` | (no margin) |
| B.2b | Model/Effort/Perm wrapper | `div` `animation:nsIn 260ms ease-out both 140ms;display:grid;gap:16px` → `div` `display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:16px 20px` → two columns each `div` `display:grid;gap:16px;align-content:start;min-width:0`. Column 1: `section` Model (`animation:nsIn 260ms ease-out both 40ms;display:grid;gap:8px`). Column 2: `section` Effort (`…both 80ms`) then `section` Permission mode (`…both 120ms`), both `display:grid;gap:8px`. |
| F | `div[data-ns-footer]` | `flex:none;margin-top:6px;background:var(--fai-surface);border-radius:var(--fai-radius-lg)` (12) `;padding:10px 12px;display:flex;align-items:center;justify-content:flex-end;gap:8px` |

### 1.3 Section header pattern (used by all 5 sections)
`div` `display:flex;align-items:center;justify-content:space-between;gap:8px` (Location adds `flex-wrap:wrap`) → left `div` `display:flex;align-items:center;gap:8px` → mask icon 16×16 with section hue + `span` `font:var(--fai-type-label)` (500 13/1.3 sans). Right slot is empty except Location (segmented tabs, §1.5). "First prompt" section additionally has a `div.fai-comb` directly under its header (before the composer).

| Section | Icon | Hue token → hex |
|---|---|---|
| First prompt | `chat-round-line-bold-duotone` | `--fai-blue-500` #3b7bff |
| Location | `folder-bold-duotone` | `--fai-amber-500` #f0ad1f |
| Model | `cpu-bolt-bold-duotone` | `--fai-violet-500` #6366f1 |
| Effort | `tuning-2-bold-duotone` | `--fai-orange-500` #f97316 |
| Permission mode | `shield-keyhole-bold-duotone` | `--fai-green-600` #16a34a |

### 1.4 First prompt — composer
| Node | Style |
|---|---|
| Composer frame | `div` `position:relative;display:grid;background:var(--fai-surface);border:1px solid {composerBorder};border-radius:12px;box-shadow:{composerShadow};transition:var(--fai-transition-control),box-shadow 120ms ease-standard`. `composerBorder` = `var(--fai-grey-400)` (#b3b7ba) when `promptFocus` else BORDER. `composerShadow` = `0 0 0 3px var(--fai-focus-ring)` (rgba(59,123,255,.28)) when focused else `var(--fai-shadow-xs)`. |
| Editor wrap | `div` `position:relative` |
| Editor | `div ref=editorRef contentEditable=true role=textbox aria-multiline=true aria-label="First prompt"` handlers `onInput=onEditorInput onKeyDown=onEditorKey onKeyUp=onEditorCaret onClick=onEditorCaret onFocus=onPromptFocus onBlur=onPromptBlur`; style `width:100%;height:{promptH};padding:12px 16px 6px;overflow:auto;outline:none;background:transparent;border-radius:12px 12px 0 0;font:400 14px/1.55 sans;color:var(--fai-text);white-space:pre-wrap;word-break:break-word;transition:height 240ms ease-out`. `promptH` = `'120px'` if `promptFocus || prompt || menu` else `'44px'`. |
| Placeholder (`sc-if promptEmpty`) | `span` `position:absolute;left:16px;top:12px;right:16px;font:400 14px/1.55 sans;color:var(--fai-text-subtle)` (#9ca1a6) `;pointer-events:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis` text: `What should the agent do first? ` + `<span style="color:var(--fai-grey-400)">@ machine or project · / skills and plugins</span>`. `promptEmpty` = `!prompt && !promptFocus`. |
| Trigger menu (`sc-if menuOpen`) | see §2.3 |
| Chip row | `div` `display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:8px 10px 10px` containing Machines chip wrapper and Project chip wrapper, each `div[data-ns-pop]` `position:relative`. |
| Machines chip | `button type=button onClick=toggleMachinesPop aria-expanded={machinesPopOpen}` `display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 8px 0 8px;background:var(--fai-surface);border:1px solid var(--fai-border);border-radius:8px;font:500 13px/1 sans;color:var(--fai-text);cursor:pointer;white-space:nowrap;max-width:100%;transition:var(--fai-transition-control);color:{machineChipColor};border-color:{machineChipBorder}` + `style-hover="background:var(--fai-grey-50)"` (#f7f8f8). Children: mask icon 15×15 `server-square-bold-duotone` `color:var(--fai-cyan-500)` (#14b0e0) flex:none; `span` `min-width:0;overflow:hidden;text-overflow:ellipsis` `{machineChipLabel}`; mask icon 13×13 `alt-arrow-down-linear` `color:var(--fai-text-subtle)`. |
| Project chip | same button styles, `onClick=toggleProjectsPop aria-expanded={projectsPopOpen}`, `color:{projectNameColor}` (no border-color binding). Children: mask icon 15×15 `folder-with-files-bold-duotone` `color:var(--fai-amber-500)`; label `{projectName}`; if `hasProject`: `span role=button onClick=clearProject title="Clear project"` `animation:nsCheck 200ms ease-out both;display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;margin-right:-2px;border-radius:5px;color:var(--fai-text-subtle)` + `style-hover="background:var(--fai-grey-100);color:var(--fai-text)"` containing mask icon 13×13 `close-square-linear`; else (`noProject`) mask icon 13×13 `alt-arrow-down-linear` text-subtle. |

### 1.5 Location
| Node | Style |
|---|---|
| Segmented (header right) | `div role=tablist` `position:relative;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:2px;padding:3px;background:var(--fai-grey-200)` (#e8e9ea) `;border-radius:10px` |
| Thumb | `span` `position:absolute;top:3px;bottom:3px;left:3px;width:calc((100% - 8px) / 2);transform:translateX(calc({tabIdx} * (100% + 2px)));background:var(--fai-surface);border-radius:8px;box-shadow:var(--fai-shadow-raised);transition:transform 240ms ease-out;pointer-events:none`. `tabIdx` = 0 for `dir`, 1 for `repo`. |
| Tab "Existing files" | `button role=tab onClick=setDirMode aria-selected={isDirMode}` `height:26px;padding:0 10px;border:none;cursor:pointer;border-radius:8px;font:500 12px/1 sans;color:{dirTabColor};background:transparent;position:relative;white-space:nowrap;transition:var(--fai-transition-control);display:inline-flex;align-items:center;justify-content:center;gap:6px` + mask icon 14×14 `folder-bold-duotone` amber-500 + text. `dirTabColor` = INK when dir mode else `var(--fai-text-muted)`. |
| Tab "Clone from GitHub" | same; `<img src=LOBE(github) width=14 height=14 style="flex:none;opacity:{repoTabIconO}">` (`1` in repo mode else `.6`) + text. `repoTabColor` INK/text-muted. |
| Dir field frame | `div` `background:{dirBg};border:1px solid var(--fai-border);border-radius:10px;box-shadow:var(--fai-shadow-xs);overflow:hidden;transition:var(--fai-transition-control)`. `dirBg` = `var(--fai-grey-50)` when `dirLocked` else SURF. |
| Dir row | `div` `display:flex;align-items:center;gap:8px;height:42px;padding:0 6px 0 12px` → mask icon 16×16 `folder-open-bold-duotone` amber-500 flex:none; `<input value={dir} onChange=onDirInput readOnly={dirLocked} spellCheck=false autoCapitalize=off placeholder="~/code/project">` `flex:1;min-width:0;border:none;outline:none;background:transparent;font:400 13px/1.4 mono;color:var(--fai-text);padding:0`. |
| Locked adornments (`sc-if dirLocked`) | badge `span` `animation:nsIn 200ms ease-out both;display:inline-flex;align-items:center;gap:4px;height:24px;padding:0 8px;border-radius:8px;background:var(--fai-status-info-bg)` (#eaf0ff) `;color:var(--fai-status-info-fg)` (#2f5ce6) `;font:500 11px/1 sans;white-space:nowrap` text `From project`; then `button onClick=overrideDir` `animation:nsIn 200ms ease-out both 40ms;height:30px;padding:0 10px;border:none;background:transparent;border-radius:8px;font:500 13px/1 sans;color:var(--fai-text-muted);cursor:pointer;white-space:nowrap` + `style-hover="background:var(--fai-grey-100);color:var(--fai-text)"` text `Override`. |
| Browse button (`sc-if dirUnlocked`) | `button onClick=openBrowse disabled={noMachine}` `animation:nsIn 200ms ease-out both;display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 10px;border:1px solid var(--fai-border);background:var(--fai-surface);border-radius:8px;font:500 13px/1 sans;color:var(--fai-text);cursor:pointer;white-space:nowrap;opacity:{browseOpacity}` + `style-hover="background:var(--fai-grey-50)"`; mask icon 14×14 `{browseIcon}` `color:var(--fai-text-muted)` + `{browseLabel}`. `browseLabel` = `Close` when browsing else `Browse`; `browseIcon` = `alt-arrow-up-linear` when browsing else `magnifer-linear`; `browseOpacity` = 1 if any machine selected else .5. |
| Browse panel (height-animated) | `div` `display:grid;grid-template-rows:{browseRows};transition:grid-template-rows 280ms ease-out` (`1fr` when browsing else `0fr`) → `div` `min-height:0;overflow:hidden` → `div` `border-top:1px solid var(--fai-border-subtle)` (#ededee) `;background:var(--fai-surface-subtle)` (#f7f8f8) |
| Crumb bar | `div` `display:flex;align-items:center;gap:8px;padding:8px 8px 8px 10px;border-bottom:1px solid var(--fai-border-subtle);background:var(--fai-surface-subtle)` → machine badge `span` `display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 8px;border-radius:8px;background:var(--fai-grey-100);font:500 12px/1 sans;color:var(--fai-text);white-space:nowrap;flex:none` with 6×6 dot `border-radius:999px;background:var(--fai-presence-online)` (#22c55e) + `{browseMachine}`; then `div.fai-scroll` `flex:1;min-width:0;display:flex;align-items:center;gap:2px;overflow-x:auto;font:400 13px/1 mono;color:var(--fai-text-muted);white-space:nowrap` → per crumb: `button onClick=c.go` `height:24px;padding:0 6px;border:none;background:transparent;border-radius:5px;font:inherit;color:{c.color};cursor:pointer` + `style-hover="background:var(--fai-grey-100)"` text `{c.label}`; if `c.sep`: `span` `color:var(--fai-grey-400)` text `/`. |
| Folder list | `div.fai-scroll` `max-height:196px;overflow:auto;padding:6px;display:grid;gap:1px`. If `canGoUp`: `button onClick=goUp` `display:flex;align-items:center;gap:10px;height:34px;padding:0 8px;border:none;background:transparent;border-radius:8px;font:400 13px/1 mono;color:var(--fai-text-muted);cursor:pointer;text-align:left` + `style-hover="background:var(--fai-surface)"` with mask icon 16×16 `arrow-left-linear` + text `..`. Per folder: `button onClick=f.enter` same base but `color:var(--fai-text)` and `animation:nsIn 220ms ease-out both {f.delay}` (`i*22ms`); children: mask icon 16×16 `{f.icon}` `color:{f.color}` flex:none; `span` `flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis` `{f.name}`; `span` `font:var(--fai-type-meta);color:var(--fai-text-subtle);font-family:sans` `{f.meta}`; mask icon 14×14 `arrow-right-linear` `color:var(--fai-grey-400)`. If `noFolders`: `div` `animation:nsIn 200ms ease-out both;padding:14px 8px;font:var(--fai-type-meta);color:var(--fai-text-subtle);text-align:center` text `No subfolders`. |
| Browse footer | `div` `display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px;border-top:1px solid var(--fai-border-subtle);background:var(--fai-surface)` → `span` `font:400 12px/1.3 mono;color:var(--fai-text-muted);min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis` `{browsePathLabel}`; `<x-import Button variant=primary size=sm on-click=useFolder>Use this folder</x-import>`. |
| Repo panel (height-animated) | `div` `display:grid;grid-template-rows:{repoRows};transition:grid-template-rows 280ms ease-out` (`1fr` in repo mode else `0fr`) → `div` `min-height:0;overflow:hidden` → `div` `transform:translateY({repoShift});opacity:{repoOpacity};pointer-events:{repoEvents};transition:transform 280ms ease-out,opacity 280ms ease-standard` (`0`/`1`/`auto` in repo mode; `-12px`/`0`/`none` otherwise) → `div` `display:grid;gap:8px` |
| Repo row | `div` `display:grid;grid-template-columns:minmax(0,1fr) 168px;gap:8px` |
| Repo field | `div` `display:flex;align-items:center;gap:8px;height:42px;padding:0 12px;background:var(--fai-surface);border:1px solid var(--fai-border);border-radius:10px;box-shadow:var(--fai-shadow-xs)` → `<img src=LOBE(github) width=16 height=16 style="flex:none;opacity:.8">` + `<input value={repo} onChange=onRepoInput spellCheck=false autoCapitalize=off placeholder="owner/repository">` `flex:1;min-width:0;border:none;outline:none;background:transparent;font:400 13px/1.4 mono;color:var(--fai-text);padding:0`. |
| Branch button wrapper | `div[data-ns-pop]` `position:relative` |
| Branch button | `button onClick=toggleBranchesPop disabled={branchDisabled} aria-expanded={branchesPopOpen}` `width:100%;display:grid;height:42px;padding:0 10px 0 12px;background:{branchBg};border:1px solid var(--fai-border);border-radius:10px;box-shadow:var(--fai-shadow-xs);text-align:left;cursor:{branchCursor};color:var(--fai-text);transition:var(--fai-transition-control)`. Three stacked layers each `span` `grid-area:1/1;display:flex;align-items:center;gap:8px;min-width:0;opacity:{o};transform:translateY({s});transition:opacity 160ms ease-standard,transform 240ms ease-out;pointer-events:none`: (1) EMPTY: mask icon 15×15 `branching-paths-down-bold-duotone` `color:var(--fai-grey-400)` + `span` `font:400 13px/1 mono;color:var(--fai-text-subtle)` text `—` (em dash); (2) LOADING: spinner `span` `width:14px;height:14px;flex:none;border-radius:999px;border:2px solid var(--fai-grey-300);border-top-color:var(--fai-grey-900);animation:nsSpin 700ms linear infinite` + `span` `font:var(--fai-type-meta);color:var(--fai-text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis` text `Fetching branches…`; (3) READY: mask icon 15×15 `branching-paths-down-bold-duotone` text-subtle + `span` `flex:1;min-width:0;font:400 13px/1 mono;white-space:nowrap;overflow:hidden;text-overflow:ellipsis` `{branch}` + mask icon 14×14 `alt-arrow-down-linear` text-subtle. Values: `branchBg` = SURF if branches is an array else `var(--fai-grey-50)`; `branchCursor` `pointer`/`default`; `brEmptyO/S` = `1,'0'` when `branches===null` else `0,'-6px'`; `brLoadO/S` = `1,'0'` when `'loading'` else `0,'6px'`; `brReadyO/S` = `1,'0'` when array else `0,'6px'`. |
| Clone note | `div` `display:flex;align-items:flex-start;gap:8px;padding:9px 10px;background:var(--fai-surface-subtle);border:1px solid var(--fai-border-subtle);border-radius:10px` → mask icon 15×15 `refresh-bold-duotone` `color:var(--fai-blue-500);flex:none;margin-top:1px` + `span` `font:var(--fai-type-meta);color:var(--fai-text-muted);text-wrap:pretty;min-width:0` text `Cloned into <span style="font-family:mono;color:var(--fai-text)">{cloneTarget}</span> on each machine, pulled fresh before the agent starts.` `cloneTarget` = `dir || '~'`. |

### 1.6 Model
| Node | Style |
|---|---|
| Harness radiogroup | `div role=radiogroup aria-label="Harness" onMouseMove=fhHarnessMove onMouseLeave=fhHarnessLeave` `position:relative;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:2px;padding:3px;background:var(--fai-grey-100);border-radius:10px` |
| Follow-hover ghost | `span` `position:absolute;left:0;top:0;width:{fhHarness.w}px;height:{fhHarness.h}px;transform:translate({fhHarness.x}px,{fhHarness.y}px);opacity:{fhHarness.o};background:var(--fai-grey-200);border-radius:8px;transition:transform 80ms ease-standard,width 80ms ease-standard,height 80ms ease-standard,opacity 120ms ease-standard;pointer-events:none` |
| Selection thumb | `span` `position:absolute;top:3px;bottom:3px;left:3px;width:calc((100% - 12px) / 4);transform:translateX(calc({harnessIdx} * (100% + 2px)));background:var(--fai-surface);border-radius:8px;box-shadow:var(--fai-shadow-raised);transition:transform 160ms ease-out;pointer-events:none` |
| Harness tab ×4 | `button role=radio data-fh=1 onClick=h.pick aria-checked={h.on} title={h.name}` `animation:nsIn 220ms ease-out both {h.delay}` (`i*30ms`) `;position:relative;display:flex;align-items:center;justify-content:center;gap:6px;height:32px;padding:0 6px;min-width:0;background:transparent;border:none;border-radius:8px;cursor:pointer;color:{h.color};transition:color 120ms ease-standard` → logo `span` `display:inline-block;width:16px;height:16px;flex:none;background:url({h.img}) center/contain no-repeat` + `span` `font:500 12px/1 sans;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0` `{h.name}`. `h.color` = INK when selected else text-muted. `h.img` = LOBE(claude-color | openai | opencode | pi). (`h.letter` fallback is computed but NOT rendered anywhere.) |
| Search field | `div` `display:flex;align-items:center;gap:8px;height:38px;padding:0 10px;background:var(--fai-surface);border:1px solid {searchBorder};border-radius:10px;box-shadow:var(--fai-shadow-xs);transition:var(--fai-transition-control)` → mask icon 15×15 `magnifer-linear` text-subtle flex:none; `<input value={query} onChange=onQuery onKeyDown=onQueryKey onFocus=onSearchFocus onBlur=onSearchBlur spellCheck=false autoCapitalize=off autoCorrect=off placeholder="Search models or paste a custom model id...">` `flex:1;min-width:0;border:none;outline:none;background:transparent;font:400 13px/1.4 sans;color:var(--fai-text);padding:0`; if `hasQuery`: `button onClick=clearQuery aria-label="Clear"` `display:inline-flex;width:22px;height:22px;align-items:center;justify-content:center;border:none;background:transparent;color:var(--fai-text-subtle);cursor:pointer;border-radius:5px` + `style-hover="color:var(--fai-text)"` with mask icon 14×14 `close-square-linear`. `searchBorder` = grey-400 when `searchFocus` else BORDER. NOTE placeholder uses three ASCII dots. |
| Model list | `div.fai-scroll onMouseMove=fhModelsMove onMouseLeave=fhModelsLeave` `position:relative;display:grid;gap:2px;align-content:start;height:220px;overflow:auto;padding:4px;background:var(--fai-surface);border:1px solid var(--fai-border);border-radius:10px;box-shadow:var(--fai-shadow-xs)` |
| List follow-hover ghost | `span` `position:absolute;left:0;top:0;width:{fhModels.w}px;height:{fhModels.h}px;transform:translate({fhModels.x}px,{fhModels.y}px);opacity:{fhModels.o};background:var(--fai-grey-50);border-radius:8px;transition:transform 80ms ease-standard,width 80ms ease-standard,height 80ms ease-standard,opacity 120ms ease-standard;pointer-events:none` |
| List selection fill | `span` `position:absolute;left:4px;right:4px;top:4px;height:44px;transform:translateY(calc({modelIdx} * 46px));opacity:{modelHiOpacity};background:var(--fai-grey-100);border-radius:8px;transition:transform 160ms ease-out,opacity 120ms ease-standard;pointer-events:none` (row 44 + gap 2 = 46 pitch). No check icon on model rows — selection is this sliding fill only. |
| Custom-id row (`sc-if showCustomRow`) | `button data-fh=1 onClick=pickCustom` `position:relative;display:flex;align-items:center;gap:10px;width:100%;height:44px;padding:6px 8px;background:var(--fai-surface);border:1px dashed {customBorder}` (always `var(--fai-grey-400)`) `;border-radius:8px;cursor:pointer;text-align:left;color:var(--fai-text);animation:nsIn 220ms ease-out both` + `style-hover="background:var(--fai-grey-50)"` → tile `span` `display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:8px;background:var(--fai-grey-900);color:#fff;flex:none` with mask icon 14×14 `code-square-bold-duotone`; `span` `flex:1;min-width:0` → `span` `display:block;font:500 13px/1.3 sans` text `Use custom model id` + `span` `display:block;font:var(--fai-type-meta);color:var(--fai-text-muted);font-family:mono;white-space:nowrap;overflow:hidden;text-overflow:ellipsis` `{query}`; trailing `span` `font:var(--fai-type-meta);color:var(--fai-text-subtle);white-space:nowrap` text `↵ Enter`. |
| Model row (×visibleModels) | `button data-fh=1 onClick=md.pick aria-pressed={md.on}` `position:relative;display:flex;align-items:center;gap:10px;width:100%;height:44px;padding:6px 8px;background:transparent;border:1px solid transparent;border-radius:8px;cursor:pointer;text-align:left;color:var(--fai-text);animation:{md.anim}` → vendor tile `span` `position:relative;display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:8px;background:var(--fai-surface);box-shadow:<tile shadow>;flex:none;overflow:hidden` → `span` `position:absolute;inset:0;background:url({md.img}) center/16px 16px no-repeat`; text block `span` `flex:1;min-width:0` → `span` `display:block;font:500 13px/1.3 sans;white-space:nowrap;overflow:hidden;text-overflow:ellipsis` `{md.name}` + `span` `display:block;font:var(--fai-type-meta);color:var(--fai-text-subtle);white-space:nowrap;overflow:hidden;text-overflow:ellipsis` → `<span style="font-family:mono">{md.id}</span> · {md.vendor}`; badge `span` `font:400 12px/1 mono;color:var(--fai-text-subtle);white-space:nowrap` `{md.ctx}` (e.g. `200K`, `1M`, `400K`). |
| No results (`sc-if noResults`) | `div` `animation:nsIn 200ms ease-out both;display:grid;place-items:center;gap:6px;padding:22px 12px;color:var(--fai-text-subtle);font:var(--fai-type-meta);text-align:center` text `No {harnessName} models match "{query}"`. |

### 1.7 Effort
| Node | Style |
|---|---|
| Box | `div` `position:relative;display:grid;height:56px;padding:10px 12px 10px;background:var(--fai-surface-subtle);border:1px solid var(--fai-border-subtle);border-radius:10px;overflow:hidden` (two layers stacked in `grid-area:1/1`) |
| Slider layer | `div` `grid-area:1/1;display:grid;align-content:start;opacity:{sliderOpacity};transform:translateY({sliderShift});transition:opacity 240ms ease-standard,transform 240ms ease-out;pointer-events:{sliderEvents}` — `1 / '0' / 'auto'` when the model has ≥1 effort level, else `0 / '-6px' / 'none'`. |
| Track | `div onPointerDown=onEffortDown onPointerMove=onEffortMove onPointerUp=onEffortUp onPointerCancel=onEffortUp onPointerLeave=onEffortLeave` `position:relative;height:34px;background:var(--fai-surface);border:1px solid {effortBoxBorder};border-radius:10px;overflow:hidden;cursor:ew-resize;user-select:none;touch-action:none;transition:var(--fai-transition-control),box-shadow 120ms ease-standard;box-shadow:{effortBoxShadow}`. `effortBoxBorder` = grey-400 when `effortFocus` else BORDER; `effortBoxShadow` = `0 0 0 3px var(--fai-focus-ring)` when `effortFocus` else `none`. |
| Fill | `div` `position:absolute;left:0;top:0;bottom:0;width:calc({effortP} * 100% + {effortFillOff}px);background:var(--fai-grey-100);transition:width 160ms ease-out;pointer-events:none` |
| Hover preview | `div` `position:absolute;top:0;bottom:0;left:{effortHoverL}px;width:{effortHoverW}px;opacity:{effortHoverO};background:rgba(59,123,255,.14);transition:opacity 120ms ease-standard;pointer-events:none` |
| Pips ×5 (`sc-for effortStops`) | `span` `position:absolute;top:50%;left:calc(12px + (100% - 29px) * {s.frac});width:5px;height:5px;margin-top:-2.5px;border-radius:999px;background:var(--fai-grey-900);opacity:{s.pipO};transition:left 160ms ease-out,opacity 120ms ease-standard;pointer-events:none` |
| Handle line | `div` `position:absolute;top:{effortLineInset}px;bottom:{effortLineInset}px;left:calc({effortP} * 100% + {effortLineOff}px);width:2px;border-radius:1px;background:{effortLineColor};transition:left 160ms ease-out,top 120ms ease-standard,bottom 120ms ease-standard,background-color 120ms ease-standard;pointer-events:none` |
| Labels | `div` `position:absolute;inset:0;display:flex;align-items:center;justify-content:space-between;padding:0 10px;pointer-events:none` → left `span` `font:500 13px/1 sans;color:{effortTextColor};padding:0 4px;background:{effortTextBg};border-radius:3px;transition:color 120ms ease-standard` text `Effort`; right `span` same + `text-transform:capitalize;font-variant-numeric:tabular-nums` text `{effortLabel}`. `effortTextBg` is always `'transparent'`. |
| Range input | `<input type=range min=0 max={effortMax} step=1 value={effortIdx} onChange=onEffort onInput=onEffort onFocus=onEffortFocus onBlur=onEffortBlur aria-label="Effort">` `position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;pointer-events:none` (keyboard-only; pointer goes to the track div). |
| Lock layer | `div` `grid-area:1/1;display:flex;align-items:center;gap:10px;opacity:{lockOpacity};transform:translateY({lockShift});transition:opacity 240ms ease-standard,transform 240ms ease-out;pointer-events:none` (`0 / '6px'` when efforts exist, else `1 / '0'`) → mask icon 16×16 `lock-bold-duotone` text-subtle flex:none + `span` `font:var(--fai-type-meta);color:var(--fai-text-muted);text-wrap:pretty` `{noEffortText}`. |

### 1.8 Permission mode
| Node | Style |
|---|---|
| Container | `div onMouseMove=fhPermsMove onMouseLeave=fhPermsLeave` `position:relative;display:grid;gap:2px;padding:4px;background:var(--fai-surface);border:1px solid var(--fai-border);border-radius:10px;box-shadow:var(--fai-shadow-xs)` |
| Follow-hover ghost | as model list ghost (`fhPerms`, grey-50, radius 8) |
| Selection fill | `span` `position:absolute;left:4px;right:4px;top:4px;height:44px;transform:translateY(calc({permIdx} * 46px));background:var(--fai-grey-100);border-radius:8px;transition:transform 160ms ease-out;pointer-events:none` |
| Row ×3 | `button data-fh=1 onClick=pm.pick aria-pressed={pm.on}` `animation:nsIn 220ms ease-out both {pm.delay}` (`i*35ms`) `;position:relative;display:flex;align-items:center;gap:10px;width:100%;height:44px;padding:6px 8px;background:transparent;border:1px solid transparent;border-radius:8px;cursor:pointer;text-align:left;color:var(--fai-text)` → tile `span` `display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:8px;background:var(--fai-surface);color:{pm.hue};box-shadow:<tile shadow>;flex:none` with mask icon 15×15 `{pm.icon}`; text block (`display:block;font:500 13px/1.3 sans` name; `display:block;font:var(--fai-type-meta);color:var(--fai-text-subtle);white-space:nowrap;overflow:hidden;text-overflow:ellipsis` desc); if `pm.on`: mask icon 16×16 `check-circle-bold` `background:var(--fai-grey-900);flex:none;animation:nsCheck 200ms ease-out both`. |

### 1.9 Footer
| Node | Style |
|---|---|
| Lifetime segmented | `div[data-ns-summary] role=radiogroup aria-label="Session lifetime"` `position:relative;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:2px;padding:3px;background:var(--fai-grey-200);border-radius:10px;margin-right:auto`. (Yes — the attribute `data-ns-summary` is on the segmented control; there is NO separate summary-text element in this design. See §8.) |
| Thumb | `span` `position:absolute;top:3px;bottom:3px;left:3px;width:calc((100% - 8px) / 2);transform:translateX(calc({lifeIdx} * (100% + 2px)));background:var(--fai-surface);border-radius:8px;box-shadow:var(--fai-shadow-raised);transition:transform 240ms ease-out;pointer-events:none`. `lifeIdx` 0 = ephemeral, 1 = persistent. |
| Ephemeral | `button role=radio onClick=setEphemeral aria-checked={isEphemeral} title="Ephemeral"` `position:relative;display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 10px;border:none;background:transparent;border-radius:8px;font:500 13px/1 sans;color:{ephColor};cursor:pointer;white-space:nowrap;transition:var(--fai-transition-control)` → mask icon 15×15 `fire-bold-duotone` `color:var(--fai-orange-500)` + `<span>Ephemeral</span>`. `ephColor` INK when selected else text-muted. |
| Persistent | same, `database-bold-duotone` `color:var(--fai-blue-500)`, `perColor`. |
| Cancel | `<x-import Button variant=secondary size=md>Cancel</x-import>` — no handler wired. |
| Start | `<x-import Button variant=primary size=md disabled={cantStart} on-click=start>{startLabel}</x-import>`. `start` is `() => {}` in the design. |

### 1.10 Icon-tile treatment summary
| Tile | Size | Radius | Background | Glyph | Where |
|---|---|---|---|---|---|
| Header bolt | 22 | 5 (xs) | grey-900 | 13 white `bolt-bold-duotone` | dialog header |
| Trigger-menu item | 22 | 5 (xs) | surface + tile shadow | 13 in `mi.hue` | @ / menu rows |
| Project row | 24 | 8 (chip) | surface + tile shadow | 14 `folder-with-files-bold-duotone` in `p.hue` | projects popover |
| "New project…" | 24 | 8 | `1px dashed var(--fai-grey-400)` | 14 `add-circle-linear` currentColor | projects popover |
| Machine row | 26 | 8 | on: grey-900 / off: surface + tile shadow | 15 `SOLAR(m.icon)` white when on, else `m.hue` | machines popover |
| "Connect a machine…" | 26 | 8 | dashed grey-400 | 14 `add-circle-linear` | machines popover |
| Custom model row | 26 | 8 | grey-900 | 14 white `code-square-bold-duotone` | model list |
| Model row vendor | 26 | 8 | surface + tile shadow, overflow hidden | 16×16 LOBE image, centered (`background:url() center/16px 16px no-repeat`) | model list |
| Permission row | 26 | 8 | surface + tile shadow | 15 `SOLAR(p.icon)` in `p.hue` | perms |

### 1.11 Every icon and where
| Iconify id (`solar:`) | Sizes | Used in |
|---|---|---|
| `bolt-bold-duotone` | 13 | header tile |
| `chat-round-line-bold-duotone` | 16 | First prompt header (blue-500) |
| `server-square-bold-duotone` | 15 | machines chip (cyan-500); also `MACHINES[1].icon` via `SOLAR('server-square')` (15, tile) |
| `laptop-bold-duotone`, `cpu-bold-duotone`, `monitor-bold-duotone` | 15 | machine tiles via `SOLAR(m.icon)` |
| `alt-arrow-down-linear` | 13 (chips), 14 (branch button, ready layer) | chips, branch |
| `alt-arrow-up-linear` | 14 | Browse button when browsing (`Close`) |
| `magnifer-linear` | 14 (Browse button), 15 (search) | Browse, model search |
| `close-square-linear` | 13 (project clear), 14 (search clear) | chips, search |
| `check-circle-bold` | 16 | machine rows (always present, opacity/scale), project rows (sc-if), perm rows (sc-if) |
| `add-circle-linear` | 14 | "Connect a machine…", "New project…" |
| `documents-bold-duotone` | 13 | Copy button in pairing |
| `folder-with-files-bold-duotone` | 15 (chip), 14 (project tiles, new-project name input), menu `Project` items (13) | project chip/popover/@-menu |
| `folder-bold-duotone` | 16 (Location header, folder rows), 14 (tab, new-project path input) | Location |
| `folder-open-bold-duotone` | 16 | dir input leading icon |
| `link-round-angle-bold-duotone` | 14 | new-project repo input |
| `arrow-left-linear` | 16 | `..` row |
| `arrow-right-linear` | 14 | folder rows trailing |
| `branching-paths-down-bold-duotone` | 15 (branch button), 14 (branch popover rows) ; also `SKILLS[3].icon` (13, /commit) | branch |
| `refresh-bold-duotone` | 15 | clone note (blue-500) |
| `cpu-bolt-bold-duotone` | 16 | Model header (violet-500) |
| `code-square-bold-duotone` | 14 | custom-id tile |
| `tuning-2-bold-duotone` | 16 | Effort header (orange-500) |
| `lock-bold-duotone` | 16 | no-effort lock layer |
| `shield-keyhole-bold-duotone` | 16 | Permission header (green-600) |
| `shield-check-bold-duotone`, `pen-new-square-bold-duotone`, `danger-triangle-bold-duotone` | 15 | PERMS tiles |
| `fire-bold-duotone` | 15 | Ephemeral (orange-500) |
| `database-bold-duotone` | 15 | Persistent (blue-500) |
| `clipboard-check-`, `test-tube-`, `notes-`, `branching-paths-down-bold-duotone` | 13 | SKILLS (/ menu) |
| `window-frame-`, `book-2-`, `checklist-minimalistic-`, `shield-warning-bold-duotone` | 13 | PLUGINS (/ menu) |

LOBE vendor logos: `github` (14 in tab @ opacity .6/1; 16 @ .8 in repo field), harness tabs `claude-color`, `openai`, `opencode`, `pi` (16), model vendor tiles per `VENDORS[*].img` (`claude-color`, `openai`, `gemini-color`, `deepseek-color`, `kimi-color`, `qwen-color`, `xai`, `zhipu-color`, `minimax-color`, `mistral-color`); custom vendor has `img:''` → rendered as an empty inline SVG data URI `data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22/%3E`.

---

## 2. State and behaviour

### 2.1 Props (`data-props`)
| Prop | Type | Default | Effect |
|---|---|---|---|
| `harness` | `'claude-code'\|'codex'\|'opencode'\|'pi'` | `'claude-code'` | initial `state.harness` and `state.listHarness`; on change (`componentDidUpdate`) → `switchHarness(props.harness)` if it differs from `state.harness`. |
| `permissionMode` | `'ask'\|'auto-edit'\|'full'` | `'ask'` | initial `state.perm`; on change → `setState({perm})`. |
| `sessionType` | `'ephemeral'\|'persistent'` | `'persistent'` | initial `state.session`; on change → `setState({session})`. |

### 2.2 State table (`class Component extends DCLogic { state = {...} }`)
| Name | Type | Initial | Changed by |
|---|---|---|---|
| `machines` | `string[]` machine ids | `['m1','m2']` | `m.toggle` (row click), `@`-menu machine apply (adds if absent) |
| `projects` | `Project[]` | `PROJECTS` | `createProj` (append) |
| `project` | `string\|null` | `null` | `p.pick`, `createProj`, `@`-menu project apply, `clearProject` (→null) |
| `pop` | `'machines'\|'projects'\|'branches'\|null` | `null` | `openPop` (toggle), `_out` (outside pointerdown), `onBodyScroll`, `p.pick`/`b.pick`/`createProj`/`clearProject` (→null) |
| `popX`, `popY` | number (px, relative to fixed containing block) | `0,0` | `openPop` |
| `popUp` | boolean | `false` | `openPop` (flip-up) |
| `np` | `{name,path,repo}\|null` | `null` | `startNewProj` (→ empty triple), `cancelNewProj`/`createProj`/`openPop`/`_out` (→null), `onNpName/Path/Repo` |
| `pairing` | boolean | `false` | `startPairing` (true, also `copied:false`), `cancelPairing`/`openPop`/`_out` (false) |
| `copied` | boolean | `false` | `copyPair` (true; auto false after 1600ms via `_t3`) |
| `menu` | `{type:'@'\|'/', query, node, start, end, x, y}\|null` | `null` | `detectTrigger` (set/clear), `onEditorKey` Escape, `insertChip` (null), `onBodyScroll` (null) |
| `menuIdx` | number | `0` | `detectTrigger` (clamped; reset to 0 when menu newly opens), ArrowUp/Down |
| `slideDir` | `1\|-1` | `1` | `switchHarness` |
| `branches` | `null\|'loading'\|{name,meta}[]` | `null` | `fetchBranches` |
| `effortHover` | number index or `-1` | `-1` | `onEffortMove` (hover idx), `onEffortDown`/`onEffortUp`/`onEffortLeave` (→-1) |
| `effortW` | number (track clientWidth) | `0` | `onEffortMove`, `onEffortDown` |
| `effortDrag` | boolean | `false` | `onEffortDown` true, `onEffortUp` false |
| `effortFocus` | boolean | `false` | range input focus/blur |
| `promptFocus` | boolean | `false` | editor focus/blur |
| `fh` | `{[name]: {x,y,w,h,o,i}}` | `{}` | `fh(name).move/leave` |
| `dirMode` | `'dir'\|'repo'` | `'dir'` | `setDirMode`, `setRepoMode` (also `browsing:false`) |
| `dir` | string | `'~/code'` | `onDirInput`, `p.pick`/`createProj`/menu project apply (= project.path), `useFolder` |
| `dirOverride` | boolean | `false` | `overrideDir` (true), `useFolder` (true), project pick/create/clear (false) |
| `browsing` | boolean | `false` | `openBrowse` (toggle), `useFolder`/`setRepoMode`/project pick (false) |
| `bpath` | `string[]` | `['code']` | `f.enter` (push), `goUp` (pop), `c.go` (slice) |
| `repo` | string | `''` | `onRepoInput`, `p.pick` (= p.repo), `createProj`/menu apply (= p.repo \|\| current) |
| `branch` | string | `'main'` | `b.pick`, `fetchBranches` success (→'main') |
| `harness` | harness id | `props.harness ?? 'claude-code'` | `switchHarness` (immediately) |
| `listHarness` | harness id | same | `switchHarness` (after 200ms) — drives which model list is rendered |
| `phase` | `'in'\|'out'\|'idle'` | `'in'` | mount → `'idle'` after 700ms; `switchHarness` → `'out'`, +200ms `'in'`, +700ms `'idle'` |
| `gen` | number | `0` | `switchHarness` (+1). NOT referenced by the template. |
| `query` | string | `''` | `onQuery`, `clearQuery`, Escape in search, `switchHarness` (→''), `pickCustom` (→'') |
| `searchFocus` | boolean | `false` | search focus/blur |
| `model` | model id | `'claude-opus-4-1'` | `pickModel`, `switchHarness`, `pickCustom` |
| `custom` | `Model\|null` | `null` | `pickCustom` (`M(query,query,'custom')`) |
| `effort` | string level or `''` | `'high'` | `pickModel` (= m.def \|\| ''), `switchHarness` (= next.def), `pickCustom` (''), slider/drag/keyboard |
| `session` | `'ephemeral'\|'persistent'` | `props.sessionType ?? 'persistent'` | footer radios, prop change |
| `perm` | `'ask'\|'auto-edit'\|'full'` | `props.permissionMode ?? 'ask'` | perm rows, prop change |
| `prompt` | string | `''` | `onEditorInput` (= `editorText()`), `insertChip` |

Timers (all cleared in `componentWillUnmount`): `_t` (phase→idle 700ms), `_t2` (harness swap 200ms), `_t3` (copied reset 1600ms), `_tb` (branch debounce 450ms), `_tb2` (fake fetch 1100ms). Document listener: `pointerdown` → `_out`.

Lifecycle:
- `componentDidMount`: `_t = setTimeout(() => setState({phase:'idle'}), 700)`; register `_out = e => { if (state.pop && !e.target.closest('[data-ns-pop]')) setState({pop:null, np:null, pairing:false}) }` on `document` `pointerdown`.
- `onBodyScroll` (scroll body `onScroll`): `if (pop || menu) setState({pop:null, menu:null})`.
- `_out` only closes `pop` (chip popovers, branch popover). It does NOT close the `@`/`/` menu (that closes via Escape, chip insert, caret leaving a trigger, or body scroll).

### 2.3 Prompt editor and trigger menus
- `editorText()` = `editorRef.current.innerText.replace(/ /g,' ').trim()`.
- `onEditorInput`: `setState({prompt: editorText()})` then `detectTrigger()`.
- `onEditorCaret` (`onKeyUp`, `onClick`): `if (!['ArrowUp','ArrowDown','Enter','Tab','Escape'].includes(e.key)) detectTrigger()`.
- `onPromptFocus/Blur`: `promptFocus` true/false.
- `detectTrigger()`:
  1. `el = editorRef.current; sel = window.getSelection()`; if no el/sel/range or `!el.contains(sel.anchorNode)` → close menu if open, return.
  2. `node = sel.anchorNode; off = sel.anchorOffset`; if `node.nodeType !== 3` (not a text node) → close, return.
  3. `before = node.textContent.slice(0, off)`; `m = /(^|[\s ])([@\/])([\w./-]*)$/.exec(before)`; no match → close, return.
  4. Caret rect: `r = document.createRange(); r.setStart(node, off); r.collapse(true); cr = r.getBoundingClientRect()`.
  5. `start = off - m[2].length - m[3].length` (index of the trigger char in `node`).
  6. `menu = { type: m[2], query: m[3], node, start, end: off, x: Math.max(8, Math.min(cr.left, window.innerWidth - 308)) - fixedOrigin(el).x, y: cr.bottom + 6 - fixedOrigin(el).y }`.
  7. `items = menuItemsFor(menu)`; `setState({menu, menuIdx: Math.min(state.menu ? state.menuIdx : 0, Math.max(0, items.length - 1))})`.
- `menuItemsFor(menu)`: `q = (menu.query||'').toLowerCase()`, `hit = t => !q || t.toLowerCase().includes(q)`.
  - `'@'`: `MACHINES.filter(m => m.status==='online' && hit(m.name))` → `{ key:'machine:'+id, label:name, kind:'Machine', icon:SOLAR(m.icon), hue:m.hue, apply: () => { if (!machines.includes(id)) setState({machines: machines.concat(id)}) } }`, then `projects.filter(p => hit(p.name))` → `{ key:'project:'+id, label:name, kind:'Project', icon:SOLAR('folder-with-files'), hue:p.hue, apply: () => setState({project:p.id, dir:p.path, dirOverride:false, repo:p.repo || repo, browsing:false}) }`.
  - `'/'`: `SKILLS.filter(k => hit(k.label)||hit(k.desc))` → `{key:'skill:'+id, label, kind:'Skill', icon:SOLAR(icon), hue, apply:()=>{}}`, then `PLUGINS.filter(p => hit(p.label))` → `{key:'plugin:'+id, label, kind:'Plugin', …, apply:()=>{}}`.
- `onEditorKey` (keydown, only when menu open): ArrowDown → `menuIdx = (menuIdx+1) % max(1,items.length)`; ArrowUp → `(menuIdx-1+items.length) % max(1,items.length)`; Enter or Tab (if items) → `insertChip(items[menuIdx] || items[0])`; Escape → `menu:null`. All `preventDefault()`.
- Menu row click: `onMouseDown={ e => { e.preventDefault(); insertChip(it) } }` (mousedown so the editor keeps focus).
- `insertChip(item)`: create `span` `contentEditable="false" data-chip={item.key}` with cssText `display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 7px 0 5px;margin:0 1px;vertical-align:-5px;border-radius:8px;background:var(--fai-grey-100);border:1px solid var(--fai-border);font:500 13px/1 sans;color:var(--fai-text);white-space:nowrap;user-select:all`, innerHTML = mask icon 13×13 with `background:{item.hue}` + `<span>{item.label}</span>`. Range `[menu.node, menu.start] → [menu.node, menu.end]` deleted; insert ` ` text node then the chip before it (`r.insertNode(space); r.insertNode(chip)` → chip precedes nbsp); caret placed after the nbsp; `item.apply()`; `setState({menu:null, prompt: editorText()})`.
- Menu popover DOM (`sc-if menuOpen`): `div[data-ns-pop] onMouseMove=fhMenuMove onMouseLeave=fhMenuLeave` `position:fixed;left:{menuX}px;top:{menuY}px;z-index:50;width:300px;background:var(--fai-surface);border:1px solid var(--fai-border);border-radius:12px;box-shadow:var(--fai-shadow-shell);padding:4px;display:grid;gap:2px;animation:nsPop 140ms ease-out both`. Children: follow-hover ghost `span` (`fhMenu`, grey-50, radius 8, `transition:transform 80ms ease-standard,height 80ms ease-standard,opacity 120ms ease-standard`); keyboard highlight `span` `position:absolute;left:4px;right:4px;top:4px;height:36px;transform:translateY(calc({menuIdx} * 38px));opacity:{menuHiOpacity};background:var(--fai-grey-100);border-radius:8px;transition:transform 120ms ease-out;pointer-events:none` (`menuHiOpacity` = 1 if any items else 0); rows `button data-fh=1` `position:relative;display:flex;align-items:center;gap:9px;width:100%;height:36px;padding:0 8px;background:transparent;border:none;border-radius:8px;cursor:pointer;text-align:left;color:var(--fai-text)` → 22px tile (§1.10) + `span` `flex:1;min-width:0;font:500 13px/1.2 sans;white-space:nowrap;overflow:hidden;text-overflow:ellipsis` `{mi.label}` + `span` `font:var(--fai-type-meta);color:var(--fai-text-subtle);white-space:nowrap` `{mi.kind}`; if `noMenuItems`: `div` `padding:10px 8px;font:var(--fai-type-meta);color:var(--fai-text-subtle)` text `No matches`. Rows have no enter animation and no hover style of their own (the ghost does the hover).

### 2.4 Follow-hover highlight (`fh`)
`FH0 = { x:0, y:0, w:0, h:0, o:0, i:-1 }`. `fh(name, axis)` returns `{ [name]: state.fh[name] || FH0, [name+'Move']: move, [name+'Leave']: leave }`.
- `move(e)`: `c = e.currentTarget; cr = c.getBoundingClientRect()`; iterate `c.querySelectorAll('[data-fh]')` skipping `el.disabled`; distance `d = axis==='x' ? |clientX − (r.left + r.width/2)| : |clientY − (r.top + r.height/2)|`; nearest wins (`bi`); if current entry has `o` truthy and same `i` → no-op; else `setState(fh[name] = { x: best.left − cr.left + c.scrollLeft, y: best.top − cr.top + c.scrollTop, w: best.width, h: best.height, o: 1, i: bi })`.
- `leave()`: `fh[name] = { ...(fh[name] || FH0), o: 0, i: -1 }` (position retained so the fade-out doesn't jump).
- Instances: `fhMenu` (y), `fhBranches` (y), `fhModels` (y), `fhPerms` (y), `fhHarness` (x), `fhMachines` (y), `fhProjects` (y). The ghost is a `span` at `left:0;top:0` translated by `(x,y)`, sized `w×h` — i.e. it always matches the nearest row's box (including for the machines list, where rows are 44px and the "Connect…" row is 40px). Ghost colour: grey-50 everywhere except the harness segmented (grey-200, radius 8).

### 2.5 Machines chip + popover
- `selMachines = MACHINES.filter(m => machines.includes(m.id))`.
- `machineChipLabel`: 0 → `Select machine`; 1 → that machine's `name`; N → `N machines`. `machineChipColor`: INK if ≥1 else `var(--fai-status-expired-fg)` (#dc2626). `machineChipBorder`: BORDER if ≥1 else `var(--fai-status-expired-fg)`.
- `machineCountLabel` (`'02 selected'` zero-padded / `'Select at least one'`) is computed but NOT rendered.
- Per-row values (`machines` array, `i` = index in MACHINES):
  - `on = machines.includes(id)`, `offline = status !== 'online'`, `icon = SOLAR(m.icon)`, `delay = (80 + i*45) + 'ms'`, `cursor = offline ? 'not-allowed' : 'pointer'`, `opacity = offline ? .55 : 1`, `bg = on ? SEL : 'transparent'`, `ring = on ? 1 : 0` (check opacity), `scale = on ? 1 : .94`, `tileBg = on ? INK : SURF`, `tileFg = on ? '#fff' : m.hue`, `tileShadow = on ? 'none' : <tile shadow>`, `dot = offline ? var(--fai-presence-offline) (#b3b7ba) : load === 'Idle' ? var(--fai-presence-online) (#22c55e) : var(--fai-presence-away) (#f97316)`.
  - `radius`: `prevOn = i>0 && machines.includes(MACHINES[i-1].id)`, `nextOn = i<len-1 && machines.includes(MACHINES[i+1].id)`; `radius = (on && prevOn ? '0 0' : '8px 8px') + ' ' + (on && nextOn ? '0 0' : '8px 8px')` → adjacent selected rows merge into one rounded block (gap is 0 in this popover).
  - `toggle`: remove if on else append.
- Popover DOM (`sc-if machinesPopOpen`): outer `div` `position:fixed;left:{popX}px;top:{popY}px;z-index:50;transform:{popTransform}` → inner `div onMouseMove=fhMachinesMove onMouseLeave=fhMachinesLeave` `position:relative;width:min(320px,calc(100vw - 32px));background:var(--fai-surface);border:1px solid var(--fai-border);border-radius:12px;box-shadow:var(--fai-shadow-shell);padding:6px;display:grid;gap:0;animation:nsPop 160ms ease-out both`. Ghost span (`fhMachines`, grey-50, radius 8, `transition:transform 80ms,width 80ms,height 80ms (ease-standard),opacity 120ms ease-standard`).
  - `sc-if notPairing`: rows `button data-fh=1 onClick=m.toggle disabled={m.offline} aria-pressed={m.on}` `animation:nsIn 200ms ease-out both {m.delay};position:relative;display:flex;align-items:center;gap:10px;width:100%;height:44px;padding:6px 8px;background:{m.bg};border:none;border-radius:{m.radius};cursor:{m.cursor};opacity:{m.opacity};text-align:left;color:var(--fai-text);transition:background-color 160ms ease-standard,border-radius 160ms ease-standard` → tile `span` `display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:8px;background:{m.tileBg};color:{m.tileFg};box-shadow:{m.tileShadow};flex:none;transition:background-color 240ms ease-out,color 240ms ease-out` with mask icon 15×15 `{m.icon}`; text block `span` `flex:1;min-width:0` → `span` `display:block;font:500 13px/1.3 sans` `{m.name}` + `span` `display:flex;align-items:center;gap:6px;font:var(--fai-type-meta);color:var(--fai-text-subtle);white-space:nowrap;overflow:hidden;text-overflow:ellipsis` → 6×6 dot `background:{m.dot}` + `{m.os} · {m.load}`; check `span` mask 16×16 `check-circle-bold` `background:var(--fai-grey-900);opacity:{m.ring};transform:scale({m.scale});transition:opacity 160ms ease-out,transform 160ms ease-out;flex:none` (always in DOM). Then divider `div` `height:1px;background:var(--fai-border-subtle);margin:4px 2px`. Then `button data-fh=1 onClick=startPairing` `animation:nsIn 200ms ease-out both 140ms;position:relative;display:flex;align-items:center;gap:10px;width:100%;height:40px;padding:6px 8px;background:transparent;border:none;border-radius:8px;cursor:pointer;text-align:left;color:var(--fai-text-muted)` + `style-hover="color:var(--fai-text)"` → 26px dashed tile (§1.10) + `span` `font:500 13px/1.3 sans` text `Connect a machine…`.
  - `sc-if isPairing`: `div` `display:grid;gap:10px;padding:4px;animation:nsPanel 200ms ease-out both` → `p` `font:var(--fai-type-meta);color:var(--fai-text-muted);text-wrap:pretty` text `Run this on the machine. It appears here as soon as the agent checks in.`; command box `div` `display:flex;align-items:center;gap:8px;height:36px;padding:0 6px 0 10px;background:var(--fai-grey-50);border:1px solid var(--fai-border);border-radius:10px` → `code` `flex:1;min-width:0;font:400 12px/1.4 mono;color:var(--fai-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis` `{pairCmd}` + `button onClick=copyPair` `display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 8px;border:1px solid var(--fai-border);background:var(--fai-surface);border-radius:8px;font:500 12px/1 sans;color:var(--fai-text);cursor:pointer;white-space:nowrap` + `style-hover="background:var(--fai-grey-50)"` → mask icon 13×13 `documents-bold-duotone` text-muted + `{copyLabel}`; status row `div` `display:flex;align-items:center;justify-content:space-between;gap:8px` → `span` `display:flex;align-items:center;gap:8px;font:var(--fai-type-meta);color:var(--fai-text-muted)` with 6×6 dot `background:var(--fai-presence-away)` + text `Waiting for check-in…` + `<x-import Button variant=secondary size=sm on-click=cancelPairing>Back</x-import>`.
  - `pairCmd` = `curl -sL orch.sh/join | sh -s -- --token 7f3a-k2m9`. `copyLabel` = `Copied` if `copied` else `Copy`. `copyPair`: `try { navigator.clipboard.writeText(pairCmd) } catch {}`; `copied:true`; reset after 1600ms.

### 2.6 Popover positioning (`openPop`, `fixedOrigin`)
- `fixedOrigin(el)`: walk `el.parentElement` up to (excluding) `documentElement`; the first ancestor whose computed `transform !== 'none' || filter !== 'none' || backdropFilter (or webkitBackdropFilter) !== 'none' || perspective !== 'none' || /transform|filter/.test(willChange) || /paint|layout|strict|content/.test(contain)` is the fixed-position containing block; return `{ x: r.left + p.clientLeft − p.scrollLeft, y: r.top + p.clientTop − p.scrollTop, w: p.clientWidth, h: p.clientHeight }`; otherwise `{0,0,innerWidth,innerHeight}`. In this layout that ancestor is the SCRIM (backdrop-filter). (During the first 260ms the dialog's `nsPanel` transform is non-none, so the dialog would be found instead; after the animation settles `transform:none` → scrim.)
- `openPop(name, e)`: if `pop === name` → `setState({pop:null, np:null, pairing:false})` (toggle off). Else `r = e.currentTarget.getBoundingClientRect(); o = fixedOrigin(el); need = 340; up = r.bottom + need > innerHeight && r.top > need`; `setState({ pop:name, np:null, pairing:false, popX: Math.max(8, Math.min(r.left, innerWidth − 336)) − o.x, popY: (up ? r.top − 6 : r.bottom + 6) − o.y, popUp: up })`.
- `popTransform` = `'translateY(-100%)'` when `popUp` else `'none'` (applied on the fixed outer div so the panel hangs upward from `popY = r.top − 6`).
- `popX/popY/popTransform` are shared by machines, projects and branches popovers (only one open at a time).
- Width clamp constants: 336 = 320 panel + 16; the trigger menu uses 308 = 300 + 8.

### 2.7 Project chip + popover
- `proj = projects.find(p => p.id === project) || null`. `hasProject = !!proj`, `noProject = !proj`, `projectName = proj ? proj.name : 'No project'`, `projectNameColor = proj ? INK : 'var(--fai-text-muted)'`. (`projectRepo` computed, unused.)
- `clearProject(e)`: `e.stopPropagation(); setState({project:null, dirOverride:false, pop:null})`.
- Rows (`projects`, `i`): `delay = (i*35)+'ms'`, `on = p.id === project`, `bg = on ? SEL : 'transparent'`, `meta = p.repo ? p.path + ' · ' + p.repo : p.path`, `pick = () => { setState({project:p.id, pop:null, dir:p.path, dirOverride:false, repo:p.repo, browsing:false}); fetchBranches(p.repo) }`.
- Popover DOM (`sc-if projectsPopOpen`): outer fixed div as §2.6 → inner `div onMouseMove=fhProjectsMove onMouseLeave=fhProjectsLeave` same panel styles as machines but `gap:2px`. Ghost (`fhProjects`).
  - `sc-if notNewProj`: rows `button data-fh=1 onClick=p.pick` `animation:nsIn 200ms ease-out both {p.delay};position:relative;display:flex;align-items:center;gap:10px;width:100%;height:44px;padding:6px 8px;background:{p.bg};border:none;border-radius:8px;cursor:pointer;text-align:left;color:var(--fai-text);transition:background-color 160ms ease-standard` → 24px tile (surface, tile shadow, `color:{p.hue}`, 14px `folder-with-files-bold-duotone`) + text block (`display:block;font:500 13px/1.3 sans` name; `display:block;font:meta;color:text-subtle;nowrap/ellipsis` `{p.meta}`) + `sc-if p.on` mask 16×16 `check-circle-bold` grey-900 `animation:nsCheck 200ms ease-out both`. Divider (1px border-subtle, margin 4px 2px). `button data-fh=1 onClick=startNewProj` `animation:nsIn 200ms ease-out both 110ms;…height:40px;…color:var(--fai-text-muted)` + `style-hover="color:var(--fai-text)"` → 24px dashed tile + `span` `font:500 13px/1.3 sans` text `New project…`.
  - `sc-if isNewProj`: `div` `display:grid;gap:8px;padding:4px;animation:nsPanel 200ms ease-out both` → three field rows each `div` `display:flex;align-items:center;gap:8px;height:36px;padding:0 10px;background:var(--fai-surface);border:1px solid var(--fai-border);border-radius:10px;box-shadow:var(--fai-shadow-xs)` with leading mask icon 14×14 text-subtle and `<input … spellCheck=false autoCapitalize=off>` `flex:1;min-width:0;border:none;outline:none;background:transparent;font:400 13px/1.4 {family};color:var(--fai-text);padding:0`: (1) `folder-with-files-bold-duotone`, `value={npName} onChange=onNpName placeholder="Project name"` sans; (2) `folder-bold-duotone`, `value={npPath} onChange=onNpPath placeholder="~/code/project"` mono; (3) `link-round-angle-bold-duotone`, `value={npRepo} onChange=onNpRepo placeholder="owner/repository (optional)"` mono. Then `div` `display:flex;justify-content:flex-end;gap:6px;margin-top:2px` → `Button secondary sm on-click=cancelNewProj` `Back`, `Button primary sm disabled={npInvalid} on-click=createProj` `Create`.
  - `onNpName(v)`: `slug(x) = x.trim().toLowerCase().replace(/\s+/g,'-')`; `path` auto-follows: if `np.path === '' || np.path === '~/code/' + slug(np.name)` then `path = '~/code/' + slug(v)` else unchanged. `npInvalid = !np || !np.name.trim() || !np.path.trim()`.
  - `createProj`: `hues = ['var(--fai-violet-400)','var(--fai-cyan-400)','var(--fai-amber-500)']; p = { id:'p'+Date.now(), name, path, repo (trimmed), hue: hues[projects.length % 3] }; setState({ projects: projects.concat(p), project: p.id, np:null, pop:null, dir:p.path, dirOverride:false, repo: p.repo || repo, browsing:false })`. (Does NOT call `fetchBranches`.)

### 2.8 Location
- `dirLocked = !!proj && !dirOverride && dirMode === 'dir'`; `dirUnlocked = !dirLocked`; `dirBg = dirLocked ? grey-50 : SURF`; `noMachine = !selMachines.length`; `browseOpacity = selMachines.length ? 1 : .5`.
- `setDirMode → {dirMode:'dir'}`; `setRepoMode → {dirMode:'repo', browsing:false}`; `overrideDir → {dirOverride:true}`; `openBrowse → {browsing: !browsing}`; `onDirInput → {dir: value}`.
- File browser: `nodeAt(path) = path.reduce((n,k) => (n && n[k]) || {}, FS)`; `bnode = nodeAt(bpath)`; `keys = Object.keys(bnode)`; `folders = keys.map((k,i) => ({ name:k, meta: n ? n + ' folders' : '' (n = child count), icon: SOLAR('folder') (both branches of the ternary are 'folder'), color: k.startsWith('.') ? 'var(--fai-grey-400)' : 'var(--fai-amber-500)', delay: (i*22)+'ms', enter: () => setState({bpath: bpath.concat(k)}) }))`; `noFolders = !keys.length`; `canGoUp = bpath.length > 0`; `goUp → bpath.slice(0,-1)`.
- Crumbs: `[{ label:'~', color: bpath.length ? 'inherit' : INK, sep: bpath.length > 0, go: () => bpath = [] }]` + `bpath.map((k,i) => ({ label:k, color: i === last ? INK : 'inherit', sep: i < last, go: () => bpath = bpath.slice(0, i+1) }))`. `browsePath = '~' + (bpath.length ? '/' + bpath.join('/') : '')`; `browsePathLabel = browsePath`; `browseMachine = selMachines[0]?.name || ''`.
- `useFolder → { dir: browsePath, browsing:false, dirOverride:true }`.
- Repo: `onRepoInput(v) → { setState({repo:v}); fetchBranches(v) }`. `fetchBranches(repo)`: clear `_tb`,`_tb2`; if `!/^[\w.-]+\/[\w.-]+$/.test(repo.trim())` → `branches:null`, return; `_tb = setTimeout(450ms) → branches:'loading'; _tb2 = setTimeout(1100ms) → branches: [{name:'main',meta:'default'},{name:'develop',meta:'2h ago'},{name:'feat/session-modal',meta:'1d ago'},{name:'fix/auth-fixation',meta:'3d ago'},{name:'release/1.4',meta:'2w ago'}], branch:'main'`.
- `branchDisabled = !Array.isArray(branches)`; `branchIdx = array ? max(0, findIndex(name === branch)) : 0`; `branchItems = (array ? branches : []).map((b,i) => ({ name, meta, delay:(i*25)+'ms', color: b.name === branch ? INK : 'var(--fai-text-subtle)', pick: () => setState({branch:b.name, pop:null}) }))`; `branch` rendered as `branch || 'main'`.
- Branch popover DOM (`sc-if branchesPopOpen`): fixed outer as §2.6 → `div onMouseMove=fhBranchesMove onMouseLeave=fhBranchesLeave` `position:relative;width:240px;background:var(--fai-surface);border:1px solid var(--fai-border);border-radius:12px;box-shadow:var(--fai-shadow-shell);padding:4px;display:grid;gap:2px;animation:nsPop 160ms ease-out both` → ghost (`fhBranches`, `transition:transform 80ms ease-standard,opacity 120ms ease-standard`) + selection `span` `position:absolute;left:4px;right:4px;top:4px;height:36px;transform:translateY(calc({branchIdx} * 38px));background:var(--fai-grey-100);border-radius:8px;transition:transform 160ms ease-out;pointer-events:none` + rows `button data-fh=1 onClick=b.pick` `animation:nsIn 200ms ease-out both {b.delay};position:relative;display:flex;align-items:center;gap:9px;width:100%;height:36px;padding:0 8px;background:transparent;border:none;border-radius:8px;cursor:pointer;text-align:left;color:var(--fai-text)` → mask 14×14 `branching-paths-down-bold-duotone` `color:{b.color}` + `span` `flex:1;min-width:0;font:400 13px/1.2 mono;nowrap/ellipsis` `{b.name}` + `span` `font:meta;color:text-subtle;nowrap` `{b.meta}`.
- The repo panel content is always mounted; only the `grid-template-rows` + inner opacity/translate animate (§3). The branch button is positioned relative (`data-ns-pop`), so `_out` treats clicks inside it as inside.

### 2.9 Model
- `harnessObj(id) = HARNESSES.find(h => h.id === (id || listHarness)) || HARNESSES[0]` — the LIST follows `listHarness`; the TABS follow `harness`.
- `currentModel()`: `custom` if `custom && model === custom.id`; else `harnessObj().models.find(m => m.id === model) || null`.
- `harnesses = HARNESSES.map((x,i) => ({ id, delay:(i*30)+'ms', name, letter, img: LOBE(x.img), on: x.id === harness, color: on ? INK : text-muted, pick: () => switchHarness(x.id) }))`; `harnessIdx = HARNESSES.findIndex(id === harness)`; `harnessName = harnessObj().name`.
- `switchHarness(id)`: return if `id === harness || phase === 'out'`; clear `_t`,`_t2`; `dir = indexOf(id) > indexOf(harness) ? 1 : -1`; `setState({phase:'out', harness:id, slideDir:dir})`; `_t2 = setTimeout(200ms) → { h = harnessObj(id); keep = h.models.find(m => m.id === model); next = keep || h.models[0]; setState({listHarness:id, phase:'in', gen:gen+1, query:'', model: next.id, effort: next.def}); _t = setTimeout(700ms) → phase:'idle' }`.
- `pickModel(m)`: if `m.id !== model` → `setState({model:m.id, effort: m.def || ''})`.
- Filtering: `q = query.trim().toLowerCase()`; `filtered = h.models.filter(m => !q || (m.id+' '+m.name+' '+VENDORS[m.vendor].name).toLowerCase().includes(q))`; `list = (custom && (!q || custom.id.toLowerCase().includes(q)) ? [custom] : []).concat(filtered)` (custom model, when set, is prepended).
- `visibleModels = list.map((m,i) => { v = VENDORS[m.vendor] || VENDORS.custom; on = m.id === model; anim = phase==='out' ? (slideDir>0 ? 'nsOutL' : 'nsOutR') + ' 160ms var(--fai-ease-standard) both ' + (i*14) + 'ms' : phase==='in' ? (slideDir>0 ? 'nsInR' : 'nsInL') + ' 260ms var(--fai-ease-out) both ' + (40 + i*32) + 'ms' : 'none'; return { id, name, ctx, vendor: v.name, img: v.img ? LOBE(v.img) : <empty svg data uri>, letter: v.name[0], on, anim, pick: () => pickModel(m) } })`.
- `exact = h.models.some(id.toLowerCase() === q) || (custom && custom.id.toLowerCase() === q)`; `showCustomRow = q.length > 2 && !exact`; `pickCustom = () => { c = M(query.trim(), query.trim(), 'custom'); setState({custom:c, model:c.id, effort:'', query:''}) }`; `customBorder = 'var(--fai-grey-400)'`; `noResults = !visibleModels.length && !showCustomRow`.
- `modelIdx = max(0, visibleModels.findIndex(on) + (showCustomRow ? 1 : 0))`; `modelHiOpacity = (phase === 'out' || no selected visible) ? 0 : 1`.
- Search: `onQuery → query`; `clearQuery → ''`; `onQueryKey`: Enter && showCustomRow → `pickCustom()`; Escape → `query:''`. `hasQuery = !!query`.
- `hideImg` (sets `e.currentTarget.style.display='none'`) is defined but not bound anywhere.

### 2.10 Effort
- `cm = currentModel(); efforts = cm ? cm.efforts : []; effortIdx = max(0, efforts.indexOf(effort)); n = efforts.length; frac(i) = n > 1 ? i/(n−1) : 0`.
- `effortStops = [0,1,2,3,4].map(i => { live = i < n; e = efforts[i]; f = live ? frac(i) : 1; return { label: e||'', frac: f, opacity: live?1:0, tab: live?0:-1, color: i===effortIdx ? INK : text-subtle, cell: 'calc((100% - 29px) / ' + max(1,n−1) + ')', pipO: live && i > effortIdx ? .3 : 0, align, tx, pick: () => live && setState({effort:e}) } })`. Only `frac` and `pipO` are used by the template (pips right of the active one show at 0.3; the active and left-of-active pips are hidden; non-live pips sit at `frac=1` with opacity 0).
- Rendered values: `effortP = frac(effortIdx)`; `effortFillOff = 20 − 20·p − (effortIdx === 0 ? 20 : 0)`; `effortLineOff = 11 − 24·p`; `effortLineInset = (effortHover ≥ 0 || effortDrag || effortFocus) ? 7 : 8`; `effortLineColor = (effortFocus || effortDrag) ? INK : effortHover ≥ 0 ? 'rgba(16,18,20,.5)' : 'rgba(16,18,20,.25)'`; `effortTextColor = (hover||drag||focus) ? INK : text-muted`; `effortLabel = efforts[effortIdx] || ''`; `effortMax = max(0, n−1)`; `sliderOpacity = n ? 1 : 0`; `sliderShift = n ? '0' : '-6px'`; `sliderEvents = n ? 'auto' : 'none'`; `lockOpacity = n ? 0 : 1`; `lockShift = n ? '6px' : '0'`.
- Geometry consequences (W = track clientWidth, i.e. 34px box minus 2px border in height; width = section width − 2·12 padding − 2): pip centre = `14.5 + (W − 29)·f`; fill right edge = `p·W + 20 − 20p` (0 when idx 0); handle left = `p·W + 11 − 24p`, i.e. 11px at p=0, `W − 13` at p=1. (The fill's right edge is 9–13px to the right of the handle's left edge; handle centre and pip centre differ by `5p − 2.5` px. Recorded as-is; see §8.)
- Hover preview: `hoverGeom`: `W = effortW || 0`; if `effortHover < 0 || !n || !W` → `{l:0,w:0}`; `p = frac(effortIdx)`; `hx = p·W + 20 − 20p − (effortIdx===0 ? 20 : 0)` (= fill right edge); `x = frac(effortHover)·W`, forced `0` at hover 0 and `W` at hover n−1; `l = min(hx,x)`, `w = |x − hx|`. `effortHoverO = (effortHover ≥ 0 && !effortDrag && effortHover !== effortIdx) ? 1 : 0`.
- Pointer: `onEffortDown(e)`: return if `!n || (e.pointerType==='mouse' && e.button !== 0)`; `e.preventDefault()`; `f = clamp((clientX − r.left)/max(1,W), 0, 1)`; `idx = round(f·(n−1))`; `el.setPointerCapture(pointerId)` (try); `setState({effort: efforts[idx], effortDrag:true, effortHover:-1, effortW:W})`. `onEffortMove(e)`: return if `!n`; compute idx the same way; if dragging → `effort = efforts[idx]` when changed (+ `effortW`); else → `effortHover = idx` (+ `effortW`) when changed. `onEffortUp` (also `pointercancel`): `{effortDrag:false, effortHover:-1}`. `onEffortLeave`: if not dragging → `effortHover:-1`.
- Keyboard: hidden `<input type=range>` → `onEffort(e) → effort = efforts[+e.target.value]`; focus/blur → `effortFocus` (ring + INK handle + INK labels + inset 7).
- `noEffortText`: `cm ? (cm.vendor === 'custom' ? 'Effort is unknown for custom model ids. The harness default applies.' : vendorName + ' does not expose an effort setting for ' + cm.name + '. It runs at the model default.') : 'Pick a model to see effort levels.'`. `EFFORT_DESC` is defined (§7) but NOT rendered.
- Effort on model change: `pickModel` → `m.def || ''`; `switchHarness` → `next.def`; `pickCustom` → `''`. When `efforts` is empty the lock layer shows; `effortIdx` falls back to 0.

### 2.11 Permission mode
`perms = PERMS.map((p,i) => ({ ...p, icon: SOLAR(p.icon), delay: (i*35)+'ms', on: p.id === perm, pick: () => setState({perm:p.id}) }))`; `permIdx = PERMS.findIndex(id === perm)`. Selection = sliding grey-100 fill (`translateY(permIdx·46px)`, 160ms ease-out) + `check-circle-bold` 16px grey-900 with `nsCheck 200ms` mounted via `sc-if`.

### 2.12 Footer
- `isEphemeral/isPersistent`, `setEphemeral/setPersistent`, `lifeIdx` (0/1), `ephColor/perColor` (INK when selected else text-muted).
- `cantStart = !selMachines.length || !cm || (dirMode === 'repo' && !repo.trim())`.
- `startLabel = selMachines.length > 1 ? 'Start ' + selMachines.length + ' Sessions' : 'Start Session'` (0 or 1 selected → `Start Session`; disabled when 0).
- `start = () => {}`; Cancel and Close have no handlers in the design.

---

## 3. Motion inventory

### 3.1 Keyframes (verbatim from helmet `<style>`)
| Name | Definition | Applied to (duration / easing / fill / delay) |
|---|---|---|
| `nsPanel` | `from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:none}` | dialog `260ms ease-out both`; pairing panel & new-project panel `200ms ease-out both` |
| `nsIn` | `from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none}` | sections `260ms ease-out both` with delays: First prompt 0; Location wrapper 60 + section 0; Model/Effort/Perm wrapper 140 + Model 40, Effort 80, Perm 120. Rows: machines `200ms` delay `80+i·45`; "Connect a machine…" `200ms` delay 140; projects `200ms` delay `i·35`; "New project…" `200ms` delay 110; branch rows `200ms` delay `i·25`; folders `220ms` delay `i·22`; harness tabs `220ms` delay `i·30`; perm rows `220ms` delay `i·35`; custom-id row `220ms` 0; "From project" badge `200ms` 0; Override `200ms` 40; Browse `200ms` 0; "No subfolders" `200ms`; "No … models match" `200ms`. All ease-out, `both`. |
| `nsInB` | `from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none}` | DEFINED, NOT USED. |
| `nsOut` | `to{opacity:0;transform:translateY(-6px)}` | DEFINED, NOT USED. |
| `nsPop` | `from{opacity:0;transform:translateY(-4px) scale(.98)} to{opacity:1;transform:none}` | trigger menu `140ms ease-out both`; machines / projects / branches popovers `160ms ease-out both`. |
| `nsCheck` | `from{opacity:0;transform:scale(.5)} to{opacity:1;transform:none}` | project-row check, perm-row check, project-chip clear button: `200ms ease-out both`. |
| `nsInR` | `from{opacity:0;transform:translateX(18px)} to{opacity:1;transform:none}` | model rows when `phase==='in' && slideDir>0`: `260ms ease-out both (40+i·32)ms` |
| `nsInL` | `from{opacity:0;transform:translateX(-18px)} to{opacity:1;transform:none}` | model rows when `phase==='in' && slideDir<0`: same timing |
| `nsOutL` | `to{opacity:0;transform:translateX(-18px)}` | model rows when `phase==='out' && slideDir>0`: `160ms ease-standard both (i·14)ms` |
| `nsOutR` | `to{opacity:0;transform:translateX(18px)}` | model rows when `phase==='out' && slideDir<0`: same |
| `nsSpin` | `to{transform:rotate(360deg)}` | branch loading spinner `700ms linear infinite` |

Harness switch timeline: t=0 tab thumb slides (160ms ease-out) + old rows `nsOut*` staggered 14ms; t=200ms list data swaps to the new harness, rows `nsIn*` staggered from 40ms step 32ms; selection fill opacity 0 during `out`, 1 after; t=900ms phase `idle` → `animation:none`. (Because rows are index-keyed in the runtime, the swap relies on the `animation` string changing; in Svelte re-key by `gen`.)

### 3.2 CSS transitions on state changes
| Element | Transition |
|---|---|
| Composer frame | `background-color/border-color/color 120ms ease-standard, box-shadow 120ms ease-standard` (focus ring + grey-400 border) |
| Editor | `height 240ms ease-out` (44 → 120px) |
| Follow-hover ghosts | `transform 80ms ease-standard, width 80ms, height 80ms, opacity 120ms ease-standard` (menu ghost: transform+height+opacity; branch ghost: transform+opacity) |
| Menu keyboard highlight | `transform 120ms ease-out` |
| Model / perm / branch selection fill | `transform 160ms ease-out` (+ `opacity 120ms ease-standard` on model fill) |
| Segmented thumbs | Location & Lifetime: `transform 240ms ease-out`; Harness: `transform 160ms ease-out` |
| Segmented tab text colour | `--fai-transition-control` (120ms); harness tab `color 120ms ease-standard` |
| Chips (machines/project) | `--fai-transition-control` |
| Machine row | `background-color 160ms ease-standard, border-radius 160ms ease-standard`; tile `background-color 240ms ease-out, color 240ms ease-out`; check `opacity 160ms ease-out, transform 160ms ease-out` |
| Project row | `background-color 160ms ease-standard` |
| Dir field frame | `--fai-transition-control` (bg grey-50 ↔ white) |
| Browse panel | `grid-template-rows 280ms ease-out` (0fr ↔ 1fr) |
| Repo panel | `grid-template-rows 280ms ease-out`; inner `transform 280ms ease-out, opacity 280ms ease-standard` (translateY −12px→0) |
| Branch button | `--fai-transition-control`; layers `opacity 160ms ease-standard, transform 240ms ease-out` |
| Search field | `--fai-transition-control` |
| Effort slider/lock layers | `opacity 240ms ease-standard, transform 240ms ease-out` |
| Effort track | `--fai-transition-control, box-shadow 120ms ease-standard` |
| Effort fill | `width 160ms ease-out` |
| Effort hover preview | `opacity 120ms ease-standard` |
| Effort pips | `left 160ms ease-out, opacity 120ms ease-standard` |
| Effort handle | `left 160ms ease-out, top 120ms, bottom 120ms, background-color 120ms (ease-standard)` |
| Effort labels | `color 120ms ease-standard` |
| Footer radios | `--fai-transition-control` |
| DS Button | `--fai-transition-control, transform 80ms ease-standard` (press scale .99) |
| DS IconButton | `--fai-transition-control` |

Height-animated panels: Browse and Repo use the `grid-template-rows: 0fr→1fr` + `min-height:0;overflow:hidden` technique. The editor animates `height` directly. Popovers/menus are conditionally mounted (no exit animation anywhere except the model-list `nsOut*`).

---

## 4. Responsive rules
```
@media (max-width:640px){
  [data-ns-scrim]{padding:0 !important}
  [data-ns-dialog]{border-radius:0 !important;height:100% !important;max-height:100% !important;
                   padding:max(env(safe-area-inset-top),7px) 7px max(env(safe-area-inset-bottom),7px) !important}
  [data-ns-footer]{flex-wrap:wrap}
  [data-ns-summary]{width:100%;order:-1;margin-right:0}   /* the Ephemeral|Persistent segmented goes full-width on its own row above Cancel/Start */
}
```
Width-dependent maths elsewhere:
- Dialog `width:100%;max-width:980px`; scrim padding 24 → dialog is `min(980, vw − 48)` wide above 640px.
- Model/Effort/Perm grid: `repeat(auto-fit, minmax(min(100%,320px),1fr))` → two columns when content width ≥ 660px (320+20+320), else one column (Model above Effort+Perm).
- Popover panel width `min(320px, calc(100vw − 32px))`; `popX = clamp(r.left, 8, innerWidth − 336)`; trigger menu fixed 300px, `x = clamp(cr.left, 8, innerWidth − 308)`; branch popover fixed 240px (uses the same 336 clamp).
- Flip-up when `r.bottom + 340 > innerHeight && r.top > 340`.
- Repo row: `minmax(0,1fr) 168px` (branch column fixed 168).
- Scrim `overflow:auto` + dialog `max-height:100%`: on short viewports the body scrolls (`fai-scroll`), header/footer stay (`flex:none`).

---

## 5. Design-system components used (`FlowAIDesignSystem_94b032`)

### 5.1 `Button` (source: `components/core/Button.jsx` in `_ds_bundle.js`)
Props: `children, variant='secondary', size='md', icon, iconRight, disabled, fullWidth, style, ...rest` (rest spread onto `<button>`; `onClick` arrives via `on-click`). Renders `<button type="button" disabled={disabled}>` with mouse-tracked `hover`/`press` React state.

Sizes (`SIZES`): `sm {h:30, px:11, gap:7, fs:var(--fai-text-sm)=13px, icon:14}`; `md {h:36, px:14, gap:8, fs:var(--fai-text-base)=14px, icon:16}`; `lg {h:44, px:16, gap:8, fs:14px, icon:18}`.

Variants (`VARIANTS`): `primary {bg:var(--fai-grey-900)=#1f2224, hover:var(--fai-ink)=#111315, fg:var(--fai-text-inverse)=#fff, bd:transparent}`; `secondary {bg:#fff, hover:var(--fai-grey-50)=#f7f8f8, fg:var(--fai-text)=#1f2224, bd:var(--fai-border)=#e8e9ea}`; `subtle {bg:#f2f3f3, hover:#ededee, fg:text, bd:transparent}`; `ghost {bg:transparent, hover:#f2f3f3, fg:var(--fai-text-muted)=#6e7378, bd:transparent}`; `danger {bg:#fff, hover:#fee2e2, fg:#dc2626, bd:#e8e9ea}`; `warning {bg:#fef3c7, hover:#fdeab0, fg:#b45309, bd:#f5c33b}`.

Inline style (literal):
```
display:inline-flex; align-items:center; justify-content:center; gap:{s.gap}px; height:{s.h}px; padding:0 {s.px}px;
width: fullWidth ? 100% : auto;
font: 500 {s.fs}/1 var(--fai-font-sans); letter-spacing: var(--fai-tracking-snug) (-0.01em);
color: v.fg;
background: disabled ? var(--fai-grey-100) : hover ? v.hover : v.bg;
border: 1px solid (disabled ? var(--fai-border-subtle) : v.bd);
border-radius: var(--fai-radius-control) (10px); box-shadow:none;
cursor: disabled ? not-allowed : pointer; opacity: disabled ? 0.6 : 1;
transform: press && !disabled ? scale(var(--fai-press-scale)) (.99) : none;
transition: var(--fai-transition-control), transform 80ms var(--fai-ease-standard); white-space:nowrap
```
Icon slots: `icon` → `<Icon name size={s.icon} style={{color: primary ? var(--fai-white) : secondary ? var(--fai-text-muted) : undefined}}>` before children; `iconRight` after (secondary → text-muted). Focus: base.css `:focus-visible{outline:2px solid rgba(59,123,255,.28);outline-offset:1px}`. Note: disabled keeps `v.fg` text colour (primary disabled = white text on grey-100 at .6 opacity).

Instances in this modal: `secondary sm` Back (×2), `primary sm` Create (disabled=npInvalid), `primary sm` Use this folder, `secondary md` Cancel, `primary md` Start (disabled=cantStart). `hint-size="auto,30px"` / `"auto,36px"` are runtime placeholders only.

### 5.2 `IconButton` (`components/core/IconButton.jsx`)
Props: `icon, size='md', variant='secondary', label, disabled, style, ...rest`. `SIZES = {sm:28, md:32, lg:36}`. `bare = variant === 'ghost'`. Renders `<button type="button" aria-label={label} title={label} disabled>`:
```
display:inline-flex; align-items:center; justify-content:center; width:{d}px; height:{d}px;
color: hover ? var(--fai-text) : var(--fai-text-muted);
background: bare ? (hover ? var(--fai-grey-100) : transparent) : (hover ? var(--fai-grey-50) : var(--fai-surface));
border: 1px solid (bare ? transparent : var(--fai-border)); border-radius: var(--fai-radius-sm) (8px);
box-shadow: bare ? none : var(--fai-shadow-xs); cursor: disabled ? not-allowed : pointer; opacity: disabled ? 0.5 : 1;
transition: var(--fai-transition-control)
```
Child: `<Icon name={icon} size={size==='sm' ? 14 : 16}>`. Instance: header Close = `icon="x" size="sm" variant="ghost" label="Close"` → 28×28, transparent, hover grey-100, Lucide `x` 14px, text-muted → text on hover.

### 5.3 `Icon` (`components/core/Icon.jsx`) — used internally by the two above
`<span class="fai-icon" aria-hidden="true" data-icon={name} style="--fai-icon-url:url(https://unpkg.com/lucide-static@0.469.0/icons/{name}.svg);width:{size};height:{size};font-size:{size}">` with `.fai-icon{display:inline-block;width:1em;height:1em;flex:none;background-color:currentColor;mask:var(--fai-icon-url) center/contain no-repeat}`. NOTE: DS icons are Lucide; every other icon in the modal is Solar (iconify) drawn inline with the same mask technique.

Other components exported by the bundle (not used here): Avatar, Badge, IconChip, CombRule, Meter, Logo, Input, PasswordInput, Select, Switch, SearchInput, SegmentedTabs, StatCard, SectionCard, ListRow, StatusDot, DataTable, Pagination, TemplateCard, Alert, Modal, EmptyState, AssistantPanel, NavItem, Sidebar, NavGroupLabel, Topbar, PageHeader, UsageQuota.

---

## 6. Token table and proposed mapping to `apps/dashboard/src/app.css`

App reference values (light theme, `:root`): neutral-1 #fcfdfd, -2 #f8f9fa, -3 #eff0f3, -4 #e6e8ec, -5 #dbdee3, -6 #cfd2d9, -7 #bfc4cc, -8 #a6abb4, -9 #636974, -10 #535862, -11 #60636a, -12 #2c2e31; accent-9 #4466ac (`--ring`, `--focus-ring`); error-9 #c56c65, success-9 #84cc86, warning-9 #ceb47e, info-9 #7aabce (+ `-3` tints, `-11` inks); `--surface-raised/overlay` = neutral-1, `--surface-field` = mix(neutral-2,neutral-3), `--surface-sunken/hover` = neutral-3, `--surface-active` = neutral-4, `--background` = neutral-2, `--card/--popover` = neutral-1; `--border` = neutral-6, `--border-control` = neutral-4, `--border-divider` = mix(neutral-4 72%, neutral-3), `--border-hairline` = mix(neutral-4 34%, neutral-3); inks `--ink-strong` = neutral-12, `--ink-body`, `--ink-muted` = neutral-11, `--muted-foreground` = neutral-11, `--faint` = neutral-10; `--brand-solid` = neutral-12, `--on-brand` = neutral-1, `--gradient-action`; radii `--radius-mark` 4.6, `--radius-tile` 5.5, `--radius-well` 7, `--radius-control` 8, `--radius-card` 10, `--radius-modal` 12, `--radius-panel` 14, `--radius-shell` 20, `--radius-pill` 999; type `--text-xs` 11px, `--text-sm` 12.5px, `--text-base` 13.5px, `--text-md` 15px, `--text-lg` 17px, `--text-xl` 19px, `--text-2xl` 21px; weights `--weight-body` 400, `--weight-medium` 450, `--weight-strong` 500; leading `--leading-tight` 1.2, `--leading-ui` 1.25, `--leading-body` 1.4, `--leading-numeric` 1; tracking `--track-display` -0.008em; motion `--c-100` 100ms, `--c-300` 300ms, `--c-500` 500ms, `--e-in` cubic-bezier(.16,1,.3,1), `--e-out` cubic-bezier(.7,0,.84,0), `--e-toggle` cubic-bezier(.65,0,.35,1); shadows `--shadow-hairline` `0 3px 7px -2px tint2`, `--shadow-tile` `0 2px 6px tint2, 0 0 0 .5px tint`, `--shadow-lifted`, `--shadow-overlay` `0 18px 48px tint3, 0 2px 6px tint`, `--shadow-modal` = overlay, `--shadow-drawer`, `--shadow-action`; `--scrim` = neutral-12 @ .32, `--scrim-soft` @ .06; status `--status-live/attn/done/fail/idle-bg|-ink`; fonts `--font-sans` "Geist Variable"…, `--font-mono` "TX-02"….

| FlowAI token | Value | Used in modal for | Proposed app token | Note |
|---|---|---|---|---|
| `--fai-white` | #ffffff | tile fg when selected, primary btn text | `--on-brand` / `--neutral-1` | |
| `--fai-grey-25` | #fbfbfb | — | — | unused here |
| `--fai-grey-50` | #f7f8f8 | hover fills, ghost highlight, locked dir bg, pair cmd box, branch btn idle bg, surface-subtle | `--surface-hover` (neutral-3 #eff0f3) or `--neutral-2` (#f8f9fa) | neutral-2 is the closer value; `--surface-hover` is the semantic |
| `--fai-grey-100` | #f2f3f3 | dialog frame bg, SEL row fill, selection fills, harness track bg, badges, chip bg, ghost-btn hover, disabled btn bg | `--neutral-3` / `--surface-sunken` / `--surface-active` for selection | |
| `--fai-grey-150` | #ededee | `--fai-border-subtle`, subtle-btn hover | `--border-hairline` / `--neutral-4` | |
| `--fai-grey-200` | #e8e9ea | `--fai-border`, segmented track bg, harness ghost | `--border-control` (neutral-4 #e6e8ec) for borders; `--neutral-4` for track | app `--border` (neutral-6 #cfd2d9) is darker than FlowAI's border |
| `--fai-grey-300` | #d8dadb | comb ticks, scrollbar, spinner ring, `--fai-border-strong` | `--neutral-5` (#dbdee3) | |
| `--fai-grey-400` | #b3b7ba | focus border (composer/search/effort), custom-row dashed border, dashed add tiles, placeholder second half, dot-folder icon, crumb separators, arrow-right, presence-offline | `--neutral-8` (#a6abb4) | |
| `--fai-grey-500` | #9ca1a6 | `--fai-text-subtle`, offline machine hue | `--neutral-9`/`--faint`? — app neutral-9 #636974 is much darker; nearest lightness is `--neutral-8` #a6abb4 | NO close equivalent |
| `--fai-grey-600` | #6e7378 | `--fai-text-muted` | `--ink-muted` / `--muted-foreground` (neutral-11 #60636a) | |
| `--fai-grey-700` | #4a4f54 | — | — | unused |
| `--fai-grey-800` | #2c2f32 | — | — | unused |
| `--fai-grey-900` | #1f2224 | INK: text, selected tiles, bolt tile, check icons, pips, handle, primary btn bg | `--ink-strong` / `--brand-solid` / `--foreground` (neutral-12 #2c2e31) | |
| `--fai-ink` | #111315 | primary btn hover, `--fai-text-strong` | `--brand-hi`? (app hover is LIGHTER than solid: `calc(l + 0.075)`) | direction inverted vs app; NO direct equivalent |
| `--fai-blue-50` | #eaf0ff | `--fai-status-info-bg` ("From project" badge) | `--status-live-bg` / `--info-3` (#e7f2fa) | |
| `--fai-blue-100` | #dbe6ff | ::selection | app ::selection rule | |
| `--fai-blue-500` | #3b7bff | First prompt icon, refresh icon, Persistent icon, PROJECTS[0].hue, PERMS[1].hue, SKILLS[2].hue, hover-preview `rgba(59,123,255,.14)`, focus ring `rgba(59,123,255,.28)` | `--accent-9` (#4466ac) / `--ring` | app accent is far less saturated; NO exact equivalent |
| `--fai-blue-600` | #2f5ce6 | `--fai-status-info-fg`, `--fai-text-link` | `--status-live-ink` / `--info-11` | |
| `--fai-green-50` | #dcfce7 | — (status-active-bg) | `--success-3` | unused here |
| `--fai-green-500` | #22c55e | presence-online dot, MACHINES[1].hue, PROJECTS[2].hue, PERMS[0].hue, SKILLS[1].hue, PLUGINS[0].hue | `--success-9` (#84cc86) | app value is pastel; NO exact |
| `--fai-green-600` | #16a34a | Permission-mode header icon | `--data-ok` | NO exact |
| `--fai-green-700` | #15803d | — | `--success-11` | unused |
| `--fai-amber-50` | #fef3c7 | warning btn | `--warning-3` | unused variant |
| `--fai-amber-400` | #f5c33b | presence-pending | — | unused |
| `--fai-amber-500` | #f0ad1f | Location header icon, folder icons, project chip icon, dir icon, tab icon, createProj hue #3 | `--warning-9` (#ceb47e) | NO exact (app is muted) |
| `--fai-amber-700` | #b45309 | — | `--warning-11` | unused |
| `--fai-orange-50` | #ffedd5 | — | — | unused |
| `--fai-orange-500` | #f97316 | Effort header icon, Ephemeral icon, presence-away dot (busy machines, "Waiting for check-in…"), PROJECTS[1].hue, PERMS[2].hue, SKILLS[3].hue | none (`--mark-2` oklch(0.53 0.15 47.4) is the nearest identity hue) | NO equivalent |
| `--fai-red-50` | #fee2e2 | danger btn hover | `--error-3` | unused |
| `--fai-red-400` | #f87171 | — | — | unused |
| `--fai-red-500` | #ef4444 | PLUGINS[3].hue (Sentry) | `--error-9` | NO exact |
| `--fai-red-600` | #dc2626 | `--fai-status-expired-fg` — machines chip text+border when none selected | `--status-fail-ink` / `--destructive` (#c56c65) | |
| `--fai-cyan-400` | #38bdf8 | MACHINES[2].hue, PLUGINS[1].hue, createProj hue #2 | none (`--mark-5` oklch(0.51 0.093 186.7) nearest) | NO equivalent |
| `--fai-cyan-500` | #14b0e0 | machines chip icon | none | NO equivalent |
| `--fai-violet-400` | #818cf8 | MACHINES[0].hue, SKILLS[0].hue, PLUGINS[2].hue, createProj hue #1 | none (`--mark-7` oklch(0.51 0.15 292.5) nearest) | NO equivalent |
| `--fai-violet-500` | #6366f1 | Model header icon | none | NO equivalent |
| `--fai-desk` | #ececec | page bg behind scrim (demo only) | `--background` | not part of the modal |
| `--fai-app-bg` | #f4f5f5 | — | — | |
| `--fai-surface` | #fff | body, footer, popovers, fields, tiles | `--surface-raised` / `--popover` / `--card` (neutral-1 #fcfdfd) | |
| `--fai-surface-subtle` | #f7f8f8 | effort box bg, browse panel bg, clone note bg | `--surface-field` | |
| `--fai-surface-muted` | #f2f3f3 | (= grey-100) | `--surface-sunken` | |
| `--fai-surface-sunken` | #ededee | — | — | unused |
| `--fai-surface-inverse` | #1f2224 | — | `--brand-solid` | unused directly |
| `--fai-text` | #1f2224 | body text | `--foreground` / `--ink-strong` | |
| `--fai-text-strong` | #111315 | — | `--ink-strong` | unused |
| `--fai-text-muted` | #6e7378 | header title, unselected tabs, helper copy, ghost btn text | `--ink-muted` / `--muted-foreground` | |
| `--fai-text-subtle` | #9ca1a6 | meta lines, placeholders, chevrons, ctx badge, search icon | nearest `--neutral-8` #a6abb4 (app has no "subtle" ink between neutral-8 and neutral-11) | NO exact |
| `--fai-text-disabled` | #b3b7ba | — | — | unused |
| `--fai-text-inverse` | #fff | primary btn text | `--on-brand` | |
| `--fai-text-link` | #2f5ce6 | `a` (none in modal) | `--accent-text` | |
| `--fai-border` | #e8e9ea | all 1px control/panel borders, chip borders | `--border-control` (neutral-4) | app `--border` neutral-6 is a step darker |
| `--fai-border-subtle` | #ededee | dividers, browse panel rules, effort box border, clone note border, disabled btn border | `--border-hairline` | |
| `--fai-border-strong` | #d8dadb | — | `--neutral-5` | unused |
| `--fai-focus-ring` | rgba(59,123,255,.28) | 3px ring on composer/effort focus; `:focus-visible` outline | `--ring`/`--focus-ring` (accent-9 #4466ac) at ~.28 alpha (`oklch(from var(--focus-ring) l c h / .28)`) | |
| `--fai-status-info-bg/fg` | #eaf0ff / #2f5ce6 | "From project" badge | `--status-live-bg` / `--status-live-ink` | |
| `--fai-status-expired-fg` | #dc2626 | machines chip empty state | `--status-fail-ink` | |
| `--fai-presence-online/away/offline/pending` | #22c55e / #f97316 / #b3b7ba / #f5c33b | machine dots, browse machine badge, waiting dot | `--success-9` / (none) / `--neutral-8` / `--warning-9` | away (orange) has no equivalent |
| `--fai-shadow-xs` | 0 1px 2px rgba(16,18,20,.03) | fields, composer idle, lists, IconButton secondary | `--shadow-xs` (app) — app's is `0 1px 2px oklch(.28 .02 264/.04)` | close |
| `--fai-shadow-raised` | 0 1px 3px rgba(16,18,20,.08),0 1px 1px rgba(16,18,20,.04) | segmented thumbs | `--shadow-tile` (heavier) or `--shadow-sm` | |
| `--fai-shadow-shell` | 0 24px 60px -12px rgba(16,18,20,.16),0 2px 8px rgba(16,18,20,.04) | popovers, trigger menu | `--shadow-overlay` | |
| `--fai-shadow-modal` | 0 32px 80px -16px rgba(16,18,20,.28),0 4px 12px rgba(16,18,20,.06) | dialog | `--shadow-modal` | |
| tile shadow (literal) | 0 1px 2px rgba(16,18,20,.07),0 0 0 1px rgba(16,18,20,.035) | 22/24/26px icon tiles | `--shadow-tile` (`0 2px 6px tint2, 0 0 0 .5px tint`) | |
| `--fai-scrim` | rgba(240,241,241,.72) | scrim (light wash) | `--scrim` is DARK (neutral-12 @ .32) | NO equivalent — light scrim needs a new token |
| `--fai-scrim-blur` | 2px | backdrop blur | none | NO equivalent |
| `--fai-radius-xs` | 5 | bolt tile, menu tiles, clear-x, crumb buttons, search clear | `--radius-tile` 5.5 | |
| `--fai-radius-sm` / `-chip` / `-badge` | 8 | rows, tiles, buttons, chips, badges, IconButton, thumbs | `--radius-control` 8 | |
| `--fai-radius-md` / `-control` | 10 | fields, segmented tracks, lists, effort box, DS Button | `--radius-card` 10 | |
| `--fai-radius-lg` | 12 | body panel, footer, composer, popovers, editor top corners | `--radius-modal` 12 | |
| `--fai-radius-xl` | 14 | — | `--radius-panel` | unused |
| `--fai-radius-2xl` / `-modal` | 18 | dialog frame | none between 14 and 20 (`--radius-shell` 20 nearest) | NO exact |
| `--fai-radius-pill` | 999 | dots, spinner | `--radius-pill` | |
| `--fai-font-sans` | Geist | all text | `--font-sans` ("Geist Variable") | |
| `--fai-font-mono` | Geist Mono | paths, ids, branches, pair cmd, ctx badge | `--font-mono` (TX-02) | face differs |
| `--fai-weight-regular/medium/semibold` | 400/500/600 | 400 body, 500 labels/buttons/names; 600 unused | `--weight-body` 400 / `--weight-strong` 500 | app `--weight-medium` is 450, not 500 |
| `--fai-text-micro` | 11px | "From project" badge | `--text-xs` 11px | |
| `--fai-text-xs` | 12px | meta, tabs, pair cmd, ctx badge, Copy btn, "New project…" inputs? (no—13) | `--text-sm` 12.5px | nearest |
| `--fai-text-sm` | 13px | labels, chips, names, inputs, buttons sm | `--text-base` 13.5px | nearest |
| `--fai-text-base` | 14px | editor text, body, Button md | `--text-base` 13.5 or `--text-md` 15 | NO exact |
| `--fai-text-xl` | 20px | h2 "New Session" | `--text-xl` 19px | nearest |
| `--fai-leading-*` | 1.15/1.3/1.45/1.6 (modal uses literal 1, 1.2, 1.25, 1.3, 1.35, 1.4, 1.55) | — | `--leading-numeric` 1, `--leading-ui` 1.25, `--leading-body` 1.4 | |
| `--fai-tracking-snug` | -0.01em | h2, DS Button | `--track-display` -0.008em | |
| `--fai-ease-standard` | cubic-bezier(.2,.8,.3,1) | most transitions, `nsOut*` | `--e-toggle` cubic-bezier(.65,0,.35,1) is the app's continuous curve | shape differs |
| `--fai-ease-out` | cubic-bezier(.16,1,.3,1) | all entrances, thumbs, fills | `--e-in` (identical curve) | exact |
| `--fai-ease-in-out` | cubic-bezier(.4,0,.2,1) | — | — | unused |
| `--fai-duration-instant` | 80ms | ghost transform/size, Button press | `--c-100` | |
| `--fai-duration-fast` | 120ms | control transitions, ghost opacity, menu highlight | `--c-100` | |
| `--fai-duration-base` | 160ms | selection fills, harness thumb, `nsOut*`, machine rows | none (`--c-100`/`--c-300`) | NO exact |
| `--fai-duration-slow` | 240ms | segmented thumbs, editor height, layer swaps | `--c-300` | |
| `--fai-duration-panel` | 280ms | browse/repo panels | `--c-300` | |
| `--fai-press-scale` | .99 | DS Button press | none | |
| `--fai-space-*` | 2/4/6/8/10/12/14/16/20/24/28/32/40/48 | modal uses literal px (2,3,4,6,7,8,9,10,12,14,16,18,20,22,24) | `--space-1..8` = 4/7/11/14/18/21/25/32 | app ladder does not contain 6, 8, 10, 12, 16, 20, 24 |
| `--fai-control-h` / `-sm` / `-lg` | 36 / 30 / 44 | Button md/sm/lg, fields 36/38/42, chips 30 | `--c-btn-h` 44 | app buttons are 44 tall; modal's are 30/36 |

Tokens with NO app equivalent (must be added or hard-coded for this surface): `--fai-violet-400`, `--fai-violet-500`, `--fai-cyan-400`, `--fai-cyan-500`, `--fai-orange-500`, `--fai-amber-500` (saturation), `--fai-blue-500` (saturation), `--fai-green-500/600`, `--fai-red-500`, `--fai-grey-500`/`--fai-text-subtle`, `--fai-ink` (darker-than-solid hover), `--fai-scrim` (light wash) + `--fai-scrim-blur`, `--fai-radius-2xl` 18, `--fai-duration-base` 160ms, `--fai-ease-standard`, `--fai-press-scale`, 14px body size, weight 500 for medium (app medium = 450).

---

## 7. Fixture data (verbatim from the script; shapes matter)
```js
const SOLAR = n => 'https://api.iconify.design/solar:' + n + '-bold-duotone.svg';
const LOBE  = n => 'https://unpkg.com/@lobehub/icons-static-svg@latest/icons/' + n + '.svg';

const MACHINES = [
  { id: 'm1', name: 'studio-mac', os: 'macOS 15 · M3 Max',       icon: 'laptop',        status: 'online',  load: '2 sessions', hue: 'var(--fai-violet-400)' },
  { id: 'm2', name: 'gpu-box-01', os: 'Ubuntu 24.04 · RTX 6000', icon: 'server-square', status: 'online',  load: 'Idle',       hue: 'var(--fai-green-500)' },
  { id: 'm3', name: 'edge-pi',    os: 'Debian 12 · ARM64',       icon: 'cpu',           status: 'online',  load: '1 session',  hue: 'var(--fai-cyan-400)' },
  { id: 'm4', name: 'win-dev',    os: 'Windows 11 · i9',         icon: 'monitor',       status: 'offline', load: 'Offline',    hue: 'var(--fai-grey-500)' }
];
const PROJECTS = [
  { id: 'p1', name: 'orchestra',  path: '~/code/orchestra',  repo: 'acme/orchestra',  hue: 'var(--fai-blue-500)' },
  { id: 'p2', name: 'flowai-web', path: '~/code/flowai-web', repo: 'acme/flowai-web', hue: 'var(--fai-orange-500)' },
  { id: 'p3', name: 'infra',      path: '~/code/infra',      repo: 'acme/infra',      hue: 'var(--fai-green-500)' }
];
const FS = { code: { orchestra: { packages: { api: {}, web: {}, cli: {} }, docs: {} }, 'flowai-web': { src: {}, public: {} }, infra: { terraform: {}, ansible: {} } }, agents: {}, Documents: {}, Downloads: {}, '.config': {} };
const VENDORS = {
  anthropic: { name: 'Anthropic', img: 'claude-color' }, openai: { name: 'OpenAI', img: 'openai' }, google: { name: 'Google', img: 'gemini-color' },
  deepseek: { name: 'DeepSeek', img: 'deepseek-color' }, moonshot: { name: 'Moonshot AI', img: 'kimi-color' }, qwen: { name: 'Qwen', img: 'qwen-color' },
  xai: { name: 'xAI', img: 'xai' }, zhipu: { name: 'Z.ai', img: 'zhipu-color' }, minimax: { name: 'MiniMax', img: 'minimax-color' },
  mistral: { name: 'Mistral', img: 'mistral-color' }, custom: { name: 'Custom', img: '' }
};
const M = (id, name, vendor, efforts, def, ctx) => ({ id, name, vendor, efforts: efforts || [], def: def || '', ctx: ctx || '' });
const CLAUDE = [
  M('claude-opus-4-1',  'Claude Opus 4.1',  'anthropic', ['low','medium','high','max'], 'high',   '200K'),
  M('claude-sonnet-4-5','Claude Sonnet 4.5','anthropic', ['low','medium','high'],       'medium', '1M'),
  M('claude-haiku-4-5', 'Claude Haiku 4.5', 'anthropic', [],                            '',       '200K')
];
const GPT = [
  M('gpt-5.1-codex',   'GPT-5.1 Codex',    'openai', ['minimal','low','medium','high','xhigh'], 'medium', '400K'),
  M('gpt-5.1',         'GPT-5.1',          'openai', ['minimal','low','medium','high','xhigh'], 'medium', '400K'),
  M('gpt-5-codex-mini','GPT-5 Codex Mini', 'openai', ['low','medium','high'],                  'medium', '400K')
];
const OPEN = [
  M('gemini-2.5-pro',   'Gemini 2.5 Pro',   'google',   ['low','high'], 'high', '1M'),
  M('deepseek-v3.2',    'DeepSeek V3.2',    'deepseek', [], '', '128K'),
  M('deepseek-r1',      'DeepSeek R1',      'deepseek', [], '', '128K'),
  M('kimi-k2-thinking', 'Kimi K2 Thinking', 'moonshot', [], '', '256K'),
  M('qwen3-coder-480b', 'Qwen3 Coder 480B', 'qwen',     [], '', '256K'),
  M('grok-code-fast-1', 'Grok Code Fast 1', 'xai',      ['low','high'], 'low', '256K'),
  M('glm-4.6',          'GLM-4.6',          'zhipu',    [], '', '200K'),
  M('minimax-m2',       'MiniMax M2',       'minimax',  [], '', '200K'),
  M('devstral-medium',  'Devstral Medium',  'mistral',  [], '', '256K')
];
const HARNESSES = [
  { id: 'claude-code', name: 'Claude Code', img: 'claude-color', letter: 'C', models: CLAUDE },
  { id: 'codex',       name: 'Codex',       img: 'openai',       letter: 'X', models: GPT },
  { id: 'opencode',    name: 'OpenCode',    img: 'opencode',     letter: 'O', models: [CLAUDE[1], GPT[1]].concat(OPEN) },
  { id: 'pi',          name: 'Pi',          img: 'pi',           letter: 'π', models: [CLAUDE[0], CLAUDE[1], GPT[0]].concat(OPEN.slice(0, 6)) }
];
const PERMS = [
  { id: 'ask',       name: 'Ask before edits',  desc: 'Approve every file write and command.',       icon: 'shield-check',    hue: 'var(--fai-green-500)' },
  { id: 'auto-edit', name: 'Auto-accept edits', desc: 'Edits run freely; shell commands still ask.', icon: 'pen-new-square',  hue: 'var(--fai-blue-500)' },
  { id: 'full',      name: 'Full access',       desc: 'No prompts. Use on disposable machines only.', icon: 'danger-triangle', hue: 'var(--fai-orange-500)' }
];
const SKILLS = [
  { id: 'review', label: '/review', desc: 'Code review',        icon: 'clipboard-check',      hue: 'var(--fai-violet-400)' },
  { id: 'test',   label: '/test',   desc: 'Write & run tests',  icon: 'test-tube',            hue: 'var(--fai-green-500)' },
  { id: 'plan',   label: '/plan',   desc: 'Plan before editing',icon: 'notes',                hue: 'var(--fai-blue-500)' },
  { id: 'commit', label: '/commit', desc: 'Commit & open PR',   icon: 'branching-paths-down', hue: 'var(--fai-orange-500)' }
];
const PLUGINS = [
  { id: 'playwright', label: 'Playwright', icon: 'window-frame',           hue: 'var(--fai-green-500)' },
  { id: 'context7',   label: 'Context7',   icon: 'book-2',                 hue: 'var(--fai-cyan-400)' },
  { id: 'linear',     label: 'Linear',     icon: 'checklist-minimalistic', hue: 'var(--fai-violet-400)' },
  { id: 'sentry',     label: 'Sentry',     icon: 'shield-warning',         hue: 'var(--fai-red-500)' }
];
const EFFORT_DESC = { minimal: 'Fastest. Almost no reasoning.', low: 'Quick turns, light reasoning.', medium: 'Balanced speed and depth.', high: 'Deeper reasoning, slower turns.', xhigh: 'Maximum reasoning budget.', max: 'Maximum reasoning budget.' };
const INK = 'var(--fai-grey-900)', BORDER = 'var(--fai-border)', SURF = 'var(--fai-surface)', SEL = 'var(--fai-grey-100)';
const FH0 = { x: 0, y: 0, w: 0, h: 0, o: 0, i: -1 };
```
Fake branch list returned by `fetchBranches`: `[{name:'main',meta:'default'},{name:'develop',meta:'2h ago'},{name:'feat/session-modal',meta:'1d ago'},{name:'fix/auth-fixation',meta:'3d ago'},{name:'release/1.4',meta:'2w ago'}]`. Pair command: `curl -sL orch.sh/join | sh -s -- --token 7f3a-k2m9`.

Shapes the port must preserve: Machine `{id,name,os,icon,status:'online'|'offline',load,hue}`; Project `{id,name,path,repo,hue}`; Model `{id,name,vendor,efforts:string[],def:string,ctx:string}`; Harness `{id,name,img,letter,models}`; Perm `{id,name,desc,icon,hue}`; menu item `{key,label,kind,icon(url),hue,apply()}`; Branch `{name,meta}`; FS = nested plain objects (folder name → children).

---

## 8. Open questions / inconsistencies (do not guess — decide explicitly)
1. **`[data-ns-summary]` is the Ephemeral|Persistent segmented control**, not a summary sentence. There is no summary-text element and no summary string in `renderVals()`. The brief's "summary text — exact wording rules" has no source in this design. `machineCountLabel` (`'02 selected'` / `'Select at least one'`) exists in the script but is never rendered; it is the only candidate for summary copy.
2. **Cancel and Close (IconButton) have no handlers.** `start` is `() => {}`. Dismissal behaviour (scrim click, Escape) is not implemented in the design.
3. **Effort geometry mismatch.** Fill right edge overshoots the handle's left edge by `9 + 4p` px; handle centre vs pip centre differ by `5p − 2.5` px (§2.10). The fill is drawn under the handle so the overshoot is visible as grey to the right of the line. Port 1:1 or correct — needs a decision.
4. **Unused `@keyframes`:** `nsOut`, `nsInB`. Unused computed values: `machineCountLabel`, `projectRepo`, `hideImg`, `effortCount`, `effortFrac`, `browsing`, `closeBrowse`, `h.letter` (harness letter fallback), `md.letter`, `effortStops[].label/tab/color/cell/align/tx/pick`, `EFFORT_DESC`, `gen`. The brief mentions a `letter` fallback for logos — the design computes it but never renders it (no `onError` on images either; `hideImg` is unbound).
5. **`sc-for` rows are index-keyed**; the harness-switch animation works only because the inline `animation` string changes. Svelte port should key model rows by `gen + ':' + id` and rely on mount to play `nsIn*`.
6. **`fixedOrigin` depends on the scrim's `backdrop-filter`.** If the port renders popovers in a portal (bits-ui Popover) the maths collapses to viewport coords; if popovers stay inside a blurred/transformed ancestor, the origin subtraction must be kept.
7. **`_out` closes on `pointerdown` outside `[data-ns-pop]`, but the `@`/`/` menu is never closed by outside clicks** (only `pop` is checked). Blur of the editor also does not close the menu. Intentional?
8. **`createProj` does not call `fetchBranches`**, while `p.pick` does; the `@`-menu project apply also does not. Branch state can therefore be stale after creating/applying a project.
9. **`pickCustom` when `custom` already set with a different id** replaces it (only one custom model at a time). `list` prepends the custom model even when a built-in harness is selected.
10. **Project pick sets `repo: p.repo`** (may be `''`), while `createProj`/menu apply use `p.repo || repo`. Inconsistent fallback.
11. **`onNpName` path auto-follow** compares against `'~/code/' + slug(np.name)` using the OLD name — works because the check happens before the state update; port must replicate ordering.
12. **`Start Session` label** is used for both 0 and 1 machines; only the disabled state distinguishes them.
13. **Font/size drift vs app.css:** design is 13/14px with weight 500; app is 13.5/15px with medium 450. DESIGN.md does not exist yet (per CLAUDE.md) — the mapping in §6 is a proposal, not law.
14. **Icon sets:** DS Button/IconButton use Lucide (`x` for Close); everything else is Solar bold-duotone via iconify CDN. The DS readme forbids duotone icons; the modal uses them throughout.
15. **`README` says `.fai-comb` pitch 6px** (matches `styles.css`); the modal uses `.fai-comb` three times (under First-prompt header, after First-prompt section with `margin-top:18px`, and between Location and Model blocks).
16. `input` `onChange` in the design fires per keystroke (React); Svelte must use `oninput`.
17. `promptH` is a fixed 44px→120px toggle, not a content-measured auto-grow; the editor scrolls internally beyond 120px (`overflow:auto`).
