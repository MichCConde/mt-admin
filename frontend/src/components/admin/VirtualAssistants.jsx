import { useState, useEffect, useCallback } from "react";
import {
  X, FileCheck, Timer, CheckCircle2, XCircle,
  ChevronDown, ChevronUp, Mail, Phone, Calendar, Users, RefreshCw,
  Search, Send, AlertTriangle, Clock, UserX, UserCheck,
} from "lucide-react";
import { colors, font, radius, shadow }         from "../../styles/tokens";
import { apiFetch }                             from "../../api";
import { cacheGet, cacheSet, cacheClear, cacheTimeLeft } from "../../utils/reportCache";
import { Card, PageHeader, TabBar, SectionLabel, StatRow } from "../ui/Structure";
import { Avatar, CommunityBadge, StatCard, StatusBadge, StatusBox, Tag } from "../ui/Indicators";
import { Select, NumberInput }                  from "../ui/Inputs";
import Button                                   from "../ui/Button";
import { logActivity, LOG_TYPES }               from "../../utils/logger";

const CACHE_KEY = "va:list";

// ── Constants ─────────────────────────────────────────────────────
const MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];
const MONTH_OPTIONS = MONTHS.map((m, i) => ({ value: i + 1, label: m }));

const TABS = [
  { id: "active",     label: "Active"        },
  { id: "main",       label: "Agency (Main)" },
  { id: "cba",        label: "CBA"           },
  { id: "eod",        label: "EOD Reports"   },
  { id: "attendance", label: "Attendance"    },
];

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

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
function VAListRow({ va, onClick, i }) {
  const clientCount = va.contract_ids?.length ?? 0;
  return (
    <button
      onClick={() => onClick(va)}
      style={{
        display: "flex", alignItems: "center", gap: 14,
        width: "100%", padding: "12px 20px",
        background: i % 2 === 0 ? colors.surface : colors.surfaceAlt,
        borderTop: `1px solid ${colors.border}`,
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

// ── ReportCard (expandable EOD entry in modal) ────────────────────
function ReportCard({ report: r, community }) {
  const [expanded, setExpanded] = useState(false);
  const isLate  = !r.punctuality?.on_time;
  const isCBA   = community === "CBA";
  const Chevron = expanded ? ChevronUp : ChevronDown;
  const dateLabel = new Date(r.date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
  return (
    <div style={{
      border: `1px solid ${isLate ? colors.warningBorder : colors.border}`,
      borderRadius: radius.md, overflow: "hidden",
    }}>
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          width: "100%", padding: "10px 14px",
          background: isLate ? colors.warningLight : colors.surfaceAlt,
          border: "none", cursor: "pointer", fontFamily: font.family,
          borderBottom: expanded ? `1px solid ${isLate ? colors.warningBorder : colors.border}` : "none",
          textAlign: "left",
        }}
      >
        <span style={{ flex: 1, fontWeight: 600, fontSize: font.sm, color: colors.textPrimary }}>{dateLabel}</span>
        {r.client && <span style={{ fontSize: font.xs, color: colors.textMuted }}>{r.client}</span>}
        {isLate
          ? <StatusBadge variant="warning">{r.punctuality.submitted_est} · {r.punctuality.minutes_late}m late</StatusBadge>
          : <StatusBadge variant="success">On Time · {r.punctuality?.submitted_est}</StatusBadge>
        }
        <Chevron size={13} color={colors.textMuted} />
      </button>
      {expanded && (
        <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            ["Time In",  r.time_in  || "—"],
            ["Time Out", r.time_out || "—"],
            ...(isCBA ? [
              ["New Leads",    r.new_leads    ?? "—"],
              ["Email Apps",   r.email_apps   ?? "—"],
              ["Website Apps", r.website_apps ?? "—"],
              ["Follow-Ups",   r.follow_ups   ?? "—"],
            ] : []),
          ].map(([label, value]) => (
            <div key={label} style={{ display: "flex", gap: 10 }}>
              <span style={{ fontSize: font.xs, fontWeight: 700, color: colors.textMuted, minWidth: 90 }}>{label}</span>
              <span style={{ fontSize: font.sm, color: colors.textBody }}>{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── VA Modal ──────────────────────────────────────────────────────
function VAModal({ va, onClose }) {
  const now = new Date();
  const [year,    setYear]    = useState(now.getFullYear());
  const [month,   setMonth]   = useState(now.getMonth() + 1);
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true); setError(""); setData(null);
    try {
      const result = await apiFetch(
        `/api/inspector?va_name=${encodeURIComponent(va.name)}&year=${year}&month=${month}`
      );
      setData(result);
      logActivity(LOG_TYPES.VA_INSPECT, `Viewed ${va.name} profile for ${MONTHS[month - 1]} ${year}`, { va: va.name, month, year });
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [va.name, year, month]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(13,31,60,0.45)", zIndex: 100 }} />
      <div style={{
        position: "fixed", top: 0, right: 0,
        height: "100vh", width: "min(580px, 95vw)",
        background: colors.surface, boxShadow: "-8px 0 32px rgba(0,0,0,0.15)",
        zIndex: 101, display: "flex", flexDirection: "column",
        overflowY: "auto", fontFamily: font.family,
      }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 14,
          padding: "20px 24px", borderBottom: `1px solid ${colors.border}`,
          background: colors.surfaceAlt, position: "sticky", top: 0, zIndex: 10,
        }}>
          <Avatar name={va.name} size={48} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: font.h3, fontWeight: 800, color: colors.textPrimary }}>{va.name}</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
              <CommunityBadge community={va.community} />
              <span style={{ fontSize: font.xs, color: colors.textMuted }}>{va.schedule || "No schedule set"}</span>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: colors.surfaceAlt, border: `1px solid ${colors.border}`,
            borderRadius: radius.md, padding: "6px 8px", cursor: "pointer",
            display: "flex", alignItems: "center",
          }}>
            <X size={16} color={colors.textMuted} />
          </button>
        </div>

        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 24 }}>
          <Card title="Profile">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                [Mail,     "MT Email",   va.email      || "—"],
                [Phone,    "Phone",      va.phone      || "—"],
                [Calendar, "Start Date", fmtDate(va.start_date)],
              ].map(([Icon, label, value]) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Icon size={14} color={colors.textMuted} style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: font.sm, fontWeight: 700, color: colors.textMuted, minWidth: 90 }}>{label}</span>
                  <span style={{ fontSize: font.sm, color: colors.textBody }}>{value}</span>
                </div>
              ))}
            </div>
          </Card>

          <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <Select label="Month" value={month} onChange={e => setMonth(Number(e.target.value))} options={MONTH_OPTIONS} style={{ flex: 1 }} />
            <NumberInput label="Year" value={year} onChange={setYear} min={2023} max={2030} style={{ width: 90 }} />
          </div>

          {error && <StatusBox variant="danger">{error}</StatusBox>}
          {loading && <div style={{ textAlign: "center", color: colors.textMuted, fontSize: font.sm, padding: "20px 0" }}>Loading reports…</div>}

          {data && (
            <>
              <StatRow>
                <StatCard icon={FileCheck}    label="Reports"  value={data.submitted_count} />
                <StatCard icon={CheckCircle2} label="On Time"  value={data.on_time_count}   highlight="success" />
                <StatCard icon={Timer}        label="Late"     value={data.late_count}      highlight={data.late_count > 0 ? "warning" : "success"} />
                <StatCard
                  icon={data.missing_days.length > 0 ? XCircle : CheckCircle2}
                  label="Missing" value={data.missing_days.length}
                  highlight={data.missing_days.length > 0 ? "danger" : "success"}
                />
              </StatRow>

              {data.missing_days.length > 0 && (
                <div>
                  <SectionLabel>Missing EOD Days</SectionLabel>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {data.missing_days.map((d, i) => (
                      <Tag key={i} variant="danger">
                        {new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </Tag>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <SectionLabel>EOD Reports ({data.reports.length}) · {MONTHS[data.month - 1]} {data.year}</SectionLabel>
                {data.reports.length === 0
                  ? <StatusBox variant="info">No EOD reports found for {MONTHS[data.month - 1]} {data.year}.</StatusBox>
                  : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {data.reports.map((r, i) => <ReportCard key={i} report={r} community={data.va.community} />)}
                    </div>
                }
              </div>

              {data.missing_days.length === 0 && data.submitted_count > 0 && (
                <StatusBox variant="success">No missing EOD reports for {MONTHS[data.month - 1]} {data.year}.</StatusBox>
              )}
            </>
          )}
        </div>
      </div>
    </>
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
                  <span style={{ flex: 1, fontWeight: 600, fontSize: font.base, color: colors.textPrimary }}>{va.name}</span>
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
                  <span style={{ flex: 1, fontWeight: 600, fontSize: font.base, color: colors.textPrimary }}>{r.name}</span>
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
                  <span style={{ flex: 1, fontWeight: 600, fontSize: font.base, color: colors.textPrimary }}>{r.name}</span>
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
  const clockOuts  = data?.clock_outs    ?? [];
  const noRecord   = data?.no_record     ?? [];
  const lateIns    = data?.late_clock_ins ?? [];

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
            <StatCard icon={Users}     label="Active VAs"    value={data.vas?.length ?? 0} />
            <StatCard icon={UserCheck} label="Clocked In"    value={clockIns.length}    highlight="teal" />
            <StatCard icon={Clock}     label="Late Clock-ins" value={lateIns.length}    highlight={lateIns.length > 0 ? "warning" : "success"} />
            <StatCard icon={UserX}     label="No Record"     value={noRecord.length}    highlight={noRecord.length > 0 ? "danger" : "success"} />
          </StatRow>

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
                  <span style={{ flex: 1, fontWeight: 600, fontSize: font.base, color: colors.textPrimary }}>{va.name}</span>
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
                  <span style={{ flex: 1, fontWeight: 600, fontSize: font.base, color: colors.textPrimary }}>{c.raw_name}</span>
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
                  <span style={{ flex: 1, fontWeight: 600, fontSize: font.base, color: colors.textPrimary }}>{c.raw_name}</span>
                  <StatusBadge variant={c.punctuality?.on_time ? "success" : "warning"}>
                    {c.punctuality?.clocked_in_est}
                    {!c.punctuality?.on_time && ` · ${c.punctuality?.minutes_late}m late`}
                  </StatusBadge>
                </div>
              ))}
            </Card>
          )}

          {clockOuts.length > 0 && (
            <Card title={`Clock-outs — ${clockOuts.length}`} noPadding>
              {clockOuts.map((c, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "10px 20px",
                  borderTop: i > 0 ? `1px solid ${colors.border}` : "none",
                  background: i % 2 === 0 ? colors.surface : colors.surfaceAlt,
                }}>
                  <span style={{ flex: 1, fontWeight: 600, fontSize: font.base, color: colors.textPrimary }}>{c.raw_name}</span>
                </div>
              ))}
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
  const [activeTab, setActiveTab] = useState("active");
  const [selected,  setSelected]  = useState(null);

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

  // EOD and Attendance tabs have their own self-contained UI
  const isReportTab = activeTab === "eod" || activeTab === "attendance";

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
      {activeTab === "eod"        && <EODTab />}
      {activeTab === "attendance" && <AttendanceTab />}

      {/* Directory tabs */}
      {!isReportTab && (
        <>
          {/* Table header */}
          <div style={{
            display: "flex", alignItems: "center", gap: 14,
            padding: "8px 20px",
            background: colors.surfaceAlt,
            borderBottom: `1px solid ${colors.border}`,
            borderTop:    `1px solid ${colors.border}`,
            borderRadius: `${radius.lg} ${radius.lg} 0 0`,
          }}>
            <div style={{ width: 36 }} />
            <div style={{ flex: 1, fontSize: font.xs, fontWeight: 700, color: colors.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Name</div>
            <div style={{ minWidth: 100, fontSize: font.xs, fontWeight: 700, color: colors.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Schedule</div>
            <div style={{ fontSize: font.xs, fontWeight: 700, color: colors.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Community</div>
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
              <VAListRow key={va.id || i} va={va} onClick={setSelected} i={i} />
            ))}
          </div>
        </>
      )}

      {selected && <VAModal va={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}