import { useState, useEffect }              from "react";
import { Search, ChevronDown, ChevronUp,
         Clock, UserX, FileCheck, Flag,
         Copy, Users, RefreshCw, AlertTriangle } from "lucide-react";
import { colors, font, radius, shadow }      from "../../styles/tokens";
import { apiFetch }                          from "../../api";
import { cacheSet, cacheGet, cacheTimeLeft, CACHE_KEYS } from "../../utils/reportCache";
import Button                                from "../ui/Button";
import { Card, PageHeader, StatRow, TabBar } from "../ui/Structure";
import { StatCard, StatusBadge, CommunityBadge, StatusBox, Avatar } from "../ui/Indicators";
import { Select }                            from "../ui/Inputs";
import { logActivity, LOG_TYPES }            from "../../utils/logger";
import FilterPill from "../ui/FilterPill";
import { VANameLink } from "../../contexts/VAProfileContext";

const CACHE_ALL = CACHE_KEYS.EOW_ALL;
const CACHE_VA  = CACHE_KEYS.EOW_VA;

// ── Helpers ───────────────────────────────────────────────────────
function getWeekRange() {
  const today = new Date();
  const day   = today.getDay();
  const mon   = new Date(today);
  mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
  const sat = new Date(mon);
  sat.setDate(mon.getDate() + 5);
  const fmt = d => d.toISOString().split("T")[0];
  return { start: fmt(mon), end: fmt(sat) };
}

function fmtDate(iso) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}
function fmtDateShort(iso) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric",
  });
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

// ── FractionStatCard ──────────────────────────────────────────────
function FractionStatCard({ icon: Icon, label, value, total, highlight }) {
  const accent = highlight === "danger" ? colors.danger : highlight === "warning" ? colors.warning : highlight === "success" ? colors.success : colors.teal;
  const iconBg = highlight === "danger" ? colors.dangerLight : highlight === "warning" ? colors.warningLight : highlight === "success" ? colors.successLight : colors.tealLight;
  return (
    <div style={{ flex: 1, minWidth: 130, background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.lg, padding: "18px 20px", boxShadow: shadow.card, display: "flex", alignItems: "flex-start", gap: 14 }}>
      {Icon && (
        <div style={{ width: 40, height: 40, borderRadius: radius.md, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={18} color={accent} strokeWidth={2} />
        </div>
      )}
      <div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontSize: 30, fontWeight: 800, color: colors.textPrimary, lineHeight: 1 }}>{value}</span>
          {total != null && <span style={{ fontSize: font.base, fontWeight: 600, color: colors.textMuted }}>/ {total}</span>}
        </div>
        <div style={{ fontSize: font.sm, color: colors.textBody, fontWeight: 600, marginTop: 5 }}>{label}</div>
      </div>
    </div>
  );
}

// ── Day Cell ──────────────────────────────────────────────────────
const PILL = {
  success: { bg: colors.successLight, color: colors.success,  border: colors.successBorder },
  warning: { bg: colors.warningLight, color: colors.warning,  border: colors.warningBorder },
  danger:  { bg: colors.dangerLight,  color: colors.danger,   border: colors.dangerBorder  },
  info:    { bg: colors.infoLight,    color: colors.info,     border: colors.infoBorder    },
  flag:    { bg: "#FFF5F5",           color: "#9333EA",       border: "#E9D5FF"            },
};
function pillStyle(v) {
  const s = PILL[v];
  return { display: "inline-block", background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: radius.sm, padding: "2px 7px", fontSize: font.xs, fontWeight: 700, whiteSpace: "nowrap" };
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

// ── Weekly Grid ───────────────────────────────────────────────────
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
              <th style={{ padding: "6px 10px", fontSize: font.xs, fontWeight: 700, color: colors.textMuted, borderBottom: `1px solid ${colors.border}`, textAlign: "left" }}>Client</th>
            )}
            {workdays.map(d => (
              <th key={d} style={{ padding: "6px 10px", fontSize: font.xs, fontWeight: 700, color: colors.textMuted, textAlign: "center", borderBottom: `1px solid ${colors.border}`, whiteSpace: "nowrap" }}>
                {fmtDate(d)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {community === "CBA" && clients.length > 0 ? clients.map(client => (
            <tr key={client}>
              <td style={{ padding: "6px 10px", fontSize: font.sm, fontWeight: 600, color: colors.textBody, borderTop: `1px solid ${colors.border}`, whiteSpace: "nowrap" }}>{client}</td>
              {workdays.map(d => (
                <td key={d} style={{ padding: "6px 10px", textAlign: "center", borderTop: `1px solid ${colors.border}` }}>
                  <DayCell entry={byDate[d]?.find(e => e.client === client)} />
                </td>
              ))}
            </tr>
          )) : (
            <tr>
              {workdays.map(d => (
                <td key={d} style={{ padding: "6px 10px", textAlign: "center", borderTop: `1px solid ${colors.border}` }}>
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

// ── Flag Details ──────────────────────────────────────────────────
function FlagDetails({ flags }) {
  if (!flags.keywords.length && !flags.duplicates.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {flags.keywords.length > 0 && (
        <div style={{ background: colors.infoLight, border: `1px solid ${colors.infoBorder}`, borderRadius: radius.md, padding: "12px 16px" }}>
          <div style={{ fontSize: font.sm, fontWeight: 700, color: colors.info, marginBottom: 6 }}>⚑ Client Issue Keywords Detected</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {flags.keywords.map((kw, i) => (
              <span key={i} style={{ background: colors.infoLight, color: colors.info, border: `1px solid ${colors.infoBorder}`, borderRadius: radius.sm, padding: "2px 9px", fontSize: font.xs, fontWeight: 700 }}>"{kw}"</span>
            ))}
          </div>
        </div>
      )}
      {flags.duplicates.length > 0 && (
        <div style={{ background: colors.dangerLight, border: `1px solid ${colors.dangerBorder}`, borderRadius: radius.md, padding: "12px 16px" }}>
          <div style={{ fontSize: font.sm, fontWeight: 700, color: colors.danger, marginBottom: 8 }}>⚠ Duplicate EOD Content Detected</div>
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

// ── VA Row ────────────────────────────────────────────────────────
function VARow({ summary, workdays }) {
  const [expanded, setExpanded] = useState(false);
  const { va, community, daily, stats, flags } = summary;
  const hasFlags = stats.flag_count > 0;
  const Chevron  = expanded ? ChevronUp : ChevronDown;
  return (
    <div style={{ border: `1px solid ${hasFlags ? colors.dangerBorder : colors.border}`, borderRadius: radius.lg, overflow: "hidden", boxShadow: shadow.card }}>
      <div
        style={{
          display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "13px 20px",
          background: hasFlags ? colors.dangerLight : colors.surfaceAlt,
          borderBottom: expanded ? `1px solid ${hasFlags ? colors.dangerBorder : colors.border}` : "none",
          fontFamily: font.family, textAlign: "left",
        }}
      >
        <CommunityBadge community={community} />
        <span style={{ flex: 1, fontWeight: 700, fontSize: font.base, color: colors.textPrimary }}>
          <VANameLink name={va.name} />
        </span>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {stats.missing_count > 0     && <StatusBadge variant="danger">{stats.missing_count} missing</StatusBadge>}
          {stats.no_clockin_count > 0  && <StatusBadge variant="neutral">{stats.no_clockin_count} no clock-in</StatusBadge>}
          {stats.late_count > 0        && <StatusBadge variant="warning">{stats.late_count} late</StatusBadge>}
          {flags.duplicates.length > 0 && <StatusBadge variant="danger">{flags.duplicates.length} duplicate{flags.duplicates.length !== 1 ? "s" : ""}</StatusBadge>}
          {flags.keywords.length > 0   && <StatusBadge variant="info">{flags.keywords.length} client flag{flags.keywords.length !== 1 ? "s" : ""}</StatusBadge>}
          {stats.flag_count === 0 && stats.missing_count === 0 && <StatusBadge variant="success">All clear</StatusBadge>}
        </div>
        <button
          onClick={() => setExpanded(v => !v)}
          style={{
            background: "none", border: "none", cursor: "pointer",
            padding: 4, display: "flex", alignItems: "center",
          }}
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          <Chevron size={15} color={colors.textMuted} style={{ flexShrink: 0 }} />
        </button>
      </div>
      {expanded && (
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
          <WeeklyGrid daily={daily} workdays={workdays} community={community} />
          <FlagDetails flags={flags} />
        </div>
      )}
    </div>
  );
}

// ── CachedBanner ─────────────────────────────────────────────────
function CachedBanner({ cacheKey, onRefresh, loading }) {
  const mins = cacheTimeLeft(cacheKey);
  if (!mins) return null;
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      background: colors.tealLight, border: `1px solid ${colors.tealMid}`,
      borderRadius: radius.md, padding: "8px 14px", marginBottom: 20,
    }}>
      <span style={{ fontSize: font.sm, color: colors.teal, fontWeight: 600 }}>
        Showing cached report · expires in {mins} min
      </span>
      <Button variant="ghost" icon={RefreshCw} onClick={onRefresh} disabled={loading} size="sm">
        Refresh
      </Button>
    </div>
  );
}

// ── All VAs Tab ───────────────────────────────────────────────────
function AllVAsTab() {
  const def = getWeekRange();
  const [start,     setStart]     = useState(def.start);
  const [end,       setEnd]       = useState(def.end);
  const [data,      setData]      = useState(() => cacheGet(CACHE_ALL));
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [community, setCommunity] = useState("all");
  const [issue,     setIssue]     = useState("all");
  const [search,    setSearch]    = useState("");

  async function run(force = false) {
    if (!force) {
      const cached = cacheGet(CACHE_ALL);
      if (cached) { setData(cached); return; }
    }
    setLoading(true); setError("");
    try {
      const result = await apiFetch(`/api/eow?start=${start}&end=${end}`);
      cacheSet(CACHE_ALL, result);
      setData(result);
      logActivity(LOG_TYPES.EOD_CHECK, `EOW report generated for ${start} → ${end}`, { start, end });
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  // ── Filter logic ──────────────────────────────────────────────
  const summaries = data?.va_summaries ?? [];

  function matchCommunity(s) {
    if (community === "all")  return true;
    if (community === "cba")  return s.community === "CBA";
    if (community === "main") return s.community === "Main";
    return true;
  }

  function matchSearch(s) {
    if (!search) return true;
    return (s.va.name || "").toLowerCase().includes(search.toLowerCase());
  }

  function matchIssue(s) {
    if (issue === "all")             return true;
    if (issue === "missing_eod")     return s.stats.missing_count    > 0;
    if (issue === "missing_clockin") return s.stats.no_clockin_count > 0;
    if (issue === "flagged")         return s.stats.flag_count       > 0;
    return true;
  }

  // Apply community first — counts for the issue row reflect the chosen community
  const byCommunity = summaries.filter(matchCommunity);

  const issueCounts = {
    all:             byCommunity.length,
    missing_eod:     byCommunity.filter(s => s.stats.missing_count    > 0).length,
    missing_clockin: byCommunity.filter(s => s.stats.no_clockin_count > 0).length,
    flagged:         byCommunity.filter(s => s.stats.flag_count       > 0).length,
  };

  const filtered = byCommunity.filter(matchIssue).filter(matchSearch);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Controls */}
      <Card>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div><label style={labelStyle}>Week Start (Mon)</label><input type="date" value={start} onChange={e => setStart(e.target.value)} style={dateInputStyle} /></div>
          <div><label style={labelStyle}>Week End (Sat)</label><input type="date" value={end}   onChange={e => setEnd(e.target.value)}   style={dateInputStyle} /></div>
          <Button icon={Search} onClick={() => run(true)} disabled={loading} style={{ alignSelf: "flex-end", height: 38 }}>
            {loading ? "Generating…" : "Generate Report"}
          </Button>
        </div>
      </Card>

      {error && <StatusBox variant="danger">{error}</StatusBox>}

      {data && (
        <>
          <CachedBanner cacheKey={CACHE_ALL} onRefresh={() => run(true)} loading={loading} />

          {/* Totals stat cards */}
          <StatRow>
            <FractionStatCard icon={FileCheck} label="EODs Submitted"
              value={(data.totals.possible_eod - data.totals.missing_eod)}
              total={data.totals.possible_eod}
              highlight={data.totals.missing_eod > 0 ? "danger" : "success"} />
            <FractionStatCard icon={Clock}     label="Clock-ins"
              value={(data.totals.possible_clockins - data.totals.no_clockin)}
              total={data.totals.possible_clockins}
              highlight={data.totals.no_clockin > 0 ? "warning" : "success"} />
            <StatCard icon={Clock} label="Late Submissions"
              value={data.totals.late}
              highlight={data.totals.late > 0 ? "warning" : "success"} />
            <StatCard icon={Flag}  label="Flag Total"
              value={data.totals.duplicates + data.totals.keyword_flags}
              highlight={(data.totals.duplicates + data.totals.keyword_flags) > 0 ? "danger" : "success"} />
          </StatRow>

          {/* ── Community filter + search (top row) ──────────── */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: font.sm, fontWeight: 700, color: colors.textMuted, marginRight: 4 }}>Community:</span>
            <FilterPill
              label="All"
              count={summaries.length}
              active={community === "all"}
              onClick={() => setCommunity("all")}
              color={colors.teal}
            />
            <FilterPill
              label="CBA"
              count={summaries.filter(s => s.community === "CBA").length}
              active={community === "cba"}
              onClick={() => setCommunity("cba")}
              color={colors.communityCBA}
            />
            <FilterPill
              label="Agency"
              count={summaries.filter(s => s.community === "Main").length}
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
                placeholder="Search VA name…"
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

          {/* ── Issue filter (second row) ────────────────────── */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: font.sm, fontWeight: 700, color: colors.textMuted, marginRight: 4 }}>Issues:</span>
            <FilterPill
              label="All"
              count={issueCounts.all}
              active={issue === "all"}
              onClick={() => setIssue("all")}
              color={colors.teal}
            />
            <FilterPill
              label="Missing Reports"
              count={issueCounts.missing_eod}
              active={issue === "missing_eod"}
              onClick={() => setIssue("missing_eod")}
              color={colors.danger}
            />
            <FilterPill
              label="Missing Clock-ins"
              count={issueCounts.missing_clockin}
              active={issue === "missing_clockin"}
              onClick={() => setIssue("missing_clockin")}
              color={colors.warning}
            />
            <FilterPill
              label="Flagged"
              count={issueCounts.flagged}
              active={issue === "flagged"}
              onClick={() => setIssue("flagged")}
              color="#7C3AED"
            />
          </div>

          {/* VA list */}
          <div>
            <div style={{ fontSize: font.xs, fontWeight: 700, color: colors.textMuted, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 12 }}>
              {filtered.length} of {summaries.length} VAs — {fmtDate(data.start)} to {fmtDate(data.end)}
            </div>

            {filtered.length === 0 ? (
              <StatusBox variant="info">
                {search
                  ? `No VAs matching "${search}".`
                  : issue !== "all"
                    ? `No VAs ${issue === "missing_eod" ? "with missing reports"
                       : issue === "missing_clockin" ? "with missing clock-ins"
                       : "flagged"} this week.`
                    : "No VAs found for this filter."
                }
              </StatusBox>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {filtered.map((s, i) => (
                  <VARow key={i} summary={s} workdays={data.workdays} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── By VA Tab ─────────────────────────────────────────────────────
function ByVATab() {
  const def = getWeekRange();
  const [start,    setStart]    = useState(def.start);
  const [end,      setEnd]      = useState(def.end);
  const [vaName,   setVaName]   = useState("");
  const [data,     setData]     = useState(() => cacheGet(CACHE_VA));
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

const allCache = cacheGet(CACHE_ALL);
const vaList   = cacheGet(CACHE_KEYS.VA_LIST); 

const vaOptions = (() => {
  const source = vaList
    ? ["Main", "CBA"].flatMap(comm => {
        const group = vaList.filter(v => v.community === comm);
        if (!group.length) return [];
        return [{ label: `${comm} Community`, options: group.map(v => ({ value: v.name, label: v.name })) }];
      })
    : allCache
    ? ["Main", "CBA"].flatMap(comm => {
        const group = allCache.va_summaries.filter(s => s.community === comm);
        if (!group.length) return [];
        return [{ label: `${comm} Community`, options: group.map(s => ({ value: s.va.name, label: s.va.name })) }];
      })
    : [];
  return source;
})();

  // If all-report cache has data for this VA, use it directly
  function findInCache(name) {
    if (!allCache) return null;
    const match = allCache.va_summaries.find(s => s.va.name === name);
    if (!match) return null;
    return { ...allCache, va_summaries: [match] };
  }

  async function run(force = false) {
    if (!vaName) return;
    if (!force) {
      const cached = cacheGet(CACHE_VA);
      if (cached) { setData(cached); return; }
    }
    // Try using the all-report cache first (no extra API call needed)
    const fromAll = findInCache(vaName);
    if (fromAll && !force) { cacheSet(CACHE_VA, fromAll); setData(fromAll); return; }

    setLoading(true); setError("");
    try {
      const result = await apiFetch(`/api/eow?start=${start}&end=${end}`);
      // Filter to just the selected VA
      const filtered = { ...result, va_summaries: result.va_summaries.filter(s => s.va.name === vaName) };
      cacheSet(CACHE_VA, filtered);
      setData(filtered);
      logActivity(LOG_TYPES.EOD_CHECK, `EOW report for ${vaName}: ${start} → ${end}`, { va: vaName, start, end });
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  const summary = data?.va_summaries?.[0] ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Controls */}
      <Card>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <Select
            label="Virtual Assistant"
            placeholder={vaOptions.length ? "Select a VA…" : "Generate All VAs report first to load list…"}
            value={vaName}
            onChange={e => setVaName(e.target.value)}
            groups={vaOptions.length ? vaOptions : undefined}
            style={{ flex: 2, minWidth: 240 }}
          />
          <div><label style={labelStyle}>Week Start</label><input type="date" value={start} onChange={e => setStart(e.target.value)} style={dateInputStyle} /></div>
          <div><label style={labelStyle}>Week End</label><input type="date" value={end}   onChange={e => setEnd(e.target.value)}   style={dateInputStyle} /></div>
          <Button icon={Search} onClick={() => run(true)} disabled={loading || !vaName} style={{ alignSelf: "flex-end", height: 38 }}>
            {loading ? "Loading…" : "Inspect"}
          </Button>
        </div>
      </Card>

      {error && <StatusBox variant="danger">{error}</StatusBox>}

      {data && summary && (
        <>
          <CachedBanner cacheKey={CACHE_VA} onRefresh={() => run(true)} loading={loading} />

          {/* VA header */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Avatar name={summary.va.name} size={48} />
            <div>
              <div style={{ fontSize: font.h3, fontWeight: 800, color: colors.textPrimary }}>
                <VANameLink name={summary.va.name} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                <CommunityBadge community={summary.community} />
                <span style={{ fontSize: font.sm, color: colors.textMuted }}>
                  {fmtDate(data.start)} — {fmtDate(data.end)}
                </span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <StatRow>
            <FractionStatCard icon={FileCheck} label="EODs Submitted"  value={summary.stats.submitted_count} total={summary.stats.total_days} highlight={summary.stats.missing_count > 0 ? "danger" : "success"} />
            <FractionStatCard icon={Clock}     label="Clock-ins"       value={summary.stats.total_days - summary.stats.no_clockin_count} total={summary.stats.total_days} highlight={summary.stats.no_clockin_count > 0 ? "warning" : "success"} />
            <StatCard icon={Clock} label="Late Submissions"  value={summary.stats.late_count}      highlight={summary.stats.late_count > 0 ? "warning" : "success"} />
            <StatCard icon={Copy}  label="Duplicate Reports" value={summary.stats.duplicate_count} highlight={summary.stats.duplicate_count > 0 ? "danger" : "success"} />
          </StatRow>

          {/* Weekly grid */}
          <Card title="Weekly Breakdown" noPadding>
            <div style={{ padding: "16px 20px" }}>
              <WeeklyGrid daily={summary.daily} workdays={data.workdays} community={summary.community} />
            </div>
          </Card>

          <FlagDetails flags={summary.flags} />

          {summary.stats.flag_count === 0 && summary.stats.missing_count === 0 && summary.stats.no_clockin_count === 0 && (
            <StatusBox variant="success">No issues found for {summary.va.name} this week.</StatusBox>
          )}
        </>
      )}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────
const TABS = [
  { id: "all",   label: "All VAs" },
  { id: "by_va", label: "By VA"   },
];

export default function EowReports() {
  const [activeTab, setActiveTab] = useState("all");
  return (
    <div style={{ fontFamily: font.family, width: "100%" }}>
      <PageHeader
        title="EOW Reports"
        subtitle="End-of-week summary of VA attendance, EOD submissions, and content flags."
      />
      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />
      {activeTab === "all"   && <AllVAsTab />}
      {activeTab === "by_va" && <ByVATab  />}
    </div>
  );
}