import { colors, font, radius } from "../../styles/tokens";

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

/**
 * CommunityBadge — colored pill for Main / CBA / SM
 */
export function CommunityBadge({ community }) {
  const style = COMMUNITY_MAP[community] ?? { bg: colors.textMuted, color: "#fff" };
  return (
    <span style={{
      display:      "inline-block",
      background:   style.bg,
      color:        style.color,
      borderRadius: radius.sm,
      padding:      "2px 8px",
      fontSize:     font.xs,
      fontWeight:   700,
      whiteSpace:   "nowrap",
      letterSpacing: "0.02em",
    }}>
      {community ?? "?"}
    </span>
  );
}

/**
 * StatusBadge — semantic status pill
 * variant: "success" | "danger" | "warning" | "info" | "neutral" | "teal"
 */
export function StatusBadge({ children, variant = "neutral" }) {
  const style = STATUS_MAP[variant];
  return (
    <span style={{
      display:      "inline-block",
      background:   style.bg,
      color:        style.color,
      border:       `1px solid ${style.border}`,
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

/**
 * SoonBadge — "Coming soon" pill
 */
export function SoonBadge() {
  return (
    <span style={{
      marginLeft:   "auto",
      fontSize:     font.xs,
      fontWeight:   700,
      background:   colors.surfaceAlt,
      color:        colors.textFaint,
      border:       `1px solid ${colors.border}`,
      borderRadius: 20,
      padding:      "3px 10px",
      flexShrink:   0,
    }}>
      Soon
    </span>
  );
}