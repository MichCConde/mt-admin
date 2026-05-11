import { colors } from "../../styles/tokens";

const SPINNER_CSS = `
  @keyframes mt-spin {
    to { transform: rotate(360deg); }
  }
  .mt-spinner {
    display: inline-block;
    border-style: solid;
    border-radius: 50%;
    animation: mt-spin 0.7s linear infinite;
  }
`;

if (typeof document !== "undefined" && !document.getElementById("mt-spinner-styles")) {
  const tag = document.createElement("style");
  tag.id = "mt-spinner-styles";
  tag.innerHTML = SPINNER_CSS;
  document.head.appendChild(tag);
}

/**
 * Small inline spinner.
 *
 * Props:
 *   - size:  diameter in px (default: 14)
 *   - color: stroke color (default: teal)
 */
export default function Spinner({ size = 14, color }) {
  const c = color || colors.teal;
  return (
    <span
      className="mt-spinner"
      style={{
        width: size,
        height: size,
        borderWidth: Math.max(2, Math.round(size / 7)),
        borderColor: `${c} transparent ${c} ${c}`,
      }}
      aria-label="Loading"
    />
  );
}