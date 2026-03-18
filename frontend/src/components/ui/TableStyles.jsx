import { colors, font } from "../../styles/tokens";

/**
 * Shared table style constants for HTML <table> elements.
 * Used in Schedule.jsx and any other page that renders a raw table.
 *
 * Usage:
 *   import { ths, tds, tableWrap } from "../ui/tableStyles";
 *   <table style={tableWrap}>
 *     <thead><tr><th style={ths}>Column</th></tr></thead>
 *     <tbody><tr><td style={tds}>Value</td></tr></tbody>
 *   </table>
 */

/** Header cell — dark navy background, uppercase label */
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

/** Body cell — standard padding + top border */
export const tds = {
  padding:   "8px 6px",
  borderTop: `1px solid ${colors.border}`,
  fontSize:  font.sm,
};

/** Table wrapper — collapses borders, fills width */
export const tableWrap = {
  borderCollapse: "collapse",
  width:          "100%",
};