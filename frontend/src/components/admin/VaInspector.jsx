import { useState, useEffect } from "react";
import {
  Search, FileCheck, Timer, CheckCircle2, XCircle, CalendarDays,
} from "lucide-react";
import { colors, font, radius, shadow } from "../../styles/tokens";
import { apiFetch }  from "../../api";
import Button        from "../ui/Button";
import StatCard      from "../ui/StatCard";
import StatusBox     from "../ui/StatusBox";
import Card, { SectionLabel } from "../ui/Card";
import { CommunityBadge, StatusBadge } from "../ui/Badge";
import PageHeader    from "../ui/PageHeader";
import Select        from "../ui/Select";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const MONTH_OPTIONS = MONTHS.map((m, i) => ({ value: i + 1, label: m }));

export default function VAInspector() {
  const now = new Date();
  const [vas,     setVAs]    = useState([]);
  const [vaName,  setVAName] = useState("");
  const [year,    setYear]   = useState(now.getFullYear());
  const [month,   setMonth]  = useState(now.getMonth() + 1);
  const [data,    setData]   = useState(null);
  const [loading, setLoading]= useState(false);
  const [error,   setError]  = useState("");
  const [vasLoad, setVasLoad]= useState(false);

  useEffect(() => {
    setVasLoad(true);
    apiFetch("/api/inspector/vas")
      .then((d) => setVAs(d.vas ?? []))
      .catch(() => {})
      .finally(() => setVasLoad(false));
  }, []);

  async function runInspect() {
    if (!vaName) return;
    setLoading(true); setError(""); setData(null);
    try {
      setData(await apiFetch(
        `/api/inspector?va_name=${encodeURIComponent(vaName)}&year=${year}&month=${month}`
      ));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // Build grouped options: Main then CBA
  const groups = ["Main", "CBA"].flatMap((comm) => {
    const group = vas.filter((v) => v.community === comm);
    if (!group.length) return [];
    return [{ label: `${comm} Community`, options: group.map((v) => ({ value: v.name, label: v.name })) }];
  });

  return (
    <div style={{ fontFamily: font.family, width: "100%" }}>
      <PageHeader
        title="VA Inspector"
        subtitle="View all reports for a specific VA and flag late or missing submissions."
      />

      {/* Controls */}
      <Card style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Select
            label="Virtual Assistant"
            placeholder={vasLoad ? "Loading VAs…" : "Select a VA…"}
            value={vaName}
            onChange={(e) => setVAName(e.target.value)}
            groups={groups}
            disabled={vasLoad}
            style={{ flex: 2, minWidth: 220 }}
          />
          <Select
            label="Month"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            options={MONTH_OPTIONS}
            style={{ flex: 1, minWidth: 150 }}
          />
          <div style={{ width: 100 }}>
            <label style={s.label}>Year</label>
            <input
              type="number" value={year} min={2023} max={2030}
              onChange={(e) => setYear(Number(e.target.value))}
              style={s.numInput}
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
            <StatCard icon={Timer}       label="Late Submissions"  value={data.late_count}      highlight={data.late_count > 0 ? "warning" : "success"} />
            <StatCard
              icon={data.missing_days.length > 0 ? XCircle : CheckCircle2}
              label="Missing Days"
              value={data.missing_days.length}
              highlight={data.missing_days.length > 0 ? "danger" : "success"}
            />
          </div>

          {/* Missing days */}
          {data.missing_days.length > 0 && (
            <Card title={`Missing Reports — ${data.missing_days.length} day${data.missing_days.length !== 1 ? "s" : ""}`} noPadding>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "14px 20px" }}>
                {data.missing_days.map((d, i) => (
                  <span key={i} style={s.missingDayPill}>
                    {new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                ))}
              </div>
            </Card>
          )}

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

// ── Report Card ───────────────────────────────────────────────────
function ReportCard({ report: r, community }) {
  const [expanded, setExpanded] = useState(false);
  const isLate = !r.punctuality?.on_time;
  const isCBA  = community === "CBA";
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
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 12,
          width: "100%", padding: "14px 20px",
          background:   isLate ? colors.warningLight : colors.surfaceAlt,
          border:       "none", cursor: "pointer", fontFamily: font.family,
          borderBottom: expanded ? `1px solid ${colors.border}` : "none",
        }}
      >
        <div style={{ flex: 2, textAlign: "left" }}>
          <div style={{ fontWeight: 700, fontSize: font.base, color: colors.textPrimary }}>{dateLabel}</div>
          {r.client && <div style={{ fontSize: font.sm, color: colors.textMuted, marginTop: 2 }}>{r.client}</div>}
        </div>
        <div style={{ fontSize: font.sm, color: colors.textMuted, flexShrink: 0 }}>
          {r.time_in || "—"} → {r.time_out || "—"}
        </div>
        <div style={{ flexShrink: 0 }}>
          {isLate
            ? <StatusBadge variant="warning">{r.punctuality.minutes_late}m Late — {r.punctuality.submitted_est}</StatusBadge>
            : <StatusBadge variant="success">On Time — {r.punctuality?.submitted_est}</StatusBadge>
          }
        </div>
        <span style={{ fontSize: 12, color: colors.textMuted, flexShrink: 0 }}>
          {expanded ? "▲" : "▼"}
        </span>
      </button>

      {expanded && (
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          {isCBA && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {[
                { label: "New Leads",    value: r.new_leads   },
                { label: "Email Apps",   value: r.email_apps  },
                { label: "Website Apps", value: r.website_apps},
                { label: "Follow Ups",   value: r.follow_ups  },
              ].map((m, i) => (
                <div key={i} style={{ background: colors.bg, borderRadius: radius.md, padding: "8px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: font.xl, fontWeight: 800, color: colors.textPrimary }}>{m.value ?? 0}</div>
                  <div style={{ fontSize: font.xs, color: colors.textMuted, marginTop: 2 }}>{m.label}</div>
                </div>
              ))}
            </div>
          )}
          {[
            { label: "Tasks Completed",  value: r.tasks          },
            { label: "Daily Summary",    value: r.daily_summary  },
            { label: "Clock-Out Notes",  value: r.clock_out_notes},
          ].filter((f) => f.value).map((field, i) => (
            <div key={i}>
              <div style={{ fontSize: font.xs, fontWeight: 700, color: colors.textMuted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>
                {field.label}
              </div>
              <div style={{ fontSize: font.base, color: colors.textBody, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
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
    display: "block", fontSize: font.sm, fontWeight: 700,
    color: colors.textMuted, marginBottom: 6, letterSpacing: "0.04em",
  },
  numInput: {
    width: "100%", border: `1.5px solid ${colors.border}`,
    borderRadius: radius.md, padding: "9px 12px",
    fontSize: font.base, outline: "none", fontFamily: font.family,
    background: colors.surface, color: colors.textPrimary, height: 38,
  },
  avatar: {
    width: 52, height: 52, borderRadius: radius.lg,
    background: colors.navy, color: colors.white,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: font.xl, fontWeight: 800, flexShrink: 0,
  },
  missingDayPill: {
    background: colors.dangerLight, border: `1px solid ${colors.dangerBorder}`,
    color: colors.danger, borderRadius: radius.sm,
    padding: "4px 10px", fontSize: font.sm, fontWeight: 700,
  },
};