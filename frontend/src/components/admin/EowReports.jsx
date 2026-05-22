import { useState, useEffect, useRef } from "react";
import {
  Search, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus,
  Clock, UserX, FileCheck, Flag, Copy, Users, RefreshCw, AlertTriangle,
  CheckCircle2, XCircle, Timer, CalendarCheck, ArrowRight, Zap, X,
  ArrowUpRight,
} from "lucide-react";
import { colors, font, radius, shadow } from "../../styles/tokens";
import { apiFetch } from "../../api";
import { cacheSet, cacheGet, cacheClear, cacheTimeLeft, CACHE_KEYS } from "../../utils/reportCache";
import Button from "../ui/Button";
import { Card, PageHeader, StatRow, TabBar } from "../ui/Structure";
import { StatCard, StatusBadge, CommunityBadge, StatusBox, Avatar } from "../ui/Indicators";
import { logActivity, LOG_TYPES } from "../../utils/logger";
import FilterPill from "../ui/FilterPill";
import { VANameLink } from "../../contexts/VAProfileContext";
import TopBarCachedBanner from "../ui/TopBarCachedBanner";
import TopBarProgress from "../ui/TopBarProgress";
import { Skeleton } from "../ui/Skeleton";

const CACHE_WEEK = CACHE_KEYS.EOW_ALL;
const STAT_RADIUS = 8;

// ── Inject animation styles once ─────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("mt-eow-styles")) {
  const tag = document.createElement("style");
  tag.id = "mt-eow-styles";
  tag.innerHTML = `
    @keyframes mt-eow-fade {
      from { opacity: 0; transform: translateY(2px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .mt-eow-fade { animation: mt-eow-fade .22s ease-out; }
    .mt-eow-metric {
      transition: border-color .15s, box-shadow .15s, transform .15s;
    }
    .mt-eow-metric:hover {
      border-color: ${colors.tealMid};
      box-shadow: 0 2px 8px rgba(12, 184, 169, 0.08);
      transform: translateY(-1px);
    }
    .mt-eow-metric-clickable { cursor: pointer; }
    .mt-eow-metric-clickable .mt-eow-metric-hint {
      opacity: 0;
      transition: opacity .15s;
    }
    .mt-eow-metric-clickable:hover .mt-eow-metric-hint {
      opacity: 1;
    }

    @keyframes mt-modal-backdrop-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes mt-modal-backdrop-out {
      from { opacity: 1; }
      to   { opacity: 0; }
    }
    @keyframes mt-modal-card-in {
      from { opacity: 0; transform: translateY(8px) scale(.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes mt-modal-card-out {
      from { opacity: 1; transform: translateY(0) scale(1); }
      to   { opacity: 0; transform: translateY(8px) scale(.97); }
    }
    .mt-modal-backdrop-in  { animation: mt-modal-backdrop-in .2s ease-out forwards; }
    .mt-modal-backdrop-out { animation: mt-modal-backdrop-out .18s ease-out forwards; }
    .mt-modal-card-in      { animation: mt-modal-card-in .24s cubic-bezier(.2,.8,.2,1) forwards; }
    .mt-modal-card-out     { animation: mt-modal-card-out .18s cubic-bezier(.4,0,1,1) forwards; }
  `;
  document.head.appendChild(tag);
}

// ── Date helpers (timezone-safe) ─────────────────────────────────
// IMPORTANT: never use `.toISOString().split("T")[0]` here. That converts
// to UTC and silently shifts the date by a day for any user in a non-UTC
// timezone (which is everyone). Always pull local Y-M-D components.
function isoFromLocal(d) {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function getWeekRange() {
  const today = new Date();
  const day   = today.getDay();               // 0 = Sun, 1 = Mon, ... 6 = Sat
  const mon   = new Date(today);
  mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
  const fri = new Date(mon);
  fri.setDate(mon.getDate() + 4);
  return { start: isoFromLocal(mon), end: isoFromLocal(fri) };
}

function shiftDate(iso, days) {
  // Use noon (T12:00:00) to stay safely away from any DST boundary
  const dt = new Date(`${iso}T12:00:00`);
  dt.setDate(dt.getDate() + days);
  return isoFromLocal(dt);
}

function fmtDate(iso) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}
function fmtDateShort(iso) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

function parseTimeString(s) {
  if (!s) return null;
  const str = String(s).trim().toUpperCase()
    .replace(/\s*EST\s*$/, "")
    .replace(/\s*EDT\s*$/, "")
    .replace(/\s+/g, "");
  let m = str.match(/^(\d{1,2}):(\d{2})(AM|PM)$/);
  if (m) {
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    if (m[3] === "PM" && h < 12) h += 12;
    if (m[3] === "AM" && h === 12) h = 0;
    return h * 60 + min;
  }
  m = str.match(/^(\d{1,2}):(\d{2})$/);
  if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  return null;
}

function computeHoursWorked(clockInStr, clockOutStr) {
  const start = parseTimeString(clockInStr);
  const end   = parseTimeString(clockOutStr);
  if (start === null || end === null) return 0;
  let diff = end - start;
  if (diff < 0) diff += 24 * 60;
  return diff / 60;
}

function hoursForEntry(entry) {
  const clockIn  = entry?.clock_in_est;
  const clockOut = entry?.reports?.[0]?.punctuality?.submitted_est;
  if (!clockIn || !clockOut) return 0;
  return computeHoursWorked(clockIn, clockOut);
}

function hoursAccent(actual, expected) {
  if (!expected || expected === 0) return "teal";
  const pct = actual / expected;
  if (pct >= 0.95 && pct <= 1.10) return "success";
  if (pct >= 0.85 || pct > 1.10)  return "warning";
  return "danger";
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

// ── Metric computation ───────────────────────────────────────────
function computeAggregate(data) {
  if (!data?.va_summaries) return null;
  const summaries = data.va_summaries;
  const allReports = summaries.flatMap(s => s.daily.flatMap(d => d.reports));
  return {
    totalSubmitted: allReports.length,
    totalPossible:  data.totals?.possible_eod ?? 0,
    totalMissing:   data.totals?.missing_eod ?? 0,
    totalLate:      data.totals?.late ?? 0,
    submissionRate: data.totals?.possible_eod
      ? Math.round(((data.totals.possible_eod - data.totals.missing_eod) / data.totals.possible_eod) * 100)
      : 0,
    punctualityRate: allReports.length
      ? Math.round((allReports.filter(r => r.punctuality?.on_time).length / allReports.length) * 100)
      : 0,
    vaCount:        summaries.length,
    vasWithMissing: summaries.filter(s => s.stats.missing_count > 0).length,
  };
}

function computeIndividual(summary) {
  if (!summary) return null;
  const { daily, stats } = summary;
  const allReports = daily.flatMap(d => d.reports);

  const totalSlots = daily.length;
  const submittedSlots = daily.filter(d => d.eod_submitted).length;
  const eodRate = totalSlots ? Math.round((submittedSlots / totalSlots) * 100) : 0;

  const onTimeReports = allReports.filter(r => r.punctuality?.on_time).length;
  const punctualityRate = allReports.length
    ? Math.round((onTimeReports / allReports.length) * 100)
    : null;

  const lateReports = allReports.filter(r => !r.punctuality?.on_time);
  const totalMinsLate = lateReports.reduce(
    (sum, r) => sum + (r.punctuality?.minutes_late ?? 0), 0
  );
  const avgMinsLate = lateReports.length
    ? Math.round((totalMinsLate / lateReports.length) * 10) / 10
    : 0;

  const clockedInSlots = daily.filter(d => d.clocked_in).length;
  const clockInRate = totalSlots
    ? Math.round((clockedInSlots / totalSlots) * 100)
    : 0;

  const reportsWithSubmission = allReports.filter(r => r.punctuality?.submitted_est).length;
  const clockOutRate = allReports.length
    ? Math.round((reportsWithSubmission / allReports.length) * 100)
    : null;

  const dateMap = {};
  for (const e of daily) {
    if (!dateMap[e.date]) dateMap[e.date] = { anyMissed: false };
    if (!e.eod_submitted) dateMap[e.date].anyMissed = true;
  }
  const sortedDates = Object.keys(dateMap).sort();
  let maxStreak = 0, curStreak = 0;
  for (const d of sortedDates) {
    if (dateMap[d].anyMissed) {
      curStreak += 1;
      maxStreak = Math.max(maxStreak, curStreak);
    } else {
      curStreak = 0;
    }
  }

  const totalHours    = daily.reduce((sum, d) => sum + hoursForEntry(d), 0);
  const expectedHours = daily.reduce((sum, d) => sum + (d.expected_hours ?? 0), 0);

  return {
    eodRate, submittedSlots, totalSlots,
    punctualityRate, onTimeReports, totalReports: allReports.length,
    avgMinsLate, lateCount: lateReports.length,
    clockInRate, clockedInSlots,
    clockOutRate, reportsWithSubmission,
    consecutiveMissed: maxStreak,
    totalHours:    Math.round(totalHours * 10) / 10,
    expectedHours: Math.round(expectedHours * 10) / 10,
    stats,
  };
}

function buildContractRows(weekData, prevWeekData) {
  if (!weekData?.va_summaries) return [];
  const prevIndex = {};
  for (const ps of prevWeekData?.va_summaries ?? []) {
    prevIndex[ps.va.name] = {};
    for (const d of ps.daily) {
      if (!prevIndex[ps.va.name][d.client]) prevIndex[ps.va.name][d.client] = [];
      prevIndex[ps.va.name][d.client].push(d);
    }
  }
  const rows = [];
  for (const s of weekData.va_summaries) {
    const byClient = {};
    for (const d of s.daily) {
      if (!byClient[d.client]) byClient[d.client] = [];
      byClient[d.client].push(d);
    }
    for (const client of Object.keys(byClient)) {
      const entries   = byClient[client];
      const expected  = entries.length;
      const submitted = entries.filter(d => d.eod_submitted).length;
      const totalHours    = Math.round(entries.reduce((sum, d) => sum + hoursForEntry(d), 0) * 10) / 10;
      const expectedHours = Math.round(entries.reduce((sum, d) => sum + (d.expected_hours ?? 0), 0) * 10) / 10;
      const allReports = entries.flatMap(d => d.reports);
      const lateReports  = allReports.filter(r => r.punctuality && !r.punctuality.on_time && (r.punctuality.minutes_late ?? 0) > 0);
      const earlyReports = allReports.filter(r => r.punctuality && !r.punctuality.on_time && (r.punctuality.minutes_early ?? 0) > 0);
      const hasMissing = submitted < expected;
      const hasLate    = lateReports.length > 0;
      const hasEarly   = earlyReports.length > 0;
      const isOnTime   = !hasMissing && !hasLate && !hasEarly && submitted > 0;
      const prevEntries   = prevIndex[s.va.name]?.[client];
      const prevSubmitted = prevEntries ? prevEntries.filter(d => d.eod_submitted).length : null;
      const prevHours     = prevEntries
        ? Math.round(prevEntries.reduce((sum, d) => sum + hoursForEntry(d), 0) * 10) / 10
        : null;
      rows.push({
        va_name: s.va.name, client, community: s.community,
        submitted, expected, totalHours, expectedHours,
        hasMissing, hasLate, hasEarly, isOnTime,
        lateCount: lateReports.length, earlyCount: earlyReports.length,
        missingCount: expected - submitted,
        prevSubmitted, prevHours,
        hasPrev: prevEntries !== undefined && prevEntries !== null,
      });
    }
  }
  return rows;
}

// ── WoW indicators ───────────────────────────────────────────────
function WoWDelta({ current, previous, isInverse = false, suffix = "" }) {
  if (previous == null || previous === undefined || Number.isNaN(previous)) {
    return <div style={{ marginTop: 8, fontSize: font.xs, color: colors.textFaint }}>no prior data</div>;
  }
  const delta = current - previous;
  if (delta === 0) {
    return (
      <div style={{
        marginTop: 8,
        display: "inline-flex", alignItems: "center", gap: 4,
        fontSize: font.xs, color: colors.textMuted, fontWeight: 600,
      }}>
        <Minus size={11} /><span>same as last week</span>
      </div>
    );
  }
  const improved = isInverse ? delta < 0 : delta > 0;
  const Icon = delta > 0 ? TrendingUp : TrendingDown;
  const color = improved ? colors.success : colors.danger;
  const bg     = improved ? colors.successLight : colors.dangerLight;
  const border = improved ? colors.successBorder : colors.dangerBorder;
  const sign = delta > 0 ? "+" : "";
  return (
    <div style={{
      marginTop: 8,
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: font.xs, color, fontWeight: 700,
      background: bg, border: `1px solid ${border}`,
      borderRadius: radius.sm, padding: "2px 8px",
    }}>
      <Icon size={11} strokeWidth={2.5} />
      <span>{sign}{delta}{suffix} vs last week</span>
    </div>
  );
}

function WoWBadge({ current, previous, isInverse = false, suffix = "" }) {
  if (previous == null || previous === undefined || Number.isNaN(previous)) {
    return <span style={{ fontSize: font.xs, color: colors.textFaint }}>no prior</span>;
  }
  const delta = Math.round((current - previous) * 10) / 10;
  if (delta === 0) {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        fontSize: font.xs, fontWeight: 600, color: colors.textMuted,
      }}>
        <Minus size={11} /> same
      </span>
    );
  }
  const improved = isInverse ? delta < 0 : delta > 0;
  const Icon = delta > 0 ? TrendingUp : TrendingDown;
  const color = improved ? colors.success : colors.danger;
  const sign = delta > 0 ? "+" : "";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: font.xs, fontWeight: 700, color,
    }}>
      <Icon size={11} strokeWidth={2.5} />
      {sign}{delta}{suffix}
    </span>
  );
}

// ── MetricBox (now clickable) ────────────────────────────────────
function MetricBox({ icon: Icon, value, label, accent, suffix, deltaCurrent, deltaPrevious, deltaInverse, deltaSuffix, sub, onClick }) {
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
  const showDelta = deltaCurrent !== undefined && deltaCurrent !== null;
  const clickable = !!onClick;

  return (
    <div
      className={`mt-eow-metric${clickable ? " mt-eow-metric-clickable" : ""}`}
      onClick={onClick}
      style={{
        position: "relative",
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: STAT_RADIUS,
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      {clickable && (
        <div
          className="mt-eow-metric-hint"
          style={{
            position: "absolute", top: 10, right: 10,
            display: "flex", alignItems: "center", gap: 3,
            fontSize: 10, fontWeight: 700,
            color: colors.teal,
            textTransform: "uppercase", letterSpacing: "0.04em",
          }}
        >
          <span>Details</span>
          <ArrowUpRight size={11} strokeWidth={2.5} />
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
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
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{
              fontSize: 26, fontWeight: 800, color: valueColor, lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
            }}>{value}</span>
            {suffix && (
              <span style={{ fontSize: font.base, fontWeight: 600, color: colors.textMuted }}>{suffix}</span>
            )}
          </div>
          <div style={{
            fontSize: 11, color: colors.textMuted, marginTop: 6,
            textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>{label}</div>
        </div>
      </div>
      {sub && (
        <div style={{ fontSize: font.xs, color: colors.textMuted, marginTop: 2, paddingLeft: 54 }}>{sub}</div>
      )}
      {showDelta && (
        <div style={{ paddingLeft: 54 }}>
          <WoWDelta current={deltaCurrent} previous={deltaPrevious} isInverse={deltaInverse} suffix={deltaSuffix || ""} />
        </div>
      )}
    </div>
  );
}

function MetricBoxSkeleton() {
  return (
    <div style={{
      background: colors.surface,
      border: `1px solid ${colors.border}`,
      borderRadius: STAT_RADIUS,
      padding: "16px 18px",
      display: "flex", alignItems: "center", gap: 14,
    }}>
      <Skeleton width={40} height={40} radius={8} />
      <div style={{ flex: 1 }}>
        <Skeleton width={48} height={22} />
        <Skeleton width={100} height={10} style={{ marginTop: 8 }} />
      </div>
    </div>
  );
}

// ── Day cell pills (weekly grid) ─────────────────────────────────
const PILL = {
  success: { bg: colors.successLight, color: colors.success, border: colors.successBorder },
  warning: { bg: colors.warningLight, color: colors.warning, border: colors.warningBorder },
  danger:  { bg: colors.dangerLight,  color: colors.danger,  border: colors.dangerBorder  },
  info:    { bg: colors.infoLight,    color: colors.info,    border: colors.infoBorder    },
  flag:    { bg: "#FFF5F5",           color: "#9333EA",      border: "#E9D5FF"            },
  neutral: { bg: colors.surfaceAlt,   color: colors.textMuted, border: colors.border      },
};
function pillStyle(v) {
  const s = PILL[v];
  return {
    display: "inline-block", background: s.bg, color: s.color,
    border: `1px solid ${s.border}`, borderRadius: radius.sm,
    padding: "2px 8px", fontSize: font.xs, fontWeight: 700, whiteSpace: "nowrap",
  };
}
function DayCell({ entry }) {
  if (!entry) return <span style={{ color: colors.textFaint, fontSize: font.xs }}>—</span>;
  if (!entry.clocked_in && !entry.eod_submitted) return <span style={pillStyle("danger")}>Absent</span>;
  if ( entry.clocked_in && !entry.eod_submitted) return <span style={pillStyle("warning")}>No EOD</span>;
  if (!entry.clocked_in &&  entry.eod_submitted) return <span style={pillStyle("info")}>No Clock-in</span>;
  if (entry.keyword_flags?.length > 0)           return <span style={pillStyle("flag")}>⚑ Flagged</span>;
  if (entry.reports?.some(r => !r.punctuality?.on_time)) return <span style={pillStyle("warning")}>Late EOD</span>;
  return <span style={pillStyle("success")}>✓ OK</span>;
}

function WeeklyGrid({ daily, workdays, community }) {
  const byDate = {};
  for (const e of daily) {
    if (!byDate[e.date]) byDate[e.date] = [];
    byDate[e.date].push(e);
  }
  const clients = [...new Set(daily.map(e => e.client).filter(Boolean))];
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 500 }}>
        <thead>
          <tr>
            {community === "CBA" && clients.length > 0 && (
              <th style={{
                padding: "6px 10px", fontSize: font.xs, fontWeight: 700,
                color: colors.textMuted, borderBottom: `1px solid ${colors.border}`, textAlign: "left",
              }}>Client</th>
            )}
            {workdays.map(d => (
              <th key={d} style={{
                padding: "6px 10px", fontSize: font.xs, fontWeight: 700,
                color: colors.textMuted, textAlign: "center",
                borderBottom: `1px solid ${colors.border}`, whiteSpace: "nowrap",
              }}>{fmtDate(d)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {community === "CBA" && clients.length > 0 ? clients.map(client => (
            <tr key={client}>
              <td style={{
                padding: "6px 10px", fontSize: font.sm, fontWeight: 600,
                color: colors.textBody, borderTop: `1px solid ${colors.border}`, whiteSpace: "nowrap",
              }}>{client}</td>
              {workdays.map(d => (
                <td key={d} style={{
                  padding: "6px 10px", textAlign: "center",
                  borderTop: `1px solid ${colors.border}`,
                }}>
                  <DayCell entry={byDate[d]?.find(e => e.client === client)} />
                </td>
              ))}
            </tr>
          )) : (
            <tr>
              {workdays.map(d => (
                <td key={d} style={{
                  padding: "6px 10px", textAlign: "center",
                  borderTop: `1px solid ${colors.border}`,
                }}>
                  <DayCell entry={byDate[d]?.[0]} />
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function FlagDetails({ flags }) {
  if (!flags.keywords.length && !flags.duplicates.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {flags.keywords.length > 0 && (
        <div style={{
          background: colors.infoLight, border: `1px solid ${colors.infoBorder}`,
          borderRadius: radius.md, padding: "12px 16px",
        }}>
          <div style={{ fontSize: font.sm, fontWeight: 700, color: colors.info, marginBottom: 6 }}>
            ⚑ Client Issue Keywords Detected
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {flags.keywords.map((kw, i) => (
              <span key={i} style={{
                background: colors.infoLight, color: colors.info,
                border: `1px solid ${colors.infoBorder}`, borderRadius: radius.sm,
                padding: "2px 9px", fontSize: font.xs, fontWeight: 700,
              }}>"{kw}"</span>
            ))}
          </div>
        </div>
      )}
      {flags.duplicates.length > 0 && (
        <div style={{
          background: colors.dangerLight, border: `1px solid ${colors.dangerBorder}`,
          borderRadius: radius.md, padding: "12px 16px",
        }}>
          <div style={{ fontSize: font.sm, fontWeight: 700, color: colors.danger, marginBottom: 8 }}>
            ⚠ Duplicate EOD Content Detected
          </div>
          {flags.duplicates.map((r, i) => (
            <div key={i} style={{ fontSize: font.sm, color: colors.textBody, marginBottom: 4 }}>
              <strong>{fmtDateShort(r.date)}</strong>{r.client && ` (${r.client})`}
              {" — "}<span style={{ color: colors.danger }}>identical content to {fmtDateShort(r.duplicate_of)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// ── BREAKDOWN MODAL SYSTEM ───────────────────────────────────────
// ─────────────────────────────────────────────────────────────────

function BreakdownModal({ open, title, subtitle, onClose, children }) {
  const [closing, setClosing] = useState(false);

  function handleClose() {
    if (closing) return;
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 180);
  }

  useEffect(() => {
    if (!open) return;
    function handleEsc(e) {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open]);

  // Lock body scroll while open
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
      className={closing ? "mt-modal-backdrop-out" : "mt-modal-backdrop-in"}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(13, 31, 60, 0.45)",
        backdropFilter: "blur(2px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000,
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className={closing ? "mt-modal-card-out" : "mt-modal-card-in"}
        style={{
          background: colors.surface,
          borderRadius: radius.lg,
          boxShadow: "0 10px 40px rgba(13,31,60,0.25)",
          maxWidth: 760,
          width: "100%",
          maxHeight: "85vh",
          display: "flex", flexDirection: "column",
          fontFamily: font.family,
        }}
      >
        <div style={{
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: `1px solid ${colors.border}`,
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: font.h4, fontWeight: 800, color: colors.textPrimary }}>
              {title}
            </div>
            {subtitle && (
              <div style={{ fontSize: font.sm, color: colors.textMuted, marginTop: 2 }}>
                {subtitle}
              </div>
            )}
          </div>
          <button
            onClick={handleClose}
            style={{
              background: "transparent", border: "none", cursor: "pointer",
              padding: 6, display: "flex", alignItems: "center",
              borderRadius: radius.sm,
              color: colors.textMuted,
              marginLeft: 12,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = colors.surfaceAlt; e.currentTarget.style.color = colors.textPrimary; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = colors.textMuted; }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div style={{
          flex: 1, overflowY: "auto",
          padding: "16px 20px",
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function BreakdownSummaryBar({ children }) {
  return (
    <div style={{
      background: colors.tealLight,
      border: `1px solid ${colors.tealMid}`,
      borderRadius: radius.md,
      padding: "12px 16px",
      marginBottom: 16,
      display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
      fontSize: font.sm, color: colors.textBody,
    }}>
      {children}
    </div>
  );
}

function BreakdownTable({ headers, rows, emptyMessage = "No data to show." }) {
  if (rows.length === 0) {
    return (
      <div style={{
        padding: "32px 20px", textAlign: "center",
        color: colors.textFaint, fontSize: font.sm,
        border: `1px solid ${colors.border}`, borderRadius: radius.md,
        background: colors.surfaceAlt,
      }}>{emptyMessage}</div>
    );
  }
  return (
    <div style={{
      overflowX: "auto",
      border: `1px solid ${colors.border}`,
      borderRadius: radius.md,
    }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: colors.surfaceAlt }}>
            {headers.map((h, i) => (
              <th key={i} style={{
                padding: "10px 14px", textAlign: "left",
                fontSize: font.xs, fontWeight: 700, color: colors.textMuted,
                textTransform: "uppercase", letterSpacing: "0.05em",
                borderBottom: `1px solid ${colors.border}`,
                whiteSpace: "nowrap",
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              style={{
                background: i % 2 === 0 ? colors.surface : colors.surfaceAlt,
              }}
            >
              {row.map((cell, j) => (
                <td key={j} style={{
                  padding: "10px 14px",
                  fontSize: font.sm, color: colors.textBody,
                  borderTop: i > 0 ? `1px solid ${colors.border}` : "none",
                  verticalAlign: "middle",
                }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusPill({ variant, children }) {
  return <span style={pillStyle(variant)}>{children}</span>;
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: font.xs, fontWeight: 700, color: colors.textMuted,
      letterSpacing: "0.07em", textTransform: "uppercase",
      marginBottom: 10, marginTop: 4,
    }}>{children}</div>
  );
}

// ── Individual breakdown content components ──────────────────────

function EodBreakdown({ summary }) {
  const total = summary.daily.length;
  const submitted = summary.daily.filter(d => d.eod_submitted).length;
  const pct = total ? Math.round((submitted / total) * 100) : 0;

  const sorted = [...summary.daily].sort((a, b) =>
    a.date === b.date ? a.client.localeCompare(b.client) : a.date.localeCompare(b.date)
  );

  return (
    <>
      <BreakdownSummaryBar>
        <strong style={{ fontSize: font.base, color: colors.textPrimary }}>
          {submitted} of {total}
        </strong>
        <span>reports submitted across all contract-days</span>
        <span style={{ marginLeft: "auto", fontWeight: 700, color: colors.teal }}>
          {pct}% submission rate
        </span>
      </BreakdownSummaryBar>
      <BreakdownTable
        headers={["Date", "Client", "Status", "Submitted At"]}
        rows={sorted.map(d => [
          fmtDateShort(d.date),
          d.client,
          d.eod_submitted
            ? <StatusPill variant="success">✓ Submitted</StatusPill>
            : <StatusPill variant="danger">Missing</StatusPill>,
          d.reports?.[0]?.punctuality?.submitted_est ?? <span style={{ color: colors.textFaint }}>—</span>,
        ])}
      />
    </>
  );
}

function PunctualityBreakdown({ summary }) {
  const reports = summary.daily.flatMap(d =>
    d.reports.map(r => ({
      date: d.date,
      client: d.client,
      ...r.punctuality,
    }))
  ).sort((a, b) =>
    a.date === b.date ? a.client.localeCompare(b.client) : a.date.localeCompare(b.date)
  );

  const onTime = reports.filter(r => r.on_time).length;
  const total  = reports.length;
  const pct = total ? Math.round((onTime / total) * 100) : 0;

  return (
    <>
      <BreakdownSummaryBar>
        <strong style={{ fontSize: font.base, color: colors.textPrimary }}>
          {onTime} of {total}
        </strong>
        <span>reports submitted on time</span>
        <span style={{ marginLeft: "auto", fontWeight: 700, color: colors.teal }}>
          {pct}% punctuality rate
        </span>
      </BreakdownSummaryBar>
      <BreakdownTable
        emptyMessage="No reports were submitted in this period."
        headers={["Date", "Client", "Expected By", "Submitted At", "Status", "Diff"]}
        rows={reports.map(r => {
          const variant = r.status === "on_time" ? "success" : r.status === "late" ? "warning" : "info";
          const label = r.status === "on_time" ? "On time" : r.status === "late" ? "Late" : "Early";
          const diff = r.status === "late"  ? `${r.minutes_late} min late`
                      : r.status === "early" ? `${r.minutes_early} min early`
                      : "—";
          return [
            fmtDateShort(r.date),
            r.client,
            r.expected_by || "—",
            r.submitted_est || "—",
            <StatusPill variant={variant}>{label}</StatusPill>,
            <span style={{
              fontWeight: 600,
              color: r.status === "on_time" ? colors.textFaint : variant === "warning" ? colors.warning : colors.info,
            }}>{diff}</span>,
          ];
        })}
      />
    </>
  );
}

function AvgMinsLateBreakdown({ summary }) {
  const lateReports = summary.daily.flatMap(d =>
    d.reports
      .filter(r => r.punctuality && !r.punctuality.on_time && (r.punctuality.minutes_late ?? 0) > 0)
      .map(r => ({ date: d.date, client: d.client, ...r.punctuality }))
  ).sort((a, b) => b.minutes_late - a.minutes_late);

  const total = lateReports.length;
  const sum   = lateReports.reduce((s, r) => s + r.minutes_late, 0);
  const avg   = total ? Math.round((sum / total) * 10) / 10 : 0;

  return (
    <>
      <BreakdownSummaryBar>
        <strong style={{ fontSize: font.base, color: colors.textPrimary }}>
          {total} late submission{total !== 1 ? "s" : ""}
        </strong>
        {total > 0 && (
          <>
            <span>—</span>
            <span>average <strong style={{ color: colors.warning }}>{avg} min</strong> late, worst was <strong style={{ color: colors.danger }}>{lateReports[0]?.minutes_late} min</strong></span>
          </>
        )}
      </BreakdownSummaryBar>
      <BreakdownTable
        emptyMessage="No late submissions this week — well done!"
        headers={["Date", "Client", "Expected By", "Submitted At", "Minutes Late"]}
        rows={lateReports.map(r => [
          fmtDateShort(r.date),
          r.client,
          r.expected_by || "—",
          r.submitted_est || "—",
          <span style={{ fontWeight: 700, color: colors.warning }}>{r.minutes_late} min</span>,
        ])}
      />
    </>
  );
}

function ClockInBreakdown({ summary }) {
  const sorted = [...summary.daily].sort((a, b) =>
    a.date === b.date ? a.client.localeCompare(b.client) : a.date.localeCompare(b.date)
  );
  const total = sorted.length;
  const clockedIn = sorted.filter(d => d.clocked_in).length;
  const pct = total ? Math.round((clockedIn / total) * 100) : 0;

  return (
    <>
      <BreakdownSummaryBar>
        <strong style={{ fontSize: font.base, color: colors.textPrimary }}>
          {clockedIn} of {total}
        </strong>
        <span>contract-days clocked in</span>
        <span style={{ marginLeft: "auto", fontWeight: 700, color: colors.teal }}>
          {pct}% completion
        </span>
      </BreakdownSummaryBar>
      <BreakdownTable
        headers={["Date", "Client", "Status", "Clock-in Time"]}
        rows={sorted.map(d => [
          fmtDateShort(d.date),
          d.client,
          d.clocked_in
            ? <StatusPill variant="success">✓ Clocked in</StatusPill>
            : <StatusPill variant="danger">Not clocked in</StatusPill>,
          d.clock_in_est ?? <span style={{ color: colors.textFaint }}>—</span>,
        ])}
      />
    </>
  );
}

function ClockOutBreakdown({ summary }) {
  const sorted = [...summary.daily].sort((a, b) =>
    a.date === b.date ? a.client.localeCompare(b.client) : a.date.localeCompare(b.date)
  );
  // "Clock-out" = EOD submission time
  const total = sorted.flatMap(d => d.reports).length;
  const withSubmission = sorted.flatMap(d => d.reports).filter(r => r.punctuality?.submitted_est).length;
  const pct = total ? Math.round((withSubmission / total) * 100) : 0;

  return (
    <>
      <BreakdownSummaryBar>
        <strong style={{ fontSize: font.base, color: colors.textPrimary }}>
          {withSubmission} of {total}
        </strong>
        <span>submitted EODs (treated as clock-out)</span>
        <span style={{ marginLeft: "auto", fontWeight: 700, color: colors.teal }}>
          {pct}% completion
        </span>
      </BreakdownSummaryBar>
      <BreakdownTable
        headers={["Date", "Client", "Status", "EOD Submitted At"]}
        rows={sorted.map(d => {
          const submittedAt = d.reports?.[0]?.punctuality?.submitted_est;
          return [
            fmtDateShort(d.date),
            d.client,
            submittedAt
              ? <StatusPill variant="success">✓ Submitted</StatusPill>
              : <StatusPill variant="danger">No EOD</StatusPill>,
            submittedAt ?? <span style={{ color: colors.textFaint }}>—</span>,
          ];
        })}
      />
    </>
  );
}

function ConsecutiveMissedBreakdown({ summary }) {
  // Group daily entries by date
  const byDate = {};
  for (const d of summary.daily) {
    if (!byDate[d.date]) byDate[d.date] = { date: d.date, total: 0, submitted: 0 };
    byDate[d.date].total += 1;
    if (d.eod_submitted) byDate[d.date].submitted += 1;
  }
  const dates = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));

  // Compute streak markers
  let curStreak = 0;
  let bestStreak = 0;
  let bestEnd = -1;
  dates.forEach((d, i) => {
    if (d.submitted < d.total) {
      curStreak += 1;
      if (curStreak > bestStreak) { bestStreak = curStreak; bestEnd = i; }
    } else {
      curStreak = 0;
    }
  });
  // Mark which dates are part of the longest streak
  const inStreak = new Set();
  if (bestStreak > 0) {
    for (let i = bestEnd - bestStreak + 1; i <= bestEnd; i++) inStreak.add(i);
  }

  return (
    <>
      <BreakdownSummaryBar>
        <strong style={{ fontSize: font.base, color: colors.textPrimary }}>
          {bestStreak} day{bestStreak !== 1 ? "s" : ""}
        </strong>
        <span>longest consecutive missed streak this week</span>
      </BreakdownSummaryBar>
      <BreakdownTable
        headers={["Date", "Reports", "Status", "Streak"]}
        rows={dates.map((d, i) => {
          const isPartial = d.submitted > 0 && d.submitted < d.total;
          const isFullMiss = d.submitted === 0;
          const variant = isFullMiss ? "danger" : isPartial ? "warning" : "success";
          const label = isFullMiss ? "All missing" : isPartial ? "Partial" : "Complete";
          return [
            fmtDateShort(d.date),
            <span style={{ fontWeight: 600 }}>{d.submitted} / {d.total}</span>,
            <StatusPill variant={variant}>{label}</StatusPill>,
            inStreak.has(i)
              ? <span style={{
                  fontSize: font.xs, fontWeight: 700, color: colors.danger,
                }}>● in streak</span>
              : <span style={{ color: colors.textFaint }}>—</span>,
          ];
        })}
      />
    </>
  );
}

function HoursWorkedBreakdown({ summary }) {
  // Group by client
  const byClient = {};
  for (const d of summary.daily) {
    if (!byClient[d.client]) byClient[d.client] = [];
    byClient[d.client].push(d);
  }
  const clientList = Object.keys(byClient).sort();

  const clientTotals = clientList.map(client => {
    const entries = byClient[client];
    const actual = Math.round(entries.reduce((s, d) => s + hoursForEntry(d), 0) * 10) / 10;
    const target = Math.round(entries.reduce((s, d) => s + (d.expected_hours ?? 0), 0) * 10) / 10;
    return { client, actual, target };
  });

  const grandActual = Math.round(clientTotals.reduce((s, c) => s + c.actual, 0) * 10) / 10;
  const grandTarget = Math.round(clientTotals.reduce((s, c) => s + c.target, 0) * 10) / 10;

  const sorted = [...summary.daily].sort((a, b) =>
    a.date === b.date ? a.client.localeCompare(b.client) : a.date.localeCompare(b.date)
  );

  return (
    <>
      <BreakdownSummaryBar>
        <strong style={{ fontSize: font.base, color: colors.textPrimary }}>
          {grandActual} hrs
        </strong>
        {grandTarget > 0 && (
          <>
            <span>worked of</span>
            <strong style={{ color: colors.textPrimary }}>{grandTarget} hrs target</strong>
            <span style={{ marginLeft: "auto", fontWeight: 700, color: colors.teal }}>
              {Math.round((grandActual / grandTarget) * 100)}% of target
            </span>
          </>
        )}
      </BreakdownSummaryBar>

      {/* Per-client totals (the key view for multi-client VAs) */}
      <SectionLabel>Hours per Client</SectionLabel>
      <div style={{
        display: "grid",
        gridTemplateColumns: clientList.length > 1 ? "repeat(auto-fit, minmax(220px, 1fr))" : "1fr",
        gap: 10,
        marginBottom: 20,
      }}>
        {clientTotals.map(c => {
          const accent = hoursAccent(c.actual, c.target);
          const color =
            accent === "success" ? colors.success :
            accent === "warning" ? colors.warning :
            accent === "danger"  ? colors.danger  :
            colors.teal;
          const pct = c.target > 0 ? Math.round((c.actual / c.target) * 100) : null;
          return (
            <div key={c.client} style={{
              padding: "12px 14px",
              border: `1px solid ${colors.border}`,
              borderRadius: radius.md,
              background: colors.surface,
            }}>
              <div style={{
                fontSize: font.xs, fontWeight: 700, color: colors.textMuted,
                textTransform: "uppercase", letterSpacing: "0.05em",
                marginBottom: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>{c.client}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span style={{
                  fontSize: 22, fontWeight: 800, color,
                  fontVariantNumeric: "tabular-nums",
                }}>{c.actual}</span>
                {c.target > 0 && (
                  <span style={{ fontSize: font.sm, color: colors.textMuted, fontWeight: 600 }}>
                    / {c.target}
                  </span>
                )}
                <span style={{ fontSize: font.sm, color: colors.textMuted, fontWeight: 600 }}>hrs</span>
              </div>
              {pct !== null && (
                <div style={{ fontSize: font.xs, color: colors.textMuted, marginTop: 4 }}>
                  {pct}% of target
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Daily breakdown */}
      <SectionLabel>Daily Breakdown</SectionLabel>
      <BreakdownTable
        headers={["Date", "Client", "Clock-in", "Clock-out", "Hours", "Target"]}
        rows={sorted.map(d => {
          const hours = Math.round(hoursForEntry(d) * 10) / 10;
          const target = d.expected_hours ?? 0;
          const clockOut = d.reports?.[0]?.punctuality?.submitted_est;
          const hourColor =
            !d.clock_in_est || !clockOut ? colors.textFaint :
            target && hours >= target * 0.95 && hours <= target * 1.10 ? colors.success :
            target && (hours < target * 0.85) ? colors.danger :
            colors.textPrimary;
          return [
            fmtDateShort(d.date),
            d.client,
            d.clock_in_est ?? <span style={{ color: colors.textFaint }}>—</span>,
            clockOut ?? <span style={{ color: colors.textFaint }}>—</span>,
            <span style={{ fontWeight: 700, color: hourColor }}>
              {hours > 0 ? `${hours} hrs` : "—"}
            </span>,
            target > 0
              ? <span style={{ color: colors.textMuted }}>{target} hrs</span>
              : <span style={{ color: colors.textFaint }}>—</span>,
          ];
        })}
      />
    </>
  );
}

// Configuration mapping metric keys to title + content
const BREAKDOWN_CONFIG = {
  eod_rate:           { title: "EOD Submission Rate", Component: EodBreakdown },
  punctuality:        { title: "Punctuality Rate",    Component: PunctualityBreakdown },
  avg_late:           { title: "Late Submissions",    Component: AvgMinsLateBreakdown },
  clock_in:           { title: "Clock-in Completion", Component: ClockInBreakdown },
  clock_out:          { title: "Clock-out Completion",Component: ClockOutBreakdown },
  consecutive_missed: { title: "Missed Days Streak",  Component: ConsecutiveMissedBreakdown },
  hours_worked:       { title: "Hours Worked",        Component: HoursWorkedBreakdown },
};

// ── VA Search + Dropdown combo box ───────────────────────────────
function VASearchSelect({ vas, value, onChange, placeholder = "Search VA name…" }) {
  const [search, setSearch] = useState(value || "");
  const [open,   setOpen]   = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => { setSearch(value || ""); }, [value]);

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

  const isSearching = search && search !== value;
  const filtered = isSearching
    ? vas.filter(v => v.name.toLowerCase().includes(search.toLowerCase()))
    : vas;

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
    <div ref={wrapRef} style={{ position: "relative", flex: 2, minWidth: 240 }}>
      <label style={labelStyle}>Virtual Assistant</label>
      <div style={{ position: "relative" }}>
        <Search size={14} style={{
          position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
          color: colors.textFaint, pointerEvents: "none",
        }} />
        <input
          type="text"
          value={search}
          placeholder={placeholder}
          onChange={e => { setSearch(e.target.value); if (!open) setOpen(true); }}
          onFocus={e => { setOpen(true); e.target.select(); }}
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
          position: "absolute", right: 12, top: "50%",
          transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`,
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
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = colors.surfaceAlt; }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
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

// ── Community tabs ───────────────────────────────────────────────
const COMMUNITY_TABS = [
  { id: "Main", label: "Agency" },
  { id: "CBA",  label: "CBA"    },
];

function CommunityTabBar({ active, onChange, counts }) {
  return (
    <div style={{
      display: "flex", gap: 4,
      borderBottom: `1px solid ${colors.border}`,
      padding: "0 8px",
    }}>
      {COMMUNITY_TABS.map(t => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            style={{
              padding: "14px 20px",
              background: "transparent", border: "none", cursor: "pointer",
              fontFamily: font.family, fontSize: font.sm, fontWeight: 700,
              color: isActive ? colors.teal : colors.textMuted,
              borderBottom: isActive ? `2.5px solid ${colors.teal}` : "2.5px solid transparent",
              marginBottom: -1,
              transition: "color .18s, border-color .18s",
              textAlign: "left",
              display: "flex", alignItems: "center", gap: 8,
            }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = colors.textBody; }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = colors.textMuted; }}
          >
            <span>{t.label}</span>
            {counts && (
              <span style={{
                fontSize: font.xs, fontWeight: 700,
                color: isActive ? colors.teal : colors.textFaint,
                background: isActive ? colors.tealLight : colors.surfaceAlt,
                padding: "1px 7px", borderRadius: 10,
              }}>{counts[t.id] ?? 0}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function HoursCell({ actual, expected }) {
  if (!expected || expected === 0) {
    return actual > 0
      ? <span style={{ fontWeight: 600 }}>{actual} hrs</span>
      : <span style={{ color: colors.textFaint }}>—</span>;
  }
  const pct = Math.round((actual / expected) * 100);
  const accent = hoursAccent(actual, expected);
  const color =
    accent === "success" ? colors.success :
    accent === "warning" ? colors.warning :
    accent === "danger"  ? colors.danger  :
    colors.textPrimary;
  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <div>
        <span style={{ fontWeight: 700, color }}>{actual}</span>
        <span style={{ color: colors.textMuted }}> / {expected} hrs</span>
      </div>
      <div style={{ fontSize: font.xs, color: colors.textMuted, fontWeight: 600 }}>
        {pct}% of target
      </div>
    </div>
  );
}

// ── VA Contract Table ────────────────────────────────────────────
function VAContractTable({ weekData, prevWeekData, onViewVA }) {
  const [community, setCommunity] = useState("Main");
  const [filter,    setFilter]    = useState("all");
  const [search,    setSearch]    = useState("");
  const allRows = buildContractRows(weekData, prevWeekData);
  const counts = {
    Main: allRows.filter(r => r.community === "Main").length,
    CBA:  allRows.filter(r => r.community === "CBA").length,
  };
  const byCommunity = allRows.filter(r => r.community === community);
  const filterCounts = {
    all:     byCommunity.length,
    missing: byCommunity.filter(r => r.hasMissing).length,
    late:    byCommunity.filter(r => r.hasLate).length,
    early:   byCommunity.filter(r => r.hasEarly).length,
    on_time: byCommunity.filter(r => r.isOnTime).length,
  };
  const filtered = byCommunity.filter(r => {
    if (filter === "missing" && !r.hasMissing) return false;
    if (filter === "late"    && !r.hasLate)    return false;
    if (filter === "early"   && !r.hasEarly)   return false;
    if (filter === "on_time" && !r.isOnTime)   return false;
    if (search) {
      const q = search.toLowerCase();
      if (!r.va_name.toLowerCase().includes(q) && !r.client.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <Card noPadding>
      <CommunityTabBar active={community} onChange={setCommunity} counts={counts} />
      <div key={community} className="mt-eow-fade">
        <div style={{
          padding: "14px 20px",
          display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center",
          borderBottom: `1px solid ${colors.border}`,
          background: colors.surfaceAlt,
        }}>
          <span style={{ fontSize: font.sm, fontWeight: 700, color: colors.textMuted, marginRight: 4 }}>Filter:</span>
          <FilterPill label="All"     count={filterCounts.all}     active={filter === "all"}     onClick={() => setFilter("all")}     color={colors.teal} />
          <FilterPill label="Missing" count={filterCounts.missing} active={filter === "missing"} onClick={() => setFilter("missing")} color={colors.danger} />
          <FilterPill label="Late"    count={filterCounts.late}    active={filter === "late"}    onClick={() => setFilter("late")}    color={colors.warning} />
          <FilterPill label="Early"   count={filterCounts.early}   active={filter === "early"}   onClick={() => setFilter("early")}   color="#7C3AED" />
          <FilterPill label="On-time" count={filterCounts.on_time} active={filter === "on_time"} onClick={() => setFilter("on_time")} color={colors.success} />
          <div style={{ marginLeft: "auto", position: "relative", display: "flex", alignItems: "center" }}>
            <Search size={14} style={{ position: "absolute", left: 10, color: colors.textFaint, pointerEvents: "none" }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search VA or client…"
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
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
            <thead>
              <tr style={{ background: colors.navy }}>
                <th style={TABLE_TH}>Name</th>
                <th style={TABLE_TH}>Client</th>
                <th style={{ ...TABLE_TH, textAlign: "center" }}>Community</th>
                <th style={{ ...TABLE_TH, textAlign: "center" }}>Total Reports</th>
                <th style={{ ...TABLE_TH, textAlign: "center" }}>Hours (Actual / Target)</th>
                <th style={TABLE_TH}>Comparison from Last Week</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} style={{
                    padding: "40px 20px", textAlign: "center",
                    color: colors.textFaint, fontSize: font.sm,
                    borderTop: `1px solid ${colors.border}`,
                  }}>
                    {filter !== "all" || search
                      ? "No rows match the current filters."
                      : `No ${community === "Main" ? "Agency" : "CBA"} contracts found.`}
                  </td>
                </tr>
              )}
              {filtered.map((r, i) => {
                const rowBg = i % 2 === 0 ? colors.surface : colors.surfaceAlt;
                return (
                  <tr
                    key={`${r.va_name}-${r.client}`}
                    onClick={() => onViewVA(r.va_name)}
                    style={{ background: rowBg, cursor: "pointer", transition: "background .12s" }}
                    onMouseEnter={e => e.currentTarget.style.background = colors.tealLight}
                    onMouseLeave={e => e.currentTarget.style.background = rowBg}
                  >
                    <td style={TABLE_TD}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Avatar name={r.va_name} size={32} />
                        <span style={{ fontWeight: 700, color: colors.textPrimary }}>{r.va_name}</span>
                      </div>
                    </td>
                    <td style={TABLE_TD}>{r.client}</td>
                    <td style={{ ...TABLE_TD, textAlign: "center" }}>
                      <CommunityBadge community={r.community} />
                    </td>
                    <td style={{ ...TABLE_TD, textAlign: "center" }}>
                      <span style={{ fontWeight: 700, color: r.hasMissing ? colors.danger : colors.textPrimary }}>
                        {r.submitted}
                      </span>
                      <span style={{ color: colors.textMuted }}> / {r.expected}</span>
                    </td>
                    <td style={{ ...TABLE_TD, textAlign: "center" }}>
                      <HoursCell actual={r.totalHours} expected={r.expectedHours} />
                    </td>
                    <td style={TABLE_TD}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <WoWBadge current={r.submitted} previous={r.prevSubmitted} suffix=" reports" />
                        {r.hasPrev && r.totalHours !== r.prevHours && (
                          <WoWBadge current={r.totalHours} previous={r.prevHours} suffix=" hrs" />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}

// ── This Week Tab ────────────────────────────────────────────────
function ThisWeekTab({ weekData, prevWeekData, start, end, setStart, setEnd, loading, error, onGenerate, onRefresh, onViewIndividual }) {
  const current  = computeAggregate(weekData);
  const previous = computeAggregate(prevWeekData);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <TopBarProgress active={loading} />
      <TopBarCachedBanner cacheKey={CACHE_WEEK} onRefresh={onRefresh} loading={loading} />
      <Card>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={labelStyle}>Week Start (Mon)</label>
            <input type="date" value={start} onChange={e => setStart(e.target.value)} style={dateInputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Week End (Fri)</label>
            <input type="date" value={end} onChange={e => setEnd(e.target.value)} style={dateInputStyle} />
          </div>
          <Button icon={Search} onClick={onGenerate} disabled={loading} style={{ alignSelf: "flex-end", height: 38 }}>
            {loading ? "Generating…" : "Generate Report"}
          </Button>
          {prevWeekData && (
            <div style={{ fontSize: font.xs, color: colors.textMuted, alignSelf: "flex-end", paddingBottom: 10 }}>
              Compared to {fmtDate(prevWeekData.start)} – {fmtDate(prevWeekData.end)}
            </div>
          )}
        </div>
      </Card>

      {error && <StatusBox variant="danger">{error}</StatusBox>}

      {loading && !weekData && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {Array.from({ length: 4 }).map((_, i) => <MetricBoxSkeleton key={i} />)}
          </div>
          <Card noPadding>
            <div style={{ padding: 16 }}>
              <Skeleton width="100%" height={48} radius={6} />
              <Skeleton width="100%" height={48} radius={6} style={{ marginTop: 8 }} />
              <Skeleton width="100%" height={48} radius={6} style={{ marginTop: 8 }} />
            </div>
          </Card>
        </>
      )}

      {weekData && current && (
        <div key={weekData.start + weekData.end} className="mt-eow-fade" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            <MetricBox icon={FileCheck} value={current.totalSubmitted} label="Total Reports Submitted" accent="success"
              sub={`out of ${current.totalPossible} expected`}
              deltaCurrent={current.totalSubmitted} deltaPrevious={previous?.totalSubmitted} />
            <MetricBox icon={Timer} value={current.totalLate} label="Total Late"
              accent={current.totalLate > 0 ? "warning" : "success"}
              deltaCurrent={current.totalLate} deltaPrevious={previous?.totalLate} deltaInverse />
            <MetricBox icon={UserX} value={current.totalMissing} label="Total Missing"
              accent={current.totalMissing > 0 ? "danger" : "success"}
              deltaCurrent={current.totalMissing} deltaPrevious={previous?.totalMissing} deltaInverse />
            <MetricBox icon={CheckCircle2} value={current.submissionRate} suffix="%" label="Submission Rate"
              accent={current.submissionRate >= 95 ? "success" : current.submissionRate >= 85 ? "warning" : "danger"}
              deltaCurrent={current.submissionRate} deltaPrevious={previous?.submissionRate} deltaSuffix="%" />
          </div>
          <VAContractTable weekData={weekData} prevWeekData={prevWeekData} onViewVA={onViewIndividual} />
          <div style={{
            display: "flex", gap: 12, flexWrap: "wrap",
            padding: "12px 16px", background: colors.surfaceAlt,
            border: `1px solid ${colors.border}`, borderRadius: radius.md,
            fontSize: font.xs, color: colors.textMuted,
          }}>
            <span><strong style={{ color: colors.textBody }}>{current.vaCount}</strong> active VAs</span>
            <span>•</span>
            <span><strong style={{ color: colors.textBody }}>{current.punctualityRate}%</strong> punctuality rate</span>
            <span>•</span>
            <span><strong style={{ color: colors.textBody }}>{current.vasWithMissing}</strong> with missing reports</span>
            <span>•</span>
            <span>Week of {fmtDate(weekData.start)} → {fmtDate(weekData.end)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Individual Analysis Tab ──────────────────────────────────────
function IndividualAnalysisTab({ weekData, preselectVA, vaList, start, end, setStart, setEnd, loading, error, onGenerate }) {
  const [selectedVA, setSelectedVA] = useState(preselectVA || "");
  const [openMetric, setOpenMetric] = useState(null);

  useEffect(() => {
    if (preselectVA && preselectVA !== selectedVA) {
      setSelectedVA(preselectVA);
    }
  }, [preselectVA]);

  const summary = weekData?.va_summaries?.find(s => s.va.name === selectedVA) ?? null;
  const metrics = summary ? computeIndividual(summary) : null;

  const hoursValue = metrics
    ? (metrics.expectedHours > 0
        ? `${metrics.totalHours} / ${metrics.expectedHours}`
        : metrics.totalHours)
    : null;
  const hoursPct = metrics && metrics.expectedHours > 0
    ? Math.round((metrics.totalHours / metrics.expectedHours) * 100)
    : null;

  const activeConfig = openMetric ? BREAKDOWN_CONFIG[openMetric] : null;
  const ActiveBreakdown = activeConfig?.Component;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <TopBarProgress active={loading} />

      <Card style={{ overflow: "visible" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <VASearchSelect
            vas={vaList}
            value={selectedVA}
            onChange={setSelectedVA}
            placeholder={vaList.length ? "Search or pick a VA…" : "VA list not loaded yet"}
          />
          <div>
            <label style={labelStyle}>Week Start</label>
            <input type="date" value={start} onChange={e => setStart(e.target.value)} style={dateInputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Week End</label>
            <input type="date" value={end} onChange={e => setEnd(e.target.value)} style={dateInputStyle} />
          </div>
          <Button icon={Search} onClick={onGenerate} disabled={loading} style={{ alignSelf: "flex-end", height: 38 }}>
            {loading ? "Loading…" : "Generate Report"}
          </Button>
        </div>
      </Card>

      {error && <StatusBox variant="danger">{error}</StatusBox>}

      {!weekData && !loading && (
        <StatusBox variant="info">Pick a week range and click Generate Report to load data.</StatusBox>
      )}
      {weekData && !selectedVA && (
        <StatusBox variant="info">Search or pick a VA above to see their performance and compliance analysis.</StatusBox>
      )}
      {weekData && selectedVA && !summary && (
        <StatusBox variant="warning">
          No data found for "{selectedVA}" in the selected week. They may not have active contracts for this period.
        </StatusBox>
      )}

      {loading && (
        <div className="mt-eow-fade" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Skeleton width={48} height={48} radius={24} />
            <div style={{ flex: 1 }}>
              <Skeleton width={200} height={20} />
              <Skeleton width={140} height={12} style={{ marginTop: 6 }} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {Array.from({ length: 3 }).map((_, i) => <MetricBoxSkeleton key={i} />)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {Array.from({ length: 4 }).map((_, i) => <MetricBoxSkeleton key={i} />)}
          </div>
        </div>
      )}

      {summary && metrics && !loading && (
        <div key={selectedVA} className="mt-eow-fade" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Avatar name={summary.va.name} size={48} />
            <div>
              <div style={{ fontSize: font.h3, fontWeight: 800, color: colors.textPrimary }}>
                <VANameLink name={summary.va.name} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                <CommunityBadge community={summary.community} />
                <span style={{ fontSize: font.sm, color: colors.textMuted }}>
                  {fmtDate(weekData.start)} – {fmtDate(weekData.end)}
                </span>
                <span style={{ fontSize: font.xs, color: colors.textFaint }}>
                  · {summary.contract_slots} contract{summary.contract_slots !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </div>

          {/* Performance */}
          <div>
            <div style={{
              fontSize: font.xs, fontWeight: 700, color: colors.textMuted,
              letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10,
            }}>Performance</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              <MetricBox
                icon={FileCheck}
                value={metrics.eodRate} suffix="%"
                label="EOD Submission Rate"
                accent={metrics.eodRate >= 95 ? "success" : metrics.eodRate >= 85 ? "warning" : "danger"}
                sub={`${metrics.submittedSlots} of ${metrics.totalSlots} reports submitted`}
                onClick={() => setOpenMetric("eod_rate")}
              />
              <MetricBox
                icon={CheckCircle2}
                value={metrics.punctualityRate ?? "—"}
                suffix={metrics.punctualityRate !== null ? "%" : ""}
                label="Punctuality Rate"
                accent={
                  metrics.punctualityRate === null ? undefined
                  : metrics.punctualityRate >= 95 ? "success"
                  : metrics.punctualityRate >= 85 ? "warning"
                  : "danger"
                }
                sub={metrics.totalReports > 0 ? `${metrics.onTimeReports} of ${metrics.totalReports} on time` : "no reports submitted"}
                onClick={() => setOpenMetric("punctuality")}
              />
              <MetricBox
                icon={Timer}
                value={metrics.lateCount > 0 ? metrics.avgMinsLate : "—"}
                suffix={metrics.lateCount > 0 ? " min" : ""}
                label="Avg Mins When Late"
                accent={
                  metrics.lateCount === 0 ? "success"
                  : metrics.avgMinsLate <= 10 ? "warning"
                  : "danger"
                }
                sub={metrics.lateCount === 0 ? "no late submissions" : `across ${metrics.lateCount} late submission${metrics.lateCount !== 1 ? "s" : ""}`}
                onClick={() => setOpenMetric("avg_late")}
              />
            </div>
          </div>

          {/* Compliance */}
          <div>
            <div style={{
              fontSize: font.xs, fontWeight: 700, color: colors.textMuted,
              letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10,
            }}>Compliance</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              <MetricBox
                icon={Clock}
                value={metrics.clockInRate} suffix="%"
                label="Clock-in Completion"
                accent={metrics.clockInRate >= 95 ? "success" : metrics.clockInRate >= 80 ? "warning" : "danger"}
                sub={`${metrics.clockedInSlots} of ${metrics.totalSlots} clocked in`}
                onClick={() => setOpenMetric("clock_in")}
              />
              <MetricBox
                icon={CalendarCheck}
                value={metrics.clockOutRate ?? "—"}
                suffix={metrics.clockOutRate !== null ? "%" : ""}
                label="Clock-out Completion"
                accent={
                  metrics.clockOutRate === null ? undefined
                  : metrics.clockOutRate >= 95 ? "success"
                  : metrics.clockOutRate >= 80 ? "warning"
                  : "danger"
                }
                sub={metrics.totalReports > 0 ? `${metrics.reportsWithSubmission} of ${metrics.totalReports} EODs submitted` : "no reports submitted"}
                onClick={() => setOpenMetric("clock_out")}
              />
              <MetricBox
                icon={XCircle}
                value={metrics.consecutiveMissed}
                suffix={` day${metrics.consecutiveMissed !== 1 ? "s" : ""}`}
                label="Consecutive Missed"
                accent={metrics.consecutiveMissed === 0 ? "success" : metrics.consecutiveMissed >= 3 ? "danger" : "warning"}
                sub={metrics.consecutiveMissed === 0 ? "no missed days" : "longest streak this week"}
                onClick={() => setOpenMetric("consecutive_missed")}
              />
              <MetricBox
                icon={Zap}
                value={hoursValue}
                suffix=" hrs"
                label="Hours Worked"
                accent={hoursAccent(metrics.totalHours, metrics.expectedHours)}
                sub={
                  metrics.expectedHours > 0
                    ? `${hoursPct}% of contracted target`
                    : metrics.totalHours > 0
                      ? "from clock-in to EOD submission"
                      : "no clock-in / EOD pairs found"
                }
                onClick={() => setOpenMetric("hours_worked")}
              />
            </div>
          </div>

          <Card title="Weekly Breakdown" noPadding>
            <div style={{ padding: "16px 20px" }}>
              <WeeklyGrid daily={summary.daily} workdays={weekData.workdays} community={summary.community} />
            </div>
          </Card>

          <FlagDetails flags={summary.flags} />

          {summary.stats.flag_count === 0 && summary.stats.missing_count === 0 && summary.stats.no_clockin_count === 0 && (
            <StatusBox variant="success">
              No issues found for {summary.va.name} this week. All clear!
            </StatusBox>
          )}
        </div>
      )}

      {/* Drill-down modal */}
      <BreakdownModal
        open={!!openMetric && !!summary}
        onClose={() => setOpenMetric(null)}
        title={activeConfig?.title || ""}
        subtitle={summary && weekData ? `${summary.va.name} · ${fmtDate(weekData.start)} – ${fmtDate(weekData.end)}` : ""}
      >
        {ActiveBreakdown && summary && <ActiveBreakdown summary={summary} />}
      </BreakdownModal>
    </div>
  );
}

// ── Root ─────────────────────────────────────────────────────────
const TABS = [
  { id: "this_week",  label: "This Week" },
  { id: "individual", label: "Individual Analysis" },
];

export default function EowReports() {
  const def = getWeekRange();
  const [activeTab,    setActiveTab]    = useState("this_week");
  const [start,        setStart]        = useState(def.start);
  const [end,          setEnd]          = useState(def.end);
  const [weekData,     setWeekData]     = useState(() => cacheGet(CACHE_WEEK)?.current ?? null);
  const [prevWeekData, setPrevWeekData] = useState(() => cacheGet(CACHE_WEEK)?.previous ?? null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");
  const [preselectVA,  setPreselectVA]  = useState("");

  const vaList = cacheGet(CACHE_KEYS.VA_LIST) ?? [];

  async function generate(force = false) {
    if (!force) {
      const cached = cacheGet(CACHE_WEEK);
      if (cached && cached.current?.start === start && cached.current?.end === end) {
        setWeekData(cached.current);
        setPrevWeekData(cached.previous);
        return;
      }
    }
    setLoading(true);
    setError("");
    if (force) cacheClear(CACHE_WEEK);
    const prevStart = shiftDate(start, -7);
    const prevEnd   = shiftDate(end,   -7);
    try {
      const [current, previous] = await Promise.all([
        apiFetch(`/api/eow?start=${start}&end=${end}`),
        apiFetch(`/api/eow?start=${prevStart}&end=${prevEnd}`).catch(() => null),
      ]);
      cacheSet(CACHE_WEEK, { current, previous });
      setWeekData(current);
      setPrevWeekData(previous);
      logActivity(LOG_TYPES.EOD_CHECK, `EOW report generated for ${start} → ${end}`, { start, end });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function refresh() { generate(true); }
  function handleViewIndividual(vaName) {
    setPreselectVA(vaName);
    setActiveTab("individual");
  }

  return (
    <div style={{ fontFamily: font.family, width: "100%" }}>
      <PageHeader
        title="EOW Reports"
        subtitle="End-of-week analysis with week-over-week comparison and individual VA breakdowns."
      />
      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />
      <div key={activeTab} className="mt-eow-fade">
        {activeTab === "this_week" && (
          <ThisWeekTab
            weekData={weekData} prevWeekData={prevWeekData}
            start={start} end={end} setStart={setStart} setEnd={setEnd}
            loading={loading} error={error}
            onGenerate={() => generate(false)} onRefresh={refresh}
            onViewIndividual={handleViewIndividual}
          />
        )}
        {activeTab === "individual" && (
          <IndividualAnalysisTab
            weekData={weekData} preselectVA={preselectVA} vaList={vaList}
            start={start} end={end} setStart={setStart} setEnd={setEnd}
            loading={loading} error={error}
            onGenerate={() => generate(false)}
          />
        )}
      </div>
    </div>
  );
}