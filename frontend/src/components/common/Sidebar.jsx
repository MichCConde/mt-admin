import { NavLink, useNavigate } from "react-router-dom";
import { getAuth, signOut } from "firebase/auth";
import { useAuth } from "../../hooks/useAuth";

const NAV = [
  { to: "/",         label: "Dashboard",          sub: "Overview",            icon: IconGrid    },
  { to: "/vas",      label: "Virtual Assistants", sub: "EOD & Attendance",    icon: IconUsers   },
  { to: "/schedule", label: "Schedule",           sub: "Shift overview",      icon: IconCal     },
  { to: "/eow",      label: "EOW Reports",        sub: "End-of-week reports", icon: IconReport  },
  { to: "/activity", label: "Activity Logs",      sub: "Audit trail",         icon: IconClock   },
];

const SOON = [
  { label: "EOM Reports",    sub: "Monthly summary"   },
  { label: "Strike Tracker", sub: "VA infractions"    },
];

export default function Sidebar() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut(getAuth());
    navigate("/login");
  };

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sb-logo">
        <div className="sb-logo-mark">
          <div className="sb-logo-box">MT</div>
          <div className="sb-logo-name">
            <span className="sb-logo-title">Monster Task</span>
            <span className="sb-logo-sub">Admin</span>
          </div>
        </div>
      </div>

      {/* Menu */}
      <div className="sb-section">
        <span className="sb-section-label">Menu</span>
        <nav className="sb-nav">
          {NAV.map(({ to, label, sub, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) => `sb-link ${isActive ? "active" : ""}`}
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="sb-link-bar" />}
                  <span className="sb-link-icon"><Icon active={isActive} /></span>
                  <span className="sb-link-text">
                    <span className="sb-link-label">{label}</span>
                    <span className="sb-link-sub">{sub}</span>
                  </span>
                  {isActive && <span className="sb-link-chevron">›</span>}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Coming Soon */}
      <div className="sb-section">
        <span className="sb-section-label">Coming Soon</span>
        <nav className="sb-nav">
          {SOON.map(({ label, sub }) => (
            <div key={label} className="sb-disabled">
              <span className="sb-disabled-text">
                <span className="sb-disabled-label">{label}</span>
                <span className="sb-disabled-sub">{sub}</span>
              </span>
              <span className="sb-badge-soon">Soon</span>
            </div>
          ))}
        </nav>
      </div>

      {/* Footer */}
      <div className="sb-footer">
        {user && <p className="sb-user-email">{user.email}</p>}
        <button className="sb-signout" onClick={handleSignOut}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sign Out
        </button>
        <p className="sb-version">MT Admin — v0.1</p>
      </div>
    </aside>
  );
}

/* ── Icons ────────────────────────────────────────────────────── */
function IconGrid({ active }) {
  const c = active ? "var(--teal)" : "#4b5680";
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="7" height="7" rx="1.5" stroke={c} strokeWidth="2"/>
      <rect x="14" y="3" width="7" height="7" rx="1.5" stroke={c} strokeWidth="2"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5" stroke={c} strokeWidth="2"/>
      <rect x="14" y="14" width="7" height="7" rx="1.5" stroke={c} strokeWidth="2"/>
    </svg>
  );
}
function IconUsers({ active }) {
  const c = active ? "var(--teal)" : "#4b5680";
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="7" r="4" stroke={c} strokeWidth="2"/>
      <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" stroke={c} strokeWidth="2"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75M21 21v-2a4 4 0 0 0-3-3.85" stroke={c} strokeWidth="2"/>
    </svg>
  );
}
function IconCal({ active }) {
  const c = active ? "var(--teal)" : "#4b5680";
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="18" rx="2" stroke={c} strokeWidth="2"/>
      <line x1="16" y1="2" x2="16" y2="6" stroke={c} strokeWidth="2" strokeLinecap="round"/>
      <line x1="8"  y1="2" x2="8"  y2="6" stroke={c} strokeWidth="2" strokeLinecap="round"/>
      <line x1="3"  y1="10" x2="21" y2="10" stroke={c} strokeWidth="2"/>
    </svg>
  );
}
function IconReport({ active }) {
  const c = active ? "var(--teal)" : "#4b5680";
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke={c} strokeWidth="2"/>
      <polyline points="14 2 14 8 20 8" stroke={c} strokeWidth="2"/>
      <line x1="8" y1="13" x2="16" y2="13" stroke={c} strokeWidth="2" strokeLinecap="round"/>
      <line x1="8" y1="17" x2="16" y2="17" stroke={c} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}
function IconClock({ active }) {
  const c = active ? "var(--teal)" : "#4b5680";
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke={c} strokeWidth="2"/>
      <polyline points="12 6 12 12 16 14" stroke={c} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}