import { useEffect, useState } from "react";
import { colors } from "../../styles/tokens";
import TopBarPortal from "./TopBarPortal";

const PROGRESS_CSS = `
  @keyframes mt-progress-slide {
    0%   { transform: translateX(-100%); }
    100% { transform: translateX(400%); }
  }
  .mt-progress-track {
    position: absolute;
    bottom: -1px;
    left: 0;
    right: 0;
    height: 2px;
    background: transparent;
    overflow: hidden;
    pointer-events: none;
  }
  .mt-progress-bar {
    height: 100%;
    width: 25%;
    background: linear-gradient(
      90deg,
      transparent 0%,
      ${colors.teal} 50%,
      transparent 100%
    );
    animation: mt-progress-slide 1.1s ease-in-out infinite;
  }
`;

if (typeof document !== "undefined" && !document.getElementById("mt-progress-styles")) {
  const tag = document.createElement("style");
  tag.id = "mt-progress-styles";
  tag.innerHTML = PROGRESS_CSS;
  document.head.appendChild(tag);
}

/**
 * Animated 2px progress bar that lives in the top bar.
 * Shows while `active` is true. Delays appearance by `delay` ms
 * to avoid flashing for fast fetches.
 *
 * Props:
 *   - active: boolean — whether to show the bar
 *   - delay:  ms before bar appears (default: 200ms)
 */
export default function TopBarProgress({ active, delay = 200 }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [active, delay]);

  if (!visible) return null;

  return (
    <TopBarPortal>
      <div className="mt-progress-track" aria-hidden="true">
        <div className="mt-progress-bar" />
      </div>
    </TopBarPortal>
  );
}