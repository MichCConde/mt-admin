import { CheckCircle2, AlertTriangle, Info, XCircle } from "lucide-react";
import { colors, font, radius, shadow } from "../../styles/tokens";

// ── Avatar ────────────────────────────────────────────────────────
/**
 * Props: name (full name string), size? (default 44)
 */
export function Avatar({ name = "?", size = 44 }) {
  const initials = name.trim().split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div style={{
      width:          size,
      height:         size,
      borderRadius:   radius.lg,
      background:     colors.tealLight,
      border:         `2px solid ${colors.tealMid}`,
      display:        "flex",
      alignItems:     "center",
      justifyContent: "center",
      fontSize:       size >= 44 ? font.lg : font.sm,
      fontWeight:     800,
      color:          colors.teal,
      flexShrink:     0,
      fontFamily:     font.family,
      userSelect:     "none",
    }}>
      {initials}
    </div>
  );
}

// ── Badges ────────────────────────────────────────────────────────
const COMMUNITY_MAP = {
  Main: { bg: colors.communityMain, color: "#fff" },
  CBA:  { bg: colors.communityCBA,  color: "#fff" },
  SM:   { bg: colors.communitySM,   color: "#fff" },
};

const STATUS_MAP = {
  success: { bg: colors.successLight, color: colors.success, border: colors.successBorder },
  danger:  { bg: colors.dangerLight,  color: colors.danger,  border: colors.dangerBorder  },
  warning: { bg: colors.warningLight, color: colors.warning, border: colors.warningBorder },
  info:    { bg: colors.infoLight,    color: colors.info,    border: colors.infoBorder    },
  neutral: { bg: colors.surfaceAlt,   color: colors.textMuted, border: colors.border      },
  teal:    { bg: colors.tealLight,    color: colors.teal,    border: colors.tealMid       },
};

export function CommunityBadge({ community }) {
  const s = COMMUNITY_MAP[community] ?? { bg: colors.textMuted, color: "#fff" };
  return (
    <span style={{
      display:       "inline-block",
      background:    s.bg,
      color:         s.color,
      borderRadius:  radius.sm,
      padding:       "2px 8px",
      fontSize:      font.xs,
      fontWeight:    700,
      whiteSpace:    "nowrap",
      letterSpacing: "0.02em",
    }}>
      {community ?? "?"}
    </span>
  );
}

export function StatusBadge({ children, variant = "neutral" }) {
  const s = STATUS_MAP[variant];
  return (
    <span style={{
      display:      "inline-block",
      background:   s.bg,
      color:        s.color,
      border:       `1px solid ${s.border}`,
      borderRadius: radius.sm,
      padding:      "3px 9px",
      fontSize:     font.xs,
      fontWeight:   700,
      whiteSpace:   "nowrap",
    }}>
      {children}
    </span>
  );
}

export function SoonBadge() {
  return (
    <span style={{
      marginLeft:   "auto",
      fontSize:     font.xs,
      fontWeight:   700,
      background:   "rgba(255,255,255,0.06)",
      color:        colors.navyMuted,
      borderRadius: 20,
      padding:      "3px 10px",
      flexShrink:   0,
    }}>
      Soon
    </span>
  );
}

// ── StatCard ──────────────────────────────────────────────────────
/**
 * Props: icon, label, value, highlight? ("success"|"danger"|"teal")
 */
export function StatCard({ icon: Icon, label, value, highlight }) {
  const accent =
    highlight === "danger"  ? colors.danger  :
    highlight === "success" ? colors.success :
    colors.teal;

  const iconBg =
    highlight === "danger"  ? colors.dangerLight  :
    highlight === "success" ? colors.successLight :
    colors.tealLight;

  return (
    <div style={{
      flex:         1,
      minWidth:     130,
      background:   colors.surface,
      border:       `1px solid ${colors.border}`,
      borderRadius: radius.lg,
      padding:      "18px 20px",
      boxShadow:    shadow.card,
      display:      "flex",
      alignItems:   "flex-start",
      gap:          14,
    }}>
      {Icon && (
        <div style={{
          width:          40,
          height:         40,
          borderRadius:   radius.md,
          background:     iconBg,
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          flexShrink:     0,
        }}>
          <Icon size={18} color={accent} strokeWidth={2} />
        </div>
      )}
      <div>
        <div style={{ fontSize: 30, fontWeight: 800, color: colors.textPrimary, lineHeight: 1 }}>
          {value ?? "—"}
        </div>
        <div style={{ fontSize: font.sm, color: colors.textBody, fontWeight: 600, marginTop: 5 }}>
          {label}
        </div>
      </div>
    </div>
  );
}

// ── StatusBox ─────────────────────────────────────────────────────
const STATUS_BOX_CONFIG = {
  success: { bg: colors.successLight, border: colors.successBorder, color: colors.success, Icon: CheckCircle2 },
  danger:  { bg: colors.dangerLight,  border: colors.dangerBorder,  color: colors.danger,  Icon: XCircle      },
  warning: { bg: colors.warningLight, border: colors.warningBorder, color: colors.warning, Icon: AlertTriangle },
  info:    { bg: colors.infoLight,    border: colors.infoBorder,    color: colors.info,    Icon: Info          },
};

/**
 * Props: variant ("success"|"danger"|"warning"|"info"), action?, style?
 */
export function StatusBox({ variant = "info", children, action, style: extraStyle }) {
  const c = STATUS_BOX_CONFIG[variant];
  return (
    <div style={{
      display:        "flex",
      alignItems:     "center",
      justifyContent: "space-between",
      gap:            12,
      background:     c.bg,
      border:         `1.5px solid ${c.border}`,
      borderRadius:   radius.lg,
      padding:        "14px 18px",
      flexWrap:       "wrap",
      ...extraStyle,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
        <c.Icon size={18} color={c.color} strokeWidth={2} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: font.base, fontWeight: 600, color: c.color, lineHeight: 1.4 }}>{children}</span>
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}

// ── Tag ───────────────────────────────────────────────────────────
const TAG_VARIANTS = {
  default: { bg: colors.surfaceAlt,   color: colors.textBody,  border: colors.border        },
  teal:    { bg: colors.tealLight,    color: colors.teal,      border: colors.tealMid       },
  success: { bg: colors.successLight, color: colors.success,   border: colors.successBorder },
  warning: { bg: colors.warningLight, color: colors.warning,   border: colors.warningBorder },
  danger:  { bg: colors.dangerLight,  color: colors.danger,    border: colors.dangerBorder  },
  info:    { bg: colors.infoLight,    color: colors.info,      border: colors.infoBorder    },
};

/**
 * Props: variant ("default"|"teal"|"success"|"warning"|"danger"|"info")
 */
export function Tag({ children, variant = "default" }) {
  const v = TAG_VARIANTS[variant] ?? TAG_VARIANTS.default;
  return (
    <span style={{
      display:      "inline-block",
      background:   v.bg,
      color:        v.color,
      border:       `1px solid ${v.border}`,
      borderRadius: radius.sm,
      padding:      "4px 10px",
      fontSize:     font.sm,
      fontWeight:   600,
      whiteSpace:   "nowrap",
    }}>
      {children}
    </span>
  );
}