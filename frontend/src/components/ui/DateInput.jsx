import { colors, font, radius } from "../../styles/tokens";

/**
 * DateInput — styled date picker used in VA Reports, VA Inspector.
 *
 * Props:
 *   value    — YYYY-MM-DD string
 *   onChange — (value: string) => void  (receives the date string, not the event)
 *   label    — optional label above the input
 *   style    — extra styles on the wrapper div
 */
export default function DateInput({ value, onChange, label, style }) {
  return (
    <div style={style}>
      {label && (
        <label style={{
          display:       "block",
          fontSize:      font.sm,
          fontWeight:    700,
          color:         colors.textMuted,
          marginBottom:  6,
          letterSpacing: "0.04em",
        }}>
          {label}
        </label>
      )}
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          border:       `1.5px solid ${colors.border}`,
          borderRadius: radius.md,
          padding:      "9px 14px",
          fontSize:     font.base,
          outline:      "none",
          fontFamily:   font.family,
          background:   colors.surface,
          color:        colors.textPrimary,
          height:       38,
          display:      "block",
        }}
      />
    </div>
  );
}