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
import { VAProfileProvider } from "../../contexts/VAProfileContext";

import ErrorBoundary from "../ui/ErrorBoundary";
import { cacheGet, cacheSet, cacheClearAll, CACHE_KEYS } from "../../utils/reportCache";

import { useInactivityTimeout } from "../../hooks/useInactivityTimeout";

const NAV = [
  { id: "dashboard",           icon: LayoutDashboard, label: "Dashboard",          component: Dashboard },
  { id: "virtual_assistants",  icon: ClipboardList,   label: "Virtual Assistants", component: VirtualAssistants },
  { id: "schedule",            icon: CalendarDays,    label: "Schedule",           component: Schedule },
  { id: "eow_reports",         icon: FileSpreadsheet, label: "EOW Reports",        component: EowReports },
  { id: "eom_reports",         icon: BarChart3,       label: "EOM Reports",        component: EomReports },
  { id: "activity_logs",       icon: ScrollText,      label: "Activity Logs",      component: ActivityLogs },
  { id: "staff_management",    icon: Users,           label: "Staff",              component: StaffDashboard },
];

const NAV_SOON = [
  { icon: ShieldAlert, label: "Strike Tracker" },
];

const SIDEBAR_EXPANDED = 240;
const SIDEBAR_COLLAPSED = 72;

// Subtler corner radius — Tabela-style without being too rounded
const ITEM_RADIUS = 6;

export default function Layout({ user, staff }) {
  const role = staff?.role || "sme";
  useInactivityTimeout();
  const allowedNav = NAV.filter(item => canAccessPage(role, item.id));

  const [activeTab, setActiveTab] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(() => {
    try { return sessionStorage.getItem("sidebar_collapsed") === "true"; } catch { return false; }
  });

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

  // Get user initials for avatar
  const userInitials = (() => {
    const name = staff?.name || user?.email || "?";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  })();

  return (
    <VAProfileProvider>
      {/* Global fade-in keyframes */}
      <style>{`
        @keyframes mt-fade-in {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .mt-page-fade {
          animation: mt-fade-in 0.22s ease-out;
        }
      `}</style>

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
            padding: collapsed ? "20px 12px" : "24px 16px",
          }}>

            {/* ── Logo lockup: icon + wordmark ────────────────────── */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: collapsed ? "center" : "flex-start",
              gap: collapsed ? 0 : 12,
              padding: "0 6px",
              marginBottom: 32,
              minHeight: 36,
            }}>
              <div style={{
                width: 32, height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}>
                <img
                  src="/mt-logo.png"
                  alt="Monster Task"
                  style={{
                    maxWidth: "100%",
                    maxHeight: "100%",
                    objectFit: "contain",
                    display: "block",
                  }}
                />
              </div>
              {!collapsed && (
                <span style={{
                  fontSize: 17,
                  fontWeight: 800,
                  color: "#fff",
                  letterSpacing: "-0.01em",
                  whiteSpace: "nowrap",
                  lineHeight: 1,
                }}>
                  Monster Task
                </span>
              )}
            </div>

            {/* ── Primary nav ─────────────────────────────────────── */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
              {allowedNav.map((item) => {
                const active = activeTab === item.id;
                const Icon   = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    title={collapsed ? item.label : undefined}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: collapsed ? "center" : "flex-start",
                      gap: collapsed ? 0 : 12,
                      width: "100%",
                      padding: collapsed ? "10px 0" : "10px 14px",
                      borderRadius: ITEM_RADIUS,
                      border: "none",
                      background: active ? colors.navyLight : "transparent",
                      cursor: "pointer",
                      fontFamily: font.family,
                      transition: "background .15s, color .15s",
                      textAlign: "left",
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = colors.navyLight; }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
                  >
                    <Icon
                      size={18}
                      strokeWidth={active ? 2.25 : 2}
                      color={active ? colors.teal : "#9FB3CC"}
                    />
                    {!collapsed && (
                      <span style={{
                        fontSize: 14,
                        fontWeight: active ? 600 : 500,
                        color: active ? colors.teal : "#C4D8EA",
                      }}>
                        {item.label}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* Coming soon — admin only */}
              {showComingSoon(role) && (
                <>
                  {!collapsed && (
                    <div style={{
                      fontSize: 10, fontWeight: 700,
                      color: "#3A5472",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      padding: "20px 14px 8px",
                    }}>
                      Coming Soon
                    </div>
                  )}
                  {NAV_SOON.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.label}
                        title={collapsed ? item.label : undefined}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: collapsed ? "center" : "flex-start",
                          gap: collapsed ? 0 : 12,
                          padding: collapsed ? "10px 0" : "10px 14px",
                          borderRadius: ITEM_RADIUS,
                          cursor: "default",
                          opacity: 0.5,
                        }}
                      >
                        <Icon size={18} color="#506A84" />
                        {!collapsed && (
                          <>
                            <span style={{ fontSize: 14, color: "#506A84", fontWeight: 500, flex: 1 }}>
                              {item.label}
                            </span>
                            <SoonBadge />
                          </>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>

            {/* ── Footer: Settings + Sign Out buttons ────────────── */}
            <div style={{
              display: "flex", flexDirection: "column", gap: 3,
              paddingTop: 16,
              marginTop: 16,
              borderTop: `1px solid ${colors.navyBorder}`,
            }}>
              <button
                onClick={() => setActiveTab("settings")}
                title={collapsed ? "Settings" : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: collapsed ? "center" : "flex-start",
                  gap: collapsed ? 0 : 12,
                  width: "100%",
                  padding: collapsed ? "10px 0" : "10px 14px",
                  borderRadius: ITEM_RADIUS,
                  border: "none",
                  background: isSettings ? colors.navyLight : "transparent",
                  cursor: "pointer", fontFamily: font.family,
                  transition: "background .15s",
                  textAlign: "left",
                }}
                onMouseEnter={e => { if (!isSettings) e.currentTarget.style.background = colors.navyLight; }}
                onMouseLeave={e => { if (!isSettings) e.currentTarget.style.background = "transparent"; }}
              >
                <SettingsIcon size={18} color={isSettings ? colors.teal : "#9FB3CC"} />
                {!collapsed && (
                  <span style={{
                    fontSize: 14,
                    fontWeight: isSettings ? 600 : 500,
                    color: isSettings ? colors.teal : "#C4D8EA",
                  }}>
                    Settings
                  </span>
                )}
              </button>

              <button
                onClick={async () => {
                  await logActivity(LOG_TYPES.SIGN_OUT, `${user?.email} signed out`);
                  cacheClearAll();
                  signOut(auth);
                }}
                title={collapsed ? "Sign Out" : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: collapsed ? "center" : "flex-start",
                  gap: collapsed ? 0 : 12,
                  width: "100%",
                  padding: collapsed ? "10px 0" : "10px 14px",
                  borderRadius: ITEM_RADIUS,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer", fontFamily: font.family,
                  transition: "background .15s",
                  textAlign: "left",
                }}
                onMouseEnter={e => e.currentTarget.style.background = colors.navyLight}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <LogOut size={18} color="#9FB3CC" />
                {!collapsed && (
                  <span style={{ fontSize: 14, fontWeight: 500, color: "#C4D8EA" }}>
                    Log Out
                  </span>
                )}
              </button>

              {/* User profile card */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: collapsed ? 0 : 10,
                justifyContent: collapsed ? "center" : "flex-start",
                padding: collapsed ? "12px 0 4px" : "16px 6px 4px",
                marginTop: 8,
                borderTop: `1px solid ${colors.navyBorder}`,
              }}>
                <div style={{
                  width: 36, height: 36,
                  borderRadius: "50%",
                  background: colors.teal,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center", justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 800,
                  flexShrink: 0,
                  letterSpacing: "0.02em",
                }}>
                  {userInitials}
                </div>
                {!collapsed && (
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#fff",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>
                      {staff?.name || user?.email?.split("@")[0] || "User"}
                    </div>
                    <div style={{
                      fontSize: 11,
                      color: "#7A9BB8",
                      fontWeight: 500,
                      marginTop: 1,
                    }}>
                      {getRoleLabel(role)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Floating collapse toggle */}
          <button
            onClick={toggleSidebar}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            style={{
              position: "absolute", bottom: 84, right: -14,
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
            position: "relative",   // ← add this
            background: colors.surface,
            borderBottom: `1px solid ${colors.border}`,
            padding: "0 32px", height: 52,
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
            flexShrink: 0,
          }}>
            {/* Slot for page-injected content (cached banners, status, etc.) */}
            <div
              id="mt-top-bar-slot"
              style={{ flex: 1, display: "flex", alignItems: "center", minWidth: 0 }}
            />
            <span style={{ fontSize: font.sm, color: colors.textMuted, fontWeight: 500, flexShrink: 0 }}>
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
            </span>
          </header>

          {/* Page content — keyed by activeTab so it re-mounts and replays the fade animation */}
          <main style={{ flex: 1, overflowY: "auto", padding: "32px 40px", width: "100%", boxSizing: "border-box" }}>
            <div key={activeTab} className="mt-page-fade">
              <ErrorBoundary level="page" pageName={isSettings ? "Settings" : (allowedNav.find(n => n.id === activeTab)?.label)}>
                <ActivePage setActiveTab={setActiveTab} />
              </ErrorBoundary>
            </div>
          </main>
        </div>
      </div>
    </VAProfileProvider>
  );
}