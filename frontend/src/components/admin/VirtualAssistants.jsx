import { useState, useEffect } from "react";
import {
  FileCheck, CheckCircle2,
  Users, RefreshCw,
  Search, Send, AlertTriangle, Clock, UserX, UserCheck,
} from "lucide-react";
import { colors, font, radius, shadow }         from "../../styles/tokens";
import { apiFetch }                             from "../../api";
import { cacheGet, cacheSet, cacheClear, cacheTimeLeft, CACHE_KEYS } from "../../utils/reportCache";
import { Card, PageHeader, TabBar, StatRow }    from "../ui/Structure";
import { Avatar, CommunityBadge, StatCard, StatusBadge, StatusBox } from "../ui/Indicators";
import Button                                   from "../ui/Button";
import { logActivity, LOG_TYPES }               from "../../utils/logger";
import FilterPill from "../ui/FilterPill";
import { useVAProfile, VANameLink } from "../../contexts/VAProfileContext";

const CACHE_KEY = CACHE_KEYS.VA_LIST;

// ── Constants ─────────────────────────────────────────────────────
const TABS = [
  { id: "dashboard",  label: "Dashboard"     },
  { id: "reports",    label: "Reports"       },
  { id: "active",     label: "Active"        },
  { id: "main",       label: "Agency"        },
  { id: "cba",        label: "CBA"           },
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

// ── VA Row in the list ────────────────────────────────────────────
function VAListRow({ va, i }) {
  const { openVAProfile } = useVAProfile();
  const clientCount = va.contract_ids?.length ?? 0;
  return (
    <button
      onClick={() => openVAProfile(va.name)}
      style={{
        display: "flex", alignItems: "center", gap: 14,
        width: "100%", padding: "12px 20px",
        background: i % 2 === 0 ? colors.surface : colors.surfaceAlt,
        borderTop: i === 0 ? "none" : `1px solid ${colors.border}`,
        border: "none", cursor: "pointer", fontFamily: font.family,
        textAlign: "left", transition: "background .1s",
      }}
      onMouseEnter={e => e.currentTarget.style.background = colors.tealLight}
      onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? colors.surface : colors.surfaceAlt}
    >
      <Avatar name={va.name} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: font.base, color: colors.textPrimary }}>{va.name}</div>
        <div style={{ fontSize: font.xs, color: colors.textMuted, marginTop: 2 }}>{va.email || "—"}</div>
      </div>
      <div style={{ minWidth: 100, fontSize: font.sm, color: colors.textBody }}>{va.schedule || "—"}</div>
      {va.community === "CBA" && (
        <StatusBadge variant={clientCount > 1 ? "teal" : "neutral"}>
          {clientCount > 0 ? `${clientCount} client${clientCount !== 1 ? "s" : ""}` : "No clients"}
        </StatusBadge>
      )}
      <CommunityBadge community={va.community} />
    </button>
  );
}

// ── Cached data banner ────────────────────────────────────────────
function CachedBanner({ cacheKey, onRefresh, loading }) {
  const mins = cacheTimeLeft(cacheKey);
  if (!mins) return null;
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      background: colors.tealLight, border: `1px solid ${colors.tealMid}`,
      borderRadius: radius.md, padding: "8px 14px", marginBottom: 16,
    }}>
      <span style={{ fontSize: font.sm, color: colors.teal, fontWeight: 600 }}>
        Showing cached data · expires in {mins} min
      </span>
      <Button variant="ghost" icon={RefreshCw} onClick={onRefresh} disabled={loading} size="sm">
        Refresh
      </Button>
    </div>
  );
}

// ── EOD Reports Tab ───────────────────────────────────────────────
function EODTab() {
  const [date,       setDate]       = useState(todayISO());
  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [emailState, setEmailState] = useState("idle"); // idle | sending | sent | error

  async function run() {
    setLoading(true); setError(""); setData(null); setEmailState("idle");
    try {
      const result = await apiFetch(`/api/eod?date=${date}`);
      setData(result);
      logActivity(LOG_TYPES.EOD_CHECK, `EOD report checked for ${date}`, { date });
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function sendEmail() {
    setEmailState("sending");
    try {
      await apiFetch(`/api/email/send-report/${date}`, { method: "POST" });
      setEmailState("sent");
      logActivity(LOG_TYPES.EMAIL_SENT, `EOD email sent for ${date}`, { date });
    } catch (e) { setEmailState("error"); }
  }

  const missing  = data?.missing        ?? [];
  const late     = data?.late_submissions ?? [];
  const submitted = data?.eod_submissions ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <Card>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={labelStyle}>Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={dateInputStyle} />
          </div>
          <Button icon={Search} onClick={run} disabled={loading} style={{ height: 38, alignSelf: "flex-end" }}>
            {loading ? "Loading…" : "Check EOD"}
          </Button>
          {data && (
            <Button
              icon={emailState === "sent" ? CheckCircle2 : Send}
              variant={emailState === "sent" ? "success" : "primary"}
              onClick={sendEmail}
              disabled={emailState === "sending" || emailState === "sent"}
              style={{ height: 38, alignSelf: "flex-end" }}
            >
              {emailState === "sending" ? "Sending…" : emailState === "sent" ? "Email Sent!" : emailState === "error" ? "Retry Send" : "Send Email"}
            </Button>
          )}
        </div>
        {emailState === "error" && <StatusBox variant="danger" style={{ marginTop: 12 }}>Failed to send email. Check backend config.</StatusBox>}
      </Card>

      {error && <StatusBox variant="danger">{error}</StatusBox>}

      {data && (
        <>
          <StatRow>
            <StatCard icon={Users}        label="Active VAs"        value={data.active_va_count} />
            <StatCard icon={UserCheck}    label="Clocked In"        value={data.clocked_in_count}  highlight="teal" />
            <StatCard icon={FileCheck}    label="EOD Submitted"     value={data.submitted_count}   highlight="success" />
            <StatCard icon={UserX}        label="Missing EOD"       value={data.missing_count}     highlight={data.missing_count > 0 ? "danger" : "success"} />
            <StatCard icon={Clock}        label="Late Submissions"  value={data.late_count}        highlight={data.late_count > 0 ? "warning" : "success"} />
          </StatRow>

          {missing.length === 0 && late.length === 0
            ? <StatusBox variant="success">All VAs submitted their EOD reports on time for {date}.</StatusBox>
            : null
          }

          {missing.length > 0 && (
            <Card title={`Missing EOD — ${missing.length} VA${missing.length !== 1 ? "s" : ""}`} noPadding>
              {missing.map((va, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 20px",
                  borderTop: i > 0 ? `1px solid ${colors.border}` : "none",
                  background: i % 2 === 0 ? colors.dangerLight : "#FFF8F8",
                }}>
                  <CommunityBadge community={va.community} />
                  <span style={{ flex: 1, fontWeight: 600, fontSize: font.base, color: colors.textPrimary }}>
                    <VANameLink name={va.name} />
                  </span>
                  {va.missing_client && <StatusBadge variant="info">{va.missing_client}</StatusBadge>}
                  <StatusBadge variant={va.clocked_in ? "warning" : "danger"}>
                    {va.clocked_in ? "No EOD" : "No Clock-in"}
                  </StatusBadge>
                </div>
              ))}
            </Card>
          )}

          {late.length > 0 && (
            <Card title={`Late Submissions — ${late.length}`} noPadding>
              {late.map((r, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 20px",
                  borderTop: i > 0 ? `1px solid ${colors.border}` : "none",
                  background: i % 2 === 0 ? colors.warningLight : "#FFFBEB",
                }}>
                  <CommunityBadge community={r.community} />
                  <span style={{ flex: 1, fontWeight: 600, fontSize: font.base, color: colors.textPrimary }}>
                    <VANameLink name={r.name} />
                  </span>
                  {r.client && <span style={{ fontSize: font.xs, color: colors.textMuted }}>{r.client}</span>}
                  <StatusBadge variant="warning">{r.punctuality?.submitted_est} · {r.punctuality?.minutes_late}m late</StatusBadge>
                </div>
              ))}
            </Card>
          )}

          {submitted.length > 0 && (
            <Card title={`Submitted on Time — ${submitted.filter(r => r.punctuality?.on_time).length}`} noPadding>
              {submitted.filter(r => r.punctuality?.on_time).map((r, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 20px",
                  borderTop: i > 0 ? `1px solid ${colors.border}` : "none",
                  background: i % 2 === 0 ? colors.surface : colors.surfaceAlt,
                }}>
                  <CommunityBadge community={r.community} />
                  <span style={{ flex: 1, fontWeight: 600, fontSize: font.base, color: colors.textPrimary }}>
                    <VANameLink name={r.name} />
                  </span>
                  {r.client && <span style={{ fontSize: font.xs, color: colors.textMuted }}>{r.client}</span>}
                  <StatusBadge variant="success">{r.punctuality?.submitted_est}</StatusBadge>
                </div>
              ))}
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ── Attendance Tab ────────────────────────────────────────────────
function AttendanceTab() {
  const [date,    setDate]    = useState(todayISO());
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  async function run() {
    setLoading(true); setError(""); setData(null);
    try {
      const result = await apiFetch(`/api/attendance?date=${date}`);
      setData(result);
      logActivity(LOG_TYPES.ATTENDANCE_CHECK, `Attendance checked for ${date}`, { date });
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  const clockIns   = data?.clock_ins     ?? [];
  const noRecord   = data?.no_record     ?? [];
  const lateIns    = data?.late_clock_ins ?? [];
  const verifyCount = data?.verify_count ?? 0;

  function clockInName(c) {
    const name = c.va_name || c.raw_name;
    const asterisk = c.needs_verification
      ? <span title="Client name needs manual verification" style={{ color: colors.warning, fontWeight: 800, marginLeft: 4 }}>*</span>
      : null;
    // Only link when we have a real VA name (not a raw/unmatched attendance entry)
    return (
      <>
        {c.va_name ? <VANameLink name={c.va_name} /> : name}
        {asterisk}
      </>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <Card>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
          <div>
            <label style={labelStyle}>Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={dateInputStyle} />
          </div>
          <Button icon={Search} onClick={run} disabled={loading} style={{ height: 38, alignSelf: "flex-end" }}>
            {loading ? "Loading…" : "Check Attendance"}
          </Button>
        </div>
      </Card>

      {error && <StatusBox variant="danger">{error}</StatusBox>}

      {data && (
        <>
          <StatRow>
            <StatCard icon={Users}     label="Active VAs"     value={data.vas?.length ?? 0} />
            <StatCard icon={UserCheck} label="Clocked In"     value={clockIns.length}    highlight="teal" />
            <StatCard icon={Clock}     label="Late Clock-ins" value={lateIns.length}     highlight={lateIns.length > 0 ? "warning" : "success"} />
            <StatCard icon={UserX}     label="No Record"      value={noRecord.length}    highlight={noRecord.length > 0 ? "danger" : "success"} />
          </StatRow>

          {/* Verification warning pill */}
          {verifyCount > 0 && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: colors.warningLight, border: `1.5px solid ${colors.warningBorder}`,
              borderRadius: radius.md, padding: "8px 14px",
            }}>
              <AlertTriangle size={14} color={colors.warning} />
              <span style={{ fontSize: font.sm, fontWeight: 600, color: colors.warning }}>
                {verifyCount} clock-in{verifyCount !== 1 ? "s" : ""} need{verifyCount === 1 ? "s" : ""} client name verification (marked with *)
              </span>
            </div>
          )}

          {noRecord.length > 0 && (
            <Card title={`No Clock-in Record — ${noRecord.length} VA${noRecord.length !== 1 ? "s" : ""}`} noPadding>
              {noRecord.map((va, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 20px",
                  borderTop: i > 0 ? `1px solid ${colors.border}` : "none",
                  background: i % 2 === 0 ? colors.dangerLight : "#FFF8F8",
                }}>
                  <CommunityBadge community={va.community} />
                  <span style={{ flex: 1, fontWeight: 600, fontSize: font.base, color: colors.textPrimary }}>
                    <VANameLink name={va.name} />
                  </span>
                  <StatusBadge variant="danger">No record</StatusBadge>
                </div>
              ))}
            </Card>
          )}

          {lateIns.length > 0 && (
            <Card title={`Late Clock-ins — ${lateIns.length}`} noPadding>
              {lateIns.map((c, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 20px",
                  borderTop: i > 0 ? `1px solid ${colors.border}` : "none",
                  background: i % 2 === 0 ? colors.warningLight : "#FFFBEB",
                }}>
                  <span style={{ flex: 1, fontWeight: 600, fontSize: font.base, color: colors.textPrimary }}>
                    {clockInName(c)}
                  </span>
                  <StatusBadge variant="warning">
                    {c.punctuality?.clocked_in_est} · {c.punctuality?.minutes_late}m late
                  </StatusBadge>
                </div>
              ))}
            </Card>
          )}

          {clockIns.length > 0 && (
            <Card title={`All Clock-ins — ${clockIns.length}`} noPadding>
              {clockIns.map((c, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 20px",
                  borderTop: i > 0 ? `1px solid ${colors.border}` : "none",
                  background: i % 2 === 0 ? colors.surface : colors.surfaceAlt,
                }}>
                  <span style={{ flex: 1, fontWeight: 600, fontSize: font.base, color: colors.textPrimary }}>
                    {clockInName(c)}
                  </span>
                  <StatusBadge variant={c.punctuality?.on_time ? "success" : "warning"}>
                    {c.punctuality?.clocked_in_est}
                    {!c.punctuality?.on_time && ` · ${c.punctuality?.minutes_late}m late`}
                  </StatusBadge>
                </div>
              ))}
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ── CSV export helper ─────────────────────────────────────────────
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

// ── Status cell renderer ──────────────────────────────────────────
function StatusCell({ status, minutesLate, minutesEarly }) {
  if (status === "missing")
    return <span style={{ color: colors.danger, fontWeight: 600 }}>Missing</span>;
  if (status === "late")
    return <span style={{ color: colors.warning, fontWeight: 600 }}>{minutesLate} min late</span>;
  if (status === "early")
    return <span style={{ color: "#7C3AED", fontWeight: 600 }}>{minutesEarly} min early</span>;
  return <span style={{ color: colors.success, fontWeight: 600 }}>On-time</span>;
}

// ── Cached banner for Reports ─────────────────────────────────────
function ReportCachedBanner({ onRefresh, loading }) {
  const mins = cacheTimeLeft(CACHE_KEYS.REPORT);
  if (!mins) return null;
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      background: colors.tealLight, border: `1px solid ${colors.tealMid}`,
      borderRadius: radius.md, padding: "8px 14px",
    }}>
      <span style={{ fontSize: font.sm, color: colors.teal, fontWeight: 600 }}>
        Showing cached data · expires in {mins} min
      </span>
      <Button variant="ghost" icon={RefreshCw} onClick={onRefresh} disabled={loading} size="sm">
        Refresh
      </Button>
    </div>
  );
}

// ── Reports Tab ───────────────────────────────────────────────────
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

      {/* ── Controls ──────────────────────────────────────────── */}
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

      {data && (
        <>
          <ReportCachedBanner onRefresh={refresh} loading={loading} />

          {/* ── Stat cards ────────────────────────────────────── */}
          <StatRow>
            <StatCard icon={Users}     label="Active VAs"       value={stats.active_vas ?? 0} />
            <StatCard icon={UserCheck} label="Clocked In"       value={stats.clocked_in ?? 0}    highlight="teal" />
            <StatCard icon={FileCheck} label="EOD Submitted"    value={stats.eod_submitted ?? 0} highlight="success" />
            <StatCard icon={UserX}     label="Missing EOD"      value={stats.missing_eod ?? 0}   highlight={stats.missing_eod > 0 ? "danger" : "success"} />
            <StatCard icon={Clock}     label="Late Submissions" value={stats.late ?? 0}          highlight={stats.late > 0 ? "warning" : "success"} />
          </StatRow>

          {/* ── Filter pills + search ─────────────────────────── */}
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

          {/* ── Table ─────────────────────────────────────────── */}
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

// ── Root ──────────────────────────────────────────────────────────
export default function VirtualAssistants() {
  const [vas,       setVAs]       = useState(() => cacheGet(CACHE_KEY) ?? []);
  const [loading,   setLoading]   = useState(!cacheGet(CACHE_KEY));
  const [error,     setError]     = useState("");
  const [activeTab, setActiveTab] = useState("dashboard");

  useEffect(() => {
    if (cacheGet(CACHE_KEY)) return;
    apiFetch("/api/inspector/vas")
      .then(d => { const list = d.vas ?? []; cacheSet(CACHE_KEY, list); setVAs(list); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function refresh() {
    cacheClear(CACHE_KEY);
    setLoading(true); setError("");
    apiFetch("/api/inspector/vas")
      .then(d => { const list = d.vas ?? []; cacheSet(CACHE_KEY, list); setVAs(list); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }

  const filtered = activeTab === "active" ? vas
    : activeTab === "main"   ? vas.filter(v => v.community === "Main")
    : vas.filter(v => v.community === "CBA");

  const cbaMultiple = vas.filter(v => v.community === "CBA" && (v.contract_ids?.length ?? 0) > 1);

  const isReportTab = activeTab === "reports" || activeTab === "dashboard";

  return (
    <div style={{ fontFamily: font.family, width: "100%" }}>
      <PageHeader
        title="Virtual Assistants"
        subtitle="Directory of all active VAs with EOD report history and profile details."
      />

      {!isReportTab && <CachedBanner cacheKey={CACHE_KEY} onRefresh={refresh} loading={loading} />}

      {/* Summary pills — only show on directory tabs */}
      {!isReportTab && (
        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
          {[
            { label: "Total",               value: vas.length,                                     color: colors.teal,          bg: colors.tealLight },
            { label: "VAs with 2+ Clients", value: cbaMultiple.length,                             color: colors.communityMain, bg: colors.infoLight },
            { label: "Main Community",      value: vas.filter(v => v.community === "Main").length,  color: colors.communityMain, bg: colors.infoLight },
            { label: "CBA Community",       value: vas.filter(v => v.community === "CBA").length,   color: colors.communityCBA,  bg: "#FFF7ED"        },
          ].map((p, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 10,
              background: p.bg, borderRadius: radius.lg,
              padding: "10px 18px", border: `1px solid ${p.color}22`,
            }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: p.color }}>{p.value}</span>
              <span style={{ fontSize: font.sm, fontWeight: 600, color: p.color }}>{p.label}</span>
            </div>
          ))}
        </div>
      )}

      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {/* EOD & Attendance tabs */}
      {activeTab === "dashboard"    && <DashboardTab />}
      {activeTab === "reports"    && <ReportsTab />}

      {/* Directory tabs */}
      {!isReportTab && (
        <>
          {/* Table header — navy style to match Reports/Dashboard */}
          <div style={{
            display: "flex", alignItems: "center", gap: 14,
            padding: "10px 20px",
            background: colors.navy,
            borderRadius: `${radius.lg} ${radius.lg} 0 0`,
          }}>
            <div style={{ width: 36 }} />
            <div style={{ flex: 1, fontSize: font.xs, fontWeight: 700, color: "#fff", textTransform: "uppercase", letterSpacing: "0.05em" }}>Name</div>
            <div style={{ minWidth: 100, fontSize: font.xs, fontWeight: 700, color: "#fff", textTransform: "uppercase", letterSpacing: "0.05em" }}>Schedule</div>
            <div style={{ fontSize: font.xs, fontWeight: 700, color: "#fff", textTransform: "uppercase", letterSpacing: "0.05em" }}>Community</div>
          </div>

          <div style={{
            border: `1px solid ${colors.border}`, borderTop: "none",
            borderRadius: `0 0 ${radius.lg} ${radius.lg}`,
            overflow: "hidden", boxShadow: shadow.card,
          }}>
            {loading && <div style={{ padding: "40px 20px", textAlign: "center", color: colors.textMuted, fontSize: font.sm }}>Loading VAs…</div>}
            {error && <StatusBox variant="danger" style={{ margin: 16 }}>{error}</StatusBox>}
            {!loading && filtered.length === 0 && (
              <div style={{ padding: "40px 20px", textAlign: "center", color: colors.textFaint, fontSize: font.sm }}>No VAs found.</div>
            )}
            {filtered.map((va, i) => (
              <VAListRow key={va.id || i} va={va} i={i} />
            ))}
          </div>
        </>
      )}

    </div>
  );
}

const SHIFT_TABS = [
  { id: "morning",   label: "Morning Shift",   sub: "5:00 AM – 10:00 AM" },
  { id: "mid",       label: "Mid Shift",       sub: "10:00 AM – 3:00 PM" },
  { id: "afternoon", label: "Afternoon Shift", sub: "3:00 PM – 10:00 PM" },
];

function ShiftTabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 0, borderBottom: `2px solid ${colors.border}`, marginBottom: 16 }}>
      {tabs.map(t => {
        const isActive = t.id === active;
        return (
          <button key={t.id} onClick={() => onChange(t.id)} style={{
            padding: "10px 20px", background: "none", border: "none", cursor: "pointer",
            fontFamily: font.family, fontSize: font.sm, fontWeight: 700,
            color: isActive ? colors.teal : colors.textMuted,
            borderBottom: isActive ? `2px solid ${colors.teal}` : "2px solid transparent",
            marginBottom: -2, transition: "all .15s",
          }}>
            <div>{t.label}</div>
            <div style={{ fontSize: font.xs, fontWeight: 500, color: isActive ? colors.teal : colors.textFaint, marginTop: 2 }}>
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

  // ── Filtering helpers ─────────────────────────────────────────
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

  // Combined stats across all shifts (community filter applied, no search)
  const allRows = data
    ? [...(data.morning || []), ...(data.mid || []), ...(data.afternoon || [])]
    : [];
  const filteredAllRows = allRows.filter(matchCommunity);

  // Rows shown in table — filtered by shift + community + search
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

      {/* Stat cards */}
      {data && (
        <StatRow>
          <StatCard icon={Users}     label="Working Today" value={stats.total} />
          <StatCard icon={Clock}     label="Clocked In"    value={stats.clocked_in}  highlight="teal" />
          <StatCard icon={UserCheck} label="Clocked Out"   value={stats.clocked_out} highlight="success" />
          <StatCard icon={UserX}     label="Absent"        value={stats.absent}
            highlight={stats.absent > 0 ? "danger" : "success"} />
        </StatRow>
      )}

      {error && <StatusBox variant="danger">{error}</StatusBox>}

      {/* Shift sub-tabs */}
      <ShiftTabBar tabs={SHIFT_TABS} active={shiftTab} onChange={setShiftTab} />

      {/* ── Filter pills + search (matches Reports tab style) ─── */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
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
              background: colors.surface, color: colors.textPrimary, width: 220,
            }}
            onFocus={e => e.target.style.borderColor = colors.teal}
            onBlur={e  => e.target.style.borderColor = colors.border}
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: "center", color: colors.textMuted, fontSize: font.sm, padding: "40px 0" }}>
          Loading shift data…
        </div>
      ) : rows.length === 0 ? (
        <StatusBox variant="info">
          {search
            ? `No results matching "${search}".`
            : community === "all"
              ? `No VAs scheduled for the ${SHIFT_TABS.find(t => t.id === shiftTab)?.label.toLowerCase() || "selected shift"}.`
              : `No ${community === "cba" ? "CBA" : "Agency"} VAs scheduled for this shift.`
          }
        </StatusBox>
      ) : (
        <Card noPadding>
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
        </Card>
      )}
    </div>
  );
}