import { NavLink, useNavigate } from "react-router-dom";
import { getAuth, signOut } from "firebase/auth";
import { useAuth } from "../../hooks/useAuth";

const NAV = [
  { to: "/",         label: "Dashboard",          sub: "Overview",            icon: DashIcon   },
  { to: "/vas",      label: "Virtual Assistants", sub: "EOD & Attendance",    icon: VAsIcon    },
  { to: "/schedule", label: "Schedule",           sub: "Shift overview",      icon: CalIcon    },
  { to: "/eow",      label: "EOW Reports",        sub: "End-of-week reports", icon: ReportIcon },
  { to: "/activity", label: "Activity Logs",      sub: "Audit trail",         icon: LogIcon    },
];

const COMING_SOON = [
  { label: "EOM Reports",    sub: "End-of-month reports" },
  { label: "Strike Tracker", sub: "EOD & Attendance"     },
];

export default function Sidebar() {
  const { user } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut(getAuth());
    navigate("/login");
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="sidebar-logo-mt">MT</span>
        <span className="sidebar-logo-sub">MONSTER TASK</span>
      </div>

      <div className="sidebar-section">
        <span className="sidebar-section-label">MENU</span>
        <nav className="sidebar-nav">
          {NAV.map(({ to, label, sub, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="nav-item-bar" />}
                  <span className="nav-item-icon">
                    <Icon active={isActive} />
                  </span>
                  <span className="nav-item-text">
                    <span className={`nav-item-label ${isActive ? "active" : ""}`}>
                      {label}
                    </span>
                    <span className="nav-item-sub">{sub}</span>
                  </span>
                  {isActive && <span className="nav-item-chevron">›</span>}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="sidebar-section">
        <span className="sidebar-section-label">COMING SOON</span>
        <nav className="sidebar-nav">
          {COMING_SOON.map(({ label, sub }) => (
            <div key={label} className="nav-item-disabled">
              <span className="nav-item-text">
                <span className="nav-item-label">{label}</span>
                <span className="nav-item-sub">{sub}</span>
              </span>
              <span className="soon-badge">Soon</span>
            </div>
          ))}
        </nav>
      </div>

      <div className="sidebar-bottom">
        {user && <p className="sidebar-email">{user.email}</p>}
        <button className="sidebar-signout" onClick={handleSignOut}>
          ⎋ Sign Out
        </button>
        <p className="sidebar-version">MT Admin — v0.1</p>
      </div>
    </aside>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function DashIcon({ active }) {
  const c = active ? "#00c9a7" : "#718096";
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
  const c = active ? "#00c9a7" : "#718096";
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="7" r="4" stroke={c} strokeWidth="2"/>
      <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" stroke={c} strokeWidth="2"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75M21 21v-2a4 4 0 0 0-3-3.85" stroke={c} strokeWidth="2"/>
    </svg>
  );
}

function CalIcon({ active }) {
  const c = active ? "#00c9a7" : "#718096";
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="18" rx="2" stroke={c} strokeWidth="2"/>
      <line x1="16" y1="2" x2="16" y2="6" stroke={c} strokeWidth="2" strokeLinecap="round"/>
      <line x1="8"  y1="2" x2="8"  y2="6" stroke={c} strokeWidth="2" strokeLinecap="round"/>
      <line x1="3"  y1="10" x2="21" y2="10" stroke={c} strokeWidth="2"/>
    </svg>
  );
}

function ReportIcon({ active }) {
  const c = active ? "#00c9a7" : "#718096";
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
        stroke={c} strokeWidth="2"/>
      <polyline points="14 2 14 8 20 8" stroke={c} strokeWidth="2"/>
      <line x1="8" y1="13" x2="16" y2="13" stroke={c} strokeWidth="2" strokeLinecap="round"/>
      <line x1="8" y1="17" x2="16" y2="17" stroke={c} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function LogIcon({ active }) {
  const c = active ? "#00c9a7" : "#718096";
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke={c} strokeWidth="2"/>
      <polyline points="12 6 12 12 16 14" stroke={c} strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}