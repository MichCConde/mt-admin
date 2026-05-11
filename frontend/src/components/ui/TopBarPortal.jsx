import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Renders children into the Layout's top-bar slot.
 * Use this for cached banners, page status, or any contextual top-bar UI.
 */
export default function TopBarPortal({ children }) {
  const [target, setTarget] = useState(null);

  useEffect(() => {
    setTarget(document.getElementById("mt-top-bar-slot"));
  }, []);

  if (!target) return null;
  return createPortal(children, target);
}