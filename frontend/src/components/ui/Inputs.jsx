import { ChevronDown } from "lucide-react";
import { colors, font, radius } from "../../styles/tokens";

// ── Shared label style ────────────────────────────────────────────
const labelStyle = {
  display:       "block",
  fontSize:      font.sm,
  fontWeight:    700,
  color:         colors.textBody,
  marginBottom:  6,
  letterSpacing: "0.04em",
};

const inputBase = {
  width:        "100%",
  border:       `1.5px solid ${colors.border}`,
  borderRadius: radius.md,
  padding:      "9px 12px",
  fontSize:     font.base,
  outline:      "none",
  fontFamily:   font.family,
  background:   colors.surface,
  color:        colors.textPrimary,
  height:       38,
  boxSizing:    "border-box",
};

// ── DateInput ─────────────────────────────────────────────────────
/**
 * Props: value, onChange(string), label?, style?
 */
export function DateInput({ value, onChange, label, style }) {
  return (
    <div style={style}>
      {label && <label style={labelStyle}>{label}</label>}
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...inputBase, display: "block" }}
      />
    </div>
  );
}

// ── NumberInput ───────────────────────────────────────────────────
/**
 * Props: value, onChange(number), label?, min?, max?, style?
 */
export function NumberInput({ label, value, onChange, min, max, style }) {
  return (
    <div style={style}>
      {label && <label style={labelStyle}>{label}</label>}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        style={inputBase}
      />
    </div>
  );
}

// ── Select ────────────────────────────────────────────────────────
/**
 * Props: value, onChange(e), options?, groups?, label?, placeholder?,
 *        disabled?, width?, style?
 */
export function Select({
  value, onChange, options, groups, label,
  placeholder, disabled = false, width = "100%", style: extraStyle,
}) {
  return (
    <div style={{ width, ...extraStyle }}>
      {label && <label style={labelStyle}>{label}</label>}
      <div style={{ position: "relative" }}>
        <select
          value={value}
          onChange={onChange}
          disabled={disabled}
          style={{
            ...inputBase,
            padding:    "9px 36px 9px 12px",
            appearance: "none",
            cursor:     disabled ? "not-allowed" : "pointer",
            background: disabled ? colors.surfaceAlt : colors.surface,
            color:      disabled ? colors.textFaint  : colors.textPrimary,
          }}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options?.map((opt, i) => {
            const v = typeof opt === "string" ? opt : opt.value;
            const l = typeof opt === "string" ? opt : opt.label;
            return <option key={i} value={v}>{l}</option>;
          })}
          {groups?.map((g, i) => (
            <optgroup key={i} label={g.label}>
              {g.options.map((opt, j) => (
                <option key={j} value={typeof opt === "string" ? opt : opt.value}>
                  {typeof opt === "string" ? opt : opt.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <ChevronDown size={14} color={colors.textMuted} style={{
          position: "absolute", right: 12, top: "50%",
          transform: "translateY(-50%)", pointerEvents: "none",
        }} />
      </div>
    </div>
  );
}