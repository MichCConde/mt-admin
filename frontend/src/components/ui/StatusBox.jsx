import { CheckCircle2, AlertTriangle, Info, XCircle } from "lucide-react";
import { colors, font, radius } from "../../styles/tokens";

const CONFIG = {
  success: {
    bg:     colors.successLight,
    border: colors.successBorder,
    color:  colors.success,
    Icon:   CheckCircle2,
  },
  danger: {
    bg:     colors.dangerLight,
    border: colors.dangerBorder,
    color:  colors.danger,
    Icon:   XCircle,
  },
  warning: {
    bg:     colors.warningLight,
    border: colors.warningBorder,
    color:  colors.warning,
    Icon:   AlertTriangle,
  },
  info: {
    bg:     colors.infoLight,
    border: colors.infoBorder,
    color:  colors.info,
    Icon:   Info,
  },
};

/**
 * StatusBox — full-width alert / feedback banner
 * variant: "success" | "danger" | "warning" | "info"
 * action:  optional JSX (e.g. a Button) shown on the right
 */
export default function StatusBox({ variant = "info", children, action, style: extraStyle }) {
  const c = CONFIG[variant];
  const { Icon } = c;

  return (
    <div style={{
      display:      "flex",
      alignItems:   "center",
      justifyContent: "space-between",
      gap:          12,
      background:   c.bg,
      border:       `1.5px solid ${c.border}`,
      borderRadius: radius.lg,
      padding:      "14px 18px",
      flexWrap:     "wrap",
      ...extraStyle,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
        <Icon size={18} color={c.color} strokeWidth={2} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: font.base, fontWeight: 600, color: c.color, lineHeight: 1.4 }}>
          {children}
        </span>
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}