import { colors, font } from "../../styles/tokens";

/**
 * PageHeader — standard page title + subtitle used at the top of every admin page.
 * Props:
 *   title    — main heading text
 *   subtitle — smaller description line below
 */
export default function PageHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{
        fontSize:   font.h2,
        fontWeight: 800,
        color:      colors.textPrimary,
        margin:     0,
      }}>
        {title}
      </h2>
      {subtitle && (
        <p style={{
          fontSize:  font.base,
          color:     colors.textMuted,
          marginTop: 6,
          margin:    "6px 0 0",
        }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}