import { colors, font } from "../../styles/tokens";

/**
 * Shimmer keyframes — injected once globally via a <style> tag at module level.
 * Uses a moving gradient (no JS animation loop, cheap on the GPU).
 */
const SHIMMER_CSS = `
  @keyframes mt-shimmer {
    0%   { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }
  .mt-skeleton {
    background: linear-gradient(
      90deg,
      ${colors.surfaceAlt} 0%,
      ${colors.border} 50%,
      ${colors.surfaceAlt} 100%
    );
    background-size: 800px 100%;
    animation: mt-shimmer 1.4s ease-in-out infinite;
    border-radius: 4px;
  }
  .mt-skeleton.mt-skeleton-static {
    animation: none;
    background: ${colors.surfaceAlt};
  }
`;

// Inject styles once
if (typeof document !== "undefined" && !document.getElementById("mt-skeleton-styles")) {
  const tag = document.createElement("style");
  tag.id = "mt-skeleton-styles";
  tag.innerHTML = SHIMMER_CSS;
  document.head.appendChild(tag);
}

/**
 * Basic skeleton block — sized to your needs.
 *
 * Props:
 *   - width:  CSS width (default: "100%")
 *   - height: CSS height (default: 16)
 *   - radius: border radius (default: 4)
 *   - style:  extra styles
 */
export function Skeleton({ width = "100%", height = 16, radius = 4, style }) {
  return (
    <div
      className="mt-skeleton"
      style={{
        width,
        height,
        borderRadius: radius,
        ...style,
      }}
    />
  );
}

/**
 * Stat box skeleton — matches the visual shape of <StatBox /> in the Dashboard.
 * Use in grids while data is loading.
 */
export function StatBoxSkeleton() {
  return (
    <div style={{
      background: colors.surface,
      border: `1px solid ${colors.border}`,
      borderRadius: 8,
      padding: "16px 18px",
      display: "flex",
      alignItems: "center",
      gap: 14,
    }}>
      <Skeleton width={40} height={40} radius={8} />
      <div style={{ flex: 1 }}>
        <Skeleton width={42} height={22} />
        <Skeleton width={90} height={10} style={{ marginTop: 8 }} />
      </div>
    </div>
  );
}

/**
 * Table row skeleton — N cells across, all shimmer.
 * Pass `cellWidths` as an array of widths matching your real columns.
 */
export function TableRowSkeleton({ cellWidths = ["20%", "20%", "15%", "15%", "10%", "10%", "10%"], rowBg }) {
  return (
    <tr style={{ background: rowBg || colors.surface }}>
      {cellWidths.map((w, i) => (
        <td
          key={i}
          style={{
            padding: "12px",
            borderTop: `1px solid ${colors.border}`,
          }}
        >
          <Skeleton width={w} height={12} />
        </td>
      ))}
    </tr>
  );
}

/**
 * List row skeleton — for vertical lists like Flagged/Missing VAs.
 */
export function ListRowSkeleton({ i = 0 }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "12px 16px",
      borderTop: i > 0 ? `1px solid ${colors.border}` : "none",
      background: i % 2 === 0 ? colors.surface : colors.surfaceAlt,
    }}>
      <Skeleton width={36} height={18} radius={4} />
      <div style={{ flex: 1 }}>
        <Skeleton width="40%" height={12} />
      </div>
      <Skeleton width={60} height={20} radius={4} />
    </div>
  );
}

/**
 * Generic block skeleton — for card bodies, charts, etc.
 */
export function BlockSkeleton({ height = 120, style }) {
  return <Skeleton width="100%" height={height} radius={6} style={style} />;
}