import { colors, font, radius, shadow } from "../../styles/tokens";

export const ths = {
  padding:       "10px 8px",
  fontSize:      font.xs,
  fontWeight:    700,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  textAlign:     "center",
  color:         "#fff",
  userSelect:    "none",
};

export const tds = {
  padding:   "8px 6px",
  borderTop: `1px solid ${colors.border}`,
  fontSize:  font.sm,
};

export const tableWrap = {
  borderCollapse: "collapse",
  width:          "100%",
};

export function DataTable({ columns, rows, emptyMessage = "No records found." }) {
  if (!rows?.length) {
    return (
      <div style={{
        background:   colors.surfaceAlt,
        border:       `1px solid ${colors.border}`,
        borderRadius: radius.lg,
        padding:      "32px 20px",
        textAlign:    "center",
        color:        colors.textFaint,
        fontSize:     font.base,
      }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div style={{ border: `1px solid ${colors.border}`, borderRadius: radius.lg, overflow: "hidden", boxShadow: shadow.card }}>
      {/* Header */}
      <div style={{
        display:      "flex",
        background:   colors.surfaceAlt,
        padding:      "10px 16px",
        gap:          12,
        borderBottom: `1px solid ${colors.border}`,
      }}>
        {columns.map((col, i) => (
          <div key={i} style={{
            flex:          col.flex ?? 1,
            fontSize:      font.xs,
            fontWeight:    700,
            color:         colors.textMuted,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            textAlign:     col.align ?? "left",
          }}>
            {col.label}
          </div>
        ))}
      </div>

      {/* Rows */}
      {rows.map((row, i) => (
        <div
          key={i}
          style={{
            display:    "flex",
            padding:    "11px 16px",
            gap:        12,
            alignItems: "center",
            background: i % 2 === 0 ? colors.surface : colors.surfaceAlt,
            borderTop:  `1px solid ${colors.border}`,
            transition: "background .1s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = colors.tealLight; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = i % 2 === 0 ? colors.surface : colors.surfaceAlt; }}
        >
          {row.map((cell, j) => (
            <div key={j} style={{
              flex:         columns[j]?.flex ?? 1,
              fontSize:     font.md,
              overflow:     "hidden",
              textOverflow: "ellipsis",
              whiteSpace:   "nowrap",
              textAlign:    columns[j]?.align ?? "left",
            }}>
              {cell}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}