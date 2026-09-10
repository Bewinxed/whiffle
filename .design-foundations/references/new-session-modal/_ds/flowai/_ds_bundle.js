/* @ds-bundle: {"format":4,"namespace":"FlowAIDesignSystem_94b032","components":[{"name":"Avatar","sourcePath":"components/core/Avatar.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"CombRule","sourcePath":"components/core/CombRule.jsx"},{"name":"Icon","sourcePath":"components/core/Icon.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"Tile","sourcePath":"components/core/IconChip.jsx"},{"name":"IconChip","sourcePath":"components/core/IconChip.jsx"},{"name":"Logo","sourcePath":"components/core/Logo.jsx"},{"name":"Meter","sourcePath":"components/core/Meter.jsx"},{"name":"DataTable","sourcePath":"components/data/DataTable.jsx"},{"name":"ListRow","sourcePath":"components/data/ListRow.jsx"},{"name":"StatusDot","sourcePath":"components/data/ListRow.jsx"},{"name":"Pagination","sourcePath":"components/data/Pagination.jsx"},{"name":"SectionCard","sourcePath":"components/data/SectionCard.jsx"},{"name":"StatCard","sourcePath":"components/data/StatCard.jsx"},{"name":"TemplateCard","sourcePath":"components/data/TemplateCard.jsx"},{"name":"Alert","sourcePath":"components/feedback/Alert.jsx"},{"name":"AssistantPanel","sourcePath":"components/feedback/AssistantPanel.jsx"},{"name":"EmptyState","sourcePath":"components/feedback/EmptyState.jsx"},{"name":"Modal","sourcePath":"components/feedback/Modal.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"PasswordInput","sourcePath":"components/forms/PasswordInput.jsx"},{"name":"SearchInput","sourcePath":"components/forms/SearchInput.jsx"},{"name":"SegmentedTabs","sourcePath":"components/forms/SegmentedTabs.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"NavItem","sourcePath":"components/navigation/NavItem.jsx"},{"name":"PageHeader","sourcePath":"components/navigation/PageHeader.jsx"},{"name":"NavGroupLabel","sourcePath":"components/navigation/Sidebar.jsx"},{"name":"Sidebar","sourcePath":"components/navigation/Sidebar.jsx"},{"name":"Topbar","sourcePath":"components/navigation/Topbar.jsx"},{"name":"UsageQuota","sourcePath":"components/navigation/UsageQuota.jsx"}],"sourceHashes":{"components/core/Avatar.jsx":"c9331bcc6a78","components/core/Badge.jsx":"f31faea25e37","components/core/Button.jsx":"bc8c857903bf","components/core/CombRule.jsx":"3cb68335cfa9","components/core/Icon.jsx":"d8fbc0a5c215","components/core/IconButton.jsx":"ccf1dd459c1a","components/core/IconChip.jsx":"0a96015be17d","components/core/Logo.jsx":"603cee98ad5d","components/core/Meter.jsx":"50192b1124da","components/data/DataTable.jsx":"287499cbc382","components/data/ListRow.jsx":"7b39cea0f6c1","components/data/Pagination.jsx":"514ba9dde130","components/data/SectionCard.jsx":"ea4f8fb9dcde","components/data/StatCard.jsx":"cada8fd3347b","components/data/TemplateCard.jsx":"ebaa03608149","components/feedback/Alert.jsx":"42a73ee05d25","components/feedback/AssistantPanel.jsx":"4db529902171","components/feedback/EmptyState.jsx":"9166d2e3dc8f","components/feedback/Modal.jsx":"c0030d0cb0bd","components/forms/Input.jsx":"913321aa2993","components/forms/PasswordInput.jsx":"8bba5f6c6bd7","components/forms/SearchInput.jsx":"48a5514b56a7","components/forms/SegmentedTabs.jsx":"92a7e096bc16","components/forms/Select.jsx":"c420e6905ca4","components/forms/Switch.jsx":"6336f6ea1866","components/navigation/NavItem.jsx":"4fb1ecf060cf","components/navigation/PageHeader.jsx":"2fc120e3386a","components/navigation/Sidebar.jsx":"1ed577c8e343","components/navigation/Topbar.jsx":"955aa1887d9b","components/navigation/UsageQuota.jsx":"cebd0a21d247","ui_kits/flowai_app/AppShell.jsx":"fc4eada8fa16","ui_kits/flowai_app/DashboardScreen.jsx":"1212a51fb3cc","ui_kits/flowai_app/IntegrationsScreen.jsx":"e9d0075c842c","ui_kits/flowai_app/SettingsScreen.jsx":"eea7fe1111e0","ui_kits/flowai_app/TeamMembersScreen.jsx":"9ba5be0715ca","ui_kits/flowai_app/WorkflowLibraryScreen.jsx":"00b831d37061","ui_kits/flowai_app/data.jsx":"891b2a8bc1d3"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.FlowAIDesignSystem_94b032 = window.FlowAIDesignSystem_94b032 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Avatar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Round monogram avatar with optional presence dot. Photos are used when available. */
function Avatar({
  name = "",
  src,
  size = 28,
  presence,
  style,
  ...rest
}) {
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      position: "relative",
      display: "inline-flex",
      flex: "none",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: size,
      height: size,
      borderRadius: "var(--fai-radius-pill)",
      overflow: "hidden",
      background: "var(--fai-grey-150)",
      color: "var(--fai-grey-700)",
      font: "var(--fai-weight-medium) " + Math.round(size * 0.38) + "px/1 var(--fai-font-sans)",
      boxShadow: "inset 0 0 0 1px rgba(16,18,20,.06)"
    }
  }, src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: name,
    style: {
      width: "100%",
      height: "100%",
      objectFit: "cover"
    }
  }) : initials), presence ? /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      right: -1,
      bottom: -1,
      width: Math.max(7, size * 0.28),
      height: Math.max(7, size * 0.28),
      borderRadius: "var(--fai-radius-pill)",
      background: "var(--fai-presence-" + presence + ")",
      border: "2px solid var(--fai-surface)"
    }
  }) : null);
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/core/CombRule.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** The signature hairline tick row. Sits between a section-card header and its content,
 *  and as a closing rule at the bottom of long tables. */
function CombRule({
  dense = false,
  height = 14,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    className: "fai-comb" + (dense ? " fai-comb--dense" : ""),
    style: {
      height,
      ...style
    }
  }, rest));
}
Object.assign(__ds_scope, { CombRule });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/CombRule.jsx", error: String((e && e.message) || e) }); }

// components/core/Icon.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const BASE = "https://unpkg.com/lucide-static@0.469.0/icons/";

/** Lucide glyph, tinted with currentColor. `name` is the kebab-case Lucide id. */
function Icon({
  name,
  size = 16,
  strokeWidth,
  style,
  className = "",
  ...rest
}) {
  const url = "url(" + BASE + name + ".svg)";
  return /*#__PURE__*/React.createElement("span", _extends({
    className: "fai-icon " + className,
    "aria-hidden": "true",
    "data-icon": name,
    style: {
      "--fai-icon-url": url,
      width: size,
      height: size,
      fontSize: size,
      ...style
    }
  }, rest));
}
Object.assign(__ds_scope, { Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Icon.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const TONES = {
  active: {
    bg: "var(--fai-status-active-bg)",
    fg: "var(--fai-status-active-fg)"
  },
  paused: {
    bg: "var(--fai-status-paused-bg)",
    fg: "var(--fai-status-paused-fg)"
  },
  expired: {
    bg: "var(--fai-status-expired-bg)",
    fg: "var(--fai-status-expired-fg)"
  },
  draft: {
    bg: "var(--fai-status-draft-bg)",
    fg: "var(--fai-status-draft-fg)"
  },
  info: {
    bg: "var(--fai-status-info-bg)",
    fg: "var(--fai-status-info-fg)"
  },
  success: {
    bg: "var(--fai-green-50)",
    fg: "var(--fai-green-700)"
  },
  count: {
    bg: "var(--fai-blue-50)",
    fg: "var(--fai-blue-600)"
  }
};

/** Soft-tint status pill. Also the sidebar count chip (tone="count"/"success"). */
function Badge({
  children,
  tone = "draft",
  icon,
  style,
  ...rest
}) {
  const t = TONES[tone] || TONES.draft;
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      padding: "3px 8px",
      font: "var(--fai-weight-medium) var(--fai-text-xs)/1.2 var(--fai-font-sans)",
      color: t.fg,
      background: t.bg,
      borderRadius: "var(--fai-radius-badge)",
      ...style
    }
  }, rest), icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 11
  }) : null, children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const SIZES = {
  sm: {
    h: 30,
    px: 11,
    gap: 7,
    fs: "var(--fai-text-sm)",
    icon: 14
  },
  md: {
    h: 36,
    px: 14,
    gap: 8,
    fs: "var(--fai-text-base)",
    icon: 16
  },
  lg: {
    h: 44,
    px: 16,
    gap: 8,
    fs: "var(--fai-text-base)",
    icon: 18
  }
};
const VARIANTS = {
  primary: {
    bg: "var(--fai-grey-900)",
    hover: "var(--fai-ink)",
    fg: "var(--fai-text-inverse)",
    bd: "transparent"
  },
  secondary: {
    bg: "var(--fai-surface)",
    hover: "var(--fai-grey-50)",
    fg: "var(--fai-text)",
    bd: "var(--fai-border)"
  },
  subtle: {
    bg: "var(--fai-grey-100)",
    hover: "var(--fai-grey-150)",
    fg: "var(--fai-text)",
    bd: "transparent"
  },
  ghost: {
    bg: "transparent",
    hover: "var(--fai-grey-100)",
    fg: "var(--fai-text-muted)",
    bd: "transparent"
  },
  danger: {
    bg: "var(--fai-surface)",
    hover: "var(--fai-red-50)",
    fg: "var(--fai-red-600)",
    bd: "var(--fai-border)"
  },
  warning: {
    bg: "var(--fai-amber-50)",
    hover: "#fdeab0",
    fg: "var(--fai-amber-700)",
    bd: "var(--fai-amber-400)"
  }
};

/** The product's standard action control. Near-black primary, hairline white secondary. */
function Button({
  children,
  variant = "secondary",
  size = "md",
  icon,
  iconRight,
  disabled,
  fullWidth,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);
  const s = SIZES[size] || SIZES.md;
  const v = VARIANTS[variant] || VARIANTS.secondary;
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    disabled: disabled,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setPress(false);
    },
    onMouseDown: () => setPress(true),
    onMouseUp: () => setPress(false),
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: s.gap,
      height: s.h,
      padding: "0 " + s.px + "px",
      width: fullWidth ? "100%" : undefined,
      font: "var(--fai-weight-medium) " + s.fs + "/1 var(--fai-font-sans)",
      letterSpacing: "var(--fai-tracking-snug)",
      color: v.fg,
      background: disabled ? "var(--fai-grey-100)" : hover ? v.hover : v.bg,
      border: "1px solid " + (disabled ? "var(--fai-border-subtle)" : v.bd),
      borderRadius: "var(--fai-radius-control)",
      boxShadow: "none",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.6 : 1,
      transform: press && !disabled ? "scale(var(--fai-press-scale))" : "none",
      transition: "var(--fai-transition-control),transform var(--fai-duration-instant) var(--fai-ease-standard)",
      whiteSpace: "nowrap",
      ...style
    }
  }, rest), icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: s.icon,
    style: {
      color: variant === "primary" ? "var(--fai-white)" : variant === "secondary" ? "var(--fai-text-muted)" : undefined
    }
  }) : null, children, iconRight ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: iconRight,
    size: s.icon,
    style: {
      color: variant === "secondary" ? "var(--fai-text-muted)" : undefined
    }
  }) : null);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const SIZES = {
  sm: 28,
  md: 32,
  lg: 36
};

/** Square hairline icon button — sidebar collapse, close, refresh, row actions. */
function IconButton({
  icon,
  size = "md",
  variant = "secondary",
  label,
  disabled,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  const d = SIZES[size] || SIZES.md;
  const bare = variant === "ghost";
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    "aria-label": label,
    title: label,
    disabled: disabled,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: d,
      height: d,
      color: hover ? "var(--fai-text)" : "var(--fai-text-muted)",
      background: bare ? hover ? "var(--fai-grey-100)" : "transparent" : hover ? "var(--fai-grey-50)" : "var(--fai-surface)",
      border: "1px solid " + (bare ? "transparent" : "var(--fai-border)"),
      borderRadius: "var(--fai-radius-sm)",
      boxShadow: bare ? "none" : "var(--fai-shadow-xs)",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      transition: "var(--fai-transition-control)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: size === "sm" ? 14 : 16
  }));
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/core/IconChip.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const HUES = {
  red: "var(--fai-red-400)",
  orange: "var(--fai-orange-500)",
  amber: "var(--fai-amber-400)",
  green: "var(--fai-green-500)",
  cyan: "var(--fai-cyan-400)",
  blue: "var(--fai-blue-500)",
  violet: "var(--fai-violet-400)",
  grey: "var(--fai-grey-500)",
  ink: "var(--fai-grey-900)"
};

/** The house "containered glyph" shell. Wrap anything that needs the tile treatment
 *  (a Lucide glyph, a presence dot, a mark) so the surface, radius and shadow stay in one place. */
function Tile({
  size = 28,
  fill = "soft",
  hue = "grey",
  children,
  style,
  ...rest
}) {
  const hex = HUES[hue] || HUES.grey;
  const filled = fill === "solid" || fill === "ink";
  const bg = fill === "ink" ? "var(--fai-grey-900)" : filled ? hex : "var(--fai-surface)";
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: size,
      height: size,
      flex: "none",
      color: filled ? "var(--fai-white)" : hex,
      background: bg,
      borderRadius: size <= 20 ? "var(--fai-radius-xs)" : size >= 24 ? "var(--fai-radius-md)" : "var(--fai-radius-chip)",
      boxShadow: filled ? "none" : "0 1px 2px rgba(16,18,20,.07),0 0 0 1px rgba(16,18,20,.035)",
      ...style
    }
  }, rest), children);
}

/** Rounded-square glyph holder. `soft` = white tile + coloured glyph (list rows);
 *  `solid` = coloured tile + white glyph (table rows); `ink` = near-black tile + white glyph (KPI tiles). */
function IconChip({
  icon,
  hue = "grey",
  fill = "soft",
  size = 28,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement(Tile, _extends({
    size: size,
    fill: fill,
    hue: hue,
    style: style
  }, rest), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: Math.round(size * (fill === "soft" ? 0.55 : 0.52))
  }));
}
Object.assign(__ds_scope, { Tile, IconChip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconChip.jsx", error: String((e && e.message) || e) }); }

// components/core/Logo.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** FlowAI wordmark. NOTE: no logo asset was supplied with the source screenshots, so the
 *  mark is set in type only — drop the real SVG into assets/ and render it here when available. */
function Logo({
  size = 16,
  tone = "ink",
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: "inline-flex",
      alignItems: "center",
      font: "var(--fai-weight-bold) " + size + "px/1 var(--fai-font-sans)",
      letterSpacing: "var(--fai-tracking-tight)",
      color: tone === "inverse" ? "var(--fai-text-inverse)" : "var(--fai-text-strong)",
      ...style
    }
  }, rest), "FlowAI");
}
Object.assign(__ds_scope, { Logo });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Logo.jsx", error: String((e && e.message) || e) }); }

// components/core/Meter.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Segmented bar meter (seat usage, quota, token spend). Filled bars are near-black;
 *  remaining bars drop to grey-300. Not a rounded progress track — always discrete bars. */
function Meter({
  value = 0,
  max = 100,
  bars = 46,
  tone = "ink",
  height = 26,
  style,
  ...rest
}) {
  const filled = Math.round(Math.min(value, max) / max * bars);
  const fill = tone === "ink" ? "var(--fai-grey-800)" : "var(--fai-" + tone + "-500)";
  return /*#__PURE__*/React.createElement("div", _extends({
    role: "progressbar",
    "aria-valuenow": value,
    "aria-valuemax": max,
    style: {
      display: "flex",
      gap: 2,
      alignItems: "stretch",
      height,
      ...style
    }
  }, rest), Array.from({
    length: bars
  }).map((_, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      flex: 1,
      borderRadius: 1,
      background: i < filled ? fill : "var(--fai-grey-300)"
    }
  })));
}
Object.assign(__ds_scope, { Meter });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Meter.jsx", error: String((e && e.message) || e) }); }

// components/data/DataTable.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Product data table: grey header band, hairline row rules, no vertical rules, no zebra. */
function DataTable({
  columns = [],
  rows = [],
  footer,
  rowKey,
  onRowClick,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(-1);
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      width: "100%",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("table", {
    style: {
      width: "100%",
      borderCollapse: "collapse",
      tableLayout: "auto"
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, columns.map((c, i) => /*#__PURE__*/React.createElement("th", {
    key: c.key || i,
    style: {
      textAlign: c.align || "left",
      padding: "9px 12px",
      background: "var(--fai-surface-muted)",
      font: "var(--fai-weight-regular) var(--fai-text-sm)/1.2 var(--fai-font-sans)",
      color: "var(--fai-text-muted)",
      whiteSpace: "nowrap",
      borderTopLeftRadius: i === 0 ? "var(--fai-radius-sm)" : 0,
      borderBottomLeftRadius: i === 0 ? "var(--fai-radius-sm)" : 0,
      borderTopRightRadius: i === columns.length - 1 ? "var(--fai-radius-sm)" : 0,
      borderBottomRightRadius: i === columns.length - 1 ? "var(--fai-radius-sm)" : 0,
      width: c.width
    }
  }, c.header)))), /*#__PURE__*/React.createElement("tbody", null, rows.map((r, ri) => /*#__PURE__*/React.createElement("tr", {
    key: rowKey ? r[rowKey] : ri,
    onMouseEnter: () => setHover(ri),
    onMouseLeave: () => setHover(-1),
    onClick: onRowClick ? () => onRowClick(r, ri) : undefined,
    style: {
      background: hover === ri ? "var(--fai-grey-25)" : "transparent",
      cursor: onRowClick ? "pointer" : "default",
      transition: "background-color var(--fai-duration-fast) var(--fai-ease-standard)"
    }
  }, columns.map((c, ci) => /*#__PURE__*/React.createElement("td", {
    key: c.key || ci,
    style: {
      textAlign: c.align || "left",
      padding: "10px 12px",
      borderTop: ri === 0 ? "none" : "1px solid var(--fai-border-subtle)",
      font: "var(--fai-type-body)",
      color: c.muted ? "var(--fai-text-muted)" : "var(--fai-text)",
      whiteSpace: "nowrap"
    }
  }, c.render ? c.render(r, ri) : r[c.key])))))), footer ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      padding: "12px 12px 4px",
      borderTop: "1px solid var(--fai-border-subtle)"
    }
  }, footer) : null);
}
Object.assign(__ds_scope, { DataTable });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/DataTable.jsx", error: String((e && e.message) || e) }); }

// components/data/ListRow.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Inset grey row used for status lists, role breakdowns, API keys and settings items. */
function ListRow({
  leading,
  title,
  subtitle,
  count,
  trailing,
  inset = true,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", _extends({
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: inset ? "8px 12px" : "8px 0",
      minHeight: 44,
      background: inset ? hover ? "var(--fai-grey-100)" : "var(--fai-surface-subtle)" : "transparent",
      border: inset ? "1px solid var(--fai-border-subtle)" : "none",
      borderRadius: inset ? "var(--fai-radius-row)" : 0,
      transition: "background-color var(--fai-duration-fast) var(--fai-ease-standard)",
      ...style
    }
  }, rest), leading, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0,
      flex: 1,
      display: "flex",
      alignItems: "baseline",
      gap: 6
    }
  }, count !== undefined ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--fai-weight-medium) var(--fai-text-lg)/1.2 var(--fai-font-sans)",
      color: "var(--fai-text)"
    }
  }, count) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: subtitle ? "var(--fai-type-label)" : "var(--fai-type-body)",
      color: "var(--fai-text)",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, title), subtitle ? /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--fai-type-meta)",
      color: "var(--fai-text-subtle)",
      marginTop: 2,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, subtitle) : null)), trailing);
}

/** Presence/state dot for the leading slot of a ListRow. By default it sits in a white
 *  hairline tile (as in Member Status); pass `tile={false}` for a bare dot. */
function StatusDot({
  tone = "offline",
  size = 8,
  tile = true,
  tileSize = 28
}) {
  const dot = /*#__PURE__*/React.createElement("span", {
    style: {
      width: size,
      height: size,
      borderRadius: "var(--fai-radius-pill)",
      background: "var(--fai-presence-" + tone + ")",
      flex: "none"
    }
  });
  if (!tile) return dot;
  return /*#__PURE__*/React.createElement(__ds_scope.Tile, {
    size: tileSize
  }, dot);
}
Object.assign(__ds_scope, { ListRow, StatusDot });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/ListRow.jsx", error: String((e && e.message) || e) }); }

// components/data/Pagination.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Cell({
  children,
  active,
  disabled,
  onClick
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    disabled: disabled,
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      minWidth: 28,
      height: 28,
      padding: "0 6px",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      font: "var(--fai-weight-medium) var(--fai-text-sm)/1 var(--fai-font-sans)",
      color: active ? "var(--fai-text-inverse)" : "var(--fai-text-muted)",
      background: active ? "var(--fai-grey-900)" : hover && !disabled ? "var(--fai-grey-100)" : "transparent",
      border: "1px solid " + (active ? "transparent" : "var(--fai-border-subtle)"),
      borderRadius: "var(--fai-radius-sm)",
      opacity: disabled ? 0.4 : 1,
      cursor: disabled ? "not-allowed" : "pointer",
      transition: "var(--fai-transition-control)"
    }
  }, children);
}

/** Table pager: chevron ends, numbered cells, ellipsis gap, near-black active cell. */
function Pagination({
  page = 1,
  pageCount = 10,
  onChange,
  style,
  ...rest
}) {
  const go = n => onChange && onChange(Math.min(Math.max(1, n), pageCount));
  const head = [1, 2, 3].filter(n => n <= pageCount);
  const tail = [pageCount - 1, pageCount].filter(n => n > 3);
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: "flex",
      alignItems: "center",
      gap: 4,
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement(Cell, {
    disabled: page === 1,
    onClick: () => go(page - 1)
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-left",
    size: 14
  })), head.map(n => /*#__PURE__*/React.createElement(Cell, {
    key: n,
    active: n === page,
    onClick: () => go(n)
  }, n)), pageCount > 5 ? /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--fai-text-subtle)",
      padding: "0 2px"
    }
  }, "\xB7\xB7\xB7") : null, tail.map(n => /*#__PURE__*/React.createElement(Cell, {
    key: n,
    active: n === page,
    onClick: () => go(n)
  }, n)), /*#__PURE__*/React.createElement(Cell, {
    disabled: page === pageCount,
    onClick: () => go(page + 1)
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-right",
    size: 14
  })));
}
Object.assign(__ds_scope, { Pagination });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Pagination.jsx", error: String((e && e.message) || e) }); }

// components/data/SectionCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** The workhorse container: title row with a leading glyph, the comb rule, then content. */
function SectionCard({
  title,
  icon,
  action,
  children,
  comb = true,
  padding = 12,
  style,
  bodyStyle,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("section", _extends({
    style: {
      background: "var(--fai-surface)",
      border: "1px solid var(--fai-border-subtle)",
      borderRadius: "var(--fai-radius-card)",
      boxShadow: "var(--fai-shadow-card)",
      overflow: "hidden",
      ...style
    }
  }, rest), title || action ? /*#__PURE__*/React.createElement("header", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      padding: "12px " + padding + "px 0"
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      font: "var(--fai-type-card-title)",
      letterSpacing: "var(--fai-tracking-snug)",
      color: "var(--fai-text)"
    }
  }, icon ? /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--fai-text-muted)",
      display: "inline-flex"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 16
  })) : null, title), action) : null, comb ? /*#__PURE__*/React.createElement(__ds_scope.CombRule, {
    style: {
      margin: "10px " + padding + "px 0"
    }
  }) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: padding + "px",
      ...bodyStyle
    }
  }, children));
}
Object.assign(__ds_scope, { SectionCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/SectionCard.jsx", error: String((e && e.message) || e) }); }

// components/data/StatCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** KPI tile: white outer card wrapping a grey inset panel with glyph, label and metric. */
function StatCard({
  label,
  value,
  icon = "activity",
  delta,
  deltaTone = "up",
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      background: "var(--fai-surface)",
      border: "1px solid var(--fai-border-subtle)",
      borderRadius: "var(--fai-radius-lg)",
      padding: 6,
      boxShadow: "var(--fai-shadow-card)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--fai-grey-25)",
      border: "1px solid var(--fai-border-subtle)",
      borderRadius: "var(--fai-radius-md)",
      padding: "10px 12px 12px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.IconChip, {
    icon: icon,
    fill: "ink",
    size: 24
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--fai-type-body)",
      color: "var(--fai-text-muted)",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, label)), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--fai-type-metric)",
      letterSpacing: "var(--fai-tracking-tight)",
      marginTop: 8
    }
  }, value), delta ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      marginTop: 10,
      font: "var(--fai-type-meta)",
      color: "var(--fai-metric-" + deltaTone + ")"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 5,
      height: 5,
      borderRadius: "var(--fai-radius-pill)",
      background: "currentColor",
      opacity: .8
    }
  }), delta) : null));
}
Object.assign(__ds_scope, { StatCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/StatCard.jsx", error: String((e && e.message) || e) }); }

// components/data/TemplateCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Recently-used template tile: grey preview panel with crosshair guides, then title + meta. */
function TemplateCard({
  title,
  meta,
  status = "Active",
  art,
  integrations = [],
  runs,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("article", _extends({
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      background: "var(--fai-surface)",
      border: "1px solid var(--fai-border-subtle)",
      borderRadius: "var(--fai-radius-lg)",
      padding: 8,
      boxShadow: hover ? "var(--fai-shadow-raised)" : "var(--fai-shadow-card)",
      transition: "box-shadow var(--fai-duration-base) var(--fai-ease-standard)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      height: 104,
      borderRadius: "var(--fai-radius-md)",
      background: "var(--fai-grey-50)",
      border: "1px solid var(--fai-border-subtle)",
      backgroundImage: "linear-gradient(var(--fai-border-subtle),var(--fai-border-subtle)),linear-gradient(var(--fai-border-subtle),var(--fai-border-subtle))",
      backgroundSize: "100% 1px,1px 100%",
      backgroundPosition: "0 50%,50% 0",
      backgroundRepeat: "no-repeat",
      display: "grid",
      placeItems: "center",
      overflow: "hidden"
    }
  }, art ? /*#__PURE__*/React.createElement("img", {
    src: art,
    alt: "",
    style: {
      width: 56,
      height: 56,
      objectFit: "contain"
    }
  }) : /*#__PURE__*/React.createElement(__ds_scope.IconChip, {
    icon: "layout-template",
    hue: "grey",
    size: 40
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: 8,
      right: 8
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Badge, {
    tone: "info"
  }, status))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "10px 4px 4px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--fai-weight-medium) var(--fai-text-base)/1.3 var(--fai-font-sans)"
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--fai-type-meta)",
      color: "var(--fai-text-subtle)",
      marginTop: 4
    }
  }, meta)), integrations.length || runs ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      borderTop: "1px solid var(--fai-border-subtle)",
      padding: "8px 4px 2px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 4
    }
  }, integrations.map((it, i) => /*#__PURE__*/React.createElement(__ds_scope.IconChip, {
    key: i,
    icon: it.icon,
    hue: it.hue,
    size: 20
  }))), runs ? /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--fai-type-meta)",
      color: "var(--fai-text-subtle)"
    }
  }, runs) : null) : null);
}
Object.assign(__ds_scope, { TemplateCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/TemplateCard.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Alert.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const TONES = {
  warning: {
    bg: "#fefce8",
    bd: "#f7e6a8",
    fg: "var(--fai-amber-700)",
    icon: "triangle-alert"
  },
  danger: {
    bg: "var(--fai-red-50)",
    bd: "#fbcaca",
    fg: "var(--fai-red-600)",
    icon: "octagon-alert"
  },
  info: {
    bg: "var(--fai-blue-50)",
    bd: "#cddcff",
    fg: "var(--fai-blue-600)",
    icon: "info"
  },
  neutral: {
    bg: "var(--fai-surface-subtle)",
    bd: "var(--fai-border)",
    fg: "var(--fai-text-muted)",
    icon: "info"
  }
};

/** Inline notice. Tinted fill, hairline tinted border, coloured glyph, grey body copy. */
function Alert({
  tone = "warning",
  title,
  children,
  icon,
  action,
  style,
  ...rest
}) {
  const t = TONES[tone] || TONES.warning;
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: "flex",
      alignItems: "flex-start",
      gap: 10,
      padding: "10px 12px",
      background: t.bg,
      border: "1px solid " + t.bd,
      borderRadius: "var(--fai-radius-md)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement(__ds_scope.Tile, {
    size: 26,
    style: {
      color: t.fg,
      marginTop: 1
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon || t.icon,
    size: 14
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, title ? /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--fai-weight-medium) var(--fai-text-sm)/1.35 var(--fai-font-sans)",
      color: t.fg
    }
  }, title) : null, children ? /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--fai-type-meta)",
      color: "var(--fai-text-muted)",
      marginTop: title ? 3 : 0,
      lineHeight: 1.45
    }
  }, children) : null), action);
}
Object.assign(__ds_scope, { Alert });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Alert.jsx", error: String((e && e.message) || e) }); }

// components/feedback/EmptyState.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Empty state: crosshair guides behind a round white glyph badge. */
function EmptyState({
  icon = "sparkles",
  title,
  children,
  tone = "blue",
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      position: "relative",
      display: "grid",
      placeItems: "center",
      padding: "48px 24px",
      overflow: "hidden",
      backgroundImage: "linear-gradient(var(--fai-border-subtle),var(--fai-border-subtle)),linear-gradient(var(--fai-border-subtle),var(--fai-border-subtle))",
      backgroundSize: "100% 1px,1px 100%",
      backgroundPosition: "0 50%,50% 0",
      backgroundRepeat: "no-repeat",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 72,
      height: 72,
      borderRadius: "var(--fai-radius-pill)",
      background: "var(--fai-surface)",
      boxShadow: "0 8px 24px -8px rgba(16,18,20,.18),0 0 0 1px var(--fai-border-subtle)",
      display: "grid",
      placeItems: "center",
      color: "var(--fai-" + tone + "-500)"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 28
  })), title ? /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--fai-type-card-title)",
      marginTop: 16
    }
  }, title) : null, children ? /*#__PURE__*/React.createElement("p", {
    style: {
      font: "var(--fai-type-body)",
      color: "var(--fai-text-muted)",
      marginTop: 6,
      textAlign: "center",
      maxWidth: 320
    }
  }, children) : null);
}
Object.assign(__ds_scope, { EmptyState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/EmptyState.jsx", error: String((e && e.message) || e) }); }

// components/feedback/AssistantPanel.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
function Suggestion({
  icon,
  children,
  onClick
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      width: "100%",
      height: 34,
      padding: "0 10px",
      background: hover ? "var(--fai-grey-50)" : "var(--fai-surface)",
      border: "1px solid var(--fai-border-subtle)",
      borderRadius: "var(--fai-radius-sm)",
      font: "var(--fai-type-label)",
      color: "var(--fai-text)",
      cursor: "pointer",
      textAlign: "left",
      transition: "var(--fai-transition-control)"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 13,
    style: {
      color: "var(--fai-blue-500)"
    }
  }), children);
}

/** The Ask AI drawer: floating panel over the page, greeting + suggestions + composer. */
function AssistantPanel({
  greeting = "Hey there!",
  blurb = "Ask me anything about your workflows, automation ideas, debugging runs, or how to optimize your AI agents.",
  suggestions = [],
  messages = [],
  onSend,
  onClose,
  width = 360,
  style,
  ...rest
}) {
  const [draft, setDraft] = React.useState("");
  const send = () => {
    if (draft.trim() && onSend) onSend(draft.trim());
    setDraft("");
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      width,
      display: "flex",
      flexDirection: "column",
      background: "var(--fai-grey-100)",
      borderRadius: "var(--fai-radius-modal)",
      padding: 7,
      boxShadow: "var(--fai-shadow-shell)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "3px 4px 8px"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Logo, {
    size: 13
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--fai-type-label)",
      color: "var(--fai-text-subtle)",
      flex: 1
    }
  }, "Assistant"), /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    icon: "x",
    size: "sm",
    variant: "ghost",
    label: "Close assistant",
    onClick: onClose
  })), /*#__PURE__*/React.createElement("div", {
    className: "fai-scroll",
    style: {
      background: "var(--fai-surface)",
      borderRadius: "var(--fai-radius-lg)",
      padding: 12,
      display: "flex",
      flexDirection: "column",
      gap: 10,
      minHeight: 300,
      maxHeight: 420,
      overflowY: "auto"
    }
  }, messages.length === 0 ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(__ds_scope.EmptyState, {
    icon: "sparkles",
    style: {
      flex: 1,
      padding: "36px 12px",
      margin: "0 -12px"
    }
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--fai-type-card-title)"
    }
  }, greeting), /*#__PURE__*/React.createElement("p", {
    style: {
      font: "var(--fai-type-meta)",
      color: "var(--fai-text-muted)",
      marginTop: 6,
      lineHeight: 1.5
    }
  }, blurb)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 6
    }
  }, suggestions.map((s, i) => /*#__PURE__*/React.createElement(Suggestion, {
    key: i,
    icon: s.icon,
    onClick: s.onClick
  }, s.label)))) : messages.map((m, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      alignSelf: m.from === "user" ? "flex-end" : "flex-start",
      maxWidth: "86%",
      padding: "8px 10px",
      borderRadius: "var(--fai-radius-md)",
      background: m.from === "user" ? "var(--fai-grey-900)" : "var(--fai-surface-subtle)",
      color: m.from === "user" ? "var(--fai-text-inverse)" : "var(--fai-text)",
      border: m.from === "user" ? "none" : "1px solid var(--fai-border-subtle)",
      font: "var(--fai-type-body)",
      lineHeight: 1.45
    }
  }, m.text))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      background: "var(--fai-surface)",
      borderRadius: "var(--fai-radius-lg)",
      border: "1px solid var(--fai-border-subtle)",
      padding: 8
    }
  }, /*#__PURE__*/React.createElement("input", {
    value: draft,
    onChange: e => setDraft(e.target.value),
    onKeyDown: e => {
      if (e.key === "Enter") send();
    },
    placeholder: "Ask anything about your workflows...",
    style: {
      width: "100%",
      border: "none",
      outline: "none",
      background: "transparent",
      font: "var(--fai-type-body)",
      color: "var(--fai-text)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    icon: "plus",
    size: "sm",
    variant: "ghost",
    label: "Attach"
  }), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: send,
    "aria-label": "Send",
    style: {
      width: 28,
      height: 28,
      borderRadius: "var(--fai-radius-pill)",
      border: "none",
      background: "var(--fai-grey-900)",
      color: "var(--fai-text-inverse)",
      display: "grid",
      placeItems: "center",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "arrow-up",
    size: 14
  })))));
}
Object.assign(__ds_scope, { AssistantPanel });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/AssistantPanel.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Modal.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Centred dialog. Grey shell holds a branded strip, a white body card and a white footer card. */
function Modal({
  open = true,
  title,
  subtitle,
  children,
  footer,
  onClose,
  width = 460,
  style,
  ...rest
}) {
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      zIndex: 40,
      display: "grid",
      placeItems: "center",
      padding: 24,
      background: "var(--fai-scrim)",
      backdropFilter: "blur(var(--fai-scrim-blur))"
    }
  }, /*#__PURE__*/React.createElement("div", _extends({
    role: "dialog",
    "aria-modal": "true",
    style: {
      width,
      maxWidth: "100%",
      background: "var(--fai-grey-100)",
      borderRadius: "var(--fai-radius-modal)",
      padding: 7,
      boxShadow: "var(--fai-shadow-modal)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "1px 2px 7px"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Tile, {
    size: 22,
    fill: "ink"
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "workflow",
    size: 12
  })), /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    icon: "x",
    size: "sm",
    variant: "ghost",
    label: "Close",
    onClick: onClose
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--fai-surface)",
      borderRadius: "var(--fai-radius-lg)",
      padding: "16px 18px 18px"
    }
  }, title ? /*#__PURE__*/React.createElement("h2", {
    style: {
      font: "var(--fai-weight-medium) var(--fai-text-xl)/1.25 var(--fai-font-sans)",
      letterSpacing: "var(--fai-tracking-snug)"
    }
  }, title) : null, subtitle ? /*#__PURE__*/React.createElement("p", {
    style: {
      font: "var(--fai-type-body)",
      color: "var(--fai-text-muted)",
      marginTop: 4
    }
  }, subtitle) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: title ? 16 : 0,
      display: "grid",
      gap: 12
    }
  }, children)), footer ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      background: "var(--fai-surface)",
      borderRadius: "var(--fai-radius-lg)",
      padding: "12px 14px",
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 8
    }
  }, footer) : null));
}
Object.assign(__ds_scope, { Modal });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Modal.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Hairline text field. Optional label, leading icon and trailing adornment. */
function Input({
  label,
  hint,
  icon,
  trailing,
  size = "md",
  invalid,
  disabled,
  style,
  wrapperStyle,
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const h = size === "sm" ? 34 : size === "lg" ? 46 : 42;
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: "block",
      ...wrapperStyle
    }
  }, label ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: "block",
      font: "var(--fai-type-label)",
      color: "var(--fai-text)",
      marginBottom: 6
    }
  }, label) : null, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      height: h,
      padding: "0 12px",
      background: disabled ? "var(--fai-grey-50)" : "var(--fai-surface)",
      border: "1px solid " + (invalid ? "var(--fai-red-400)" : focus ? "var(--fai-grey-400)" : "var(--fai-border)"),
      borderRadius: "var(--fai-radius-control)",
      boxShadow: focus ? "0 0 0 3px var(--fai-focus-ring)" : "var(--fai-shadow-xs)",
      transition: "var(--fai-transition-control),box-shadow var(--fai-duration-fast) var(--fai-ease-standard)"
    }
  }, icon ? /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--fai-text-subtle)",
      display: "inline-flex"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 16
  })) : null, /*#__PURE__*/React.createElement("input", _extends({
    disabled: disabled,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      flex: 1,
      minWidth: 0,
      border: "none",
      outline: "none",
      background: "transparent",
      font: "var(--fai-type-body)",
      color: "var(--fai-text)",
      padding: 0,
      ...style
    }
  }, rest)), trailing), hint ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: "block",
      font: "var(--fai-type-meta)",
      color: invalid ? "var(--fai-red-600)" : "var(--fai-text-subtle)",
      marginTop: 6
    }
  }, hint) : null);
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/PasswordInput.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Password field with the eye-off reveal toggle used across FlowAI's security dialogs. */
function PasswordInput({
  label,
  hint,
  defaultValue = "",
  ...rest
}) {
  const [shown, setShown] = React.useState(false);
  return /*#__PURE__*/React.createElement(__ds_scope.Input, _extends({
    label: label,
    hint: hint,
    type: shown ? "text" : "password",
    defaultValue: defaultValue,
    trailing: /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
      variant: "ghost",
      size: "sm",
      icon: shown ? "eye" : "eye-off",
      label: shown ? "Hide password" : "Show password",
      onClick: () => setShown(v => !v),
      style: {
        marginRight: -6
      }
    })
  }, rest));
}
Object.assign(__ds_scope, { PasswordInput });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/PasswordInput.jsx", error: String((e && e.message) || e) }); }

// components/forms/SearchInput.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Table/toolbar search field. Always leads with the magnifier and an ellipsis placeholder. */
function SearchInput({
  placeholder = "Search Workflow...",
  width = 240,
  ...rest
}) {
  return /*#__PURE__*/React.createElement(__ds_scope.Input, _extends({
    icon: "search",
    size: "sm",
    placeholder: placeholder,
    wrapperStyle: {
      width
    }
  }, rest));
}
Object.assign(__ds_scope, { SearchInput });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/SearchInput.jsx", error: String((e && e.message) || e) }); }

// components/forms/SegmentedTabs.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Segmented tabs on a grey track — the page-level view switcher (Team Members / Team Details / …). */
function SegmentedTabs({
  items = [],
  value,
  defaultValue,
  onChange,
  style,
  ...rest
}) {
  const [active, setActive] = React.useState(defaultValue ?? items[0]);
  const current = value === undefined ? active : value;
  const pick = item => {
    if (value === undefined) setActive(item);
    if (onChange) onChange(item);
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    role: "tablist",
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 2,
      padding: 3,
      background: "var(--fai-surface-muted)",
      borderRadius: "var(--fai-radius-md)",
      ...style
    }
  }, rest), items.map(item => {
    const on = item === current;
    return /*#__PURE__*/React.createElement("button", {
      key: item,
      role: "tab",
      "aria-selected": on,
      onClick: () => pick(item),
      style: {
        height: 30,
        padding: "0 12px",
        border: "none",
        cursor: "pointer",
        borderRadius: "var(--fai-radius-sm)",
        font: "var(--fai-weight-medium) var(--fai-text-sm)/1 var(--fai-font-sans)",
        color: on ? "var(--fai-text)" : "var(--fai-text-muted)",
        background: on ? "var(--fai-surface)" : "transparent",
        boxShadow: on ? "var(--fai-shadow-raised)" : "none",
        transition: "var(--fai-transition-control)"
      }
    }, item);
  }));
}
Object.assign(__ds_scope, { SegmentedTabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/SegmentedTabs.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Hairline select. Full-width form select (`label`) or compact toolbar filter (`size="sm"`). */
function Select({
  label,
  options = [],
  placeholder = "Select…",
  size = "md",
  disabled,
  style,
  wrapperStyle,
  ...rest
}) {
  const h = size === "sm" ? 34 : 42;
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: size === "sm" ? "inline-block" : "block",
      ...wrapperStyle
    }
  }, label ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: "block",
      font: "var(--fai-type-label)",
      color: "var(--fai-text)",
      marginBottom: 6
    }
  }, label) : null, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      display: "flex",
      alignItems: "center",
      height: h,
      background: disabled ? "var(--fai-grey-50)" : "var(--fai-surface)",
      border: "1px solid var(--fai-border)",
      borderRadius: "var(--fai-radius-control)",
      boxShadow: "var(--fai-shadow-xs)",
      paddingRight: 32
    }
  }, /*#__PURE__*/React.createElement("select", _extends({
    disabled: disabled,
    style: {
      appearance: "none",
      WebkitAppearance: "none",
      border: "none",
      outline: "none",
      background: "transparent",
      padding: "0 0 0 12px",
      height: "100%",
      width: "100%",
      font: size === "sm" ? "var(--fai-type-label)" : "var(--fai-type-body)",
      color: "var(--fai-text)",
      cursor: disabled ? "not-allowed" : "pointer",
      ...style
    }
  }, rest), placeholder ? /*#__PURE__*/React.createElement("option", {
    value: ""
  }, placeholder) : null, options.map(o => {
    const value = typeof o === "string" ? o : o.value;
    const text = typeof o === "string" ? o : o.label;
    return /*#__PURE__*/React.createElement("option", {
      key: value,
      value: value
    }, text);
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      right: 11,
      color: "var(--fai-text-muted)",
      display: "inline-flex",
      pointerEvents: "none"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-down",
    size: 16
  }))));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Pill switch used for every on/off setting row. Near-black when on, grey-300 when off. */
function Switch({
  checked,
  defaultChecked = false,
  onChange,
  disabled,
  label,
  style,
  ...rest
}) {
  const [on, setOn] = React.useState(defaultChecked);
  const isOn = checked === undefined ? on : checked;
  const toggle = () => {
    if (disabled) return;
    if (checked === undefined) setOn(!isOn);
    if (onChange) onChange(!isOn);
  };
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    role: "switch",
    "aria-checked": isOn,
    "aria-label": label,
    onClick: toggle,
    disabled: disabled,
    style: {
      width: 40,
      height: 22,
      flex: "none",
      padding: 2,
      borderRadius: "var(--fai-radius-pill)",
      border: "none",
      background: isOn ? "var(--fai-grey-900)" : "var(--fai-grey-300)",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: isOn ? "flex-end" : "flex-start",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      transition: "background-color var(--fai-duration-base) var(--fai-ease-standard)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 18,
      height: 18,
      borderRadius: "var(--fai-radius-pill)",
      background: "var(--fai-white)",
      boxShadow: "0 1px 2px rgba(16,18,20,.2)"
    }
  }));
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/navigation/NavItem.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Sidebar nav row. Active state is a grey-50 fill, never a coloured fill or left bar. */
function NavItem({
  icon,
  label,
  badge,
  active,
  muted,
  onClick,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    onClick: onClick,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      width: "100%",
      height: 34,
      padding: "0 10px",
      border: "none",
      cursor: "pointer",
      borderRadius: "var(--fai-radius-md)",
      background: active ? "var(--fai-surface-subtle)" : hover ? "var(--fai-grey-50)" : "transparent",
      color: muted ? "var(--fai-text-subtle)" : active ? "var(--fai-text)" : "var(--fai-text-muted)",
      font: (active ? "var(--fai-weight-medium)" : "var(--fai-weight-regular)") + " var(--fai-text-base)/1 var(--fai-font-sans)",
      textAlign: "left",
      transition: "var(--fai-transition-control)",
      ...style
    }
  }, rest), icon ? /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 16,
    style: {
      opacity: muted ? .6 : 1
    }
  }) : null, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, label), badge);
}
Object.assign(__ds_scope, { NavItem });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/NavItem.jsx", error: String((e && e.message) || e) }); }

// components/navigation/PageHeader.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Page title block with a right-hand action cluster. Sits on the grey page background. */
function PageHeader({
  title,
  subtitle,
  actions,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 16,
      padding: "0 0 14px",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
    style: {
      font: "var(--fai-type-page-title)",
      letterSpacing: "var(--fai-tracking-snug)"
    }
  }, title), subtitle ? /*#__PURE__*/React.createElement("p", {
    style: {
      font: "var(--fai-type-body)",
      color: "var(--fai-text-muted)",
      marginTop: 4
    }
  }, subtitle) : null), actions ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      flex: "none"
    }
  }, actions) : null);
}
Object.assign(__ds_scope, { PageHeader });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/PageHeader.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Sidebar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Group label inside the sidebar — 12px grey-500, always with a leading glyph. */
function NavGroupLabel({
  icon = "circle-dashed",
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "0 10px",
      height: 28,
      color: "var(--fai-text-subtle)",
      font: "var(--fai-weight-regular) var(--fai-text-sm)/1 var(--fai-font-sans)"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 13
  }), children);
}

/** Fixed 260px sidebar: brand row, scrolling nav, pinned account row at the bottom. */
function Sidebar({
  children,
  footerName,
  footerEmail,
  onCollapse,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("aside", _extends({
    style: {
      width: "var(--fai-sidebar-w)",
      flex: "none",
      display: "flex",
      flexDirection: "column",
      background: "var(--fai-surface)",
      borderRight: "1px solid var(--fai-border-subtle)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      height: "var(--fai-topbar-h)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 12px 0 14px",
      borderBottom: "1px solid var(--fai-border-subtle)"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Logo, {
    size: 15
  }), /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    icon: "panel-left",
    size: "sm",
    variant: "ghost",
    label: "Collapse sidebar",
    onClick: onCollapse
  })), /*#__PURE__*/React.createElement("div", {
    className: "fai-scroll",
    style: {
      flex: 1,
      overflowY: "auto",
      padding: "10px 8px",
      display: "flex",
      flexDirection: "column",
      gap: 2
    }
  }, children), footerName ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "10px 12px",
      borderTop: "1px solid var(--fai-border-subtle)"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Avatar, {
    name: footerName,
    size: 30
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--fai-type-label)",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, footerName), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--fai-type-meta)",
      color: "var(--fai-text-subtle)",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, footerEmail)), /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "chevron-down",
    size: 14,
    style: {
      color: "var(--fai-text-subtle)"
    }
  })) : null);
}
Object.assign(__ds_scope, { NavGroupLabel, Sidebar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Sidebar.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Topbar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** App topbar: breadcrumb-style page label on the left, Ask AI + refresh on the right. */
function Topbar({
  icon = "users",
  label,
  children,
  onAskAI,
  style,
  ...rest
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("header", _extends({
    style: {
      height: "var(--fai-topbar-h)",
      flex: "none",
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "0 12px 0 16px",
      background: "var(--fai-surface)",
      borderBottom: "1px solid var(--fai-border-subtle)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      color: "var(--fai-text-muted)"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 15
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--fai-type-body)",
      color: "var(--fai-text)"
    }
  }, label)), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, children), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onAskAI,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      height: 28,
      padding: "0 10px",
      border: "1px solid var(--fai-border)",
      borderRadius: "var(--fai-radius-sm)",
      background: hover ? "var(--fai-grey-50)" : "var(--fai-surface)",
      font: "var(--fai-weight-medium) var(--fai-text-sm)/1 var(--fai-font-sans)",
      color: "var(--fai-text)",
      cursor: "pointer",
      boxShadow: "var(--fai-shadow-xs)",
      transition: "var(--fai-transition-control)"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "sparkles",
    size: 13,
    style: {
      color: "var(--fai-blue-500)"
    }
  }), "Ask AI"), /*#__PURE__*/React.createElement(__ds_scope.IconButton, {
    icon: "refresh-cw",
    size: "sm",
    variant: "ghost",
    label: "Refresh"
  }));
}
Object.assign(__ds_scope, { Topbar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Topbar.jsx", error: String((e && e.message) || e) }); }

// components/navigation/UsageQuota.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Sidebar quota card: run count, one line of copy, full-width subtle upgrade button. */
function UsageQuota({
  used = 891,
  limit = 1000,
  caption = "Upgrade for unlimited use",
  cta = "Upgrade",
  onUpgrade,
  style,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      border: "1px solid var(--fai-border-subtle)",
      borderRadius: "var(--fai-radius-lg)",
      padding: 10,
      background: "var(--fai-surface)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
    name: "zap",
    size: 14,
    style: {
      color: "var(--fai-text)"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--fai-weight-medium) var(--fai-text-base)/1 var(--fai-font-sans)"
    }
  }, used, "/", limit)), /*#__PURE__*/React.createElement("div", {
    style: {
      font: "var(--fai-type-meta)",
      color: "var(--fai-text-muted)",
      margin: "6px 0 10px"
    }
  }, caption), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "subtle",
    size: "sm",
    fullWidth: true,
    onClick: onUpgrade
  }, cta));
}
Object.assign(__ds_scope, { UsageQuota });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/UsageQuota.jsx", error: String((e && e.message) || e) }); }

// ui_kits/flowai_app/AppShell.jsx
try { (() => {
const {
  Sidebar,
  NavItem,
  NavGroupLabel,
  Topbar,
  UsageQuota,
  Badge,
  Icon,
  IconChip,
  AssistantPanel,
  SearchInput
} = window.FlowAIDesignSystem_94b032;
const NAV = [{
  group: "Workspaces",
  items: [{
    id: "dashboard",
    icon: "layout-grid",
    label: "Dashboard"
  }, {
    id: "library",
    icon: "workflow",
    label: "Workflow Library",
    badge: /*#__PURE__*/React.createElement(Badge, {
      tone: "count"
    }, "28")
  }, {
    id: "canvas",
    icon: "git-branch",
    label: "Workflow  Canvas",
    badge: /*#__PURE__*/React.createElement(Icon, {
      name: "flame",
      size: 14,
      style: {
        color: "var(--fai-orange-500)"
      }
    })
  }, {
    id: "templates",
    icon: "layers",
    label: "Templates"
  }, {
    id: "analytics",
    icon: "chart-line",
    label: "Analytics"
  }, {
    id: "team",
    icon: "users",
    label: "Team Members",
    badge: /*#__PURE__*/React.createElement(Badge, {
      tone: "success"
    }, "35+")
  }, {
    id: "integrations",
    icon: "plug",
    label: "Integrations"
  }]
}, {
  group: "Agent Managements",
  items: [{
    id: "settings",
    icon: "settings",
    label: "Settings"
  }, {
    id: "help",
    icon: "life-buoy",
    label: "Help & Support"
  }, {
    id: "appearance",
    icon: "sun",
    label: "Appearance",
    badge: /*#__PURE__*/React.createElement(Icon, {
      name: "sun",
      size: 14,
      style: {
        color: "var(--fai-text-subtle)"
      }
    })
  }]
}];
const TOPBAR = {
  dashboard: {
    icon: "layout-grid",
    label: "Dashboard"
  },
  library: {
    icon: "workflow",
    label: "Workflow Library"
  },
  team: {
    icon: "users",
    label: "Team Members"
  },
  integrations: {
    icon: "plug",
    label: "Integrations"
  },
  settings: {
    icon: "settings",
    label: "Settings"
  }
};
function AppShell({
  screen,
  onNavigate,
  children
}) {
  const [assistant, setAssistant] = React.useState(false);
  const bar = TOPBAR[screen] || TOPBAR.dashboard;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: "100vh",
      background: "var(--fai-desk)",
      padding: 26,
      boxSizing: "border-box"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      height: "calc(100vh - 52px)",
      minHeight: 700,
      overflow: "hidden",
      background: "var(--fai-surface)",
      borderRadius: "var(--fai-radius-shell)",
      boxShadow: "var(--fai-shadow-shell)"
    }
  }, /*#__PURE__*/React.createElement(Sidebar, {
    footerName: "Tanjim Islam",
    footerEmail: "tanjim@gr8rstudio.com"
  }, NAV.map(section => /*#__PURE__*/React.createElement(React.Fragment, {
    key: section.group
  }, /*#__PURE__*/React.createElement(NavGroupLabel, null, section.group), section.items.map(it => /*#__PURE__*/React.createElement(NavItem, {
    key: it.id,
    icon: it.icon,
    label: it.label,
    badge: it.badge,
    active: screen === it.id,
    onClick: () => onNavigate(it.id)
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      paddingRight: 2
    }
  }, /*#__PURE__*/React.createElement(NavGroupLabel, null, "Workflow  Runs"), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 24,
      height: 24,
      display: "grid",
      placeItems: "center",
      border: "1px solid var(--fai-border)",
      borderRadius: "var(--fai-radius-sm)",
      color: "var(--fai-text-muted)"
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "plus",
    size: 13
  }))), window.RECENT_RUNS.map(r => /*#__PURE__*/React.createElement("div", {
    key: r.name,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      height: 32,
      padding: "0 10px",
      color: "var(--fai-text-muted)",
      font: "var(--fai-type-body)"
    }
  }, /*#__PURE__*/React.createElement(IconChip, {
    icon: r.icon,
    hue: r.hue,
    fill: "solid",
    size: 18
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, r.name), /*#__PURE__*/React.createElement(Icon, {
    name: "star",
    size: 14,
    style: {
      color: "var(--fai-grey-400)"
    }
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement(UsageQuota, null))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      minWidth: 0,
      background: "var(--fai-app-bg)"
    }
  }, /*#__PURE__*/React.createElement(Topbar, {
    icon: bar.icon,
    label: bar.label,
    onAskAI: () => setAssistant(v => !v)
  }, screen === "dashboard" ? /*#__PURE__*/React.createElement(SearchInput, {
    placeholder: "Search for something...",
    width: 320
  }) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      position: "relative",
      minHeight: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "fai-scroll",
    style: {
      position: "absolute",
      inset: 0,
      overflowY: "auto",
      padding: "var(--fai-page-pad-y) var(--fai-page-pad-x) 28px"
    }
  }, children), assistant ? /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 12,
      right: 16,
      bottom: 12,
      display: "flex",
      alignItems: "flex-start"
    }
  }, /*#__PURE__*/React.createElement(AssistantPanel, {
    width: 352,
    onClose: () => setAssistant(false),
    suggestions: [{
      icon: "workflow",
      label: "Build a Workflow"
    }, {
      icon: "plug",
      label: "Explore Integrations"
    }, {
      icon: "gauge",
      label: "Optimize Performance"
    }]
  })) : null))));
}
Object.assign(window, {
  AppShell
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/flowai_app/AppShell.jsx", error: String((e && e.message) || e) }); }

// ui_kits/flowai_app/DashboardScreen.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  StatCard,
  SectionCard,
  DataTable,
  Badge,
  IconChip,
  TemplateCard,
  Button,
  Select,
  CombRule
} = window.FlowAIDesignSystem_94b032;
function successColor(v) {
  return v >= 90 ? "var(--fai-metric-up)" : v >= 60 ? "var(--fai-metric-warn)" : "var(--fai-metric-down)";
}
function workflowNameCell(r) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(IconChip, {
    icon: r.icon,
    hue: r.hue,
    fill: "solid",
    size: 18
  }), r.name);
}
const STATUS_LABEL = {
  active: "Active",
  paused: "Paused",
  draft: "Draft",
  expired: "Expire"
};
function DashboardScreen() {
  const cols = [{
    header: "Workflow Name",
    render: workflowNameCell
  }, {
    key: "trigger",
    header: "Trigger",
    muted: true
  }, {
    key: "runs",
    header: "Total Runs"
  }, {
    header: "Success",
    render: r => /*#__PURE__*/React.createElement("span", {
      style: {
        color: successColor(r.success)
      }
    }, r.success, "%")
  }, {
    header: "Last Run",
    muted: true,
    render: r => /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        color: "var(--fai-text-muted)"
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "fai-icon",
      style: {
        "--fai-icon-url": "url(https://unpkg.com/lucide-static@0.469.0/icons/clock.svg)",
        width: 14,
        height: 14
      }
    }), r.last)
  }];
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      font: "var(--fai-weight-medium) var(--fai-text-2xl)/1.2 var(--fai-font-sans)",
      letterSpacing: "var(--fai-tracking-snug)"
    }
  }, "Welcome Back, Jane!"), /*#__PURE__*/React.createElement("p", {
    style: {
      font: "var(--fai-type-body)",
      color: "var(--fai-text-muted)",
      marginTop: 5
    }
  }, "Automate tasks using AI in minutes. No code required.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3,1fr)",
      gap: "var(--fai-gap-card)"
    }
  }, /*#__PURE__*/React.createElement(StatCard, {
    icon: "activity",
    label: "Total Runs",
    value: "12,847",
    delta: "+12% from last week"
  }), /*#__PURE__*/React.createElement(StatCard, {
    icon: "circle-check",
    label: "Success Rate",
    value: "98.2%",
    delta: "+0.4% from last week"
  }), /*#__PURE__*/React.createElement(StatCard, {
    icon: "workflow",
    label: "Active Workflows",
    value: "23+",
    delta: "+3 from last week"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "var(--fai-gap-card)"
    }
  }, /*#__PURE__*/React.createElement(SectionCard, {
    title: "Active Workflows",
    comb: false,
    padding: 0,
    bodyStyle: {
      padding: "12px 12px 0"
    }
  }, /*#__PURE__*/React.createElement(DataTable, {
    columns: cols,
    rows: window.WORKFLOWS.slice(0, 6)
  }), /*#__PURE__*/React.createElement(CombRule, {
    style: {
      margin: "6px 12px 12px"
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "var(--fai-gap-card)"
    }
  }, /*#__PURE__*/React.createElement(SectionCard, {
    title: "Recent  Using Templates",
    comb: false,
    action: /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      size: "sm",
      iconRight: "arrow-right"
    }, "View all")
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(4,1fr)",
      gap: "var(--fai-gap-card)"
    }
  }, window.TEMPLATES.map(t => /*#__PURE__*/React.createElement(TemplateCard, _extends({
    key: t.title
  }, t)))))));
}
Object.assign(window, {
  DashboardScreen,
  successColor,
  workflowNameCell,
  STATUS_LABEL
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/flowai_app/DashboardScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/flowai_app/IntegrationsScreen.jsx
try { (() => {
const {
  PageHeader,
  Button,
  StatCard,
  SectionCard,
  ListRow,
  IconChip,
  Badge,
  Alert,
  SegmentedTabs,
  IconButton,
  Icon,
  CombRule
} = window.FlowAIDesignSystem_94b032;
function IntegrationsScreen() {
  const [tab, setTab] = React.useState("API Keys  04");
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Integrations",
    subtitle: "Connect FlowForge to your tools and automate workflows.",
    actions: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      icon: "calendar"
    }, "27 April, 2026"), /*#__PURE__*/React.createElement(Button, {
      icon: "plus"
    }, "Connect Integration"))
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--fai-grey-25)",
      border: "1px solid var(--fai-border-subtle)",
      borderRadius: "var(--fai-radius-card)",
      padding: 12,
      boxShadow: "var(--fai-shadow-card)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(SegmentedTabs, {
    items: ["Connected  25", "Marketplace  300+", "API Keys  04", "Usage & Limits"],
    value: tab,
    onChange: setTab
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "sm",
    icon: "plus"
  }, "Generate API Key")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(4,1fr)",
      gap: 10,
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement(StatCard, {
    icon: "key",
    label: "Total Keys",
    value: "04"
  }), /*#__PURE__*/React.createElement(StatCard, {
    icon: "circle-check",
    label: "Active Keys",
    value: "03"
  }), /*#__PURE__*/React.createElement(StatCard, {
    icon: "ban",
    label: "Revoked keys",
    value: "01"
  }), /*#__PURE__*/React.createElement(StatCard, {
    icon: "shield",
    label: "IP- restricted",
    value: "02"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement(SectionCard, {
    title: "Integrations API Key",
    icon: "circle-dot",
    action: /*#__PURE__*/React.createElement(IconButton, {
      icon: "ellipsis",
      size: "sm",
      variant: "ghost",
      label: "More"
    })
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 8
    }
  }, window.API_KEYS.map(k => /*#__PURE__*/React.createElement(ListRow, {
    key: k.name,
    leading: /*#__PURE__*/React.createElement(IconChip, {
      icon: k.icon,
      hue: k.hue,
      size: 32
    }),
    title: k.name,
    subtitle: k.meta,
    trailing: /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(Badge, {
      tone: k.envTone
    }, k.env), k.age === "Revoked" ? /*#__PURE__*/React.createElement(Badge, {
      tone: "draft",
      icon: "ban"
    }, "Revoked") : /*#__PURE__*/React.createElement(Badge, {
      tone: "paused",
      icon: "triangle-alert"
    }, k.age), /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 8px",
        border: "1px solid var(--fai-border-subtle)",
        borderRadius: "var(--fai-radius-sm)",
        background: "var(--fai-surface)",
        font: "var(--fai-weight-regular) var(--fai-text-xs)/1 var(--fai-font-mono)",
        color: "var(--fai-text-muted)"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "key",
      size: 11
    }), k.key), /*#__PURE__*/React.createElement(IconButton, {
      icon: "copy",
      size: "sm",
      label: "Copy key"
    }), /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      icon: "rotate-cw"
    }, "Rotate"), k.revocable ? /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "danger",
      icon: "ban"
    }, "Revoke") : null)
  }))))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement(Alert, {
    tone: "warning",
    title: "Security Reminder",
    action: /*#__PURE__*/React.createElement(Button, {
      variant: "warning",
      size: "sm",
      icon: "rotate-cw"
    }, "Rotate Now")
  }, "Never expose API keys in client-side code or public repositories. Rotate keys every 90 days.")), /*#__PURE__*/React.createElement(CombRule, {
    style: {
      marginTop: 12
    }
  })));
}
Object.assign(window, {
  IntegrationsScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/flowai_app/IntegrationsScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/flowai_app/SettingsScreen.jsx
try { (() => {
const {
  PageHeader,
  Button,
  SectionCard,
  ListRow,
  IconChip,
  Badge,
  Alert,
  SegmentedTabs,
  Switch,
  Modal,
  Input,
  PasswordInput,
  Select,
  Icon,
  CombRule
} = window.FlowAIDesignSystem_94b032;
const SECURITY_TOGGLES = [{
  icon: "smartphone",
  title: "Authenticator App (TOTP)",
  meta: "Use an app like Authy or 1Password to generate codes",
  on: true
}, {
  icon: "message-square",
  title: "SMS Backup",
  meta: "Receive a code via SMS as a backup method",
  on: false
}, {
  icon: "bell",
  title: "Login Alerts",
  meta: "Get notified by email when a new device signs in",
  on: true
}];
const DANGER_ROWS = [{
  icon: "download",
  hue: "grey",
  title: "Export Workspace Data",
  meta: "Download every workflow, run log and integration record.",
  cta: "Request export",
  variant: "secondary"
}, {
  icon: "user-round-cog",
  hue: "amber",
  title: "Transfer Ownership",
  meta: "Hand the workspace to another admin. You keep Admin access.",
  cta: "Transfer Ownership",
  variant: "secondary",
  action: "transfer"
}, {
  icon: "user-round-minus",
  hue: "orange",
  title: "Remove All Members",
  meta: "Revoke access for all 35 members. Workflows are kept.",
  cta: "Remove All Members",
  variant: "secondary"
}, {
  icon: "trash-2",
  hue: "red",
  title: "Delete Workspace",
  meta: "Permanently delete all workflows, members, integrations and data. This cannot be undone.",
  cta: "Delete Workspace",
  variant: "danger"
}];
function SettingsScreen() {
  const [tab, setTab] = React.useState("Password & Security");
  const [dialog, setDialog] = React.useState(null);
  const danger = tab === "Danger Zone";
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Settings",
    subtitle: "Manage workspace preferences, display, and localization settings."
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--fai-grey-25)",
      border: "1px solid var(--fai-border-subtle)",
      borderRadius: "var(--fai-radius-card)",
      padding: 12,
      boxShadow: "var(--fai-shadow-card)"
    }
  }, /*#__PURE__*/React.createElement(SegmentedTabs, {
    items: ["General Settings", "Profile Settings", "Password & Security", "Notifications", "Billing", "Danger Zone"],
    value: tab,
    onChange: setTab
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      maxWidth: 720
    }
  }, danger ? /*#__PURE__*/React.createElement(SectionCard, {
    title: "Danger Zone",
    icon: "triangle-alert",
    style: {
      borderColor: "#fbcaca"
    }
  }, /*#__PURE__*/React.createElement(Alert, {
    tone: "danger"
  }, "These actions are irreversible. Please read carefully before proceeding \u2014 type-to-confirm is required for workspace deletion."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 8,
      marginTop: 10
    }
  }, DANGER_ROWS.map(r => /*#__PURE__*/React.createElement(ListRow, {
    key: r.title,
    leading: /*#__PURE__*/React.createElement(IconChip, {
      icon: r.icon,
      hue: r.hue,
      size: 30
    }),
    title: r.title,
    subtitle: r.meta,
    trailing: /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: r.variant,
      onClick: () => r.action && setDialog(r.action)
    }, r.cta)
  })))) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(SectionCard, {
    title: "Password & Security",
    icon: "shield"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(ListRow, {
    leading: /*#__PURE__*/React.createElement(IconChip, {
      icon: "mail",
      hue: "grey",
      size: 30
    }),
    title: "Email Address",
    subtitle: "tanjim@gr8rstudio.com \u2014 verified",
    trailing: /*#__PURE__*/React.createElement(Button, {
      size: "sm"
    }, "Change Email")
  }), /*#__PURE__*/React.createElement(ListRow, {
    leading: /*#__PURE__*/React.createElement(IconChip, {
      icon: "lock",
      hue: "grey",
      size: 30
    }),
    title: "Password",
    subtitle: "Last changed 4 months ago",
    trailing: /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      onClick: () => setDialog("password")
    }, "Change Password")
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement(SectionCard, {
    title: "Two-Factor Authentication",
    icon: "key-round"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 8
    }
  }, SECURITY_TOGGLES.map(t => /*#__PURE__*/React.createElement(ListRow, {
    key: t.title,
    leading: /*#__PURE__*/React.createElement(IconChip, {
      icon: t.icon,
      hue: "grey",
      size: 30
    }),
    title: t.title,
    subtitle: t.meta,
    trailing: /*#__PURE__*/React.createElement(Switch, {
      defaultChecked: t.on,
      label: t.title
    })
  }))))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement(SectionCard, {
    title: "Active Sessions",
    icon: "monitor"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(ListRow, {
    leading: /*#__PURE__*/React.createElement(IconChip, {
      icon: "monitor",
      hue: "green",
      size: 30
    }),
    title: "MacBook Pro \xB7 Dhaka, BD",
    subtitle: "Chrome 141 \xB7 Current session",
    trailing: /*#__PURE__*/React.createElement(Badge, {
      tone: "active"
    }, "Active")
  }), /*#__PURE__*/React.createElement(ListRow, {
    leading: /*#__PURE__*/React.createElement(IconChip, {
      icon: "smartphone",
      hue: "grey",
      size: 30
    }),
    title: "iPhone 15 \xB7 Dhaka, BD",
    subtitle: "FlowAI iOS \xB7 Last active 3hr ago",
    trailing: /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "danger",
      icon: "log-out"
    }, "Revoke")
  })))))), /*#__PURE__*/React.createElement(CombRule, {
    style: {
      marginTop: 12
    }
  })), /*#__PURE__*/React.createElement(Modal, {
    open: dialog === "password",
    title: "Change Password",
    subtitle: "Update your password to keep your account secure.",
    onClose: () => setDialog(null),
    footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      onClick: () => setDialog(null)
    }, "Cancle"), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      onClick: () => setDialog(null)
    }, "Update password"))
  }, /*#__PURE__*/React.createElement(PasswordInput, {
    label: "Current password",
    defaultValue: "password"
  }), /*#__PURE__*/React.createElement(PasswordInput, {
    label: "New Password",
    defaultValue: "password"
  }), /*#__PURE__*/React.createElement(PasswordInput, {
    label: "Confirm new Password",
    defaultValue: "password"
  })), /*#__PURE__*/React.createElement(Modal, {
    open: dialog === "transfer",
    title: "Transfer Ownership",
    subtitle: "Transfer full ownership to another workspace admin",
    onClose: () => setDialog(null),
    footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      onClick: () => setDialog(null)
    }, "Cancle"), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      onClick: () => setDialog(null)
    }, "Transfer Ownership"))
  }, /*#__PURE__*/React.createElement(Select, {
    label: "Transfer to",
    placeholder: "Select an Admin...",
    options: ["Oliver Remington", "Edward Kensington", "Benjamin Calloway"]
  }), /*#__PURE__*/React.createElement(PasswordInput, {
    label: "Your password",
    defaultValue: "password"
  }), /*#__PURE__*/React.createElement(Alert, {
    tone: "warning"
  }, "You will become an Admin after this transfer. You cannot undo this without the new owner's permission.")));
}
Object.assign(window, {
  SettingsScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/flowai_app/SettingsScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/flowai_app/TeamMembersScreen.jsx
try { (() => {
const {
  PageHeader,
  Button,
  StatCard,
  SectionCard,
  ListRow,
  StatusDot,
  IconChip,
  Badge,
  Avatar,
  Meter,
  DataTable,
  SegmentedTabs,
  Select,
  Icon,
  CombRule,
  IconButton
} = window.FlowAIDesignSystem_94b032;
function TeamMembersScreen() {
  const [tab, setTab] = React.useState("Team Details");
  const cols = [{
    key: "no",
    header: "No",
    muted: true
  }, {
    header: "Workflow Name",
    render: window.workflowNameCell
  }, {
    key: "trigger",
    header: "Trigger",
    muted: true
  }, {
    key: "runs",
    header: "Runs"
  }, {
    header: "Workflow",
    render: r => /*#__PURE__*/React.createElement("span", {
      style: {
        color: window.successColor(r.success)
      }
    }, r.success, "%")
  }, {
    header: "Creator",
    render: r => /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(Avatar, {
      name: r.creator,
      size: 22
    }), r.creator)
  }, {
    header: "Action",
    align: "right",
    render: () => /*#__PURE__*/React.createElement(Icon, {
      name: "upload",
      size: 14,
      style: {
        color: "var(--fai-text-subtle)"
      }
    })
  }];
  const rows = window.WORKFLOWS.slice(0, 5).map((r, i) => ({
    ...r,
    creator: window.CONTRIBUTORS[i % 4].name
  }));
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Team Members",
    subtitle: "Manage who has access to your workspace.",
    actions: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      icon: "calendar"
    }, "27 April, 2026"), /*#__PURE__*/React.createElement(Button, {
      icon: "settings"
    }, "Team Settings"), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      icon: "plus"
    }, "Invite Member"))
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--fai-grey-25)",
      border: "1px solid var(--fai-border-subtle)",
      borderRadius: "var(--fai-radius-card)",
      padding: 12,
      boxShadow: "var(--fai-shadow-card)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(SegmentedTabs, {
    items: ["Team Members", "Team Details", "Activity Log"],
    value: tab,
    onChange: setTab
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "sm",
    icon: "upload"
  }, "Export CSV")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(5,1fr)",
      gap: 10,
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement(StatCard, {
    icon: "users",
    label: "Total Members",
    value: "35"
  }), /*#__PURE__*/React.createElement(StatCard, {
    icon: "workflow",
    label: "Workflows Built",
    value: "213"
  }), /*#__PURE__*/React.createElement(StatCard, {
    icon: "sparkles",
    label: "AI Runs Today",
    value: "4,210"
  }), /*#__PURE__*/React.createElement(StatCard, {
    icon: "circle-check",
    label: "Success Rate",
    value: "98.6%"
  }), /*#__PURE__*/React.createElement(StatCard, {
    icon: "wallet",
    label: "AI Cost / Month",
    value: "$94.40"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr",
      gap: 10,
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement(SectionCard, {
    title: "Member Status",
    icon: "circle-dot",
    action: /*#__PURE__*/React.createElement(IconButton, {
      icon: "ellipsis",
      size: "sm",
      variant: "ghost",
      label: "More"
    })
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 8
    }
  }, window.MEMBER_STATUS.map(m => /*#__PURE__*/React.createElement(ListRow, {
    key: m.label,
    leading: /*#__PURE__*/React.createElement(StatusDot, {
      tone: m.tone
    }),
    count: m.count,
    title: m.label,
    trailing: /*#__PURE__*/React.createElement("span", {
      style: {
        font: "var(--fai-type-meta)",
        color: "var(--fai-text-subtle)"
      }
    }, m.pct)
  })))), /*#__PURE__*/React.createElement(SectionCard, {
    title: "Role Distributions",
    icon: "circle-dot",
    action: /*#__PURE__*/React.createElement(IconButton, {
      icon: "ellipsis",
      size: "sm",
      variant: "ghost",
      label: "More"
    })
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 8
    }
  }, window.ROLES.map(r => /*#__PURE__*/React.createElement(ListRow, {
    key: r.label,
    leading: /*#__PURE__*/React.createElement(IconChip, {
      icon: r.icon,
      hue: r.hue,
      size: 26
    }),
    count: r.count,
    title: r.label,
    trailing: /*#__PURE__*/React.createElement("span", {
      style: {
        font: "var(--fai-type-meta)",
        color: "var(--fai-text-subtle)"
      }
    }, r.pct)
  })))), /*#__PURE__*/React.createElement(SectionCard, {
    title: "Seat Usage",
    icon: "circle-dot",
    action: /*#__PURE__*/React.createElement("span", {
      style: {
        font: "var(--fai-weight-medium) var(--fai-text-xs)/1 var(--fai-font-sans)",
        color: "var(--fai-text-subtle)",
        whiteSpace: "nowrap"
      }
    }, "Pro Plant")
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--fai-surface-subtle)",
      border: "1px solid var(--fai-border-subtle)",
      borderRadius: "var(--fai-radius-row)",
      padding: 12
    }
  }, /*#__PURE__*/React.createElement(IconChip, {
    icon: "armchair",
    hue: "grey",
    size: 24,
    style: {
      color: "var(--fai-grey-900)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: 6,
      margin: "8px 0 10px"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--fai-type-metric)"
    }
  }, "35/50"), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--fai-type-body)",
      color: "var(--fai-text-muted)"
    }
  }, "of Seats"), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--fai-type-meta)",
      color: "var(--fai-text-muted)"
    }
  }, "70%")), /*#__PURE__*/React.createElement(Meter, {
    value: 35,
    max: 50,
    bars: 44,
    height: 24
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: "var(--fai-type-meta)",
      color: "var(--fai-text-subtle)"
    }
  }, "15 seats remaining"), /*#__PURE__*/React.createElement(Badge, {
    tone: "paused"
  }, "Renewd May 1, 2026"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    icon: "plus"
  }, "Invite"), /*#__PURE__*/React.createElement(Button, {
    size: "sm",
    variant: "primary",
    fullWidth: true
  }, "Upgrade Plan")))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1.75fr 1fr",
      gap: 10,
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement(SectionCard, {
    title: "Top Workflows by Activity",
    comb: false,
    padding: 12,
    action: /*#__PURE__*/React.createElement(Select, {
      size: "sm",
      placeholder: "This Month",
      options: ["This Month", "Last Month"]
    }),
    bodyStyle: {
      padding: "12px 12px 12px"
    }
  }, /*#__PURE__*/React.createElement(DataTable, {
    columns: cols,
    rows: rows
  })), /*#__PURE__*/React.createElement(SectionCard, {
    title: "Top Contributors",
    comb: false,
    padding: 12,
    action: /*#__PURE__*/React.createElement(Select, {
      size: "sm",
      placeholder: "This Month",
      options: ["This Month", "Last Month"]
    })
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 8
    }
  }, window.CONTRIBUTORS.map(c => /*#__PURE__*/React.createElement(ListRow, {
    key: c.name,
    leading: /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 6
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "trophy",
      size: 14,
      style: {
        color: "var(--fai-amber-500)"
      }
    }), /*#__PURE__*/React.createElement(Avatar, {
      name: c.name,
      size: 26
    })),
    title: c.name,
    subtitle: c.role,
    trailing: /*#__PURE__*/React.createElement(Badge, {
      tone: "paused",
      icon: "zap"
    }, c.runs)
  }))))), /*#__PURE__*/React.createElement(CombRule, {
    style: {
      marginTop: 12
    }
  })));
}
Object.assign(window, {
  TeamMembersScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/flowai_app/TeamMembersScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/flowai_app/WorkflowLibraryScreen.jsx
try { (() => {
const {
  PageHeader,
  Button,
  StatCard,
  SectionCard,
  DataTable,
  Pagination,
  Badge,
  SearchInput,
  Select,
  Icon,
  CombRule
} = window.FlowAIDesignSystem_94b032;
function WorkflowLibraryScreen() {
  const [page, setPage] = React.useState(1);
  const [query, setQuery] = React.useState("");
  const rows = window.WORKFLOWS.filter(r => r.name.toLowerCase().includes(query.toLowerCase()));
  const cols = [{
    header: "Workflow Name",
    render: window.workflowNameCell
  }, {
    key: "trigger",
    header: "Trigger",
    muted: true
  }, {
    key: "runs",
    header: "Total Runs"
  }, {
    header: "Success",
    render: r => /*#__PURE__*/React.createElement("span", {
      style: {
        color: window.successColor(r.success)
      }
    }, r.success, "%")
  }, {
    header: "Last Run",
    render: r => /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        color: "var(--fai-text-muted)"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "clock",
      size: 14
    }), r.last)
  }, {
    header: "Status",
    render: r => /*#__PURE__*/React.createElement(Badge, {
      tone: r.status
    }, window.STATUS_LABEL[r.status])
  }, {
    header: "Action",
    align: "right",
    render: () => /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        justifyContent: "flex-end"
      }
    }, /*#__PURE__*/React.createElement("a", {
      href: "#view",
      style: {
        color: "var(--fai-text)",
        font: "var(--fai-type-body)",
        textDecoration: "none"
      }
    }, "View"), /*#__PURE__*/React.createElement("a", {
      href: "#edit",
      style: {
        color: "var(--fai-text)",
        font: "var(--fai-type-body)",
        textDecoration: "none"
      }
    }, "Edit"), /*#__PURE__*/React.createElement(Icon, {
      name: "ellipsis",
      size: 14,
      style: {
        color: "var(--fai-text-subtle)"
      }
    }))
  }];
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Workflow Library",
    subtitle: "Automate tasks using AI in minutes. No code required.",
    actions: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      icon: "calendar"
    }, "27 April, 2026"), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      icon: "plus"
    }, "Created Workflow"))
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(4,1fr)",
      gap: "var(--fai-gap-card)"
    }
  }, /*#__PURE__*/React.createElement(StatCard, {
    icon: "workflow",
    label: "Total Workflow",
    value: "28"
  }), /*#__PURE__*/React.createElement(StatCard, {
    icon: "circle-check",
    label: "Success Rate",
    value: "98.2%"
  }), /*#__PURE__*/React.createElement(StatCard, {
    icon: "zap",
    label: "Active Workflows",
    value: "08"
  }), /*#__PURE__*/React.createElement(StatCard, {
    icon: "sparkles",
    label: "AI Tokens",
    value: "842K"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "var(--fai-gap-card)"
    }
  }, /*#__PURE__*/React.createElement(SectionCard, {
    comb: false,
    padding: 0,
    bodyStyle: {
      padding: "0 12px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: 12
    }
  }, /*#__PURE__*/React.createElement(SearchInput, {
    value: query,
    onChange: e => setQuery(e.target.value)
  }), /*#__PURE__*/React.createElement(Select, {
    size: "sm",
    placeholder: "All Workflows",
    options: ["All Workflows", "Webhook", "Schedule", "Manual"]
  }), /*#__PURE__*/React.createElement(Select, {
    size: "sm",
    placeholder: "All Status",
    options: ["All Status", "Active", "Paused", "Draft"]
  }), /*#__PURE__*/React.createElement(Select, {
    size: "sm",
    placeholder: "Last Modified",
    options: ["Last Modified", "Most Runs", "Success Rate"]
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    size: "sm",
    icon: "upload"
  }, "Export CSV")), /*#__PURE__*/React.createElement(DataTable, {
    columns: cols,
    rows: rows,
    footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
      style: {
        font: "var(--fai-type-body)",
        color: "var(--fai-text-muted)"
      }
    }, "Showing ", rows.length, " of 28"), /*#__PURE__*/React.createElement(Pagination, {
      page: page,
      pageCount: 10,
      onChange: setPage
    }))
  }), /*#__PURE__*/React.createElement(CombRule, {
    style: {
      margin: "10px 12px 12px"
    }
  }))));
}
Object.assign(window, {
  WorkflowLibraryScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/flowai_app/WorkflowLibraryScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/flowai_app/data.jsx
try { (() => {
const WORKFLOWS = [{
  no: "001",
  name: "Email Support Router",
  icon: "mail",
  hue: "red",
  trigger: "Webhook",
  runs: "12,847",
  success: 98.2,
  last: "2 min ago",
  status: "paused"
}, {
  no: "002",
  name: "Lead Scoring Pipeline",
  icon: "target",
  hue: "amber",
  trigger: "Schedule",
  runs: "12,569",
  success: 96.4,
  last: "15 min ago",
  status: "active"
}, {
  no: "003",
  name: "Slack Digest Repoart",
  icon: "hash",
  hue: "cyan",
  trigger: "Schedule",
  runs: "11,846",
  success: 91.6,
  last: "30 min ago",
  status: "paused"
}, {
  no: "004",
  name: "Weekly Report Generator",
  icon: "file-text",
  hue: "amber",
  trigger: "Webhook",
  runs: "10,848",
  success: 70.5,
  last: "2hr ago",
  status: "active"
}, {
  no: "005",
  name: "Twitter Brand Monitor",
  icon: "at-sign",
  hue: "green",
  trigger: "Schedule",
  runs: "10,560",
  success: 88.3,
  last: "3hr ago",
  status: "draft"
}, {
  no: "006",
  name: "Invoice Extraction",
  icon: "receipt",
  hue: "violet",
  trigger: "Manual",
  runs: "10,247",
  success: 98.2,
  last: "8hr ago",
  status: "active"
}, {
  no: "007",
  name: "Onboarding Email Drip",
  icon: "send",
  hue: "green",
  trigger: "Schedule",
  runs: "9,847",
  success: 56.4,
  last: "Yesterday",
  status: "paused"
}, {
  no: "008",
  name: "HubSpot Sync Workflow",
  icon: "refresh-cw",
  hue: "amber",
  trigger: "Webhook",
  runs: "6,880",
  success: 98.2,
  last: "Yesterday",
  status: "active"
}, {
  no: "009",
  name: "Slack Digest Summery",
  icon: "hash",
  hue: "cyan",
  trigger: "Manual",
  runs: "2,223",
  success: 30.2,
  last: "2 days ago",
  status: "expired"
}, {
  no: "010",
  name: "Notion Contact Sync",
  icon: "book",
  hue: "violet",
  trigger: "Manual",
  runs: "12,756",
  success: 92.4,
  last: "3 days ago",
  status: "draft"
}, {
  no: "011",
  name: "Client Meeting Update",
  icon: "calendar",
  hue: "red",
  trigger: "Schedule",
  runs: "5,623",
  success: 99.1,
  last: "4 days ago",
  status: "active"
}, {
  no: "012",
  name: "Weekly Support Router",
  icon: "life-buoy",
  hue: "orange",
  trigger: "Schedule",
  runs: "4,848",
  success: 68.7,
  last: "1 week ago",
  status: "active"
}];
const MEMBER_STATUS = [{
  tone: "online",
  count: "15",
  label: "Active now",
  pct: "23%"
}, {
  tone: "away",
  count: "02",
  label: "Away",
  pct: "6%"
}, {
  tone: "offline",
  count: "18",
  label: "Offline",
  pct: "6%"
}, {
  tone: "pending",
  count: "08",
  label: "Pending Invite",
  pct: "49%"
}];
const ROLES = [{
  icon: "crown",
  hue: "red",
  count: "01",
  label: "Owner",
  pct: "3%"
}, {
  icon: "shield",
  hue: "amber",
  count: "05",
  label: "Admin",
  pct: "14%"
}, {
  icon: "pencil",
  hue: "green",
  count: "13",
  label: "Editor",
  pct: "37%"
}, {
  icon: "eye",
  hue: "amber",
  count: "12",
  label: "Viewer",
  pct: "34%"
}, {
  icon: "receipt",
  hue: "cyan",
  count: "02",
  label: "Billing",
  pct: "6%"
}, {
  icon: "terminal",
  hue: "violet",
  count: "02",
  label: "Devops",
  pct: "6%"
}];
const CONTRIBUTORS = [{
  name: "William Prescott",
  role: "Engineering · Admin",
  runs: "25"
}, {
  name: "Edward Kensington",
  role: "Engineering · Editor",
  runs: "24"
}, {
  name: "Oliver Remington",
  role: "Marketing · Editor",
  runs: "19"
}, {
  name: "Benjamin Calloway",
  role: "Engineering · Devops",
  runs: "11"
}];
const API_KEYS = [{
  name: "Production Key",
  icon: "key",
  hue: "red",
  meta: "Created Jan 15, 2026 · Last used 2 min ago · 38,210 calls/mo",
  env: "Production",
  envTone: "expired",
  age: "1728 old",
  key: "fl_live_••••••••••••••••x8Yp",
  revocable: true
}, {
  name: "Development Key",
  icon: "wrench",
  hue: "green",
  meta: "Created Feb 3, 2025 · Last used 1 day ago · 100PZ calls/mo",
  env: "Development",
  envTone: "active",
  age: "846 old",
  key: "fl_test_••••••••••••••••mQz7",
  revocable: true
}, {
  name: "CI/CD Pipeline",
  icon: "git-branch",
  hue: "amber",
  meta: "Created Mar 10, 2026 · Last used 2 fin ago · 8442 call/mo",
  env: "Staging",
  envTone: "paused",
  age: "474 old",
  key: "fl_stg_••••••••••••••••pkdr",
  revocable: true
}, {
  name: "Legacy Integration",
  icon: "archive",
  hue: "grey",
  meta: "Created Dec 1, 2025 · Last used 1 month ago · calm",
  env: "Production",
  envTone: "expired",
  age: "Revoked",
  key: "fl_live_••••••••••••••••e1k",
  revocable: false
}];
const TEMPLATES = [{
  title: "Email Support Router",
  meta: "Used 2 hours ago  ·  Webhook",
  runs: "1,204 runs",
  integrations: [{
    icon: "mail",
    hue: "red"
  }, {
    icon: "send",
    hue: "cyan"
  }, {
    icon: "hash",
    hue: "green"
  }]
}, {
  title: "Lead Scoring Pipeline",
  meta: "Used 4 hours ago  ·  Manual",
  runs: "1,204 runs",
  integrations: [{
    icon: "target",
    hue: "amber"
  }, {
    icon: "database",
    hue: "violet"
  }, {
    icon: "at-sign",
    hue: "green"
  }]
}, {
  title: "Sales Dashboard Report",
  meta: "Used Yesterday  ·  Webhook",
  runs: "1,204 runs",
  integrations: [{
    icon: "chart-line",
    hue: "cyan"
  }, {
    icon: "table",
    hue: "red"
  }, {
    icon: "file-text",
    hue: "amber"
  }]
}, {
  title: "Notion Contact Sync",
  meta: "Used Yesterday  ·  Schedule",
  runs: "1,204 runs",
  integrations: [{
    icon: "book",
    hue: "violet"
  }, {
    icon: "refresh-cw",
    hue: "green"
  }, {
    icon: "users",
    hue: "cyan"
  }]
}];
const RECENT_RUNS = [{
  name: "Email support router wor...",
  icon: "mail",
  hue: "red"
}, {
  name: "Lead scoring pipeline Wo...",
  icon: "target",
  hue: "amber"
}, {
  name: "Weekly report gen workfl...",
  icon: "file-text",
  hue: "cyan"
}, {
  name: "HubSpot sync workflow",
  icon: "refresh-cw",
  hue: "orange"
}];
Object.assign(window, {
  WORKFLOWS,
  MEMBER_STATUS,
  ROLES,
  CONTRIBUTORS,
  API_KEYS,
  TEMPLATES,
  RECENT_RUNS
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/flowai_app/data.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.CombRule = __ds_scope.CombRule;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Tile = __ds_scope.Tile;

__ds_ns.IconChip = __ds_scope.IconChip;

__ds_ns.Logo = __ds_scope.Logo;

__ds_ns.Meter = __ds_scope.Meter;

__ds_ns.DataTable = __ds_scope.DataTable;

__ds_ns.ListRow = __ds_scope.ListRow;

__ds_ns.StatusDot = __ds_scope.StatusDot;

__ds_ns.Pagination = __ds_scope.Pagination;

__ds_ns.SectionCard = __ds_scope.SectionCard;

__ds_ns.StatCard = __ds_scope.StatCard;

__ds_ns.TemplateCard = __ds_scope.TemplateCard;

__ds_ns.Alert = __ds_scope.Alert;

__ds_ns.AssistantPanel = __ds_scope.AssistantPanel;

__ds_ns.EmptyState = __ds_scope.EmptyState;

__ds_ns.Modal = __ds_scope.Modal;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.PasswordInput = __ds_scope.PasswordInput;

__ds_ns.SearchInput = __ds_scope.SearchInput;

__ds_ns.SegmentedTabs = __ds_scope.SegmentedTabs;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.NavItem = __ds_scope.NavItem;

__ds_ns.PageHeader = __ds_scope.PageHeader;

__ds_ns.NavGroupLabel = __ds_scope.NavGroupLabel;

__ds_ns.Sidebar = __ds_scope.Sidebar;

__ds_ns.Topbar = __ds_scope.Topbar;

__ds_ns.UsageQuota = __ds_scope.UsageQuota;

})();
