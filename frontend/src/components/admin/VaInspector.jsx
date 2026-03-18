import { useState, useEffect }    from "react";
import { Search, FileCheck, Timer, CheckCircle2, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { colors, font, radius, shadow } from "../../styles/tokens";
import { apiFetch }              from "../../api";
import Button                           from "../ui/Button";
import { Card, SectionLabel, ControlBar, PageHeader, StatRow } from "../ui/Structure";
import { Select, NumberInput }          from "../ui/Inputs";
import { Avatar, StatCard, StatusBox, Tag, CommunityBadge, StatusBadge } from "../ui/Indicators";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const MONTH_OPTIONS = MONTHS.map((m, i) => ({ value: i + 1, label: m }));

// ── Root ──────────────────────────────────────────────────────────
export default function VAInspector() {
  const now = new Date();
  const [vas,     setVAs]     = useState([]);
  const [vaName,  setVAName]  = useState("");
  const [year,    setYear]    = useState(now.getFullYear());
  const [month,   setMonth]   = useState(now.getMonth() + 1);
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [vasLoad, setVasLoad] = useState(false);

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

      <ControlBar>
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
        <NumberInput
          label="Year"
          value={year}
          onChange={setYear}
          min={2023}
          max={2030}
          style={{ width: 100 }}
        />
        <Button
          icon={Search}
          onClick={runInspect}
          disabled={loading || !vaName}
          style={{ alignSelf: "flex-end", height: 38 }}
        >
          {loading ? "Loading…" : "Inspect"}
        </Button>
      </ControlBar>

      {error && <StatusBox variant="danger" style={{ marginBottom: 20 }}>{error}</StatusBox>}

      {data && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

          {/* VA identity bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <Avatar name={data.va.name} size={48} />
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
          <StatRow>
            <StatCard icon={FileCheck}    label="Reports Submitted" value={data.submitted_count} />
            <StatCard icon={CheckCircle2} label="On Time"           value={data.on_time_count}   highlight="success" />
            <StatCard icon={Timer}        label="Late Submissions"  value={data.late_count}      highlight={data.late_count > 0 ? "warning" : "success"} />
            <StatCard
              icon={data.missing_days.length > 0 ? XCircle : CheckCircle2}
              label="Missing Days"
              value={data.missing_days.length}
              highlight={data.missing_days.length > 0 ? "danger" : "success"}
            />
          </StatRow>

          {/* Missing days */}
          {data.missing_days.length > 0 && (
            <Card title={`Missing Reports — ${data.missing_days.length} day${data.missing_days.length !== 1 ? "s" : ""}`}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {data.missing_days.map((d, i) => (
                  <Tag key={i} variant="danger">
                    {new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </Tag>
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
  const isLate  = !r.punctuality?.on_time;
  const isCBA   = community === "CBA";
  const dateLabel = new Date(r.date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
  const Chevron = expanded ? ChevronUp : ChevronDown;

  return (
    <div style={{
      background:   colors.surface,
      border:       `1.5px solid ${isLate ? colors.warningBorder : colors.border}`,
      borderRadius: radius.lg,
      overflow:     "hidden",
      boxShadow:    shadow.card,
    }}>
      {/* Header row */}
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          display:      "flex",
          alignItems:   "center",
          gap:          12,
          width:        "100%",
          padding:      "14px 20px",
          background:   isLate ? colors.warningLight : colors.surfaceAlt,
          border:       "none",
          borderBottom: expanded ? `1px solid ${isLate ? colors.warningBorder : colors.border}` : "none",
          cursor:       "pointer",
          fontFamily:   font.family,
          textAlign:    "left",
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: font.base, fontWeight: 700, color: colors.textPrimary }}>
            {dateLabel}
          </div>
          {r.client && (
            <div style={{ fontSize: font.sm, color: colors.textMuted, marginTop: 2 }}>
              {r.client}
            </div>
          )}
        </div>
        {isLate
          ? <StatusBadge variant="warning">{r.punctuality.submitted_est} — {r.punctuality.minutes_late}m late</StatusBadge>
          : <StatusBadge variant="success">On Time · {r.punctuality?.submitted_est}</StatusBadge>
        }
        <Chevron size={15} color={colors.textMuted} />
      </button>

      {/* Expanded details */}
      {expanded && (
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
          {isCBA && (
            <Row label="Client"       value={r.client       ?? "—"} />
          )}
          <Row label="Time In"        value={r.time_in      ?? "—"} />
          <Row label="Time Out"       value={r.time_out     ?? "—"} />
          {isCBA && (
            <>
              <Row label="New Leads"        value={r.new_leads    ?? "—"} />
              <Row label="Email Apps"       value={r.email_apps   ?? "—"} />
              <Row label="Website Apps"     value={r.website_apps ?? "—"} />
              <Row label="Follow-Ups"       value={r.follow_ups   ?? "—"} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
      <span style={{
        fontSize:   font.sm,
        fontWeight: 700,
        color:      colors.textMuted,
        minWidth:   110,
      }}>
        {label}
      </span>
      <span style={{ fontSize: font.base, color: colors.textBody }}>
        {value}
      </span>
    </div>
  );
}