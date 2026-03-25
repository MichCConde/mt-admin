import { NavLink, useNavigate } from "react-router-dom";
import { getAuth, signOut } from "firebase/auth";
import { useAuth } from "../../hooks/useAuth";
import { colors } from "../../styles/tokens";

const NAV = [
  { to: "/",         label: "Dashboard",          sub: "Overview",               icon: DashIcon },
  { to: "/vas",      label: "Virtual Assistants", sub: "EOD & Attendance",       icon: VAsIcon  },
  { to: "/schedule", label: "Schedule",            sub: "Shift overview",         icon: CalIcon  },
  { to: "/eow",      label: "EOW Reports",         sub: "End-of-week reports",    icon: ReportIcon },
  { to: "/activity", label: "Activity Logs",       sub: "Audit trail",            icon: LogIcon  },
];

const COMING_SOON = [
  { label: "EOM Reports", sub: "End-of-month reports" },
  { label: "Strike Tracker", sub: "EOD & Attendance" },
];

export default function Sidebar() {
  const { user } = useAuth();
  const navigate  = useNavigate();

  async function handleSignOut() {
    await signOut(getAuth());
    navigate("/login");
  }

  return (
    <aside style={styles.sidebar}>
      {/* Logo */}
      <div style={styles.logoBlock}>
        <div style={styles.logoBox}>
          <span style={styles.logoMT}>MT</span>
          <span style={styles.logoSub}>MONSTER TASK</span>
        </div>
      </div>

      {/* Menu */}
      <div style={styles.section}>
        <p style={styles.sectionLabel}>MENU</p>
        <nav style={styles.nav}>
          {NAV.map(({ to, label, sub, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              style={({ isActive }) => ({
                ...styles.navItem,
                ...(isActive ? styles.navItemActive : {}),
              })}
            >
              {({ isActive }) => (
                <>
                  {isActive && <span style={styles.activeBar} />}
                  <span style={styles.navIcon}>
                    <Icon active={isActive} />
                  </span>
                  <span style={styles.navText}>
                    <span style={{
                      ...styles.navLabel,
                      color: isActive ? colors.teal : "#fff",
                    }}>
                      {label}
                    </span>
                    <span style={styles.navSub}>{sub}</span>
                  </span>
                  {isActive && <span style={styles.navChevron}>›</span>}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Coming Soon */}
      <div style={styles.section}>
        <p style={styles.sectionLabel}>COMING SOON</p>
        <nav style={styles.nav}>
          {COMING_SOON.map(({ label, sub }) => (
            <div key={label} style={styles.navItemDisabled}>
              <span style={styles.navText}>
                <span style={styles.navLabelDisabled}>{label}</span>
                <span style={styles.navSub}>{sub}</span>
              </span>
              <span style={styles.soonBadge}>Soon</span>
            </div>
          ))}
        </nav>
      </div>

      {/* Bottom */}
      <div style={styles.bottom}>
        {user && (
          <p style={styles.userEmail}>{user.email}</p>
        )}
        <button style={styles.signOutBtn} onClick={handleSignOut}>
          <span>⎋</span> Sign Out
        </button>
        <p style={styles.version}>MT Admin — v0.1</p>
      </div>
    </aside>
  );
}

// ── Inline styles ─────────────────────────────────────────────────────────────

const styles = {
  sidebar: {
    width: "200px",
    minWidth: "200px",
    minHeight: "100vh",
    background: colors.sidebarBg,
    display: "flex",
    flexDirection: "column",
    borderRight: `1px solid ${colors.sidebarBorder}`,
    position: "relative",
  },
  logoBlock: {
    padding: "24px 20px 20px",
    borderBottom: `1px solid ${colors.sidebarBorder}`,
  },
  logoBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "2px",
  },
  logoMT: {
    fontSize: "22px",
    fontWeight: "800",
    color: "#fff",
    letterSpacing: "1px",
  },
  logoSub: {
    fontSize: "9px",
    fontWeight: "700",
    color: colors.teal,
    letterSpacing: "2px",
  },
  section: {
    padding: "20px 0 4px",
  },
  sectionLabel: {
    fontSize: "10px",
    fontWeight: "700",
    color: colors.textMuted,
    letterSpacing: "1.5px",
    padding: "0 20px",
    marginBottom: "6px",
  },
  nav: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "10px 20px",
    textDecoration: "none",
    position: "relative",
    transition: "background 0.15s",
    borderRadius: "0",
    cursor: "pointer",
  },
  navItemActive: {
    background: "rgba(0, 201, 167, 0.08)",
  },
  activeBar: {
    position: "absolute",
    left: 0,
    top: "6px",
    bottom: "6px",
    width: "3px",
    background: colors.teal,
    borderRadius: "0 3px 3px 0",
  },
  navIcon: {
    width: "20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  navText: {
    display: "flex",
    flexDirection: "column",
    gap: "1px",
    flex: 1,
  },
  navLabel: {
    fontSize: "13px",
    fontWeight: "600",
    color: "#fff",
    lineHeight: 1.3,
  },
  navSub: {
    fontSize: "11px",
    color: colors.textMuted,
    lineHeight: 1.3,
  },
  navChevron: {
    color: colors.teal,
    fontSize: "16px",
    fontWeight: "300",
  },
  navItemDisabled: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "10px 20px",
    opacity: 0.5,
    cursor: "not-allowed",
  },
  navLabelDisabled: {
    fontSize: "13px",
    fontWeight: "600",
    color: colors.textMuted,
  },
  soonBadge: {
    fontSize: "10px",
    fontWeight: "600",
    background: "#2d2d5a",
    color: colors.textMuted,
    padding: "2px 7px",
    borderRadius: "10px",
    flexShrink: 0,
  },
  bottom: {
    marginTop: "auto",
    padding: "16px 20px",
    borderTop: `1px solid ${colors.sidebarBorder}`,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  userEmail: {
    fontSize: "12px",
    color: colors.teal,
    wordBreak: "break-all",
  },
  signOutBtn: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    background: "none",
    border: "none",
    color: colors.textMuted,
    fontSize: "13px",
    cursor: "pointer",
    padding: 0,
  },
  version: {
    fontSize: "11px",
    color: "#3a3a6e",
  },
};

// ── SVG Icons ─────────────────────────────────────────────────────────────────

function DashIcon({ active }) {
  const c = active ? colors.teal : colors.textMuted;
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="7" height="7" rx="1" stroke={c} strokeWidth="2"/>
      <rect x="14" y="3" width="7" height="7" rx="1" stroke={c} strokeWidth="2"/>
      <rect x="3" y="14" width="7" height="7" rx="1" stroke={c} strokeWidth="2"/>
      <rect x="14" y="14" width="7" height="7" rx="1" stroke={c} strokeWidth="2"/>
    </svg>
  );
}

function VAsIcon({ active }) {
  const c = active ? colors.teal : colors.textMuted;
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="7" r="4" stroke={c} strokeWidth="2"/>
      <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" stroke={c} strokeWidth="2"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75M21 21v-2a4 4 0 0 0-3-3.85" stroke={c} strokeWidth="2"/>
    </svg>
  );
}

function CalIcon({ active }) {
  const c = active ? colors.teal : colors.textMuted;
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="18" rx="2" stroke={c} strokeWidth="2"/>
      <line x1="16" y1="2" x2="16" y2="6" stroke={c} strokeWidth="2" strokeLinecap="round"/>
      <line x1="8" y1="2" x2="8" y2="6" stroke={c} strokeWidth="2" strokeLinecap="round"/>
      <line x1="3" y1="10" x2="21" y2="10" stroke={c} strokeWidth="2"/>
    </svg>
  );
}

function ReportIcon({ active }) {
  const c = active ? colors.teal : colors.textMuted;
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke={c} strokeWidth="2"/>
      <polyline points="14 2 14 8 20 8" stroke={c} strokeWidth="2"/>
      <line x1="8" y1="13" x2="16" y2="13" stroke={c} strokeWidth="2" strokeLinecap="round"/>
      <line x1="8" y1="17" x2="16" y2="17" stroke={c} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function LogIcon({ active }) {
  const c = active ? colors.teal : colors.textMuted;
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke={c} strokeWidth="2"/>
      <polyline points="12 6 12 12 16 14" stroke={c} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}