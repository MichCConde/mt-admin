import { colors, font } from "../../styles/tokens";

export default function FilterPill({ label, count, active, onClick, color }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "6px 14px", borderRadius: 20,
        border: active ? `2px solid ${color}` : `1.5px solid ${colors.border}`,
        background: active ? `${color}10` : colors.surface,
        color: active ? color : colors.textMuted,
        fontWeight: 700, fontSize: font.sm, fontFamily: font.family,
        cursor: "pointer", transition: "all .12s",
      }}
    >
      {label}
      {count != null && (
        <span style={{
          background: active ? color : colors.surfaceAlt,
          color: active ? "#fff" : colors.textMuted,
          borderRadius: 10, padding: "1px 8px",
          fontSize: font.xs, fontWeight: 800, minWidth: 20, textAlign: "center",
        }}>
          {count}
        </span>
      )}
    </button>
  );
}