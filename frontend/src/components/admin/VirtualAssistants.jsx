import { useState, useEffect, useRef } from "react";
import {
  FileCheck, CheckCircle2,
  Users, RefreshCw,
  Search, Send, AlertTriangle, Clock, UserX, UserCheck,
  PauseCircle, ChevronDown,
} from "lucide-react";
import { colors, font, radius, shadow }         from "../../styles/tokens";
import { apiFetch }                             from "../../api";
import { cacheGet, cacheSet, cacheClear, cacheTimeLeft, CACHE_KEYS } from "../../utils/reportCache";
import { Card, PageHeader, TabBar, StatRow }    from "../ui/Structure";
import { Avatar, CommunityBadge, StatCard, StatusBadge, StatusBox } from "../ui/Indicators";
import { Select }                               from "../ui/Inputs";
import Button                                   from "../ui/Button";
import { logActivity, LOG_TYPES }               from "../../utils/logger";
import FilterPill from "../ui/FilterPill";
import { useVAProfile, VANameLink } from "../../contexts/VAProfileContext";
import TopBarCachedBanner from "../ui/TopBarCachedBanner";
import TopBarProgress from "../ui/TopBarProgress";
import { Skeleton, TableRowSkeleton } from "../ui/Skeleton";
import { VAProfileBody } from "../ui/VAProfileModal";

const CACHE_KEY      = CACHE_KEYS.VA_LIST;
const DASH_CACHE_KEY = CACHE_KEYS.DASHBOARD;
const STAT_RADIUS    = 8;

// Inject local styles once globally
if (typeof document !== "undefined" && !document.getElementById("mt-va-stat-styles")) {
  const tag = document.createElement("style");
  tag.id = "mt-va-stat-styles";
  tag.innerHTML = `
    .mt-stat-box {
      transition: border-color .15s, box-shadow .15s, transform .15s;
    }
    .mt-stat-box:hover {
      border-color: ${colors.tealMid};
      box-shadow: 0 2px 8px rgba(12, 184, 169, 0.08);
      transform: translateY(-1px);
    }
    @keyframes mt-shift-fade {
      from { opacity: 0; transform: translateY(2px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .mt-shift-fade {
      animation: mt-shift-fade .18s ease-out;
    }
  `;
  document.head.appendChild(tag);
}

// ── Table style constants ────────────────────────────────────────
const TABLE_TH = {
  padding: "12px 16px",
  fontSize: font.xs,
  fontWeight: 700,
  color: "#fff",
  textAlign: "left",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

const TABLE_TD = {
  padding: "12px 16px",
  fontSize: font.sm,
  color: colors.textBody,
  borderTop: `1px solid ${colors.border}`,
  whiteSpace: "nowrap",
  verticalAlign: "middle",
};

// ── Tabs ─────────────────────────────────────────────────────────
const TABS = [
  { id: "dashboard",  label: "Dashboard"          },
  { id: "reports",    label: "Reports"            },
  { id: "active",     label: "Active"             },
  { id: "main",       label: "Agency"             },
  { id: "cba",        label: "CBA"                },
  { id: "individual", label: "Individual Profile" },
];

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

const dateInputStyle = {
  border: `1.5px solid ${colors.border}`, borderRadius: radius.md,
  padding: "9px 12px", fontSize: font.base, outline: "none",
  fontFamily: font.family, background: colors.surface,
  color: colors.textPrimary, height: 38,
};
const labelStyle = {
  display: "block", fontSize: font.sm, fontWeight: 700,
  color: colors.textBody, marginBottom: 6,
};

// ── Unified StatBox ──────────────────────────────────────────────
function StatBox({ icon: Icon, value, label, accent }) {
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

  return (
    <div
      className="mt-stat-box"
      style={{
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: STAT_RADIUS,
        padding: "16px 18px",
        cursor: "default",
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
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

function StatBoxSkeleton() {
  return (
    <div style={{
      background: colors.surface,
      border: `1px solid ${colors.border}`,
      borderRadius: STAT_RADIUS,
      padding: "16px 18px",
      display: "flex",
      alignItems: "center",
      gap: 14,
    }}>
      <Skeleton width={40} height={40} radius={8} />
      <div style={{ flex: 1 }}>
        <Skeleton width={42} height={22} />
        <Skeleton width={90} height={10} style={{ marginTop: 8 }} />
      </div>
    </div>
  );
}

// ── Overview Stats — 5 cards above directory tables ──────────────
function OverviewStats({ vas, dashData, loading }) {
  if (loading && vas.length === 0) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
        {Array.from({ length: 5 }).map((_, i) => <StatBoxSkeleton key={i} />)}
      </div>
    );
  }

  const total  = vas.length;
  const agency = vas.filter(v => v.community === "Main").length;
  const cba    = vas.filter(v => v.community === "CBA").length;
  const noContract = dashData?.va_counts?.no_contract ?? 0;
  const paused     = dashData?.va_counts?.paused_contracts ?? 0;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
      <StatBox icon={Users}        value={total}      label="Total VAs" />
      <StatBox icon={UserCheck}    value={agency}     label="Agency VAs" accent="teal" />
      <StatBox icon={UserCheck}    value={cba}        label="CBA VAs"    accent="teal" />
      <StatBox
        icon={UserX}
        value={noContract}
        label="No Contracts"
        accent={noContract > 0 ? "warning" : undefined}
      />
      <StatBox
        icon={PauseCircle}
        value={paused}
        label="Paused Contracts"
        accent={paused > 0 ? "warning" : undefined}
      />
    </div>
  );
}

// ── VA Row in the directory table ────────────────────────────────
function VAListRow({ va, i }) {
  const { openVAProfile } = useVAProfile();
  const clientCount = va.contract_ids?.length ?? 0;
  const rowBg = i % 2 === 0 ? colors.surface : colors.surfaceAlt;

  return (
    <tr
      onClick={() => openVAProfile(va.name)}
      style={{
        background: rowBg,
        cursor: "pointer",
        transition: "background .12s",
      }}
      onMouseEnter={e => e.currentTarget.style.background = colors.tealLight}
      onMouseLeave={e => e.currentTarget.style.background = rowBg}
    >
      {/* Name + Avatar */}
      <td style={TABLE_TD}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar name={va.name} size={36} />
          <div style={{ fontWeight: 700, color: colors.textPrimary, fontSize: font.base }}>
            {va.name}
          </div>
        </div>
      </td>

      {/* Community */}
      <td style={{ ...TABLE_TD, textAlign: "center" }}>
        <CommunityBadge community={va.community} />
      </td>

      {/* Email */}
      <td style={{ ...TABLE_TD, color: colors.textMuted, fontSize: font.xs }}>
        {va.email || <span style={{ color: colors.textFaint }}>—</span>}
      </td>

      {/* Phone */}
      <td style={TABLE_TD}>
        {va.phone || <span style={{ color: colors.textFaint }}>—</span>}
      </td>

      {/* Work Days */}
      <td style={TABLE_TD}>
        {va.schedule || <span style={{ color: colors.textFaint }}>—</span>}
      </td>

      {/* Clients */}
      <td style={{ ...TABLE_TD, textAlign: "center" }}>
        {clientCount === 0
          ? <StatusBadge variant="neutral">None</StatusBadge>
          : <StatusBadge variant={clientCount > 1 ? "teal" : "info"}>
              {clientCount} client{clientCount !== 1 ? "s" : ""}
            </StatusBadge>
        }
      </td>
    </tr>
  );
}

// ── Directory View (Active / Agency / CBA tabs) ──────────────────
function DirectoryView({ vas, dashData, loading, error }) {
  const [filterWorkDays, setFilterWorkDays] = useState("all");
  const [filterClients,  setFilterClients]  = useState("all");
  const [search,         setSearch]         = useState("");

  // Unique filter options computed from data
  const workDayOrder = { "Mon - Fri": 1, "Mon - Sun": 2, "Flexible": 3 };
  const workDayValues = [...new Set(vas.map(v => v.schedule).filter(Boolean))]
    .sort((a, b) => (workDayOrder[a] ?? 99) - (workDayOrder[b] ?? 99));

  const clientCounts   = [...new Set(vas.map(v => v.contract_ids?.length ?? 0))].sort((a, b) => a - b);
  const hasNoContracts = clientCounts.includes(0);
  const nonZeroCounts  = clientCounts.filter(c => c > 0);

  // Counts for pill badges
  const countWorkDay = (day) =>
    vas.filter(v => day === "all" ? true : v.schedule === day).length;
  const countClients = (key) =>
    vas.filter(v => {
      const c = v.contract_ids?.length ?? 0;
      if (key === "all")  return true;
      if (key === "none") return c === 0;
      return c === key;
    }).length;

  // Apply filters + search
  const filtered = vas.filter(va => {
    if (filterWorkDays !== "all" && va.schedule !== filterWorkDays) return false;

    const count = va.contract_ids?.length ?? 0;
    if (filterClients === "none" && count !== 0) return false;
    if (filterClients !== "all" && filterClients !== "none" && count !== filterClients) return false;

    if (search) {
      const q = search.toLowerCase();
      const matches = (va.name  || "").toLowerCase().includes(q)
                   || (va.email || "").toLowerCase().includes(q)
                   || (va.phone || "").toLowerCase().includes(q);
      if (!matches) return false;
    }

    return true;
  });

  const hasActiveFilter = filterWorkDays !== "all" || filterClients !== "all" || !!search;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <OverviewStats vas={vas} dashData={dashData} loading={loading} />

      {error && <StatusBox variant="danger">{error}</StatusBox>}

      {/* Filters */}
      {!loading && vas.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

          {/* Work Days + Search */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: font.sm, fontWeight: 700, color: colors.textMuted, marginRight: 4 }}>
              Work Days:
            </span>
            <FilterPill
              label="All"
              count={vas.length}
              active={filterWorkDays === "all"}
              onClick={() => setFilterWorkDays("all")}
              color={colors.teal}
            />
            {workDayValues.map(day => (
              <FilterPill
                key={day}
                label={day}
                count={countWorkDay(day)}
                active={filterWorkDays === day}
                onClick={() => setFilterWorkDays(day)}
                color={colors.teal}
              />
            ))}

            <div style={{ marginLeft: "auto", position: "relative", display: "flex", alignItems: "center" }}>
              <Search size={14} style={{ position: "absolute", left: 10, color: colors.textFaint, pointerEvents: "none" }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name, email, or phone…"
                style={{
                  paddingLeft: 30, paddingRight: 12, paddingTop: 7, paddingBottom: 7,
                  border: `1.5px solid ${colors.border}`, borderRadius: radius.md,
                  fontSize: font.sm, fontFamily: font.family, outline: "none",
                  background: colors.surface, color: colors.textPrimary, width: 260,
                }}
                onFocus={e => e.target.style.borderColor = colors.teal}
                onBlur={e  => e.target.style.borderColor = colors.border}
              />
            </div>
          </div>

          {/* Clients */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: font.sm, fontWeight: 700, color: colors.textMuted, marginRight: 4 }}>
              Clients:
            </span>
            <FilterPill
              label="All"
              count={vas.length}
              active={filterClients === "all"}
              onClick={() => setFilterClients("all")}
              color={colors.teal}
            />
            {hasNoContracts && (
              <FilterPill
                label="No Contracts"
                count={countClients("none")}
                active={filterClients === "none"}
                onClick={() => setFilterClients("none")}
                color={colors.warning}
              />
            )}
            {nonZeroCounts.map(count => (
              <FilterPill
                key={count}
                label={`${count} client${count !== 1 ? "s" : ""}`}
                count={countClients(count)}
                active={filterClients === count}
                onClick={() => setFilterClients(count)}
                color={count > 1 ? colors.teal : colors.communityMain}
              />
            ))}
          </div>

        </div>
      )}

      {/* Table */}
      <Card noPadding style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
          <thead>
            <tr style={{ background: colors.navy }}>
              <th style={TABLE_TH}>Name</th>
              <th style={{ ...TABLE_TH, textAlign: "center" }}>Community</th>
              <th style={TABLE_TH}>Email</th>
              <th style={TABLE_TH}>Phone</th>
              <th style={TABLE_TH}>Work Days</th>
              <th style={{ ...TABLE_TH, textAlign: "center" }}>Clients</th>
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? colors.surface : colors.surfaceAlt }}>
                <td style={TABLE_TD}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <Skeleton width={36} height={36} radius={18} />
                    <Skeleton width={140} height={14} />
                  </div>
                </td>
                <td style={{ ...TABLE_TD, textAlign: "center" }}>
                  <Skeleton width={50} height={20} radius={4} style={{ display: "inline-block" }} />
                </td>
                <td style={TABLE_TD}><Skeleton width={170} height={12} /></td>
                <td style={TABLE_TD}><Skeleton width={110} height={12} /></td>
                <td style={TABLE_TD}><Skeleton width={70} height={12} /></td>
                <td style={{ ...TABLE_TD, textAlign: "center" }}>
                  <Skeleton width={60} height={20} radius={4} style={{ display: "inline-block" }} />
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} style={{
                  padding: "40px 20px",
                  textAlign: "center",
                  color: colors.textFaint,
                  fontSize: font.sm,
                  borderTop: `1px solid ${colors.border}`,
                }}>
                  {hasActiveFilter
                    ? "No VAs match the current filters."
                    : "No VAs found."}
                </td>
              </tr>
            )}
            {!loading && filtered.map((va, i) => (
              <VAListRow key={va.id || i} va={va} i={i} />
            ))}
          </tbody>
        </table>
      </Card>

      {/* Filtered count summary */}
      {!loading && hasActiveFilter && (
        <div style={{ fontSize: font.xs, color: colors.textMuted, textAlign: "right" }}>
          Showing {filtered.length} of {vas.length} VAs
        </div>
      )}
    </div>
  );
}

// ── CSV export helper ───────────────────────────────────────────
function exportCSV(rows, date) {
  const header = ["Name", "Client", "Community", "Clock In", "Punctuality", "Clock Out", "Submission", "Status"];
  const csvRows = rows.map(r => [
    r.va_name,
    r.client || "—",
    r.community,
    r.clock_in || "Missing",
    r.clock_in_status === "on_time" ? "On-time"
      : r.clock_in_status === "late" ? `${r.clock_in_minutes_late}m late`
      : r.clock_in_status === "early" ? `${r.clock_in_minutes_early}m early`
      : "Missing",
    r.clock_out || "Missing",
    r.clock_out_status === "on_time" ? "On-time"
      : r.clock_out_status === "late" ? `${r.clock_out_minutes_late}m late`
      : r.clock_out_status === "early" ? `${r.clock_out_minutes_early}m early`
      : "Missing",
    r.status,
  ]);

  const csv = [header, ...csvRows].map(row =>
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")
  ).join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `eod-report-${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Status cell renderer ────────────────────────────────────────
function StatusCell({ status, minutesLate, minutesEarly }) {
  if (status === "missing")
    return <span style={{ color: colors.danger, fontWeight: 600 }}>Missing</span>;
  if (status === "late")
    return <span style={{ color: colors.warning, fontWeight: 600 }}>{minutesLate} min late</span>;
  if (status === "early")
    return <span style={{ color: "#7C3AED", fontWeight: 600 }}>{minutesEarly} min early</span>;
  return <span style={{ color: colors.success, fontWeight: 600 }}>On-time</span>;
}

// ── Reports Tab ─────────────────────────────────────────────────
function ReportsTab() {
  const cached = cacheGet(CACHE_KEYS.REPORT);

  const [date,       setDate]       = useState(() => cached?.date || todayISO());
  const [data,       setData]       = useState(() => cached);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [filter,     setFilter]     = useState("all");
  const [search,     setSearch]     = useState("");
  const [emailState, setEmailState] = useState("idle");

  function fetchReport(targetDate, isRefresh) {
    setLoading(true); setError(""); setEmailState("idle"); setSearch("");
    if (isRefresh) { cacheClear(CACHE_KEYS.REPORT); }
    else { setData(null); }

    apiFetch(`/api/eod/report?date=${targetDate}`)
      .then(result => {
        cacheSet(CACHE_KEYS.REPORT, result);
        setData(result);
        setDate(targetDate);
        logActivity(LOG_TYPES.EOD_CHECK, `Report checked for ${targetDate}`, { date: targetDate });
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }

  function run()     { fetchReport(date, false); }
  function refresh() { fetchReport(data?.date || date, true); }

  async function sendEmail() {
    setEmailState("sending");
    try {
      await apiFetch(`/api/email/send-report/${data?.date || date}`, { method: "POST" });
      setEmailState("sent");
      logActivity(LOG_TYPES.EMAIL_SENT, `EOD email sent for ${data?.date || date}`, { date: data?.date || date });
    } catch (e) { setEmailState("error"); }
  }

  const rows  = data?.rows  ?? [];
  const stats = data?.stats ?? {};

  const counts = {
    all:     rows.length,
    missing: rows.filter(r => r.status === "missing").length,
    late:    rows.filter(r => r.status === "late").length,
    early:   rows.filter(r => r.status === "early").length,
    on_time: rows.filter(r => r.status === "on_time").length,
  };

  const filtered = rows.filter(r => {
    if (filter !== "all" && r.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (r.va_name || "").toLowerCase().includes(q)
          || (r.client  || "").toLowerCase().includes(q);
    }
    return true;
  });

  const th = {
    padding: "10px 14px", textAlign: "left",
    fontSize: font.xs, fontWeight: 700, color: colors.textMuted,
    textTransform: "uppercase", letterSpacing: "0.05em",
    borderBottom: `2px solid ${colors.border}`, whiteSpace: "nowrap",
  };
  const td = {
    padding: "10px 14px", fontSize: font.sm, color: colors.textBody,
    borderBottom: `1px solid ${colors.border}`, whiteSpace: "nowrap",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <TopBarProgress active={loading} />
      <TopBarCachedBanner cacheKey={CACHE_KEYS.REPORT} onRefresh={refresh} loading={loading} />

      <Card>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={labelStyle}>Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={dateInputStyle} />
          </div>
          <Button icon={Search} onClick={run} disabled={loading} style={{ height: 38 }}>
            {loading ? "Loading…" : "Check EOD"}
          </Button>
          {data && (
            <>
              <Button
                icon={emailState === "sent" ? CheckCircle2 : Send}
                variant={emailState === "sent" ? "success" : "primary"}
                onClick={sendEmail}
                disabled={emailState === "sending" || emailState === "sent"}
                style={{ height: 38 }}
              >
                {emailState === "sending" ? "Sending…"
                  : emailState === "sent" ? "Email Sent!"
                  : emailState === "error" ? "Retry Send"
                  : "Send Email"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => exportCSV(filtered, data?.date || date)}
                style={{ height: 38 }}
              >
                Export CSV
              </Button>
            </>
          )}
        </div>
        {emailState === "error" && (
          <StatusBox variant="danger" style={{ marginTop: 12 }}>Failed to send email. Check backend config.</StatusBox>
        )}
      </Card>

      {error && <StatusBox variant="danger">{error}</StatusBox>}

      {loading && !data && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
            {Array.from({ length: 5 }).map((_, i) => <StatBoxSkeleton key={i} />)}
          </div>

          <Card noPadding style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 780 }}>
              <thead>
                <tr style={{ background: colors.surfaceAlt }}>
                  {["Name", "Client", "Community", "Clock In", "Punctuality", "Clock Out", "Submission"].map(h => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 8 }).map((_, i) => (
                  <TableRowSkeleton
                    key={i}
                    rowBg={i % 2 === 0 ? colors.surface : colors.surfaceAlt}
                    cellWidths={["70%", "60%", "40%", "50%", "55%", "50%", "55%"]}
                  />
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {data && (
        <>
          {/* Unified stat boxes */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
            <StatBox icon={Users}     value={stats.active_vas ?? 0}    label="Active VAs" />
            <StatBox icon={UserCheck} value={stats.clocked_in ?? 0}    label="Clocked In"      accent="teal" />
            <StatBox icon={FileCheck} value={stats.eod_submitted ?? 0} label="EOD Submitted"   accent="success" />
            <StatBox
              icon={UserX}
              value={stats.missing_eod ?? 0}
              label="Missing EOD"
              accent={stats.missing_eod > 0 ? "danger" : "success"}
            />
            <StatBox
              icon={Clock}
              value={stats.late ?? 0}
              label="Late Submissions"
              accent={stats.late > 0 ? "warning" : "success"}
            />
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: font.sm, fontWeight: 700, color: colors.textMuted, marginRight: 4 }}>Filter:</span>
            <FilterPill label="All"     count={counts.all}     active={filter === "all"}     onClick={() => setFilter("all")}     color={colors.teal} />
            <FilterPill label="Missing" count={counts.missing} active={filter === "missing"} onClick={() => setFilter("missing")} color={colors.danger} />
            <FilterPill label="Late"    count={counts.late}    active={filter === "late"}    onClick={() => setFilter("late")}    color={colors.warning} />
            <FilterPill label="Early"   count={counts.early}   active={filter === "early"}   onClick={() => setFilter("early")}   color="#7C3AED" />
            <FilterPill label="On-time" count={counts.on_time} active={filter === "on_time"} onClick={() => setFilter("on_time")} color={colors.success} />
            <div style={{ marginLeft: "auto", position: "relative", display: "flex", alignItems: "center" }}>
              <Search size={14} style={{ position: "absolute", left: 10, color: colors.textFaint, pointerEvents: "none" }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name or client…"
                style={{
                  paddingLeft: 30, paddingRight: 12, paddingTop: 7, paddingBottom: 7,
                  border: `1.5px solid ${colors.border}`, borderRadius: radius.md,
                  fontSize: font.sm, fontFamily: font.family, outline: "none",
                  background: colors.surface, color: colors.textPrimary, width: 200,
                }}
                onFocus={e => e.target.style.borderColor = colors.teal}
                onBlur={e  => e.target.style.borderColor = colors.border}
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <StatusBox variant="info">
              {filter === "all"
                ? `No report data for ${data?.date || date}.`
                : `No ${filter.replace("_", "-")} records for ${data?.date || date}.`}
            </StatusBox>
          ) : (
            <Card noPadding style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 780 }}>
                <thead>
                  <tr style={{ background: colors.surfaceAlt }}>
                    <th style={th}>Name</th>
                    <th style={th}>Client</th>
                    <th style={{ ...th, textAlign: "center" }}>Community</th>
                    <th style={th}>Clock In</th>
                    <th style={th}>Punctuality</th>
                    <th style={th}>Clock Out</th>
                    <th style={th}>Submission</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? colors.surface : colors.surfaceAlt }}>
                      <td style={{ ...td, fontWeight: 600, color: colors.textPrimary }}>
                        <VANameLink name={r.va_name} />
                        {r.needs_verification && (
                          <span title="Client name needs verification" style={{ color: colors.warning, fontWeight: 800, marginLeft: 4 }}>*</span>
                        )}
                      </td>
                      <td style={td}>{r.client || "—"}</td>
                      <td style={{ ...td, textAlign: "center" }}>
                        <CommunityBadge community={r.community} />
                      </td>
                      <td style={td}>
                        {r.clock_in
                          ? <span style={{ fontWeight: 500 }}>{r.clock_in.replace(" EST", "")}</span>
                          : r.status === "Upcoming"
                            ? <span style={{ color: colors.textFaint }}>—</span>
                            : <span style={{ color: colors.danger, fontWeight: 600 }}>Missing</span>
                        }
                      </td>
                      <td style={td}>
                        <StatusCell
                          status={r.clock_in_status}
                          minutesLate={r.clock_in_minutes_late}
                          minutesEarly={r.clock_in_minutes_early}
                        />
                      </td>
                      <td style={td}>
                        {r.clock_out
                          ? <span style={{ fontWeight: 500 }}>{r.clock_out.replace(" EST", "")}</span>
                          : <span style={{ color: colors.danger, fontWeight: 600 }}>Missing</span>}
                      </td>
                      <td style={td}>
                        <StatusCell
                          status={r.clock_out_status}
                          minutesLate={r.clock_out_minutes_late}
                          minutesEarly={r.clock_out_minutes_early}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ── VASearchSelect — combo box (search + dropdown) ──────────────
function VASearchSelect({ vas, value, onChange, placeholder = "Search VA name…" }) {
  const [search, setSearch] = useState(value || "");
  const [open,   setOpen]   = useState(false);
  const wrapRef = useRef(null);

  // Keep input text in sync when value changes externally
  useEffect(() => {
    setSearch(value || "");
  }, [value]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setSearch(value || "");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value]);

  // Filter by search; when search matches the current value exactly, show all so user can browse
  const isSearching = search && search !== value;
  const filtered = isSearching
    ? vas.filter(v => v.name.toLowerCase().includes(search.toLowerCase()))
    : vas;

  // Group by community
  const groups = [
    { id: "Main", label: "Agency Community", items: filtered.filter(v => v.community === "Main") },
    { id: "CBA",  label: "CBA Community",    items: filtered.filter(v => v.community === "CBA")  },
  ].filter(g => g.items.length > 0);

  function pick(vaName) {
    onChange(vaName);
    setSearch(vaName);
    setOpen(false);
  }

  return (
    <div ref={wrapRef} style={{ position: "relative", maxWidth: 420 }}>
      <label style={{
        display: "block", fontSize: font.sm, fontWeight: 700,
        color: colors.textBody, marginBottom: 6,
      }}>
        Virtual Assistant
      </label>

      <div style={{ position: "relative" }}>
        <Search size={14} style={{
          position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
          color: colors.textFaint, pointerEvents: "none",
        }} />
        <input
          type="text"
          value={search}
          placeholder={placeholder}
          onChange={e => {
            setSearch(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={e => {
            setOpen(true);
            e.target.select();
          }}
          style={{
            width: "100%",
            paddingLeft: 36, paddingRight: 36, paddingTop: 9, paddingBottom: 9,
            border: `1.5px solid ${open ? colors.teal : colors.border}`,
            borderRadius: radius.md,
            fontSize: font.base, fontFamily: font.family, outline: "none",
            background: colors.surface, color: colors.textPrimary,
            transition: "border-color .12s",
          }}
        />
        <ChevronDown size={14} style={{
          position: "absolute", right: 12, top: "50%", transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`,
          color: colors.textMuted, pointerEvents: "none",
          transition: "transform .15s",
        }} />
      </div>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
          maxHeight: 320, overflowY: "auto",
          background: colors.surface,
          border: `1.5px solid ${colors.border}`,
          borderRadius: radius.md,
          boxShadow: "0 6px 20px rgba(13,31,60,0.12)",
          zIndex: 50,
        }}>
          {groups.length === 0 ? (
            <div style={{ padding: "16px 14px", textAlign: "center", color: colors.textMuted, fontSize: font.sm }}>
              No VAs match "{search}"
            </div>
          ) : groups.map(g => (
            <div key={g.id}>
              <div style={{
                padding: "8px 14px",
                fontSize: font.xs, fontWeight: 700,
                color: colors.textMuted,
                textTransform: "uppercase", letterSpacing: "0.05em",
                background: colors.surfaceAlt,
                position: "sticky", top: 0, zIndex: 1,
              }}>
                {g.label} ({g.items.length})
              </div>
              {g.items.map(v => {
                const isSelected = v.name === value;
                return (
                  <button
                    key={v.name}
                    onClick={() => pick(v.name)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      width: "100%", padding: "10px 14px",
                      border: "none", borderTop: `1px solid ${colors.border}`,
                      background: isSelected ? colors.tealLight : "transparent",
                      color: isSelected ? colors.teal : colors.textPrimary,
                      fontWeight: isSelected ? 700 : 500,
                      fontFamily: font.family, fontSize: font.sm,
                      cursor: "pointer", textAlign: "left",
                      transition: "background .1s",
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) e.currentTarget.style.background = colors.surfaceAlt;
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <Avatar name={v.name} size={28} />
                    <span style={{ flex: 1 }}>{v.name}</span>
                    <CommunityBadge community={v.community} />
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Individual Profile Tab ───────────────────────────────────────
function IndividualProfileTab({ vas }) {
  const [selectedVA, setSelectedVA] = useState("");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Card>
        <VASearchSelect
          vas={vas}
          value={selectedVA}
          onChange={setSelectedVA}
          placeholder="Search or pick a VA…"
        />
      </Card>

      {selectedVA ? (
        <Card noPadding>
          <VAProfileBody vaName={selectedVA} />
        </Card>
      ) : (
        <StatusBox variant="info">
          Search for a VA above to view their profile, contracts, and EOD report history.
        </StatusBox>
      )}
    </div>
  );
}

// ── Root ─────────────────────────────────────────────────────────
export default function VirtualAssistants() {
  const [vas,        setVAs]        = useState(() => cacheGet(CACHE_KEY) ?? []);
  const [dashData,   setDashData]   = useState(() => cacheGet(DASH_CACHE_KEY) ?? null);
  const [loading,    setLoading]    = useState(!cacheGet(CACHE_KEY));
  const [error,      setError]      = useState("");
  const [activeTab,  setActiveTab]  = useState("dashboard");

  useEffect(() => {
    if (!cacheGet(CACHE_KEY)) {
      apiFetch("/api/inspector/vas")
        .then(d => { const list = d.vas ?? []; cacheSet(CACHE_KEY, list); setVAs(list); })
        .catch(e => setError(e.message))
        .finally(() => setLoading(false));
    }
    if (!cacheGet(DASH_CACHE_KEY)) {
      apiFetch("/api/dashboard")
        .then(d => { cacheSet(DASH_CACHE_KEY, d); setDashData(d); })
        .catch(() => {});
    }
  }, []);

  function refresh() {
    cacheClear(CACHE_KEY);
    cacheClear(DASH_CACHE_KEY);
    setLoading(true); setError("");
    apiFetch("/api/inspector/vas")
      .then(d => { const list = d.vas ?? []; cacheSet(CACHE_KEY, list); setVAs(list); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
    apiFetch("/api/dashboard")
      .then(d => { cacheSet(DASH_CACHE_KEY, d); setDashData(d); })
      .catch(() => {});
  }

  const isDirectoryTab = activeTab === "active" || activeTab === "main" || activeTab === "cba";

  const filteredVAs = activeTab === "active" ? vas
    : activeTab === "main"   ? vas.filter(v => v.community === "Main")
    : activeTab === "cba"    ? vas.filter(v => v.community === "CBA")
    : vas;

  return (
    <div style={{ fontFamily: font.family, width: "100%" }}>
      <PageHeader
        title="Virtual Assistants"
        subtitle="Directory of all active VAs with EOD report history and profile details."
      />

      {isDirectoryTab && <TopBarProgress active={loading} />}
      {isDirectoryTab && <TopBarCachedBanner cacheKey={CACHE_KEY} onRefresh={refresh} loading={loading} />}

      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {/* Fade animation on tab change — key forces remount */}
      <div key={activeTab} className="mt-page-fade">
        {activeTab === "dashboard"  && <DashboardTab />}
        {activeTab === "reports"    && <ReportsTab />}
        {activeTab === "individual" && <IndividualProfileTab vas={vas} />}
        {isDirectoryTab && (
          <DirectoryView
            vas={filteredVAs}
            dashData={dashData}
            loading={loading}
            error={error}
          />
        )}
      </div>
    </div>
  );
}

// ── Live Shift Dashboard ─────────────────────────────────────────
const SHIFT_TABS = [
  { id: "morning",   label: "Morning Shift",   sub: "5:00 AM – 10:00 AM" },
  { id: "mid",       label: "Mid Shift",       sub: "10:00 AM – 3:00 PM" },
  { id: "afternoon", label: "Afternoon Shift", sub: "3:00 PM – 10:00 PM" },
];

function ShiftTabBar({ tabs, active, onChange }) {
  return (
    <div style={{
      display: "flex",
      gap: 4,
      borderBottom: `1px solid ${colors.border}`,
      padding: "0 8px",
    }}>
      {tabs.map(t => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            style={{
              padding: "14px 20px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontFamily: font.family,
              fontSize: font.sm,
              fontWeight: 700,
              color: isActive ? colors.teal : colors.textMuted,
              borderBottom: isActive ? `2.5px solid ${colors.teal}` : "2.5px solid transparent",
              marginBottom: -1,
              transition: "color .18s, border-color .18s",
              textAlign: "left",
            }}
            onMouseEnter={e => {
              if (!isActive) e.currentTarget.style.color = colors.textBody;
            }}
            onMouseLeave={e => {
              if (!isActive) e.currentTarget.style.color = colors.textMuted;
            }}
          >
            <div>{t.label}</div>
            <div style={{
              fontSize: font.xs,
              fontWeight: 500,
              color: isActive ? colors.teal : colors.textFaint,
              marginTop: 2,
              transition: "color .18s",
            }}>
              {t.sub}
            </div>
          </button>
        );
      })}
    </div>
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
      borderRadius: radius.sm, padding: "2px 10px",
    }}>
      {status}
    </span>
  );
}

function PunctualityCell({ status, minutesLate, minutesEarly }) {
  if (!status || status === "missing")
    return <span style={{ color: colors.danger, fontWeight: 600 }}>Missing</span>;
  if (status === "late")
    return <span style={{ color: colors.warning, fontWeight: 600 }}>{minutesLate}m late</span>;
  if (status === "early")
    return <span style={{ color: "#7C3AED", fontWeight: 600 }}>{minutesEarly}m early</span>;
  return <span style={{ color: colors.success, fontWeight: 600 }}>On-time</span>;
}

function DashboardTab() {
  const VA_DASH_KEY = CACHE_KEYS.VA_DASH;

  const [data,      setData]      = useState(() => cacheGet(VA_DASH_KEY));
  const [loading,   setLoading]   = useState(!cacheGet(VA_DASH_KEY));
  const [error,     setError]     = useState("");
  const [shiftTab,  setShiftTab]  = useState("morning");
  const [community, setCommunity] = useState("all");
  const [search,    setSearch]    = useState("");

  function fetchData() {
    cacheClear(VA_DASH_KEY);
    setLoading(true); setError("");
    apiFetch("/api/eod/dashboard")
      .then(d => {
        cacheSet(VA_DASH_KEY, d);
        setData(d);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (cacheGet(VA_DASH_KEY)) return;
    fetchData();
  }, []);

  function matchCommunity(r) {
    if (community === "all")  return true;
    if (community === "cba")  return r.community === "CBA";
    if (community === "main") return r.community === "Main";
    return true;
  }

  function matchSearch(r) {
    if (!search) return true;
    const q = search.toLowerCase();
    return (r.va_name || "").toLowerCase().includes(q)
        || (r.client  || "").toLowerCase().includes(q);
  }

  const allRows = data
    ? [...(data.morning || []), ...(data.mid || []), ...(data.afternoon || [])]
    : [];
  const filteredAllRows = allRows.filter(matchCommunity);

  const shiftRows = data ? (data[shiftTab] || []) : [];
  const rows      = shiftRows.filter(matchCommunity).filter(matchSearch);

  const stats = {
    total:       filteredAllRows.length,
    clocked_in:  filteredAllRows.filter(r => r.status === "Clocked In").length,
    clocked_out: filteredAllRows.filter(r => r.status === "Clocked Out").length,
    absent:      filteredAllRows.filter(r => r.status === "Absent").length,
  };

  const th = {
    padding: "10px 12px", fontSize: font.xs, fontWeight: 700,
    color: "#fff", textAlign: "left", letterSpacing: "0.04em",
    textTransform: "uppercase", whiteSpace: "nowrap",
  };
  const td = {
    padding: "10px 12px", fontSize: font.sm, color: colors.textBody,
    borderTop: `1px solid ${colors.border}`, whiteSpace: "nowrap",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <TopBarProgress active={loading} />
      <TopBarCachedBanner cacheKey={VA_DASH_KEY} onRefresh={fetchData} loading={loading} />

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: font.lg, fontWeight: 800, color: colors.textPrimary }}>
            Live Shift Dashboard
          </div>
          <div style={{ fontSize: font.sm, color: colors.textMuted }}>
            {data?.date
              ? new Date(data.date + "T12:00:00").toLocaleDateString("en-US", {
                  weekday: "long", month: "long", day: "numeric", year: "numeric",
                })
              : "Today"
            }
          </div>
        </div>
        <Button variant="ghost" icon={RefreshCw} onClick={fetchData} disabled={loading} size="sm">
          {loading ? "Loading…" : "Refresh"}
        </Button>
      </div>

      {/* Unified stat boxes */}
      {loading && !data ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => <StatBoxSkeleton key={i} />)}
        </div>
      ) : data ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <StatBox icon={Users}     value={stats.total}       label="Working Today" />
          <StatBox icon={Clock}     value={stats.clocked_in}  label="Clocked In"    accent="teal" />
          <StatBox icon={UserCheck} value={stats.clocked_out} label="Clocked Out"   accent="success" />
          <StatBox
            icon={UserX}
            value={stats.absent}
            label="Absent"
            accent={stats.absent > 0 ? "danger" : "success"}
          />
        </div>
      ) : null}

      {error && <StatusBox variant="danger">{error}</StatusBox>}

      {/* ── UNIFIED TABBED CARD ── */}
      <Card noPadding>
        {/* Shift tabs at top */}
        <ShiftTabBar tabs={SHIFT_TABS} active={shiftTab} onChange={setShiftTab} />

        {/* Animated content area — filter row + table together */}
        <div key={shiftTab} className="mt-shift-fade">

          {/* Filter row */}
          <div style={{
            padding: "14px 20px",
            display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center",
            borderBottom: `1px solid ${colors.border}`,
            background: colors.surfaceAlt,
          }}>
            <span style={{ fontSize: font.sm, fontWeight: 700, color: colors.textMuted, marginRight: 4 }}>Filter:</span>
            <FilterPill
              label="All"
              count={shiftRows.length}
              active={community === "all"}
              onClick={() => setCommunity("all")}
              color={colors.teal}
            />
            <FilterPill
              label="CBA"
              count={shiftRows.filter(r => r.community === "CBA").length}
              active={community === "cba"}
              onClick={() => setCommunity("cba")}
              color={colors.communityCBA}
            />
            <FilterPill
              label="Agency"
              count={shiftRows.filter(r => r.community === "Main").length}
              active={community === "main"}
              onClick={() => setCommunity("main")}
              color={colors.communityMain}
            />
            <div style={{ marginLeft: "auto", position: "relative", display: "flex", alignItems: "center" }}>
              <Search size={14} style={{ position: "absolute", left: 10, color: colors.textFaint, pointerEvents: "none" }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name or client…"
                style={{
                  paddingLeft: 30, paddingRight: 12, paddingTop: 7, paddingBottom: 7,
                  border: `1.5px solid ${colors.border}`, borderRadius: radius.md,
                  fontSize: font.sm, fontFamily: font.family, outline: "none",
                  background: colors.surface, color: colors.textPrimary, width: 240,
                }}
                onFocus={e => e.target.style.borderColor = colors.teal}
                onBlur={e  => e.target.style.borderColor = colors.border}
              />
            </div>
          </div>

          {/* Table area — flush bottom of the card */}
          {loading && !data ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: colors.navy }}>
                    {["Name", "Client", "Shift Time", "Clock In EST", "Punctuality", "Status", "Clock Out EST", "Submission"].map(h => (
                      <th key={h} style={th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <TableRowSkeleton
                      key={i}
                      rowBg={i % 2 === 0 ? colors.surface : colors.surfaceAlt}
                      cellWidths={["60%", "60%", "55%", "55%", "55%", "50%", "55%", "55%"]}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : rows.length === 0 ? (
            <div style={{ padding: "32px 20px", textAlign: "center", color: colors.textFaint, fontSize: font.sm }}>
              {search
                ? `No results matching "${search}".`
                : community === "all"
                  ? `No VAs scheduled for the ${SHIFT_TABS.find(t => t.id === shiftTab)?.label.toLowerCase() || "selected shift"}.`
                  : `No ${community === "cba" ? "CBA" : "Agency"} VAs scheduled for this shift.`
              }
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: colors.navy }}>
                    <th style={th}>Name</th>
                    <th style={th}>Client</th>
                    <th style={th}>Shift Time</th>
                    <th style={th}>Clock In EST</th>
                    <th style={th}>Punctuality</th>
                    <th style={th}>Status</th>
                    <th style={th}>Clock Out EST</th>
                    <th style={th}>Submission</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? colors.surface : colors.surfaceAlt }}>
                      <td style={td}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <CommunityBadge community={r.community} />
                          <VANameLink
                            name={r.va_name}
                            style={{ fontWeight: 600, color: colors.textPrimary }}
                          />
                        </div>
                      </td>
                      <td style={td}>{r.client}</td>
                      <td style={{ ...td, fontWeight: 600, color: colors.teal, fontSize: font.xs }}>
                        {r.shift_time}
                      </td>
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
                            : <PunctualityCell
                                status={r.clock_in_status}
                                minutesLate={r.clock_in_minutes_late}
                                minutesEarly={r.clock_in_minutes_early}
                              />
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
                          ? <PunctualityCell
                              status={r.clock_out_status}
                              minutesLate={r.clock_out_minutes_late}
                              minutesEarly={r.clock_out_minutes_early}
                            />
                          : r.status === "Clocked In" && r.shift_ended
                            ? <span style={{ color: colors.danger, fontWeight: 600 }}>Missing</span>
                            : <span style={{ color: colors.textFaint }}>—</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}