import { colors, font, radius, shadow } from "../../styles/tokens";

// ── Card ──────────────────────────────────────────────────────────
/**
 * Props: title?, subtitle?, action?, padding?, noPadding?, style?
 */
export function Card({ children, title, subtitle, action, padding = "20px 24px", noPadding = false, style: extraStyle }) {
  return (
    <div style={{
      background:   colors.surface,
      border:       `1px solid ${colors.border}`,
      borderRadius: radius.lg,
      boxShadow:    shadow.card,
      overflow:     "hidden",
      ...extraStyle,
    }}>
      {(title || action) && (
        <div style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          padding:        "13px 20px",
          borderBottom:   `1px solid ${colors.border}`,
          background:     colors.surfaceAlt,
          gap:            12,
        }}>
          <div>
            {title && (
              <div style={{ fontSize: font.base, fontWeight: 700, color: colors.textPrimary }}>{title}</div>
            )}
            {subtitle && (
              <div style={{ fontSize: font.sm, color: colors.textMuted, marginTop: 2 }}>{subtitle}</div>
            )}
          </div>
          {action && <div style={{ flexShrink: 0 }}>{action}</div>}
        </div>
      )}
      <div style={{ padding: noPadding ? 0 : padding }}>{children}</div>
    </div>
  );
}

// ── SectionLabel ──────────────────────────────────────────────────
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

// ── Divider ───────────────────────────────────────────────────────
export function Divider({ style: extraStyle }) {
  return (
    <hr style={{ border: "none", borderTop: `1px solid ${colors.border}`, margin: "20px 0", ...extraStyle }} />
  );
}

// ── ControlBar ────────────────────────────────────────────────────
/**
 * Wraps filter controls in a Card with horizontal flex layout.
 * Props: children, style?
 */
export function ControlBar({ children, style }) {
  return (
    <Card style={{ marginBottom: 28, ...style }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        {children}
      </div>
    </Card>
  );
}

// ── PageHeader ────────────────────────────────────────────────────
/**
 * Props: title, subtitle?
 */
export function PageHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: font.h2, fontWeight: 800, color: colors.textPrimary, margin: 0 }}>
        {title}
      </h2>
      {subtitle && (
        <p style={{ fontSize: font.base, color: colors.textBody, marginTop: 6, margin: "6px 0 0" }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

// ── TabBar ────────────────────────────────────────────────────────
/**
 * Props: tabs [{ id, label, Icon }], active, onChange(id), style?
 */
export function TabBar({ tabs, active, onChange, style }) {
  return (
    <div style={{
      display:      "flex",
      gap:          4,
      borderBottom: `2px solid ${colors.border}`,
      marginBottom: 32,
      ...style,
    }}>
      {tabs.map(({ id, label, Icon }) => {
        const on = active === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            style={{
              display:      "flex",
              alignItems:   "center",
              gap:          6,
              padding:      "10px 18px",
              border:       "none",
              background:   "transparent",
              fontSize:     font.base,
              fontWeight:   on ? 700 : 500,
              color:        on ? colors.teal : colors.textMuted,
              cursor:       "pointer",
              borderBottom: `2px solid ${on ? colors.teal : "transparent"}`,
              marginBottom: -2,
              fontFamily:   font.family,
              transition:   "color .12s",
            }}
          >
            {Icon && <Icon size={14} strokeWidth={on ? 2.5 : 2} />}
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ── StatRow ───────────────────────────────────────────────────────
/**
 * Horizontal flex wrapper for StatCard tiles.
 * Props: children, style?
 */
export function StatRow({ children, style }) {
  return (
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap", ...style }}>
      {children}
    </div>
  );
}