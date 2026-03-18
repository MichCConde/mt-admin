import { colors, font } from "../../styles/tokens";

/**
 * TabBar — reusable tab navigation used across VA Reports, Schedule, VA Inspector.
 *
 * Props:
 *   tabs      — array of { id, label, Icon } where Icon is a Lucide component
 *   active    — id of the currently active tab
 *   onChange  — (id) => void called when a tab is clicked
 *   style     — optional extra style on the wrapper div
 */
export default function TabBar({ tabs, active, onChange, style }) {
  return (
    <div style={{
      display:      "flex",
      gap:          4,
      borderBottom: `2px solid ${colors.border}`,
      marginBottom: 32,
      ...style,
    }}>
      {tabs.map(({ id, label, Icon }) => {
        const isActive = active === id;
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
              fontWeight:   isActive ? 700 : 500,
              color:        isActive ? colors.teal : colors.textMuted,
              cursor:       "pointer",
              borderBottom: `2px solid ${isActive ? colors.teal : "transparent"}`,
              marginBottom: -2,
              fontFamily:   font.family,
              transition:   "color .12s",
            }}
          >
            {Icon && (
              <Icon size={14} strokeWidth={isActive ? 2.5 : 2} />
            )}
            {label}
          </button>
        );
      })}
    </div>
  );
}