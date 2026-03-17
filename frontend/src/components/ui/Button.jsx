import { colors, font, radius } from "../../styles/tokens";

/**
 * Button
 * variant: "primary" | "secondary" | "ghost" | "danger"
 * size:    "sm" | "md" | "lg"
 */
export default function Button({
  children,
  onClick,
  disabled = false,
  variant = "primary",
  size = "md",
  icon: Icon,
  style: extraStyle,
  ...rest
}) {
  const base = {
    display:        "inline-flex",
    alignItems:     "center",
    justifyContent: "center",
    gap:            6,
    border:         "none",
    borderRadius:   radius.md,
    fontFamily:     font.family,
    fontWeight:     700,
    cursor:         disabled ? "not-allowed" : "pointer",
    opacity:        disabled ? 0.55 : 1,
    transition:     "background .12s, box-shadow .12s, transform .1s",
    whiteSpace:     "nowrap",
    ...SIZE[size],
    ...VARIANT[variant],
    ...extraStyle,
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={base}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.filter = "brightness(0.92)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; }}
      {...rest}
    >
      {Icon && <Icon size={ICON_SIZE[size]} strokeWidth={2.5} />}
      {children}
    </button>
  );
}

const SIZE = {
  sm: { fontSize: font.sm,   padding: "6px 12px",  height: 30 },
  md: { fontSize: font.base, padding: "9px 18px",  height: 38 },
  lg: { fontSize: font.lg,   padding: "11px 24px", height: 44 },
};

const ICON_SIZE = { sm: 13, md: 14, lg: 16 };

const VARIANT = {
  primary: {
    background: colors.teal,
    color:      colors.white,
  },
  secondary: {
    background: colors.surfaceAlt,
    color:      colors.textBody,
    border:     `1.5px solid ${colors.border}`,
  },
  ghost: {
    background: "transparent",
    color:      colors.textMuted,
  },
  danger: {
    background: colors.dangerLight,
    color:      colors.danger,
    border:     `1.5px solid ${colors.dangerBorder}`,
  },
};