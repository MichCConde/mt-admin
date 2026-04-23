import { useState, useEffect, useCallback } from "react";
import {
  X, FileCheck, Timer, CheckCircle2, XCircle,
  ChevronDown, ChevronUp, Mail, Phone, Calendar, Clock,
} from "lucide-react";
import { colors, font, radius } from "../../styles/tokens";
import { apiFetch } from "../../api";
import { cacheGet, cacheSet, CACHE_KEYS } from "../../utils/reportCache";
import { Card, SectionLabel, StatRow } from "./Structure";
import { Avatar, CommunityBadge, StatCard, StatusBadge, StatusBox, Tag } from "./Indicators";
import { Select, NumberInput } from "./Inputs";
import { logActivity, LOG_TYPES } from "../../utils/logger";

const MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];
const MONTH_OPTIONS = MONTHS.map((m, i) => ({ value: i + 1, label: m }));

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function fmtShift(s) {
  if (!s) return "—";
  const parts = String(s).trim().split(":");
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1] || "0", 10);
  if (isNaN(h)) return s;
  const ap  = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ap}`;
}

function getVAShifts(va) {
  const shifts = [];
  if (va?.contracts?.length > 0) {
    for (const c of va.contracts) {
      if (c.start_shift) {
        shifts.push({ start: c.start_shift, end: c.end_shift, client: c.client_name });
      }
    }
  }
  if (shifts.length === 0 && va?.start_shift) {
    shifts.push({ start: va.start_shift, end: va.end_shift, client: "" });
  }
  return shifts;
}

// ── ReportCard ────────────────────────────────────────────────────
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

// ── VA Profile Modal ──────────────────────────────────────────────
export default function VAProfileModal({ vaName, onClose }) {
  const now = new Date();
  const [year,   setYear]   = useState(now.getFullYear());
  const [month,  setMonth]  = useState(now.getMonth() + 1);
  const [data,   setData]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,  setError]  = useState("");
  const [vaList, setVaList] = useState(() => cacheGet(CACHE_KEYS.VA_LIST) ?? []);

  // Hydrate VA list if we don't have it yet (enables full shift display)
  useEffect(() => {
    if (vaList.length > 0) return;
    apiFetch("/api/inspector/vas")
      .then(d => {
        const list = d.vas ?? [];
        cacheSet(CACHE_KEYS.VA_LIST, list);
        setVaList(list);
      })
      .catch(() => {}); // silent fail — we fall back to inspector VA object
  }, []);

  // Merge VA data from directory cache (has enriched contracts) + inspector response
  const cachedVA = vaList.find(v => v.name === vaName);
  const inspectorVA = data?.va;
  const va = cachedVA || inspectorVA;

  const fetchData = useCallback(async () => {
    setLoading(true); setError(""); setData(null);
    try {
      const result = await apiFetch(
        `/api/inspector?va_name=${encodeURIComponent(vaName)}&year=${year}&month=${month}`
      );
      setData(result);
      logActivity(LOG_TYPES.VA_INSPECT, `Viewed ${vaName} profile for ${MONTHS[month - 1]} ${year}`, { va: vaName, month, year });
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [vaName, year, month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  if (!va && !loading) {
    return (
      <>
        <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(13,31,60,0.45)", zIndex: 100 }} />
        <div style={{
          position: "fixed", top: 0, right: 0, height: "100vh", width: "min(580px, 95vw)",
          background: colors.surface, zIndex: 101, padding: 24, fontFamily: font.family,
        }}>
          <StatusBox variant="danger">{error || `VA "${vaName}" not found.`}</StatusBox>
          <button onClick={onClose} style={{ marginTop: 12 }}>Close</button>
        </div>
      </>
    );
  }

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
          <Avatar name={va?.name || vaName} size={48} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: font.h3, fontWeight: 800, color: colors.textPrimary }}>{va?.name || vaName}</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
              {va?.community && <CommunityBadge community={va.community} />}
              <span style={{ fontSize: font.xs, color: colors.textMuted }}>{va?.schedule || "—"}</span>
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
          {va && (
            <Card title="Profile">
              {(() => {
                const shifts = getVAShifts(va);
                const singleShift = shifts.length <= 1;

                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {[
                      [Mail,     "MT Email",   va.email || "—"],
                      [Phone,    "Phone",      va.phone || "—"],
                      [Calendar, "Start Date", fmtDate(va.start_date)],
                      ...(singleShift ? [
                        [Clock, "Shift Start", fmtShift(shifts[0]?.start)],
                        [Clock, "Shift End",   fmtShift(shifts[0]?.end)],
                      ] : []),
                    ].map(([Icon, label, value]) => (
                      <div key={label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Icon size={14} color={colors.textMuted} style={{ flexShrink: 0 }} />
                        <span style={{ fontSize: font.sm, fontWeight: 700, color: colors.textMuted, minWidth: 90 }}>{label}</span>
                        <span style={{ fontSize: font.sm, color: colors.textBody }}>{value}</span>
                      </div>
                    ))}
                    {!singleShift && (
                      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <Clock size={14} color={colors.textMuted} style={{ flexShrink: 0, marginTop: 2 }} />
                        <span style={{ fontSize: font.sm, fontWeight: 700, color: colors.textMuted, minWidth: 90 }}>
                          Shifts ({shifts.length})
                        </span>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                          {shifts.map((s, i) => (
                            <div key={i} style={{ fontSize: font.sm, color: colors.textBody }}>
                              <span style={{ fontWeight: 600 }}>{s.client}:</span>{" "}
                              <span>{fmtShift(s.start)} – {fmtShift(s.end)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </Card>
          )}

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