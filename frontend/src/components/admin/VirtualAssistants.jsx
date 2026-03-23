import { useState, useEffect, useCallback } from "react";
import {
  X, FileCheck, Timer, CheckCircle2, XCircle,
  ChevronDown, ChevronUp, Mail, Phone, Calendar, Users,
} from "lucide-react";
import { colors, font, radius, shadow }         from "../../styles/tokens";
import { apiFetch }                             from "../../api";
import { cacheGet, cacheSet }                   from "../../utils/reportCache";
import { Card, PageHeader, TabBar, SectionLabel, StatRow } from "../ui/Structure";
import { Avatar, CommunityBadge, StatCard, StatusBadge, StatusBox, Tag } from "../ui/Indicators";
import { Select, NumberInput }                  from "../ui/Inputs";
import { logActivity, LOG_TYPES }               from "../../utils/logger";

const CACHE_KEY = "va:list";

// ── Constants ─────────────────────────────────────────────────────
const MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];
const MONTH_OPTIONS = MONTHS.map((m, i) => ({ value: i + 1, label: m }));

const TABS = [
  { id: "active", label: "Active"         },
  { id: "main",   label: "Agency (Main)"  },
  { id: "cba",    label: "CBA"            },
];

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

// ── VA Row in the list ────────────────────────────────────────────
function VAListRow({ va, onClick, i }) {
  const clientCount = va.contract_ids?.length ?? 0;
  return (
    <button
      onClick={() => onClick(va)}
      style={{
        display:    "flex",
        alignItems: "center",
        gap:        14,
        width:      "100%",
        padding:    "12px 20px",
        background: i % 2 === 0 ? colors.surface : colors.surfaceAlt,
        borderTop:  `1px solid ${colors.border}`,
        border:     "none",
        cursor:     "pointer",
        fontFamily: font.family,
        textAlign:  "left",
        transition: "background .1s",
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

// ── ReportCard (expandable EOD entry) ────────────────────────────
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

  const fetch = useCallback(async () => {
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

  useEffect(() => { fetch(); }, [fetch]);

  // Block background scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0,
          background: "rgba(13,31,60,0.45)",
          zIndex: 100,
        }}
      />

      {/* Drawer panel — slides in from right */}
      <div style={{
        position:      "fixed",
        top:           0,
        right:         0,
        height:        "100vh",
        width:         "min(580px, 95vw)",
        background:    colors.surface,
        boxShadow:     "-8px 0 32px rgba(0,0,0,0.15)",
        zIndex:        101,
        display:       "flex",
        flexDirection: "column",
        overflowY:     "auto",
        fontFamily:    font.family,
      }}>

        {/* Header */}
        <div style={{
          display:        "flex",
          alignItems:     "center",
          gap:            14,
          padding:        "20px 24px",
          borderBottom:   `1px solid ${colors.border}`,
          background:     colors.surfaceAlt,
          position:       "sticky",
          top:            0,
          zIndex:         10,
        }}>
          <Avatar name={va.name} size={48} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: font.h3, fontWeight: 800, color: colors.textPrimary }}>{va.name}</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
              <CommunityBadge community={va.community} />
              <span style={{ fontSize: font.xs, color: colors.textMuted }}>{va.schedule || "No schedule set"}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: colors.surfaceAlt, border: `1px solid ${colors.border}`,
              borderRadius: radius.md, padding: "6px 8px", cursor: "pointer",
              display: "flex", alignItems: "center",
            }}
          >
            <X size={16} color={colors.textMuted} />
          </button>
        </div>

        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 24 }}>

          {/* Basic info */}
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

          {/* Month/Year selector */}
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <Select
              label="Month"
              value={month}
              onChange={e => setMonth(Number(e.target.value))}
              options={MONTH_OPTIONS}
              style={{ flex: 1 }}
            />
            <NumberInput
              label="Year"
              value={year}
              onChange={setYear}
              min={2023}
              max={2030}
              style={{ width: 90 }}
            />
          </div>

          {error && <StatusBox variant="danger">{error}</StatusBox>}

          {loading && (
            <div style={{ textAlign: "center", color: colors.textMuted, fontSize: font.sm, padding: "20px 0" }}>
              Loading reports…
            </div>
          )}

          {data && (
            <>
              {/* Stats */}
              <StatRow>
                <StatCard icon={FileCheck}    label="Reports"     value={data.submitted_count} />
                <StatCard icon={CheckCircle2} label="On Time"     value={data.on_time_count}   highlight="success" />
                <StatCard icon={Timer}        label="Late"        value={data.late_count}      highlight={data.late_count > 0 ? "warning" : "success"} />
                <StatCard
                  icon={data.missing_days.length > 0 ? XCircle : CheckCircle2}
                  label="Missing"
                  value={data.missing_days.length}
                  highlight={data.missing_days.length > 0 ? "danger" : "success"}
                />
              </StatRow>

              {/* Missing days */}
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

              {/* EOD Reports */}
              <div>
                <SectionLabel>
                  EOD Reports ({data.reports.length}) · {MONTHS[data.month - 1]} {data.year}
                </SectionLabel>
                {data.reports.length === 0 ? (
                  <StatusBox variant="info">
                    No EOD reports found for {MONTHS[data.month - 1]} {data.year}.
                  </StatusBox>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {data.reports.map((r, i) => (
                      <ReportCard key={i} report={r} community={data.va.community} />
                    ))}
                  </div>
                )}
              </div>

              {/* All clear */}
              {data.missing_days.length === 0 && data.submitted_count > 0 && (
                <StatusBox variant="success">
                  No missing EOD reports for {MONTHS[data.month - 1]} {data.year}.
                </StatusBox>
              )}
            </>
          )}
        </div>
      </div>
    </>
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
    if (cacheGet(CACHE_KEY)) return;   // already cached — skip fetch
    apiFetch("/api/inspector/vas")
      .then(d => { const list = d.vas ?? []; cacheSet(CACHE_KEY, list); setVAs(list); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = activeTab === "active" ? vas
    : activeTab === "main"   ? vas.filter(v => v.community === "Main")
    : vas.filter(v => v.community === "CBA");

  const cbaMultiple = vas.filter(v => v.community === "CBA" && (v.contract_ids?.length ?? 0) > 1);

  return (
    <div style={{ fontFamily: font.family, width: "100%" }}>
      <PageHeader
        title="Virtual Assistants"
        subtitle="Directory of all active VAs with EOD report history and profile details."
      />

      {/* Summary pills */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        {[
          { label: "Total",                value: vas.length,          color: colors.teal,    bg: colors.tealLight    },
          { label: "VAs with 2+ Clients",  value: cbaMultiple.length,  color: colors.communityMain, bg: colors.infoLight },
          { label: "Main Community",       value: vas.filter(v => v.community === "Main").length, color: colors.communityMain, bg: colors.infoLight },
          { label: "CBA Community",        value: vas.filter(v => v.community === "CBA").length,  color: colors.communityCBA,  bg: "#FFF7ED"        },
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

      {/* Tabs */}
      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {/* Table header */}
      <div style={{
        display:       "flex",
        alignItems:    "center",
        gap:           14,
        padding:       "8px 20px",
        background:    colors.surfaceAlt,
        borderBottom:  `1px solid ${colors.border}`,
        borderTop:     `1px solid ${colors.border}`,
        borderRadius:  `${radius.lg} ${radius.lg} 0 0`,
      }}>
        <div style={{ width: 36 }} />
        <div style={{ flex: 1, fontSize: font.xs, fontWeight: 700, color: colors.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Name</div>
        <div style={{ minWidth: 100, fontSize: font.xs, fontWeight: 700, color: colors.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Schedule</div>
        <div style={{ fontSize: font.xs, fontWeight: 700, color: colors.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Community</div>
      </div>

      {/* VA list */}
      <div style={{ border: `1px solid ${colors.border}`, borderTop: "none", borderRadius: `0 0 ${radius.lg} ${radius.lg}`, overflow: "hidden", boxShadow: shadow.card }}>
        {loading && (
          <div style={{ padding: "40px 20px", textAlign: "center", color: colors.textMuted, fontSize: font.sm }}>
            Loading VAs…
          </div>
        )}
        {error && <StatusBox variant="danger" style={{ margin: 16 }}>{error}</StatusBox>}
        {!loading && filtered.length === 0 && (
          <div style={{ padding: "40px 20px", textAlign: "center", color: colors.textFaint, fontSize: font.sm }}>
            No VAs found.
          </div>
        )}
        {filtered.map((va, i) => (
          <VAListRow key={va.id || i} va={va} onClick={setSelected} i={i} />
        ))}
      </div>

      {/* Modal */}
      {selected && (
        <VAModal va={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}