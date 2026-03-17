import { useState } from "react";
import {
  LayoutDashboard,
  ClipboardList,
  BarChart3,
  ShieldAlert,
  CalendarDays,
  ChevronRight,
} from "lucide-react";
import { colors, font, radius } from "../../styles/tokens";
import Dashboard from "../admin/Dashboard";
import VAReports from "../admin/VaReports";
import { SoonBadge } from "../ui/Badge";

const NAV = [
  { id: "dashboard",  icon: LayoutDashboard, label: "Dashboard", sub: "Overview",         component: Dashboard },
  { id: "va_reports", icon: ClipboardList,   label: "VA Reports", sub: "EOD & Attendance", component: VAReports },
];

const NAV_SOON = [
  { icon: BarChart3,    label: "EOM Reports"     },
  { icon: ShieldAlert,  label: "Strike Tracker"  },
  { icon: CalendarDays, label: "Schedule"         },
];

export default function Layout() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const ActivePage = NAV.find((n) => n.id === activeTab)?.component ?? Dashboard;

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: font.family, background: colors.bg }}>

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside style={{
        width:          240,
        minWidth:       240,
        background:     colors.navy,
        display:        "flex",
        flexDirection:  "column",
        height:         "100vh",
        borderRight:    `1px solid ${colors.navyBorder}`,
        overflowY:      "auto",
      }}>
        {/* Logo */}
        <div style={{
          padding:        "24px 20px 20px",
          borderBottom:   `1px solid ${colors.navyBorder}`,
        }}>
          <img
            src="https://images.leadconnectorhq.com/image/f_webp/q_80/r_1200/u_https://assets.cdn.filesafe.space/y0alJIjtUPUtCbTJC8PG/media/68710a1e0d2af8dd5e7394be.png"
            alt="Monster Task"
            style={{ width: 140, objectFit: "contain" }}
          />
        </div>

        {/* Primary nav */}
        <div style={{ flex: 1, padding: "16px 10px 0" }}>
          <NavGroupLabel>Menu</NavGroupLabel>

          {NAV.map((item) => {
            const active = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                style={{
                  display:       "flex",
                  alignItems:    "center",
                  gap:           10,
                  width:         "100%",
                  padding:       "9px 12px",
                  borderRadius:  radius.md,
                  border:        "none",
                  background:    active ? colors.navyLight : "transparent",
                  cursor:        "pointer",
                  fontFamily:    font.family,
                  marginBottom:  2,
                  transition:    "background .12s",
                  borderLeft:    active ? `3px solid ${colors.teal}` : "3px solid transparent",
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = colors.navyLight; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
              >
                <Icon
                  size={16}
                  strokeWidth={active ? 2.5 : 2}
                  color={active ? colors.teal : colors.navyMuted}
                />
                <div style={{ flex: 1, textAlign: "left" }}>
                  <div style={{ fontSize: font.base, fontWeight: active ? 700 : 500, color: active ? colors.white : colors.navyText, lineHeight: 1.2 }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: font.xs, color: active ? colors.navyMuted : "#2E4A6A", marginTop: 1 }}>
                    {item.sub}
                  </div>
                </div>
                {active && <ChevronRight size={13} color={colors.teal} />}
              </button>
            );
          })}

          {/* Coming soon section */}
          <NavGroupLabel style={{ marginTop: 20 }}>Coming Soon</NavGroupLabel>
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
                <Icon size={16} color="#1E3255" />
                <span style={{ fontSize: font.base, color: "#1E3255", fontWeight: 500 }}>{item.label}</span>
                <SoonBadge />
              </div>
            );
          })}
        </div>

        {/* Sidebar footer */}
        <div style={{ padding: "16px 20px", borderTop: `1px solid ${colors.navyBorder}` }}>
          <div style={{ fontSize: font.xs, color: "#253D5C", fontWeight: 600 }}>MT Admin — v0.1</div>
          <div style={{ fontSize: font.xs, color: "#1A2E47", marginTop: 2 }}>Dev Mode</div>
        </div>
      </aside>

      {/* ── Main area ──────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>

        {/* Top bar */}
        <header style={{
          background:    colors.surface,
          borderBottom:  `1px solid ${colors.border}`,
          padding:       "0 32px",
          height:        56,
          display:       "flex",
          alignItems:    "center",
          justifyContent:"flex-end",
          flexShrink:    0,
        }}>
          <span style={{ fontSize: font.sm, color: colors.textMuted, fontWeight: 500 }}>
            {new Date().toLocaleDateString("en-US", {
              weekday: "long", month: "long", day: "numeric", year: "numeric",
            })}
          </span>
        </header>

        {/* Scrollable page content — full width */}
        <main style={{ flex: 1, overflowY: "auto", padding: "36px 40px" }}>
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
      color:         "#1E3255",
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