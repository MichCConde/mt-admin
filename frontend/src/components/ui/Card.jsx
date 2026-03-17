import { colors, font, radius, shadow } from "../../styles/tokens";

/**
 * Card — standard white surface with border and shadow
 * Props:
 *   title      — optional header text
 *   subtitle   — optional header subtext
 *   action     — optional JSX in the top-right of the header
 *   padding    — inner padding (default "20px 24px")
 *   noPadding  — removes inner padding (useful for tables flush to edges)
 *   style      — extra styles on the wrapper
 */
export default function Card({
  children,
  title,
  subtitle,
  action,
  padding = "20px 24px",
  noPadding = false,
  style: extraStyle,
}) {
  const hasHeader = title || action;

  return (
    <div style={{
      background:   colors.surface,
      border:       `1.5px solid ${colors.border}`,
      borderRadius: radius.lg,
      boxShadow:    shadow.card,
      overflow:     "hidden",
      ...extraStyle,
    }}>
      {hasHeader && (
        <div style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          padding:        "14px 20px",
          borderBottom:   `1px solid ${colors.border}`,
          background:     colors.surfaceAlt,
          gap:            12,
        }}>
          <div>
            {title && (
              <div style={{ fontSize: font.base, fontWeight: 700, color: colors.textPrimary }}>
                {title}
              </div>
            )}
            {subtitle && (
              <div style={{ fontSize: font.sm, color: colors.textMuted, marginTop: 2 }}>
                {subtitle}
              </div>
            )}
          </div>
          {action && <div style={{ flexShrink: 0 }}>{action}</div>}
        </div>
      )}

      <div style={{ padding: noPadding ? 0 : padding }}>
        {children}
      </div>
    </div>
  );
}

/**
 * SectionLabel — uppercase label above a group of content
 */
export function SectionLabel({ children, style: extraStyle }) {
  return (
    <div style={{
      fontSize:      font.xs,
      fontWeight:    700,
      color:         colors.textMuted,
      letterSpacing: "0.07em",
      textTransform: "uppercase",
      marginBottom:  12,
      ...extraStyle,
    }}>
      {children}
    </div>
  );
}

/**
 * Divider — horizontal rule
 */
export function Divider({ style: extraStyle }) {
  return (
    <hr style={{
      border:     "none",
      borderTop:  `1px solid ${colors.border}`,
      margin:     "20px 0",
      ...extraStyle,
    }} />
  );
}