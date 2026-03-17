import { useState, useEffect } from "react";
import {
  Search, Users, FileCheck, Timer, AlertTriangle,
  CheckCircle2, XCircle, ChevronDown, CalendarDays,
} from "lucide-react";
import { colors, font, radius, shadow } from "../../styles/tokens";
import Button from "../ui/Button";
import StatCard from "../ui/StatCard";
import DataTable from "../ui/DataTable";
import StatusBox from "../ui/StatusBox";
import Card, { SectionLabel } from "../ui/Card";
import { CommunityBadge, StatusBadge } from "../ui/Badge";

const API    = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

export default function VAInspector() {
  const now = new Date();

  const [vas,      setVAs]     = useState([]);
  const [vaName,   setVAName]  = useState("");
  const [year,     setYear]    = useState(now.getFullYear());
  const [month,    setMonth]   = useState(now.getMonth() + 1);
  const [data,     setData]    = useState(null);
  const [loading,  setLoading] = useState(false);
  const [error,    setError]   = useState("");
  const [vasLoad,  setVasLoad] = useState(false);

  // Load VA list on mount
  useEffect(() => {
    setVasLoad(true);
    fetch(`${API}/api/inspector/vas`)
      .then((r) => r.json())
      .then((d) => setVAs(d.vas ?? []))
      .catch(() => {})
      .finally(() => setVasLoad(false));
  }, []);

  async function runInspect() {
    if (!vaName) return;
    setLoading(true); setError(""); setData(null);
    try {
      const res = await fetch(
        `${API}/api/inspector?va_name=${encodeURIComponent(vaName)}&year=${year}&month=${month}`
      );
      if (!res.ok) throw new Error((await res.json()).detail ?? "Request failed");
      setData(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const selectedVA = vas.find((v) => v.name === vaName);

  return (
    <div style={{ fontFamily: font.family, width: "100%" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: font.h2, fontWeight: 800, color: colors.textPrimary, margin: 0 }}>
          VA Inspector
        </h2>
        <p style={{ fontSize: font.base, color: colors.textMuted, marginTop: 6 }}>
          View all reports for a specific VA and flag late or missing submissions.
        </p>
      </div>

      {/* Controls */}
      <Card style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>

          {/* VA selector */}
          <div style={{ flex: 2, minWidth: 220 }}>
            <label style={s.label}>Virtual Assistant</label>
            <div style={{ position: "relative" }}>
              <select
                value={vaName}
                onChange={(e) => setVAName(e.target.value)}
                style={s.select}
                disabled={vasLoad}
              >
                <option value="">
                  {vasLoad ? "Loading VAs…" : "Select a VA…"}
                </option>
                {vas.map((v) => (
                  <option key={v.id} value={v.name}>
                    {v.name} [{v.community}]
                  </option>
                ))}
              </select>
              <ChevronDown size={14} color={colors.textMuted}
                style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
            </div>
          </div>

          {/* Month */}
          <div style={{ flex: 1, minWidth: 150 }}>
            <label style={s.label}>Month</label>
            <div style={{ position: "relative" }}>
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))} style={s.select}>
                {MONTHS.map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
              <ChevronDown size={14} color={colors.textMuted}
                style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
            </div>
          </div>

          {/* Year */}
          <div style={{ width: 100 }}>
            <label style={s.label}>Year</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              min={2023} max={2030}
              style={{ ...s.select, width: "100%" }}
            />
          </div>

          <Button
            icon={Search}
            onClick={runInspect}
            disabled={loading || !vaName}
            style={{ alignSelf: "flex-end", height: 38 }}
          >
            {loading ? "Loading…" : "Inspect"}
          </Button>
        </div>
      </Card>

      {error && <StatusBox variant="danger" style={{ marginBottom: 20 }}>{error}</StatusBox>}

      {/* Results */}
      {data && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

          {/* VA identity bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={s.avatar}>
              {data.va.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
            </div>
            <div>
              <div style={{ fontSize: font.h3, fontWeight: 800, color: colors.textPrimary }}>
                {data.va.name}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                <CommunityBadge community={data.va.community} />
                <span style={{ fontSize: font.sm, color: colors.textMuted }}>
                  {MONTHS[data.month - 1]} {data.year}
                </span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <StatCard icon={FileCheck}   label="Reports Submitted" value={data.submitted_count} />
            <StatCard icon={CheckCircle2}label="On Time"           value={data.on_time_count}   highlight="success" />
            <StatCard
              icon={Timer}
              label="Late Submissions"
              value={data.late_count}
              highlight={data.late_count > 0 ? "warning" : "success"}
            />
            <StatCard
              icon={data.missing_days.length > 0 ? XCircle : CheckCircle2}
              label="Missing Days"
              value={data.missing_days.length}
              highlight={data.missing_days.length > 0 ? "danger" : "success"}
            />
          </div>

          {/* Missing days alert */}
          {data.missing_days.length > 0 && (
            <Card title={`Missing Reports — ${data.missing_days.length} day${data.missing_days.length !== 1 ? "s" : ""}`} noPadding>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "14px 20px" }}>
                {data.missing_days.map((d, i) => (
                  <span key={i} style={{
                    background: colors.dangerLight,
                    border: `1px solid ${colors.dangerBorder}`,
                    color: colors.danger,
                    borderRadius: radius.sm,
                    padding: "4px 10px",
                    fontSize: font.sm,
                    fontWeight: 700,
                  }}>
                    {new Date(d + "T12:00:00").toLocaleDateString("en-US", {
                      month: "short", day: "numeric",
                    })}
                  </span>
                ))}
              </div>
            </Card>
          )}

          {/* No missing days */}
          {data.missing_days.length === 0 && data.submitted_count > 0 && (
            <StatusBox variant="success">
              No missing EOD reports for {MONTHS[data.month - 1]} {data.year}.
            </StatusBox>
          )}

          {/* Reports list */}
          {data.reports.length > 0 ? (
            <div>
              <SectionLabel>All Reports ({data.reports.length})</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {data.reports.map((r, i) => (
                  <ReportCard key={i} report={r} community={data.va.community} />
                ))}
              </div>
            </div>
          ) : (
            <StatusBox variant="info">
              No EOD reports found for {MONTHS[data.month - 1]} {data.year}.
            </StatusBox>
          )}
        </div>
      )}
    </div>
  );
}

// ── Individual Report Card ────────────────────────────────────────
function ReportCard({ report: r, community }) {
  const [expanded, setExpanded] = useState(false);
  const isLate    = !r.punctuality?.on_time;
  const isCBA     = community === "CBA";

  const dateLabel = new Date(r.date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  return (
    <div style={{
      background:   colors.surface,
      border:       `1.5px solid ${isLate ? colors.warningBorder : colors.border}`,
      borderRadius: radius.lg,
      overflow:     "hidden",
      boxShadow:    shadow.card,
    }}>
      {/* Card header — always visible */}
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          display:     "flex",
          alignItems:  "center",
          gap:         12,
          width:       "100%",
          padding:     "14px 20px",
          background:  isLate ? colors.warningLight : colors.surfaceAlt,
          border:      "none",
          cursor:      "pointer",
          fontFamily:  font.family,
          borderBottom: expanded ? `1px solid ${colors.border}` : "none",
        }}
      >
        {/* Date */}
        <div style={{ flex: 2, textAlign: "left" }}>
          <div style={{ fontWeight: 700, fontSize: font.base, color: colors.textPrimary }}>
            {dateLabel}
          </div>
          {r.client && (
            <div style={{ fontSize: font.sm, color: colors.textMuted, marginTop: 2 }}>
              {r.client}
            </div>
          )}
        </div>

        {/* Time In / Out */}
        <div style={{ fontSize: font.sm, color: colors.textMuted, flexShrink: 0 }}>
          {r.time_in || "—"} → {r.time_out || "—"}
        </div>

        {/* Punctuality badge */}
        <div style={{ flexShrink: 0 }}>
          {isLate ? (
            <StatusBadge variant="warning">
              {r.punctuality.minutes_late}m Late — submitted {r.punctuality.submitted_est}
            </StatusBadge>
          ) : (
            <StatusBadge variant="success">
              On Time — {r.punctuality?.submitted_est}
            </StatusBadge>
          )}
        </div>

        {/* Expand chevron */}
        <ChevronDown
          size={16}
          color={colors.textMuted}
          style={{ flexShrink: 0, transform: expanded ? "rotate(180deg)" : "none", transition: "transform .15s" }}
        />
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* CBA metrics row */}
          {isCBA && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {[
                { label: "New Leads",    value: r.new_leads   },
                { label: "Email Apps",   value: r.email_apps  },
                { label: "Website Apps", value: r.website_apps},
                { label: "Follow Ups",   value: r.follow_ups  },
              ].map((m, i) => (
                <div key={i} style={{
                  background: colors.bg, borderRadius: radius.md,
                  padding: "8px 14px", textAlign: "center",
                }}>
                  <div style={{ fontSize: font.xl, fontWeight: 800, color: colors.textPrimary }}>
                    {m.value ?? 0}
                  </div>
                  <div style={{ fontSize: font.xs, color: colors.textMuted, marginTop: 2 }}>
                    {m.label}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Text fields */}
          {[
            { label: "Tasks Completed",  value: r.tasks         },
            { label: "Daily Summary",    value: r.daily_summary },
            { label: "Clock-Out Notes",  value: r.clock_out_notes },
          ].filter((f) => f.value).map((field, i) => (
            <div key={i}>
              <div style={{
                fontSize: font.xs, fontWeight: 700, color: colors.textMuted,
                letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4,
              }}>
                {field.label}
              </div>
              <div style={{
                fontSize: font.base, color: colors.textBody,
                lineHeight: 1.7, whiteSpace: "pre-wrap",
              }}>
                {field.value}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const s = {
  label: {
    display: "block",
    fontSize: font.sm,
    fontWeight: 700,
    color: colors.textMuted,
    marginBottom: 6,
    letterSpacing: "0.04em",
  },
  select: {
    width: "100%",
    border: `1.5px solid ${colors.border}`,
    borderRadius: radius.md,
    padding: "9px 36px 9px 12px",
    fontSize: font.base,
    outline: "none",
    fontFamily: font.family,
    background: colors.surface,
    color: colors.textPrimary,
    height: 38,
    appearance: "none",
    cursor: "pointer",
  },
  avatar: {
    width: 52, height: 52,
    borderRadius: radius.lg,
    background: colors.navy,
    color: colors.white,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: font.xl, fontWeight: 800,
    flexShrink: 0,
  },
};