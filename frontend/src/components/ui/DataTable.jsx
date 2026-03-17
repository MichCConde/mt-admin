import { colors, font, radius, shadow } from "../../styles/tokens";

/**
 * DataTable
 * Props:
 *   columns — array of { label, flex?, align? }
 *   rows    — array of arrays of ReactNode (each inner array = one row)
 *   emptyMessage — shown when rows is empty
 */
export default function DataTable({ columns, rows, emptyMessage = "No records found." }) {
  if (!rows?.length) {
    return (
      <div style={{
        background:   colors.surfaceAlt,
        border:       `1.5px solid ${colors.border}`,
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
    <div style={{
      border:       `1.5px solid ${colors.border}`,
      borderRadius: radius.lg,
      overflow:     "hidden",
      boxShadow:    shadow.card,
    }}>
      {/* Header */}
      <div style={{
        display:       "flex",
        background:    colors.surfaceAlt,
        padding:       "10px 16px",
        gap:           12,
        borderBottom:  `1px solid ${colors.border}`,
      }}>
        {columns.map((col, i) => (
          <div
            key={i}
            style={{
              flex:          col.flex ?? 1,
              fontSize:      font.xs,
              fontWeight:    700,
              color:         colors.textMuted,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              textAlign:     col.align ?? "left",
            }}
          >
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
            <div
              key={j}
              style={{
                flex:         columns[j]?.flex ?? 1,
                fontSize:     font.md,
                overflow:     "hidden",
                textOverflow: "ellipsis",
                whiteSpace:   "nowrap",
                textAlign:    columns[j]?.align ?? "left",
              }}
            >
              {cell}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}