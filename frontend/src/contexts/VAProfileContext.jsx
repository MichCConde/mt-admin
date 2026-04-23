import { createContext, useContext, useState } from "react";
import VAProfileModal from "../components/ui/VAProfileModal";

const VAProfileContext = createContext({
  openVAProfile: () => {},
});

export function VAProfileProvider({ children }) {
  const [openName, setOpenName] = useState(null);

  return (
    <VAProfileContext.Provider value={{ openVAProfile: setOpenName }}>
      {children}
      {openName && (
        <VAProfileModal vaName={openName} onClose={() => setOpenName(null)} />
      )}
    </VAProfileContext.Provider>
  );
}

export function useVAProfile() {
  return useContext(VAProfileContext);
}

/**
 * Clickable VA name that opens the profile modal on click.
 * Use this wherever a VA name is rendered in the UI.
 */
export function VANameLink({ name, children, style }) {
  const { openVAProfile } = useVAProfile();
  if (!name) return <span style={style}>{children || "—"}</span>;
  return (
    <span
      onClick={(e) => {
        e.stopPropagation();
        openVAProfile(name);
      }}
      style={{
        cursor: "pointer",
        color: "inherit",
        borderBottom: "1px dashed transparent",
        transition: "border-color .12s",
        ...style,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderBottomColor = "currentColor")}
      onMouseLeave={(e) => (e.currentTarget.style.borderBottomColor = "transparent")}
    >
      {children || name}
    </span>
  );
}