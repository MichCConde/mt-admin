import { ChevronDown } from "lucide-react";
import { colors, font, radius } from "../../styles/tokens";

/**
 * Select — styled dropdown with ChevronDown icon.
 *
 * Props:
 *   value       — controlled value
 *   onChange    — (e) => void or (value) => void
 *   options     — array of { value, label } OR array of strings
 *   groups      — array of { label, options: [{ value, label }] } for optgroup support
 *   label       — optional label above the select
 *   placeholder — placeholder option text
 *   disabled    — boolean
 *   width       — CSS width string (default "100%")
 *   style       — extra styles on the wrapper div
 */
export default function Select({
  value,
  onChange,
  options,
  groups,
  label,
  placeholder,
  disabled = false,
  width = "100%",
  style: extraStyle,
}) {
  function handleChange(e) {
    onChange(e);
  }

  return (
    <div style={{ width, ...extraStyle }}>
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
      <div style={{ position: "relative" }}>
        <select
          value={value}
          onChange={handleChange}
          disabled={disabled}
          style={{
            width:        "100%",
            border:       `1.5px solid ${colors.border}`,
            borderRadius: radius.md,
            padding:      "9px 36px 9px 12px",
            fontSize:     font.base,
            outline:      "none",
            fontFamily:   font.family,
            background:   disabled ? colors.surfaceAlt : colors.surface,
            color:        disabled ? colors.textFaint : colors.textPrimary,
            height:       38,
            appearance:   "none",
            cursor:       disabled ? "not-allowed" : "pointer",
          }}
        >
          {placeholder && (
            <option value="">{placeholder}</option>
          )}

          {/* Flat options */}
          {options?.map((opt, i) => {
            const val   = typeof opt === "string" ? opt : opt.value;
            const label = typeof opt === "string" ? opt : opt.label;
            return <option key={i} value={val}>{label}</option>;
          })}

          {/* Grouped options */}
          {groups?.map((group, i) => (
            <optgroup key={i} label={group.label}>
              {group.options.map((opt, j) => (
                <option key={j} value={typeof opt === "string" ? opt : opt.value}>
                  {typeof opt === "string" ? opt : opt.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        <ChevronDown
          size={14}
          color={colors.textMuted}
          style={{
            position:      "absolute",
            right:         12,
            top:           "50%",
            transform:     "translateY(-50%)",
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
}