import { useState } from "react";
import {
  LayoutDashboard, ClipboardList, UserSearch,
  CalendarDays, BarChart3, ShieldAlert, ChevronRight, LogOut,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { auth }   from "../../firebase";
import { colors, font, radius } from "../../styles/tokens";
import Dashboard   from "../admin/Dashboard";
import VAReports   from "../admin/VaReports";
import VAInspector from "../admin/VaInspector";
import Schedule    from "../admin/Schedule";
import { SoonBadge } from "../ui/Indicators";

const NAV = [
  { id: "dashboard",    icon: LayoutDashboard, label: "Dashboard",    sub: "Overview",         component: Dashboard   },
  { id: "va_reports",   icon: ClipboardList,   label: "VA Reports",   sub: "EOD & Attendance", component: VAReports   },
  { id: "va_inspector", icon: UserSearch,      label: "VA Inspector", sub: "Per-VA history",   component: VAInspector },
  { id: "schedule",     icon: CalendarDays,    label: "Schedule",     sub: "Shift overview",   component: Schedule    },
];

const NAV_SOON = [
  { icon: BarChart3,   label: "EOM Reports"    },
  { icon: ShieldAlert, label: "Strike Tracker" },
];

export default function Layout({ user }) {
  const [activeTab, setActiveTab] = useState("dashboard");
  const ActivePage = NAV.find((n) => n.id === activeTab)?.component ?? Dashboard;

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: font.family, background: colors.bg }}>

      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <aside style={{
        width:         220,
        minWidth:      220,
        background:    colors.navy,
        display:       "flex",
        flexDirection: "column",
        height:        "100vh",
        borderRight:   `1px solid ${colors.navyBorder}`,
        overflowY:     "auto",
      }}>
        {/* Logo */}
        <div style={{ padding: "20px 20px 16px", borderBottom: `1px solid ${colors.navyBorder}` }}>
          <img
            src="https://images.leadconnectorhq.com/image/f_webp/q_80/r_1200/u_https://assets.cdn.filesafe.space/y0alJIjtUPUtCbTJC8PG/media/68710a1e0d2af8dd5e7394be.png"
            alt="Monster Task"
            style={{ width: 96, objectFit: "contain" }}
          />
        </div>

        {/* Primary nav */}
        <div style={{ flex: 1, padding: "12px 8px 0" }}>
          <NavGroupLabel>Menu</NavGroupLabel>

          {NAV.map((item) => {
            const active = activeTab === item.id;
            const Icon   = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                style={{
                  display:      "flex",
                  alignItems:   "center",
                  gap:          10,
                  width:        "100%",
                  padding:      "9px 12px",
                  borderRadius: radius.md,
                  border:       "none",
                  background:   active ? colors.navyLight : "transparent",
                  cursor:       "pointer",
                  fontFamily:   font.family,
                  marginBottom: 2,
                  transition:   "background .12s",
                  borderLeft:   active ? `3px solid ${colors.teal}` : "3px solid transparent",
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = colors.navyLight; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
              >
                <Icon size={16} strokeWidth={active ? 2.5 : 2} color={active ? colors.teal : "#7A9BB8"} />
                <div style={{ flex: 1, textAlign: "left" }}>
                  <div style={{
                    fontSize:   font.base,
                    fontWeight: active ? 700 : 500,
                    color:      active ? colors.white : "#C4D8EA",
                    lineHeight: 1.2,
                  }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: font.xs, color: active ? "#7A9BB8" : "#506A84", marginTop: 1 }}>
                    {item.sub}
                  </div>
                </div>
                {active && <ChevronRight size={13} color={colors.teal} />}
              </button>
            );
          })}

          {/* Coming soon */}
          <NavGroupLabel style={{ marginTop: 16 }}>Coming Soon</NavGroupLabel>
          {NAV_SOON.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} style={{
                display:      "flex",
                alignItems:   "center",
                gap:          10,
                padding:      "9px 12px",
                borderRadius: radius.md,
                cursor:       "default",
                marginBottom: 2,
                borderLeft:   "3px solid transparent",
              }}>
                <Icon size={16} color="#2C4460" />
                <span style={{ fontSize: font.base, color: "#2C4460", fontWeight: 500 }}>{item.label}</span>
                <SoonBadge />
              </div>
            );
          })}
        </div>

        {/* Sidebar footer */}
        <div style={{ borderTop: `1px solid ${colors.navyBorder}`, padding: "14px 12px 16px" }}>
          <div style={{
            fontSize:     font.xs,
            color:        "#7A9BB8",
            fontWeight:   600,
            marginBottom: 10,
            overflow:     "hidden",
            textOverflow: "ellipsis",
            whiteSpace:   "nowrap",
          }}>
            {user?.email}
          </div>
          <button
            onClick={() => signOut(auth)}
            style={{
              display:      "flex",
              alignItems:   "center",
              gap:          8,
              width:        "100%",
              padding:      "8px 12px",
              background:   "transparent",
              border:       `1px solid ${colors.navyBorder}`,
              borderRadius: radius.md,
              color:        "#7A9BB8",
              fontSize:     font.sm,
              fontWeight:   600,
              cursor:       "pointer",
              fontFamily:   font.family,
              transition:   "background .12s, color .12s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = colors.navyLight; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#7A9BB8"; }}
          >
            <LogOut size={14} />
            Sign Out
          </button>
          <div style={{ fontSize: font.xs, color: "#3A5472", marginTop: 10 }}>
            MT Admin — v0.1
          </div>
        </div>
      </aside>

      {/* ── Main area ────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>

        {/* Top bar */}
        <header style={{
          background:     colors.surface,
          borderBottom:   `1px solid ${colors.border}`,
          padding:        "0 32px",
          height:         52,
          display:        "flex",
          alignItems:     "center",
          justifyContent: "flex-end",
          flexShrink:     0,
        }}>
          <span style={{ fontSize: font.sm, color: colors.textMuted, fontWeight: 500 }}>
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </span>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: "auto", padding: "32px 40px", width: "100%", boxSizing: "border-box" }}>
          <ActivePage setActiveTab={setActiveTab} />
        </main>
      </div>
    </div>
  );
}

function NavGroupLabel({ children, style: extra }) {
  return (
    <div style={{
      fontSize:      font.xs,
      fontWeight:    700,
      color:         "#3A5472",
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      padding:       "8px 12px 6px",
      userSelect:    "none",
      ...extra,
    }}>
      {children}
    </div>
  );
}