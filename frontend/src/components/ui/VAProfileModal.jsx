import { useState, useEffect, useCallback } from "react";
import {
  X, FileCheck, Timer, CheckCircle2, XCircle,
  ChevronDown, ChevronUp, Mail, Phone, Calendar,
} from "lucide-react";
import { colors, font, radius } from "../../styles/tokens";
import { apiFetch } from "../../api";
import { cacheGet, cacheSet, CACHE_KEYS } from "../../utils/reportCache";
import { Card, SectionLabel, StatRow } from "./Structure";
import { Avatar, CommunityBadge, StatCard, StatusBadge, StatusBox, Tag } from "./Indicators";
import { Select, NumberInput } from "./Inputs";
import { logActivity, LOG_TYPES } from "../../utils/logger";

// ── Inject drawer animation CSS once ─────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("mt-va-drawer-styles")) {
  const tag = document.createElement("style");
  tag.id = "mt-va-drawer-styles";
  tag.innerHTML = `
    @keyframes mt-drawer-slide-in {
      from { transform: translateX(100%); }
      to   { transform: translateX(0); }
    }
    @keyframes mt-backdrop-fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    .mt-va-drawer    { animation: mt-drawer-slide-in .28s cubic-bezier(.2, .8, .2, 1); }
    .mt-va-backdrop  { animation: mt-backdrop-fade-in .26s ease-out; }
  `;
  document.head.appendChild(tag);
}

const MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];
const MONTH_OPTIONS = MONTHS.map((m, i) => ({ value: i + 1, label: m }));

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
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

// ── Profile Header (shared between modal and inline) ──────────────
function ProfileHeader({ va, vaName, sticky, onClose }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "20px 24px", borderBottom: `1px solid ${colors.border}`,
      background: colors.surfaceAlt,
      ...(sticky ? { position: "sticky", top: 0, zIndex: 10 } : {}),
    }}>
      <Avatar name={va?.name || vaName} size={48} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: font.h3, fontWeight: 800, color: colors.textPrimary }}>{va?.name || vaName}</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
          {va?.community && <CommunityBadge community={va.community} />}
          <span style={{ fontSize: font.xs, color: colors.textMuted }}>{va?.schedule || "—"}</span>
        </div>
      </div>
      {onClose && (
        <button onClick={onClose} style={{
          background: colors.surface, border: `1px solid ${colors.border}`,
          borderRadius: radius.md, padding: "6px 8px", cursor: "pointer",
          display: "flex", alignItems: "center",
        }}>
          <X size={16} color={colors.textMuted} />
        </button>
      )}
    </div>
  );
}

// ── VAProfileBody — shared content used by modal AND inline tab ──
export function VAProfileBody({ vaName, onClose = null, sticky = false }) {
  const now = new Date();
  const [year,    setYear]    = useState(now.getFullYear());
  const [month,   setMonth]   = useState(now.getMonth() + 1);
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [vaList,  setVaList]  = useState(() => cacheGet(CACHE_KEYS.VA_LIST) ?? []);

  useEffect(() => {
    if (vaList.length > 0) return;
    apiFetch("/api/inspector/vas")
      .then(d => {
        const list = d.vas ?? [];
        cacheSet(CACHE_KEYS.VA_LIST, list);
        setVaList(list);
      })
      .catch(() => {});
  }, []);

  const cachedVA = vaList.find(v => v.name === vaName);
  const inspectorVA = data?.va;
  const va = cachedVA || inspectorVA;

  const fetchData = useCallback(async () => {
    if (!vaName) return;
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

  return (
    <>
      <ProfileHeader va={va} vaName={vaName} sticky={sticky} onClose={onClose} />

      <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 24 }}>
        {va && (
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
    </>
  );
}

// ── VAProfileModal — drawer chrome wrapping the body ──────────────
export default function VAProfileModal({ vaName, onClose }) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <>
      <div
        className="mt-va-backdrop"
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(13,31,60,0.45)", zIndex: 100 }}
      />
      <div
        className="mt-va-drawer"
        style={{
          position: "fixed", top: 0, right: 0,
          height: "100vh", width: "min(580px, 95vw)",
          background: colors.surface, boxShadow: "-8px 0 32px rgba(0,0,0,0.15)",
          zIndex: 101, display: "flex", flexDirection: "column",
          overflowY: "auto", fontFamily: font.family,
        }}
      >
        <VAProfileBody vaName={vaName} onClose={onClose} sticky />
      </div>
    </>
  );
}