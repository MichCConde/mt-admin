import { useState, useEffect } from "react";
import {
  LayoutDashboard, ClipboardList, Users,
  CalendarDays, BarChart3, ShieldAlert, ChevronRight, ChevronLeft,
  LogOut, ScrollText, FileSpreadsheet, Settings as SettingsIcon,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { auth }   from "../../firebase";
import { colors, font, radius } from "../../styles/tokens";
import Dashboard          from "../admin/Dashboard";
import VirtualAssistants  from "../admin/VirtualAssistants";
import Schedule           from "../admin/Schedule";
import EowReports         from "../admin/EowReports";
import ActivityLogs       from "../admin/ActivityLogs";
import EomReports         from "../admin/EomReports";
import Settings           from "../admin/Settings";
import StaffDashboard from "../admin/StaffDashboard";
import { SoonBadge }      from "../ui/Indicators";
import { logActivity, LOG_TYPES } from "../../utils/logger";
import { apiFetch, wakeBackend } from "../../api";
import { canAccessPage, showComingSoon, getRoleLabel } from "../../utils/roles";

import ErrorBoundary from "../ui/ErrorBoundary";
import { cacheGet, cacheSet, cacheClearAll, CACHE_KEYS } from "../../utils/reportCache";

import { useInactivityTimeout } from "../../hooks/useInactivityTimeout";

const NAV = [
  { id: "dashboard",           icon: LayoutDashboard, label: "Dashboard",          sub: "Overview",            component: Dashboard },
  { id: "virtual_assistants",  icon: ClipboardList,   label: "Virtual Assistants", sub: "EOD & Attendance",    component: VirtualAssistants },
  { id: "schedule",            icon: CalendarDays,    label: "Schedule",           sub: "Shift overview",      component: Schedule },
  { id: "eow_reports",         icon: FileSpreadsheet, label: "EOW Reports",        sub: "End-of-week reports", component: EowReports },
  { id: "eom_reports",         icon: BarChart3,       label: "EOM Reports",        sub: "Monthly performance", component: EomReports },
  { id: "activity_logs",       icon: ScrollText,      label: "Activity Logs",      sub: "Audit trail",         component: ActivityLogs },
  { id: "staff_management",    icon: Users,           label: "Staff",              sub: "Manage accounts",     component: StaffDashboard },
];

const NAV_SOON = [
  { icon: ShieldAlert, label: "Strike Tracker" },
];

const SIDEBAR_EXPANDED = 220;
const SIDEBAR_COLLAPSED = 64;

export default function Layout({ user, staff }) {
  const role = staff?.role || "sme";
  useInactivityTimeout(); 
  const allowedNav = NAV.filter(item => canAccessPage(role, item.id));

  const [activeTab, setActiveTab] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(() => {
    try { return sessionStorage.getItem("sidebar_collapsed") === "true"; } catch { return false; }
  });

  // Settings is a special page — not in NAV
  const isSettings = activeTab === "settings";
  const ActivePage = isSettings
    ? () => <Settings staff={staff} />
    : (allowedNav.find(n => n.id === activeTab)?.component ?? Dashboard);

  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED;

  function toggleSidebar() {
    const next = !collapsed;
    setCollapsed(next);
    try { sessionStorage.setItem("sidebar_collapsed", String(next)); } catch {}
  }

  // If role changes and current tab is no longer allowed, redirect to dashboard
  useEffect(() => {
    if (activeTab !== "settings" && !canAccessPage(role, activeTab)) {
      setActiveTab("dashboard");
    }
  }, [role, activeTab]);

  useEffect(() => {
    const current = NAV.find(n => n.id === activeTab);
    document.title = isSettings
      ? "Settings · MT Admin"
      : current ? `${current.label} · MT Admin` : "MT Admin";
  }, [activeTab, isSettings]);

  useEffect(() => { wakeBackend(); }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!cacheGet(CACHE_KEYS.VA_LIST)) {
        apiFetch("/api/inspector/vas")
          .then(d => cacheSet(CACHE_KEYS.VA_LIST, d.vas ?? []))
          .catch(() => {});
      }
      if (!cacheGet(CACHE_KEYS.SCHEDULE) && canAccessPage(role, "schedule")) {
        apiFetch("/api/schedule")
          .then(d => cacheSet(CACHE_KEYS.SCHEDULE, d.vas ?? []))
          .catch(() => {});
      }
    }, 2000);
    return () => clearTimeout(t);
  }, [role]);

  const btnBase = {
    display: "flex", alignItems: "center",
    width: "100%", borderRadius: radius.md,
    border: `1px solid ${colors.navyBorder}`,
    background: "transparent",
    color: "#7A9BB8", fontSize: font.sm, fontWeight: 600,
    cursor: "pointer", fontFamily: font.family,
    transition: "background .12s, color .12s",
  };

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: font.family, background: colors.bg }}>

      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <aside style={{
        position: "relative",
        width: sidebarWidth, minWidth: sidebarWidth,
        background: colors.navy,
        display: "flex", flexDirection: "column",
        height: "100vh",
        borderRight: `1px solid ${colors.navyBorder}`,
        overflow: "visible",
        transition: "width .2s ease, min-width .2s ease",
      }}>

        {/* Scrollable inner wrapper */}
        <div style={{
          display: "flex", flexDirection: "column", flex: 1,
          overflowY: "auto", overflowX: "hidden",
        }}>

          {/* Logo */}
          <div style={{
            padding: collapsed ? "20px 0 16px" : "20px 20px 16px",
            borderBottom: `1px solid ${colors.navyBorder}`,
            display: "flex", justifyContent: "center", alignItems: "center",
          }}>
            <img
              src="/mt-logo.png"
              alt="Monster Task"
              style={{
                width: collapsed ? 36 : 96,
                objectFit: "contain",
                transition: "width .2s ease",
              }}
            />
          </div>

          {/* Primary nav */}
          <div style={{ flex: 1, padding: collapsed ? "12px 6px 0" : "12px 8px 0" }}>
            {!collapsed && <NavGroupLabel>Menu</NavGroupLabel>}

            {allowedNav.map((item) => {
              const active = activeTab === item.id;
              const Icon   = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  title={collapsed ? item.label : undefined}
                  style={{
                    display: "flex", alignItems: "center",
                    justifyContent: collapsed ? "center" : "flex-start",
                    gap: collapsed ? 0 : 10,
                    width: "100%",
                    padding: collapsed ? "10px 0" : "9px 12px",
                    borderRadius: radius.md, border: "none",
                    background: active ? colors.navyLight : "transparent",
                    cursor: "pointer", fontFamily: font.family,
                    marginBottom: 2, transition: "background .12s",
                    borderLeft: active ? `3px solid ${colors.teal}` : "3px solid transparent",
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = colors.navyLight; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
                >
                  <Icon size={16} strokeWidth={active ? 2.5 : 2} color={active ? colors.teal : "#7A9BB8"} />
                  {!collapsed && (
                    <>
                      <div style={{ flex: 1, textAlign: "left" }}>
                        <div style={{
                          fontSize: font.base,
                          fontWeight: active ? 700 : 500,
                          color: active ? colors.white : "#C4D8EA",
                          lineHeight: 1.2,
                        }}>
                          {item.label}
                        </div>
                        <div style={{ fontSize: font.xs, color: active ? "#7A9BB8" : "#506A84", marginTop: 1 }}>
                          {item.sub}
                        </div>
                      </div>
                      {active && <ChevronRight size={13} color={colors.teal} />}
                    </>
                  )}
                </button>
              );
            })}

            {/* Coming soon — admin only */}
            {showComingSoon(role) && (
              <>
                {!collapsed && <NavGroupLabel style={{ marginTop: 16 }}>Coming Soon</NavGroupLabel>}
                {NAV_SOON.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} title={collapsed ? item.label : undefined} style={{
                      display: "flex", alignItems: "center",
                      justifyContent: collapsed ? "center" : "flex-start",
                      gap: collapsed ? 0 : 10,
                      padding: collapsed ? "9px 0" : "9px 12px",
                      borderRadius: radius.md, cursor: "default",
                      marginBottom: 2, borderLeft: "3px solid transparent",
                    }}>
                      <Icon size={16} color="#2C4460" />
                      {!collapsed && (
                        <>
                          <span style={{ fontSize: font.base, color: "#2C4460", fontWeight: 500 }}>{item.label}</span>
                          <SoonBadge />
                        </>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {/* Sidebar footer */}
          <div style={{
            borderTop: `1px solid ${colors.navyBorder}`,
            padding: collapsed ? "14px 6px 16px" : "14px 12px 16px",
            display: "flex", flexDirection: "column", gap: 6,
          }}>
            {!collapsed && (
              <div style={{
                fontSize: font.xs, color: "#7A9BB8", fontWeight: 600,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                marginBottom: 4,
              }}>
                {staff?.name || user?.email}
                <span style={{
                  display: "inline-block", marginLeft: 6,
                  fontSize: "9px", fontWeight: 800, color: colors.teal,
                  background: colors.navyLight, borderRadius: 4,
                  padding: "1px 6px", verticalAlign: "middle",
                  textTransform: "uppercase", letterSpacing: "0.05em",
                }}>
                  {getRoleLabel(role)}
                </span>
              </div>
            )}

            {/* Settings */}
            <button
              onClick={() => setActiveTab("settings")}
              title={collapsed ? "Settings" : undefined}
              style={{
                ...btnBase,
                justifyContent: collapsed ? "center" : "flex-start",
                gap: collapsed ? 0 : 8,
                padding: collapsed ? "8px 0" : "8px 12px",
                borderColor: isSettings ? colors.teal : colors.navyBorder,
                background: isSettings ? colors.navyLight : "transparent",
                color: isSettings ? colors.teal : "#7A9BB8",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = colors.navyLight; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={e => {
                e.currentTarget.style.background = isSettings ? colors.navyLight : "transparent";
                e.currentTarget.style.color = isSettings ? colors.teal : "#7A9BB8";
              }}
            >
              <SettingsIcon size={14} />
              {!collapsed && "Settings"}
            </button>

            {/* Sign out */}
            <button
              onClick={async () => {
                await logActivity(LOG_TYPES.SIGN_OUT, `${user?.email} signed out`);
                cacheClearAll();
                signOut(auth);
              }}
              title={collapsed ? "Sign Out" : undefined}
              style={{
                ...btnBase,
                justifyContent: collapsed ? "center" : "flex-start",
                gap: collapsed ? 0 : 8,
                padding: collapsed ? "8px 0" : "8px 12px",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = colors.navyLight; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#7A9BB8"; }}
            >
              <LogOut size={14} />
              {!collapsed && "Sign Out"}
            </button>

            {!collapsed && (
              <div style={{ fontSize: font.xs, color: "#3A5472", marginTop: 2 }}>
                MT Admin — v2.0
              </div>
            )}
          </div>

        </div>

        {/* Floating collapse toggle */}
        <button
          onClick={toggleSidebar}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          style={{
            position: "absolute", bottom: 60, right: -14,
            width: 28, height: 28, borderRadius: "50%",
            background: colors.teal, border: `2px solid ${colors.navy}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", zIndex: 10,
            transition: "background .15s",
            boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
          }}
          onMouseEnter={e => e.currentTarget.style.background = colors.tealHover}
          onMouseLeave={e => e.currentTarget.style.background = colors.teal}
        >
          {collapsed
            ? <ChevronRight size={14} color="#fff" strokeWidth={2.5} />
            : <ChevronLeft size={14} color="#fff" strokeWidth={2.5} />
          }
        </button>

      </aside>

      {/* ── Main area ────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>

        {/* Top bar */}
        <header style={{
          background: colors.surface,
          borderBottom: `1px solid ${colors.border}`,
          padding: "0 32px", height: 52,
          display: "flex", alignItems: "center", justifyContent: "flex-end",
          flexShrink: 0,
        }}>
          <span style={{ fontSize: font.sm, color: colors.textMuted, fontWeight: 500 }}>
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </span>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: "auto", padding: "32px 40px", width: "100%", boxSizing: "border-box" }}>
          <ErrorBoundary level="page" pageName={isSettings ? "Settings" : (allowedNav.find(n => n.id === activeTab)?.label)}>
            <ActivePage setActiveTab={setActiveTab} />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

function NavGroupLabel({ children, style: extra }) {
  return (
    <div style={{
      fontSize: font.xs, fontWeight: 700, color: "#3A5472",
      letterSpacing: "0.08em", textTransform: "uppercase",
      padding: "8px 12px 6px", userSelect: "none",
      ...extra,
    }}>
      {children}
    </div>
  );
}