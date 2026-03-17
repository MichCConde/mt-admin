// Monster Task Design Tokens — Updated brand: Teal/Cyan-Green + Dark Navy

export const colors = {
  // ── Brand ──────────────────────────────────────────────────────
  teal:        "#0CB8A9",   // primary accent (buttons, active states, highlights)
  tealHover:   "#0AA398",
  tealLight:   "#E6F7F6",
  tealMid:     "#B2E8E4",

  // ── Sidebar / Dark surfaces ────────────────────────────────────
  navy:        "#0D1F3C",   // sidebar background
  navyLight:   "#162847",   // sidebar hover
  navyBorder:  "#1E3255",   // sidebar dividers
  navyMuted:   "#4A6080",   // sidebar muted text
  navyText:    "#8DA3BE",   // sidebar secondary text

  // ── Content surfaces ───────────────────────────────────────────
  bg:          "#F2F5F9",   // page background
  surface:     "#FFFFFF",   // cards
  surfaceAlt:  "#F8FAFC",   // table alternating rows / section bg
  border:      "#E2E8F0",   // card / table borders
  borderHover: "#C8D5E3",

  // ── Text ───────────────────────────────────────────────────────
  textPrimary: "#0D1F3C",   // headings — matches navy
  textBody:    "#374151",   // body copy
  textMuted:   "#6B7280",   // labels, secondary
  textFaint:   "#9CA3AF",   // placeholders, hints

  // ── Status ─────────────────────────────────────────────────────
  success:        "#059669",
  successLight:   "#ECFDF5",
  successBorder:  "#A7F3D0",

  danger:         "#DC2626",
  dangerLight:    "#FEF2F2",
  dangerBorder:   "#FECACA",

  warning:        "#D97706",
  warningLight:   "#FFFBEB",
  warningBorder:  "#FDE68A",

  info:           "#2563EB",
  infoLight:      "#EFF6FF",
  infoBorder:     "#BFDBFE",

  // ── Community badges ───────────────────────────────────────────
  communityMain:  "#1D4ED8",
  communityCBA:   "#C2410C",
  communitySM:    "#7C3AED",

  white: "#FFFFFF",
};

export const font = {
  family: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  xs:   "11px",
  sm:   "12px",
  md:   "13px",
  base: "14px",
  lg:   "15px",
  xl:   "18px",
  h3:   "20px",
  h2:   "24px",
  h1:   "28px",
};

export const radius = {
  sm: "4px",
  md: "8px",
  lg: "12px",
  xl: "16px",
};

export const shadow = {
  xs:   "0 1px 2px rgba(0,0,0,0.05)",
  card: "0 1px 4px rgba(13,31,60,0.06), 0 1px 2px rgba(13,31,60,0.04)",
  md:   "0 4px 16px rgba(13,31,60,0.10)",
  lg:   "0 8px 32px rgba(13,31,60,0.12)",
};