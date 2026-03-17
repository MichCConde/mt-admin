import { colors, font, radius, shadow } from "../../styles/tokens";

/**
 * StatCard — numeric KPI tile
 * Props:
 *   icon      — Lucide icon component
 *   label     — text label below the number
 *   value     — the big number
 *   highlight — "success" | "danger" | "teal" | undefined (default accent)
 */
export default function StatCard({ icon: Icon, label, value, highlight }) {
  const accentColor =
    highlight === "danger"  ? colors.danger :
    highlight === "success" ? colors.success :
    highlight === "teal"    ? colors.teal :
    colors.teal;

  const iconBg =
    highlight === "danger"  ? colors.dangerLight :
    highlight === "success" ? colors.successLight :
    colors.tealLight;

  return (
    <div style={{
      flex:         1,
      minWidth:     120,
      background:   colors.surface,
      border:       `1.5px solid ${colors.border}`,
      borderRadius: radius.lg,
      padding:      "18px 20px",
      boxShadow:    shadow.card,
      display:      "flex",
      alignItems:   "flex-start",
      gap:          14,
    }}>
      {Icon && (
        <div style={{
          width:        40,
          height:       40,
          borderRadius: radius.md,
          background:   iconBg,
          display:      "flex",
          alignItems:   "center",
          justifyContent: "center",
          flexShrink:   0,
        }}>
          <Icon size={18} color={accentColor} strokeWidth={2} />
        </div>
      )}
      <div>
        <div style={{
          fontSize:   32,
          fontWeight: 800,
          color:      colors.textPrimary,
          lineHeight: 1,
        }}>
          {value ?? "—"}
        </div>
        <div style={{
          fontSize:   font.sm,
          color:      colors.textMuted,
          fontWeight: 600,
          marginTop:  5,
        }}>
          {label}
        </div>
      </div>
    </div>
  );
}