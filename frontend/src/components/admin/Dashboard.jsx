import { useEffect, useState } from "react";
import {
  RefreshCw, Users, UserCheck, UserX, PauseCircle,
  UserPlus, CalendarClock, PauseOctagon, XCircle,
  ArrowUpRight, X,
} from "lucide-react";
import { colors, font, radius } from "../../styles/tokens";
import { apiFetch } from "../../api";
import { CommunityBadge, StatusBadge } from "../ui/Indicators";
import { Card, PageHeader } from "../ui/Structure";
import { cacheGet, cacheSet, cacheClear, cacheTimeLeft, CACHE_KEYS } from "../../utils/reportCache";
import { VANameLink } from "../../contexts/VAProfileContext";
import TopBarPortal from "../ui/TopBarPortal";
import TopBarCachedBanner from "../ui/TopBarCachedBanner";
import { Skeleton, StatBoxSkeleton, TableRowSkeleton, ListRowSkeleton } from "../ui/Skeleton";
import TopBarProgress from "../ui/TopBarProgress";

const BOX_RADIUS = 8;

// ── Inject animation styles once ─────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("mt-dashboard-styles")) {
  const tag = document.createElement("style");
  tag.id = "mt-dashboard-styles";
  tag.innerHTML = `
    .mt-stat-box:hover {
      border-color: ${colors.tealMid};
      box-shadow: 0 2px 8px rgba(12, 184, 169, 0.08);
      transform: translateY(-1px);
    }
    .mt-stat-clickable .mt-stat-hint {
      opacity: 0; transition: opacity .15s;
    }
    .mt-stat-clickable:hover .mt-stat-hint { opacity: 1; }

    @keyframes mt-dash-backdrop-in  { from { opacity: 0; } to { opacity: 1; } }
    @keyframes mt-dash-backdrop-out { from { opacity: 1; } to { opacity: 0; } }
    @keyframes mt-dash-card-in {
      from { opacity: 0; transform: translateY(8px) scale(.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes mt-dash-card-out {
      from { opacity: 1; transform: translateY(0) scale(1); }
      to   { opacity: 0; transform: translateY(8px) scale(.97); }
    }
    .mt-dash-backdrop-in  { animation: mt-dash-backdrop-in .2s ease-out forwards; }
    .mt-dash-backdrop-out { animation: mt-dash-backdrop-out .18s ease-out forwards; }
    .mt-dash-card-in      { animation: mt-dash-card-in .24s cubic-bezier(.2,.8,.2,1) forwards; }
    .mt-dash-card-out     { animation: mt-dash-card-out .18s cubic-bezier(.4,0,1,1) forwards; }
  `;
  document.head.appendChild(tag);
}

// ── Date formatter for contract dates ────────────────────────────
function fmtContractDate(iso) {
  if (!iso) return "—";
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

// ── Reusable stat box (now supports clickable variant) ────────────
function StatBox({ icon: Icon, value, label, accent, onClick }) {
  const valueColor =
    accent === "warning" ? colors.warning :
    accent === "danger"  ? colors.danger  :
    accent === "success" ? colors.success :
    accent === "teal"    ? colors.teal    :
    colors.textPrimary;

  const iconBg =
    accent === "warning" ? colors.warningLight :
    accent === "danger"  ? colors.dangerLight  :
    accent === "success" ? colors.successLight :
    colors.tealLight;

  const clickable = !!onClick;

  return (
    <div
      className={`mt-stat-box${clickable ? " mt-stat-clickable" : ""}`}
      onClick={onClick}
      style={{
        position: "relative",
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: BOX_RADIUS,
        padding: "16px 18px",
        cursor: clickable ? "pointer" : "default",
        transition: "border-color .15s, box-shadow .15s, transform .15s",
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      {clickable && (
        <div
          className="mt-stat-hint"
          style={{
            position: "absolute", top: 10, right: 10,
            display: "flex", alignItems: "center", gap: 3,
            fontSize: 10, fontWeight: 700, color: colors.teal,
            textTransform: "uppercase", letterSpacing: "0.04em",
          }}
        >
          <span>Details</span>
          <ArrowUpRight size={11} strokeWidth={2.5} />
        </div>
      )}
      {Icon && (
        <div style={{
          width: 40, height: 40, borderRadius: 8,
          background: iconBg,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <Icon size={18} color={valueColor} strokeWidth={2} />
        </div>
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 26, fontWeight: 800, color: valueColor, lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
        }}>
          {value}
        </div>
        <div style={{
          fontSize: 11, color: colors.textMuted, marginTop: 6,
          textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {label}
        </div>
      </div>
    </div>
  );
}

// ── BreakdownModal ───────────────────────────────────────────────
function BreakdownModal({ open, title, subtitle, onClose, children }) {
  const [closing, setClosing] = useState(false);

  function handleClose() {
    if (closing) return;
    setClosing(true);
    setTimeout(() => { setClosing(false); onClose(); }, 180);
  }

  useEffect(() => {
    if (!open) return;
    function handleEsc(e) { if (e.key === "Escape") handleClose(); }
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  return (
    <div
      onClick={handleClose}
      className={closing ? "mt-dash-backdrop-out" : "mt-dash-backdrop-in"}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(13, 31, 60, 0.45)",
        backdropFilter: "blur(2px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000, padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={closing ? "mt-dash-card-out" : "mt-dash-card-in"}
        style={{
          background: colors.surface,
          borderRadius: radius.lg,
          boxShadow: "0 10px 40px rgba(13,31,60,0.25)",
          maxWidth: 720, width: "100%", maxHeight: "85vh",
          display: "flex", flexDirection: "column",
          fontFamily: font.family,
        }}
      >
        <div style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: `1px solid ${colors.border}`,
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: colors.textPrimary }}>{title}</div>
            {subtitle && (
              <div style={{ fontSize: font.sm, color: colors.textMuted, marginTop: 2 }}>{subtitle}</div>
            )}
          </div>
          <button
            onClick={handleClose}
            style={{
              background: "transparent", border: "none", cursor: "pointer",
              padding: 6, display: "flex", alignItems: "center",
              borderRadius: radius.sm, color: colors.textMuted, marginLeft: 12,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = colors.surfaceAlt; e.currentTarget.style.color = colors.textPrimary; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = colors.textMuted; }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Contracts table (used inside each breakdown modal) ───────────
function ContractsTable({ items, dateLabel, emptyMessage }) {
  if (!items || items.length === 0) {
    return (
      <div style={{
        padding: "32px 20px", textAlign: "center",
        color: colors.textFaint, fontSize: font.sm,
        border: `1px solid ${colors.border}`, borderRadius: radius.md,
        background: colors.surfaceAlt,
      }}>
        {emptyMessage}
      </div>
    );
  }

  const thStyle = {
    padding: "10px 14px", textAlign: "left",
    fontSize: font.xs, fontWeight: 700, color: colors.textMuted,
    textTransform: "uppercase", letterSpacing: "0.05em",
    borderBottom: `1px solid ${colors.border}`,
    whiteSpace: "nowrap",
  };
  const tdStyle = (i) => ({
    padding: "10px 14px", fontSize: font.sm, color: colors.textBody,
    borderTop: i > 0 ? `1px solid ${colors.border}` : "none",
  });

  return (
    <div style={{ overflowX: "auto", border: `1px solid ${colors.border}`, borderRadius: radius.md }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
        <thead>
          <tr style={{ background: colors.surfaceAlt }}>
            <th style={thStyle}>VA Name</th>
            <th style={{ ...thStyle, textAlign: "center", width: 110 }}>Community</th>
            <th style={thStyle}>Client</th>
            <th style={{ ...thStyle, whiteSpace: "nowrap" }}>{dateLabel}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr
              key={item.contract_id || i}
              style={{ background: i % 2 === 0 ? colors.surface : colors.surfaceAlt }}
            >
              <td style={{ ...tdStyle(i), fontWeight: 600, color: colors.textPrimary, whiteSpace: "nowrap" }}>
                {item.va_name && item.va_name !== "Unknown VA"
                  ? <VANameLink name={item.va_name} />
                  : <span style={{ color: colors.textFaint }}>{item.va_name || "—"}</span>
                }
              </td>
              <td style={{ ...tdStyle(i), textAlign: "center" }}>
                {item.community && item.community !== "—"
                  ? <CommunityBadge community={item.community} />
                  : <span style={{ color: colors.textFaint, fontSize: font.sm }}>—</span>
                }
              </td>
              <td style={tdStyle(i)}>{item.client}</td>
              <td style={{ ...tdStyle(i), whiteSpace: "nowrap" }}>{fmtContractDate(item.date)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Breakdown configs — one per "This Week's Activity" card
const BREAKDOWN_CONFIGS = {
  new_onboardings: {
    title:        "New Onboardings",
    subtitle:     "Contracts that started recently",
    dateLabel:    "Start Date",
    emptyMessage: "No new onboardings to show.",
  },
  upcoming_onboardings: {
    title:        "Upcoming Onboardings",
    subtitle:     "Drafted contracts starting later this week",
    dateLabel:    "Expected Start",
    emptyMessage: "No upcoming onboardings this week.",
  },
  total_paused: {
    title:        "Paused This Week",
    subtitle:     "Contracts paused this week",
    dateLabel:    "Paused Date",
    emptyMessage: "No contracts paused this week.",
  },
  total_ended: {
    title:        "Ended This Week",
    subtitle:     "Contracts that ended this week",
    dateLabel:    "End Date",
    emptyMessage: "No contracts ended this week.",
  },
};

// ── VA row used in Flagged / Missing lists ────────────────────────
function VARow({ va, badge, i }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 16px",
      borderTop: i > 0 ? `1px solid ${colors.border}` : "none",
      background: i % 2 === 0 ? colors.surface : colors.surfaceAlt,
    }}>
      <CommunityBadge community={va.community} />
      <span style={{ flex: 1, fontWeight: 600, fontSize: font.sm, color: colors.textPrimary }}>
        <VANameLink name={va.name} />
      </span>
      {badge}
    </div>
  );
}

// ── Today's Activity row ──────────────────────────────────────────
function ActivityRow({ r, i }) {
  const td = {
    padding: "10px 12px", fontSize: font.sm, color: colors.textBody,
    borderTop: `1px solid ${colors.border}`, whiteSpace: "nowrap",
  };
  return (
    <tr style={{ background: i % 2 === 0 ? colors.surface : colors.surfaceAlt }}>
      <td style={td}><CommunityBadge community={r.community} /></td>
      <td style={{ ...td, fontWeight: 600, color: colors.textPrimary }}>
        <VANameLink name={r.va_name} />
      </td>
      <td style={td}>{r.client}</td>
      <td style={{ ...td, fontWeight: 600, color: colors.teal, fontSize: font.xs }}>{r.shift_time}</td>
      <td style={td}>
        {r.clock_in
          ? <span style={{ fontWeight: 500 }}>{r.clock_in.replace(" EST", "")}</span>
          : r.status === "Upcoming"
            ? <span style={{ color: colors.textFaint }}>—</span>
            : <span style={{ color: colors.danger, fontWeight: 600 }}>Missing</span>
        }
      </td>
      <td style={td}>
        {r.status === "Absent"
          ? <span style={{ color: colors.danger, fontWeight: 600 }}>Missing</span>
          : r.status === "Upcoming"
            ? <span style={{ color: colors.textFaint }}>—</span>
            : r.clock_in_status === "on_time"
              ? <span style={{ color: colors.success, fontWeight: 600 }}>On-time</span>
              : r.clock_in_status === "late"
                ? <span style={{ color: colors.warning, fontWeight: 600 }}>{r.clock_in_minutes_late}m late</span>
                : r.clock_in_status === "early"
                  ? <span style={{ color: "#7C3AED", fontWeight: 600 }}>{r.clock_in_minutes_early}m early</span>
                  : <span style={{ color: colors.textFaint }}>—</span>
        }
      </td>
      <td style={td}>
        <StatusBadgeDash status={r.status} />
      </td>
      <td style={td}>
        {r.status === "Clocked Out"
          ? <span style={{ fontWeight: 500 }}>{r.clock_out?.replace(" EST", "") || "—"}</span>
          : r.status === "Clocked In" && r.shift_ended
            ? <span style={{ color: colors.danger, fontWeight: 600 }}>Missing</span>
            : <span style={{ color: colors.textFaint }}>—</span>
        }
      </td>
      <td style={td}>
        {r.status === "Clocked Out"
          ? r.clock_out_status === "on_time"
            ? <span style={{ color: colors.success, fontWeight: 600 }}>On-time</span>
            : r.clock_out_status === "late"
              ? <span style={{ color: colors.warning, fontWeight: 600 }}>{r.clock_out_minutes_late}m late</span>
              : r.clock_out_status === "early"
                ? <span style={{ color: "#7C3AED", fontWeight: 600 }}>{r.clock_out_minutes_early}m early</span>
                : <span style={{ color: colors.textFaint }}>—</span>
          : r.status === "Clocked In" && r.shift_ended
            ? <span style={{ color: colors.danger, fontWeight: 600 }}>Missing</span>
            : <span style={{ color: colors.textFaint }}>—</span>
        }
      </td>
    </tr>
  );
}

function StatusBadgeDash({ status }) {
  if (status === "Upcoming") {
    return <span style={{ color: colors.textFaint, fontWeight: 600 }}>—</span>;
  }
  const config = {
    "Clocked In":  { color: colors.teal,    bg: colors.tealLight,    border: colors.tealMid },
    "Clocked Out": { color: colors.success, bg: colors.successLight, border: colors.successBorder },
    "Absent":      { color: colors.danger,  bg: colors.dangerLight,  border: colors.dangerBorder },
  };
  const c = config[status] || config["Absent"];
  return (
    <span style={{
      display: "inline-block", fontSize: font.xs, fontWeight: 700,
      color: c.color, background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: 4, padding: "2px 10px",
    }}>
      {status}
    </span>
  );
}

// ── Root ──────────────────────────────────────────────────────────
const CACHE_KEY      = CACHE_KEYS.DASHBOARD;
const CACHE_KEY_DASH = CACHE_KEYS.VA_DASH;

export default function Dashboard() {
  const [data,          setData]          = useState(() => cacheGet(CACHE_KEY));
  const [shiftData,     setShiftData]     = useState(() => cacheGet(CACHE_KEY_DASH));
  const [loading,       setLoading]       = useState(!cacheGet(CACHE_KEY));
  const [error,         setError]         = useState("");
  const [openBreakdown, setOpenBreakdown] = useState(null);

  useEffect(() => {
    if (!cacheGet(CACHE_KEY)) {
      apiFetch("/api/dashboard")
        .then(d => { cacheSet(CACHE_KEY, d); setData(d); })
        .catch(e => setError(e.message))
        .finally(() => setLoading(false));
    }
    if (!cacheGet(CACHE_KEY_DASH)) {
      apiFetch("/api/eod/dashboard")
        .then(d => { cacheSet(CACHE_KEY_DASH, d); setShiftData(d); })
        .catch(() => {});
    }
  }, []);

  function refresh() {
    cacheClear(CACHE_KEY);
    cacheClear(CACHE_KEY_DASH);
    setLoading(true); setError(""); setData(null); setShiftData(null);

    apiFetch("/api/dashboard")
      .then(d => { cacheSet(CACHE_KEY, d); setData(d); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));

    apiFetch("/api/eod/dashboard")
      .then(d => { cacheSet(CACHE_KEY_DASH, d); setShiftData(d); })
      .catch(() => {});
  }

  // ── Loading state (skeleton placeholders) ───────────────────────
  if (loading) {
    return (
      <>
        <TopBarProgress active={loading} />

        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 20 }}>
          <PageHeader
            title="Dashboard"
            subtitle="Live overview of your VA team and today's report status."
          />

          {/* Row 1 skeleton */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
            {Array.from({ length: 5 }).map((_, i) => <StatBoxSkeleton key={i} />)}
          </div>

          {/* Row 2 skeleton */}
          <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 20 }}>
            <Card title="This Week's Activity" noPadding>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: 16 }}>
                {Array.from({ length: 4 }).map((_, i) => <StatBoxSkeleton key={i} />)}
              </div>
            </Card>
            <div style={{
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: BOX_RADIUS,
              overflow: "hidden",
            }}>
              <div style={{ padding: "14px 16px", borderBottom: `1px solid ${colors.border}` }}>
                <Skeleton width={120} height={16} />
                <Skeleton width={180} height={10} style={{ marginTop: 6 }} />
              </div>
              {Array.from({ length: 3 }).map((_, i) => <ListRowSkeleton key={i} i={i} />)}
            </div>
          </div>

          {/* Row 3 skeleton */}
          <Card title="Today's Activity" noPadding>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: colors.navy }}>
                  {["Community", "Name", "Client", "Shift Time", "Clock In", "Punctuality", "Status", "Clock Out", "Submission"].map(h => (
                    <th key={h} style={{
                      padding: "10px 12px", fontSize: font.xs, fontWeight: 700,
                      color: "#fff", textAlign: "left", letterSpacing: "0.04em",
                      textTransform: "uppercase",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 6 }).map((_, i) => (
                  <TableRowSkeleton
                    key={i}
                    rowBg={i % 2 === 0 ? colors.surface : colors.surfaceAlt}
                    cellWidths={["60%", "70%", "60%", "50%", "50%", "60%", "50%", "50%", "60%"]}
                  />
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </>
    );
  }

  // ── Error state ─────────────────────────────────────────────────
  if (error) {
    return (
      <div style={{
        background: colors.dangerLight, border: `1.5px solid ${colors.dangerBorder}`,
        borderRadius: BOX_RADIUS, padding: "16px 20px",
        color: colors.danger, fontWeight: 600, fontSize: font.base,
      }}>
        Failed to load dashboard: {error}
      </div>
    );
  }

  if (!data) return null;

  const { va_counts, missing } = data;

  const todayRows = shiftData
    ? [...(shiftData.morning || []), ...(shiftData.mid || []), ...(shiftData.afternoon || [])]
    : [];

  // Weekly activity counts + items (items power the click-through modals)
  const wa      = data.weekly_activity       || {};
  const waItems = data.weekly_activity_items || {};
  const newCount      = wa.new_onboardings ?? 0;
  const upcomingCount = wa.upcoming_onboardings ?? 0;
  const pausedCount   = wa.total_paused ?? 0;
  const endedCount    = wa.total_ended ?? 0;

  const activeConfig = openBreakdown ? BREAKDOWN_CONFIGS[openBreakdown] : null;
  const activeItems  = openBreakdown ? (waItems[openBreakdown] || []) : [];

  // ── Loaded state (real dashboard) ───────────────────────────────
  return (
    <>
      <TopBarProgress active={loading} />

      <TopBarCachedBanner cacheKey={CACHE_KEY} onRefresh={refresh} loading={loading} />

      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 20 }}>
        <PageHeader
          title="Dashboard"
          subtitle="Live overview of your VA team and today's report status."
        />

        {/* ── Row 1: 5 top-level stat boxes ───────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
          <StatBox icon={Users}        value={va_counts.total}            label="Total VAs" />
          <StatBox icon={UserCheck}    value={va_counts.main}             label="Agency VAs" accent="teal" />
          <StatBox icon={UserCheck}    value={va_counts.cba}              label="CBA VAs"    accent="teal" />
          <StatBox
            icon={UserX}
            value={va_counts.no_contract ?? 0}
            label="No Contracts"
            accent={(va_counts.no_contract ?? 0) > 0 ? "warning" : undefined}
          />
          <StatBox
            icon={PauseCircle}
            value={va_counts.paused_contracts ?? 0}
            label="Paused Contracts"
            accent={(va_counts.paused_contracts ?? 0) > 0 ? "warning" : undefined}
          />
        </div>

        {/* ── Row 2: This Week's Activity (left) + Flagged/Missing (right) ── */}
        <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 20 }}>

          {/* Left: This Week's Activity */}
          <Card title="This Week's Activity" noPadding>
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr",
              gap: 12, padding: 16,
            }}>
              <StatBox
                icon={UserPlus}
                value={newCount}
                label="New Onboardings"
                accent="success"
                onClick={newCount > 0 ? () => setOpenBreakdown("new_onboardings") : undefined}
              />
              <StatBox
                icon={CalendarClock}
                value={upcomingCount}
                label="Upcoming Onboardings"
                accent="teal"
                onClick={upcomingCount > 0 ? () => setOpenBreakdown("upcoming_onboardings") : undefined}
              />
              <StatBox
                icon={PauseOctagon}
                value={pausedCount}
                label="Total Paused"
                accent={pausedCount > 0 ? "warning" : undefined}
                onClick={pausedCount > 0 ? () => setOpenBreakdown("total_paused") : undefined}
              />
              <StatBox
                icon={XCircle}
                value={endedCount}
                label="Total Ended"
                accent={endedCount > 0 ? "danger" : undefined}
                onClick={endedCount > 0 ? () => setOpenBreakdown("total_ended") : undefined}
              />
            </div>
          </Card>

          {/* Right: Flagged + Missing combined */}
          <div style={{
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: BOX_RADIUS,
            overflow: "hidden",
          }}>
            {/* Flagged section */}
            <div style={{ padding: "14px 16px", borderBottom: `1px solid ${colors.border}` }}>
              <div style={{ fontSize: font.base, fontWeight: 700, color: colors.textPrimary }}>
                Flagged VAs
              </div>
              <div style={{ fontSize: font.xs, color: colors.textMuted, marginTop: 2 }}>
                {missing.flagged_count} consecutive missing report{missing.flagged_count !== 1 ? "s" : ""}
              </div>
            </div>
            <div>
              {missing.flagged_vas.length === 0 ? (
                <div style={{ padding: "12px 16px", fontSize: font.sm, color: colors.textMuted }}>
                  No VAs flagged. All clear.
                </div>
              ) : (
                missing.flagged_vas.map((va, i) => (
                  <VARow key={i} va={va} i={i}
                    badge={<StatusBadge variant="danger">Flagged</StatusBadge>}
                  />
                ))
              )}
            </div>

            {/* Missing Yesterday section */}
            <div style={{
              padding: "14px 16px",
              borderTop: `1px solid ${colors.border}`,
              borderBottom: `1px solid ${colors.border}`,
              background: colors.surfaceAlt,
            }}>
              <div style={{ fontSize: font.sm, fontWeight: 700, color: colors.textPrimary }}>
                Missing Reports (Yesterday)
              </div>
              <div style={{ fontSize: font.xs, color: colors.textMuted, marginTop: 2 }}>
                {missing.count} VA{missing.count !== 1 ? "s" : ""}
              </div>
            </div>
            <div>
              {missing.vas.length === 0 ? (
                <div style={{ padding: "12px 16px", fontSize: font.sm, color: colors.textMuted }}>
                  All VAs submitted their EOD reports.
                </div>
              ) : (
                missing.vas.map((va, i) => (
                  <VARow
                    key={i} va={va} i={i}
                    badge={
                      missing.flagged_vas.some(f => f.name === va.name)
                        ? <StatusBadge variant="danger">Flagged</StatusBadge>
                        : <StatusBadge variant="warning">1 day</StatusBadge>
                    }
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* ── Row 3: Today's Activity ────────────────────────────── */}
        <Card title="Today's Activity" noPadding>
          {todayRows.length === 0 ? (
            <div style={{ padding: "32px 20px", textAlign: "center", color: colors.textFaint, fontSize: font.sm }}>
              No shift activity recorded yet today.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: colors.navy }}>
                    {[
                      "Community", "Name", "Client", "Shift Time",
                      "Clock In", "Punctuality", "Status", "Clock Out", "Submission"
                    ].map(h => (
                      <th key={h} style={{
                        padding: "10px 12px", fontSize: font.xs, fontWeight: 700,
                        color: "#fff", textAlign: "left", letterSpacing: "0.04em",
                        textTransform: "uppercase", whiteSpace: "nowrap",
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {todayRows.map((r, i) => (
                    <ActivityRow key={i} r={r} i={i} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* ── Breakdown modal ───────────────────────────────────── */}
      <BreakdownModal
        open={!!openBreakdown}
        title={activeConfig?.title || ""}
        subtitle={activeConfig?.subtitle || ""}
        onClose={() => setOpenBreakdown(null)}
      >
        <ContractsTable
          items={activeItems}
          dateLabel={activeConfig?.dateLabel || "Date"}
          emptyMessage={activeConfig?.emptyMessage || "Nothing to show."}
        />
      </BreakdownModal>
    </>
  );
}