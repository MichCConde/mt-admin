import { useState, useEffect, useRef } from "react";
import { CalendarDays, Users, Clock, Search, CheckCircle2, XCircle, MinusCircle, Download, ChevronDown, UserPlus } from "lucide-react";
import { cacheGet, cacheSet, cacheClear, cacheTimeLeft, CACHE_KEYS } from "../../utils/reportCache";
import { colors, font, radius }  from "../../styles/tokens";
import { apiFetch }              from "../../api";
import Button                           from "../ui/Button";
import { Card, ControlBar, PageHeader, TabBar } from "../ui/Structure";
import { Select }                              from "../ui/Inputs";
import { Avatar, CommunityBadge, StatusBox }   from "../ui/Indicators";
import { ths, tds, tableWrap }          from "../ui/Tables";
import { VANameLink } from "../../contexts/VAProfileContext";
import TopBarCachedBanner from "../ui/TopBarCachedBanner";
import TopBarProgress from "../ui/TopBarProgress";
import { Skeleton } from "../ui/Skeleton";

const DAYS     = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_FULL = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };
const HOURS    = Array.from({ length: 17 }, (_, i) => i + 6);

const TABLE_RADIUS = 4;

// ── Inject animation styles once ─────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("mt-schedule-styles")) {
  const tag = document.createElement("style");
  tag.id = "mt-schedule-styles";
  tag.innerHTML = `
    @keyframes mt-schedule-fade {
      from { opacity: 0; transform: translateY(2px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .mt-schedule-fade { animation: mt-schedule-fade .22s ease-out; }
  `;
  document.head.appendChild(tag);
}

// ── Status classification ────────────────────────────────────────
function getStatusCategory(va) {
  if (va.is_paused === true || va.paused === true) return "paused";

  const status = String(va.status ?? va.va_status ?? "").toLowerCase().trim();

  if (!status || status === "active") return "active";

  const pausedAliases = ["paused", "pause", "on pause", "on_pause", "on hold", "on_hold"];
  if (pausedAliases.includes(status)) return "paused";

  return "excluded";
}

function isShowable(va) {
  return getStatusCategory(va) !== "excluded";
}

function isPaused(va) {
  return getStatusCategory(va) === "paused";
}

function hasNoActiveContract(va) {
  if (va.has_active_contract === false) return true;
  if (Array.isArray(va.active_contracts) && va.active_contracts.length === 0) return true;
  if (Array.isArray(va.contracts)        && va.contracts.length === 0)        return true;
  if (Array.isArray(va.contract_ids)     && va.contract_ids.length === 0)     return true;
  return false;
}

function isDeploymentCandidate(va) {
  // Used by AvailabilityFinder sort — anyone open for new work
  return isPaused(va) || hasNoActiveContract(va);
}

// ── Paused badge — small inline tag ──────────────────────────────
function PausedBadge({ va }) {
  if (!isPaused(va)) return null;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700,
      color: colors.warning, background: colors.warningLight,
      border: `1px solid ${colors.warningBorder}`,
      padding: "1px 7px", borderRadius: radius.sm,
      textTransform: "uppercase", letterSpacing: "0.04em",
      whiteSpace: "nowrap",
    }}>Paused</span>
  );
}

// ── Status badge — shows Active OR Paused (used in No Contract tab) ──
function VAStatusBadge({ va }) {
  const category = getStatusCategory(va);
  const cfg = category === "paused"
    ? { label: "Paused", color: colors.warning, bg: colors.warningLight, border: colors.warningBorder }
    : { label: "Active", color: colors.success, bg: colors.successLight, border: colors.successBorder };

  return (
    <span style={{
      fontSize: 10, fontWeight: 700,
      color: cfg.color, background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      padding: "2px 9px", borderRadius: radius.sm,
      textTransform: "uppercase", letterSpacing: "0.04em",
      whiteSpace: "nowrap",
    }}>{cfg.label}</span>
  );
}

function fmtHour(h) {
  const ap = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:00 ${ap}`;
}

function fmtShortTime(h, m) {
  const ap  = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12}${ap}` : `${h12}:${String(m).padStart(2, "0")}${ap}`;
}

// Time options: every 30 min from 6 AM to 10 PM
const TIME_OPTIONS = [];
for (let h = 6; h <= 22; h++) {
  for (let m of [0, 30]) {
    if (h === 22 && m === 30) continue;
    const ap  = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    TIME_OPTIONS.push({ h, m, label: m === 0 ? `${h12}:00 ${ap}` : `${h12}:30 ${ap}` });
  }
}
const TIME_SELECT_OPTIONS = TIME_OPTIONS.map((t, i) => ({ value: i, label: t.label }));
const DAY_SELECT_OPTIONS  = DAYS.map((d) => ({ value: d, label: DAY_FULL[d] }));

const STATUS_CONFIG = {
  available:   { color: colors.success,   bg: colors.successLight, border: colors.successBorder, Icon: CheckCircle2, label: "Available"        },
  partial:     { color: colors.warning,   bg: colors.warningLight, border: colors.warningBorder, Icon: MinusCircle,  label: "Partially Booked" },
  unavailable: { color: colors.danger,    bg: colors.dangerLight,  border: colors.dangerBorder,  Icon: XCircle,      label: "Unavailable"      },
  flexible:    { color: colors.teal,      bg: colors.tealLight,    border: colors.tealMid,       Icon: CheckCircle2, label: "Flexible (check)" },
  off:         { color: colors.textFaint, bg: colors.surfaceAlt,   border: colors.border,        Icon: MinusCircle,  label: "Day off"          },
  no_data:     { color: colors.textFaint, bg: colors.surfaceAlt,   border: colors.border,        Icon: MinusCircle,  label: "No shift data"    },
};

const labelStyle = {
  display: "block", fontSize: font.sm, fontWeight: 700,
  color: colors.textBody, marginBottom: 6,
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
    <div ref={wrapRef} style={{ position: "relative", maxWidth: 360, minWidth: 280 }}>
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
                    <PausedBadge va={v} />
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

// ── CSV download ─────────────────────────────────────────────────
async function downloadAvailability(apiFetchFn, setDownloading) {
  setDownloading(true);
  try {
    const data = await apiFetchFn("/api/schedule/availability");

    const rows = [["Period", "Time Slot", "VA Name", "Current Clients", "Slots Open", "Current Schedule"]];

    const morningSlots = Object.entries(data.morning || {});
    if (morningSlots.length > 0) {
      rows.push(["", "", "", "", "", ""]);
      rows.push(["MORNING AVAILABILITY", "", "", "", "", ""]);
      rows.push(["", "", "", "", "", ""]);
      for (const [slot, vas] of morningSlots) {
        for (const va of vas) {
          rows.push(["Morning", slot, va.va_name, va.clients, va.slots_open, va.schedule]);
        }
      }
    }

    const afternoonSlots = Object.entries(data.afternoon || {});
    if (afternoonSlots.length > 0) {
      rows.push(["", "", "", "", "", ""]);
      rows.push(["AFTERNOON AVAILABILITY", "", "", "", "", ""]);
      rows.push(["", "", "", "", "", ""]);
      for (const [slot, vas] of afternoonSlots) {
        for (const va of vas) {
          rows.push(["Afternoon", slot, va.va_name, va.clients, va.slots_open, va.schedule]);
        }
      }
    }

    if (morningSlots.length === 0 && afternoonSlots.length === 0) {
      rows.push(["No CBA VAs with available time slots found.", "", "", "", "", ""]);
    }

    rows.push(["", "", "", "", "", ""]);
    rows.push([`Total VAs with availability: ${data.total_available_vas}`, "", "", "", "", ""]);

    const csv = rows
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `va-availability-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

  } catch (e) {
    alert("Failed to download availability: " + e.message);
  } finally {
    setDownloading(false);
  }
}

// ── Schedule table skeleton ──────────────────────────────────────
function ScheduleTableSkeleton() {
  return (
    <>
      <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap", marginTop: 16, marginBottom: 24 }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Skeleton width={12} height={12} radius={3} />
            <Skeleton width={90} height={11} />
          </div>
        ))}
      </div>
      <Card noPadding style={{ overflowX: "auto", borderRadius: TABLE_RADIUS }}>
        <table style={{ ...tableWrap, minWidth: 700 }}>
          <thead>
            <tr style={{ background: colors.navy }}>
              <th style={{ ...ths, width: 180, textAlign: "left", paddingLeft: 20, borderRight: `1px solid ${colors.navyBorder}` }}>VA</th>
              {DAYS.map((d) => (
                <th key={d} style={{
                  ...ths,
                  background: (d === "Sat" || d === "Sun") ? "#0A1525" : colors.navy,
                  borderLeft: `1px solid ${colors.navyBorder}`,
                }}>{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, ri) => (
              <tr key={ri}>
                <td style={{
                  ...tds, paddingLeft: 20,
                  background: ri % 2 === 0 ? colors.surface : colors.surfaceAlt,
                  borderRight: `1px solid ${colors.border}`,
                }}>
                  <Skeleton width={130} height={14} />
                </td>
                {DAYS.map((d) => (
                  <td key={d} style={{
                    ...tds,
                    background: ri % 2 === 0 ? colors.surface : colors.surfaceAlt,
                    borderLeft: `1px solid ${colors.border}`,
                    padding: 6,
                  }}>
                    <Skeleton width="80%" height={22} radius={4} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

// ── Root ─────────────────────────────────────────────────────────
const CACHE_KEY = CACHE_KEYS.SCHEDULE;

export default function Schedule() {
  const [activeTab, setActiveTab] = useState("main");
  const [vas,       setVAs]       = useState(() => cacheGet(CACHE_KEY) ?? []);
  const [loading,   setLoading]   = useState(!cacheGet(CACHE_KEY));
  const [error,     setError]     = useState("");

  useEffect(() => {
    if (cacheGet(CACHE_KEY)) return;
    apiFetch("/api/schedule")
      .then(d => { const list = d.vas ?? []; cacheSet(CACHE_KEY, list); setVAs(list); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function refresh() {
    cacheClear(CACHE_KEY);
    setLoading(true); setError("");
    apiFetch("/api/schedule")
      .then(d => { const list = d.vas ?? []; cacheSet(CACHE_KEY, list); setVAs(list); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }

  const showableVAs = vas.filter(isShowable);

  const TABS = [
    { id: "main",        Icon: Users,        label: "Agency"          },
    { id: "cba",         Icon: Users,        label: "CBA"             },
    { id: "by_va",       Icon: CalendarDays, label: "By VA"           },
    { id: "avail",       Icon: Clock,        label: "Availability"    },
    { id: "no_contract", Icon: UserPlus,     label: "No Contract VAs" },
  ];

  return (
    <div style={{ fontFamily: font.family, width: "100%" }}>
      <PageHeader title="Schedule" subtitle="View VA shift times across the week. All times are in EST." />

      <TopBarProgress active={loading} />
      <TopBarCachedBanner cacheKey={CACHE_KEY} onRefresh={refresh} loading={loading} />

      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {loading && <ScheduleTableSkeleton />}
      {error && <StatusBox variant="danger">{error}</StatusBox>}

      {!loading && !error && (
        <div key={activeTab} className="mt-schedule-fade">
          {activeTab === "main"        && <CommunityTab vas={showableVAs.filter(v => v.community === "Main")} community="Main" />}
          {activeTab === "cba"         && <CommunityTab vas={showableVAs.filter(v => v.community === "CBA")}  community="CBA"  />}
          {activeTab === "by_va"       && <ByVATab      vas={showableVAs} />}
          {activeTab === "avail"       && <AvailabilityFinder vas={showableVAs.filter(v => v.community === "CBA")} />}
          {activeTab === "no_contract" && <NoContractTab vas={showableVAs} />}
        </div>
      )}
    </div>
  );
}

// ── No Contract VAs Tab ──────────────────────────────────────────
function NoContractTab({ vas }) {
  const [search, setSearch] = useState("");

  const noContractVAs = vas.filter(hasNoActiveContract);

  const searched = search
    ? noContractVAs.filter(v => v.name.toLowerCase().includes(search.toLowerCase()))
    : noContractVAs;

  const sorted = [...searched].sort((a, b) => {
    if (a.community !== b.community) return a.community.localeCompare(b.community);
    const aPaused = isPaused(a);
    const bPaused = isPaused(b);
    if (aPaused !== bPaused) return aPaused ? 1 : -1;
    return a.name.localeCompare(b.name);
  });

  const activeCount = noContractVAs.filter(v => !isPaused(v)).length;
  const pausedCount = noContractVAs.filter(v =>  isPaused(v)).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <StatusBox variant="info">
        VAs from the Agency and CBA communities who are <strong>Active</strong> or <strong>Paused</strong> in the VA Database but currently have no active contracts. These are deployment candidates for new client assignments.
      </StatusBox>

      {noContractVAs.length === 0 ? (
        <StatusBox variant="success">
          All Active and Paused VAs currently have active contracts. 🎉
        </StatusBox>
      ) : (
        <>
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ fontSize: font.sm, color: colors.textMuted }}>
              <strong style={{ color: colors.textPrimary, fontSize: font.base }}>{noContractVAs.length}</strong>
              {" VA"}{noContractVAs.length !== 1 ? "s" : ""}
              {" without active contracts — "}
              <span style={{ color: colors.success, fontWeight: 700 }}>{activeCount} Active</span>
              {", "}
              <span style={{ color: colors.warning, fontWeight: 700 }}>{pausedCount} Paused</span>
            </div>

            <div style={{ marginLeft: "auto", position: "relative", display: "flex", alignItems: "center" }}>
              <Search size={14} style={{
                position: "absolute", left: 10,
                color: colors.textFaint, pointerEvents: "none",
              }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search VA…"
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

          {sorted.length === 0 ? (
            <StatusBox variant="info">No VAs match "{search}".</StatusBox>
          ) : (
            <Card noPadding style={{ overflowX: "auto", borderRadius: TABLE_RADIUS }}>
              <table style={{ ...tableWrap, minWidth: 700 }}>
                <thead>
                  <tr style={{ background: colors.navy }}>
                    <th style={{ ...ths, textAlign: "left", paddingLeft: 20, borderRight: `1px solid ${colors.navyBorder}` }}>VA Name</th>
                    <th style={{ ...ths, textAlign: "center", width: 110, borderLeft: `1px solid ${colors.navyBorder}` }}>Community</th>
                    <th style={{ ...ths, textAlign: "center", width: 100, borderLeft: `1px solid ${colors.navyBorder}` }}>Status</th>
                    <th style={{ ...ths, textAlign: "left", borderLeft: `1px solid ${colors.navyBorder}` }}>Schedule</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((va, i) => {
                    const rowBg = i % 2 === 0 ? colors.surface : colors.surfaceAlt;
                    const scheduleText = va.is_flexible
                      ? "Flexible — check directly"
                      : (va.schedule || "No schedule set");
                    const hasScheduleText = va.is_flexible || !!va.schedule;
                    return (
                      <tr
                        key={va.name}
                        style={{ background: rowBg, transition: "background .12s" }}
                        onMouseEnter={e => e.currentTarget.style.background = colors.tealLight}
                        onMouseLeave={e => e.currentTarget.style.background = rowBg}
                      >
                        <td style={{
                          ...tds, paddingLeft: 20,
                          borderRight: `1px solid ${colors.border}`,
                          whiteSpace: "nowrap",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <Avatar name={va.name} size={32} />
                            <span style={{ fontWeight: 600, color: colors.textPrimary }}>
                              <VANameLink name={va.name} />
                            </span>
                          </div>
                        </td>
                        <td style={{
                          ...tds, textAlign: "center",
                          borderLeft: `1px solid ${colors.border}`,
                        }}>
                          <CommunityBadge community={va.community} />
                        </td>
                        <td style={{
                          ...tds, textAlign: "center",
                          borderLeft: `1px solid ${colors.border}`,
                        }}>
                          <VAStatusBadge va={va} />
                        </td>
                        <td style={{
                          ...tds,
                          borderLeft: `1px solid ${colors.border}`,
                          color: hasScheduleText ? colors.textBody : colors.textFaint,
                          fontStyle: hasScheduleText ? "normal" : "italic",
                        }}>
                          {scheduleText}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ── Community Tab ────────────────────────────────────────────────
function CommunityTab({ vas, community }) {
  const [search,   setSearch]   = useState("");
  const [hoverRow, setHoverRow] = useState(null);

  const filteredVas = search
    ? vas.filter(v => v.name.toLowerCase().includes(search.toLowerCase()))
    : vas;

  // No-contract VAs now live in their own tab — exclude them here so the
  // Community tabs only show VAs with active client work
  const withContract = filteredVas.filter(v => !hasNoActiveContract(v));
  const noShift      = withContract.filter(v => !v.has_shift_data && !v.is_flexible);
  const withShift    = withContract.filter(v =>  v.has_shift_data ||  v.is_flexible);

  if (!vas.length) {
    return <StatusBox variant="info">No active or paused {community === "Main" ? "Agency" : "CBA"} VAs found.</StatusBox>;
  }

  const nothingMatched = search && withShift.length === 0 && noShift.length === 0;
  const allInNoContractTab = !search && withContract.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Legend + search */}
      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        {[
          { color: colors.teal,         label: "Main shift"          },
          { color: colors.communityCBA, label: "CBA multi-client"    },
          { color: colors.border,       label: "Off / Not scheduled" },
        ].map((l, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: l.color, display: "inline-block", flexShrink: 0 }} />
            <span style={{ fontSize: font.sm, color: colors.textMuted }}>{l.label}</span>
          </div>
        ))}

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: font.xs, color: colors.textFaint }}>All times EST</span>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <Search size={14} style={{ position: "absolute", left: 10, color: colors.textFaint, pointerEvents: "none" }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search VA…"
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
      </div>

      {search && (
        <div style={{
          fontSize: font.xs, fontWeight: 700, color: colors.textMuted,
          letterSpacing: "0.07em", textTransform: "uppercase",
        }}>
          {filteredVas.length} of {vas.length} VAs match "{search}"
        </div>
      )}

      {allInNoContractTab && (
        <StatusBox variant="info">
          All {community === "Main" ? "Agency" : "CBA"} VAs are currently without active contracts. See the "No Contract VAs" tab.
        </StatusBox>
      )}

      {/* ── Main VA × Day grid ───────────────────────────────── */}
      {withShift.length > 0 && (
        <Card noPadding style={{ overflowX: "auto", borderRadius: TABLE_RADIUS }}>
          <table style={{ ...tableWrap, minWidth: 700 }}>
            <thead>
              <tr style={{ background: colors.navy }}>
                <th style={{ ...ths, width: 220, textAlign: "left", paddingLeft: 20, borderRight: `1px solid ${colors.navyBorder}` }}>VA</th>
                {DAYS.map((d) => (
                  <th key={d} style={{
                    ...ths,
                    background: (d === "Sat" || d === "Sun") ? "#0A1525" : colors.navy,
                    borderLeft: `1px solid ${colors.navyBorder}`,
                  }}>{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {withShift.map((va, rowIdx) => {
                const baseBg = rowIdx % 2 === 0 ? colors.surface : colors.surfaceAlt;
                const rowBg = hoverRow === rowIdx ? colors.tealLight : baseBg;
                return (
                  <tr
                    key={va.name}
                    onMouseEnter={() => setHoverRow(rowIdx)}
                    onMouseLeave={() => setHoverRow(null)}
                    style={{ transition: "background .12s" }}
                  >
                    <td style={{
                      ...tds,
                      fontWeight:  600,
                      paddingLeft: 20,
                      borderRight: `1px solid ${colors.border}`,
                      whiteSpace:  "nowrap",
                      background:  rowBg,
                      color:       colors.textPrimary,
                      transition:  "background .12s",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <VANameLink name={va.name} />
                        <PausedBadge va={va} />
                      </div>
                    </td>
                    {DAYS.map((day) => {
                      const works     = va.schedule_days?.includes(day);
                      const isWeekend = day === "Sat" || day === "Sun";

                      if (va.is_flexible && !isWeekend) {
                        return (
                          <td key={day} style={{
                            ...tds, borderLeft: `1px solid ${colors.border}`,
                            background: hoverRow === rowIdx ? colors.tealLight : colors.tealLight,
                            padding: 6, textAlign: "center",
                            transition: "background .12s",
                          }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: colors.teal }}>Flexible</span>
                          </td>
                        );
                      }

                      if (!works) {
                        return (
                          <td key={day} style={{
                            ...tds, borderLeft: `1px solid ${colors.border}`,
                            background: hoverRow === rowIdx
                              ? colors.tealLight
                              : (isWeekend ? "#F3F4F6" : baseBg),
                            textAlign: "center", color: colors.border, fontSize: 16,
                            transition: "background .12s",
                          }}>—</td>
                        );
                      }

                      return (
                        <td key={day} style={{
                          ...tds,
                          borderLeft:    `1px solid ${colors.border}`,
                          padding:       6,
                          verticalAlign: "top",
                          background:    hoverRow === rowIdx ? colors.tealLight : "transparent",
                          transition:    "background .12s",
                        }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                            {va.shift_blocks.map((block, bi) => (
                              <ShiftBlock key={bi} block={block} community={community} />
                            ))}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {nothingMatched && (
        <StatusBox variant="info">No VAs matching "{search}".</StatusBox>
      )}

      {/* ── No Shift Time Set warning section ────────────────── */}
      {noShift.length > 0 && (
        <div>
          <div style={{
            fontSize: font.xs, fontWeight: 700, color: colors.warning,
            letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10,
          }}>
            ⚠ No Shift Time Set ({noShift.length})
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {noShift.map((va, i) => (
              <div key={i} style={{
                display:      "flex",
                alignItems:   "center",
                gap:          10,
                background:   colors.surface,
                border:       `1px dashed ${colors.warningBorder}`,
                borderRadius: radius.md,
                padding:      "8px 14px",
              }}>
                <Avatar name={va.name} size={24} />
                <VANameLink
                  name={va.name}
                  style={{ fontSize: font.sm, fontWeight: 600, color: colors.textPrimary }}
                />
                <PausedBadge va={va} />
                <span style={{ fontSize: font.xs, color: colors.warning }}>Update in Notion</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── ShiftBlock pill — shown inside each day cell ─────────────────
function ShiftBlock({ block, community }) {
  const isMulti   = !!block.label;
  const bg        = isMulti && community === "CBA" ? "#FEF3E2" : colors.tealLight;
  const border    = isMulti && community === "CBA" ? colors.warningBorder : colors.tealMid;
  const textColor = isMulti && community === "CBA" ? colors.warning : colors.teal;

  return (
    <div style={{
      background:   bg,
      border:       `1px solid ${border}`,
      borderRadius: radius.sm,
      padding:      "3px 7px",
      cursor:       "default",
    }}>
      {block.label && (
        <div style={{ fontSize: 10, fontWeight: 800, color: textColor, whiteSpace: "nowrap" }}>
          {block.label}
        </div>
      )}
      <div style={{ fontSize: 10, fontWeight: 600, color: textColor, whiteSpace: "nowrap", opacity: block.label ? 0.75 : 1 }}>
        {fmtShortTime(block.start_h, block.start_m)}–{fmtShortTime(block.end_h, block.end_m)}
      </div>
    </div>
  );
}

// ── By VA Tab ────────────────────────────────────────────────────
function ByVATab({ vas }) {
  const [selected, setSelected] = useState("");
  const va = vas.find((v) => v.name === selected) ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <Card style={{ overflow: "visible" }}>
        <VASearchSelect
          vas={vas}
          value={selected}
          onChange={setSelected}
          placeholder={vas.length ? "Search or pick a VA…" : "VA list not loaded yet"}
        />
      </Card>

      {!selected && (
        <StatusBox variant="info">Search or pick a VA above to see their full weekly schedule.</StatusBox>
      )}

      {va && <VAScheduleDetail va={va} />}
    </div>
  );
}

function VAScheduleDetail({ va }) {
  return (
    <div key={va.name} className="mt-schedule-fade" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <Avatar name={va.name} size={48} />
        <div>
          <div style={{ fontSize: font.h3, fontWeight: 800, color: colors.textPrimary }}>
            <VANameLink name={va.name} />
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4, flexWrap: "wrap" }}>
            <CommunityBadge community={va.community} />
            <PausedBadge va={va} />
            {hasNoActiveContract(va) && (
              <span style={{
                fontSize: 10, fontWeight: 700,
                color: colors.info, background: colors.infoLight,
                border: `1px solid ${colors.infoBorder}`,
                padding: "1px 7px", borderRadius: radius.sm,
                textTransform: "uppercase", letterSpacing: "0.04em",
                whiteSpace: "nowrap",
              }}>No Active Contract</span>
            )}
            <span style={{ fontSize: font.sm, color: colors.textMuted }}>{va.schedule || "No schedule set"}</span>
            <span style={{ fontSize: font.xs, color: colors.textFaint }}>· All times EST</span>
          </div>
        </div>
      </div>

      {va.shift_blocks?.length > 0 ? (
        <Card noPadding style={{ overflowX: "auto", borderRadius: TABLE_RADIUS }}>
          <table style={{ ...tableWrap, minWidth: 700 }}>
            <thead>
              <tr style={{ background: colors.navy }}>
                <th style={{ ...ths, width: 100, borderRight: `1px solid ${colors.navyBorder}` }}>Time</th>
                {DAYS.map((d) => (
                  <th key={d} style={{ ...ths, borderLeft: `1px solid ${colors.navyBorder}` }}>{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HOURS.map((hour, ri) => (
                <tr key={hour}>
                  <td style={{
                    ...tds, fontWeight: 600, color: colors.textMuted, fontSize: font.xs,
                    borderRight: `1px solid ${colors.border}`, whiteSpace: "nowrap",
                    background: colors.surfaceAlt, textAlign: "right", paddingRight: 14,
                  }}>
                    {fmtHour(hour)}
                  </td>
                  {DAYS.map((day) => {
                    const works  = va.schedule_days?.includes(day);
                    const active = va.shift_blocks?.filter((b) => {
                      const bs = b.start_h + b.start_m / 60;
                      const be = b.end_h   + b.end_m   / 60;
                      return bs < (hour + 1) && be > hour;
                    }) ?? [];
                    const isWeekend = day === "Sat" || day === "Sun";
                    return (
                      <td key={day} style={{
                        ...tds,
                        borderLeft: `1px solid ${colors.border}`,
                        background: active.length > 0
                          ? colors.tealLight
                          : !works ? (isWeekend ? "#F0F1F2" : (ri % 2 === 0 ? colors.surface : colors.surfaceAlt))
                          : ri % 2 === 0 ? colors.surface : colors.surfaceAlt,
                        textAlign: "center",
                      }}>
                        {active.map((b, i) => (
                          <div key={i} style={{ fontSize: 10, fontWeight: 700, color: colors.teal, lineHeight: 1.4 }}>
                            {b.label || "●"}
                          </div>
                        ))}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <StatusBox variant="info">No detailed shift data available for {va.name}.</StatusBox>
      )}
    </div>
  );
}

// ── Availability Finder (CBA only) ───────────────────────────────
function classifyVA(va, day, startH, startM, endH, endM) {
  if (va.is_flexible) return { status: "flexible", blocks: [] };
  if (!va.schedule_days?.includes(day)) return { status: "off", blocks: [] };
  if (!va.shift_blocks?.length) return { status: "no_data", blocks: [] };

  const reqStart = startH + startM / 60;
  const reqEnd   = endH   + endM   / 60;

  const conflicting = va.shift_blocks.filter((b) => {
    const bs = b.start_h + b.start_m / 60;
    const be = b.end_h   + b.end_m   / 60;
    return bs < reqEnd && be > reqStart;
  });

  if (!conflicting.length) return { status: "available", blocks: [] };
  const fullyBlocked = conflicting.some((b) => {
    const bs = b.start_h + b.start_m / 60;
    const be = b.end_h   + b.end_m   / 60;
    return bs <= reqStart && be >= reqEnd;
  });

  return { status: fullyBlocked ? "unavailable" : "partial", blocks: conflicting };
}

function AvailabilityFinder({ vas }) {
  const [startIdx, setStartIdx]   = useState(6);
  const [endIdx,   setEndIdx]     = useState(8);
  const [day,      setDay]        = useState("Mon");
  const [results,  setResults]    = useState(null);
  const [downloading, setDownloading] = useState(false);

  const start = TIME_OPTIONS[startIdx];
  const end   = TIME_OPTIONS[endIdx];
  const valid = start && end && (start.h + start.m / 60) < (end.h + end.m / 60);

  function runSearch() {
    if (!valid) return;
    const classified = vas.map((va) => ({
      va,
      ...classifyVA(va, day, start.h, start.m, end.h, end.m),
    }));
    // Sort: available/flexible first, with deployment candidates prioritized
    // within "available" since they're prime targets for new clients
    const ORDER = { available: 0, flexible: 1, partial: 2, unavailable: 3, off: 4, no_data: 5 };
    classified.sort((a, b) => {
      const orderDiff = (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9);
      if (orderDiff !== 0) return orderDiff;
      const aCandidate = isDeploymentCandidate(a.va);
      const bCandidate = isDeploymentCandidate(b.va);
      if (aCandidate && !bCandidate) return -1;
      if (!aCandidate && bCandidate) return 1;
      return 0;
    });
    setResults(classified);
  }

  const available = results?.filter((r) => ["available", "flexible"].includes(r.status)) ?? [];
  const partial   = results?.filter((r) => r.status === "partial")   ?? [];
  const busy      = results?.filter((r) => ["unavailable", "off", "no_data"].includes(r.status)) ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{
        display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        gap: 12, flexWrap: "wrap",
      }}>
        <StatusBox variant="info" style={{ flex: 1, minWidth: 280 }}>
          Find CBA VAs available for a specific time window. Paused VAs and VAs with no current contracts are included and prioritized as deployment candidates.
        </StatusBox>
        <Button
          icon={Download}
          variant="ghost"
          onClick={() => downloadAvailability(apiFetch, setDownloading)}
          disabled={downloading}
          size="sm"
        >
          {downloading ? "Downloading…" : "Download CSV"}
        </Button>
      </div>

      <ControlBar>
        <Select
          label="Day"
          value={day}
          onChange={(e) => setDay(e.target.value)}
          options={DAY_SELECT_OPTIONS}
          style={{ minWidth: 130 }}
        />
        <Select
          label="Shift Start"
          value={startIdx}
          onChange={(e) => setStartIdx(Number(e.target.value))}
          options={TIME_SELECT_OPTIONS}
          style={{ minWidth: 160 }}
        />
        <Select
          label="Shift End"
          value={endIdx}
          onChange={(e) => setEndIdx(Number(e.target.value))}
          options={TIME_SELECT_OPTIONS}
          style={{ minWidth: 160 }}
        />
        <Button
          icon={Search}
          onClick={runSearch}
          disabled={!valid}
          style={{ alignSelf: "flex-end", height: 38 }}
        >
          Search
        </Button>
      </ControlBar>

      {results && (
        <div className="mt-schedule-fade" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <SummaryPill count={available.length} label="Available"   color={colors.success} bg={colors.successLight} />
            <SummaryPill count={partial.length}   label="Partial"     color={colors.warning} bg={colors.warningLight} />
            <SummaryPill count={busy.length}      label="Unavailable" color={colors.danger}  bg={colors.dangerLight}  />
          </div>

          {available.length > 0 && (
            <ResultSection
              title={`Available (${available.length})`}
              items={available}
              headerBg={colors.successLight}
              headerBorder={colors.successBorder}
            />
          )}
          {partial.length > 0 && (
            <ResultSection
              title={`Partially Booked (${partial.length})`}
              subtitle="Has other clients during part of this window"
              items={partial}
              headerBg={colors.warningLight}
              headerBorder={colors.warningBorder}
            />
          )}
          {busy.length > 0 && (
            <ResultSection
              title={`Unavailable (${busy.length})`}
              items={busy}
              headerBg={colors.dangerLight}
              headerBorder={colors.dangerBorder}
            />
          )}
          {results.length === 0 && (
            <StatusBox variant="info">No CBA VAs found.</StatusBox>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryPill({ count, label, color, bg }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, background: bg, borderRadius: radius.md, padding: "8px 14px" }}>
      <span style={{ fontSize: 22, fontWeight: 800, color }}>{count}</span>
      <span style={{ fontSize: font.sm, fontWeight: 600, color }}>{label}</span>
    </div>
  );
}

function ResultSection({ title, subtitle, items, headerBg, headerBorder }) {
  return (
    <Card noPadding>
      <div style={{ padding: "12px 20px", background: headerBg, borderBottom: `1px solid ${headerBorder}` }}>
        <div style={{ fontWeight: 700, fontSize: font.base, color: colors.textPrimary }}>{title}</div>
        {subtitle && <div style={{ fontSize: font.sm, color: colors.textMuted, marginTop: 2 }}>{subtitle}</div>}
      </div>
      {items.map(({ va, status, blocks }, i) => {
        const cfg  = STATUS_CONFIG[status];
        const Icon = cfg.Icon;
        const rowBg = i % 2 === 0 ? colors.surface : colors.surfaceAlt;
        return (
          <div
            key={i}
            style={{
              display:    "flex",
              alignItems: "flex-start",
              gap:        14,
              padding:    "12px 20px",
              borderTop:  i > 0 ? `1px solid ${colors.border}` : "none",
              background: rowBg,
              transition: "background .12s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = colors.tealLight}
            onMouseLeave={e => e.currentTarget.style.background = rowBg}
          >
            <Icon size={18} color={cfg.color} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700, fontSize: font.base, color: colors.textPrimary }}>
                  <VANameLink name={va.name} />
                </span>
                <PausedBadge va={va} />
                {hasNoActiveContract(va) && (
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    color: colors.info, background: colors.infoLight,
                    border: `1px solid ${colors.infoBorder}`,
                    padding: "1px 7px", borderRadius: radius.sm,
                    textTransform: "uppercase", letterSpacing: "0.04em",
                  }}>No Contract</span>
                )}
              </div>
              <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {va.shift_blocks?.length > 0
                  ? va.shift_blocks.map((b, bi) => (
                      <span key={bi} style={{
                        fontSize: font.xs, color: colors.textMuted,
                        background: colors.surfaceAlt, border: `1px solid ${colors.border}`,
                        borderRadius: radius.sm, padding: "2px 8px",
                      }}>
                        {b.display}
                      </span>
                    ))
                  : <span style={{ fontSize: font.sm, color: colors.textFaint }}>{cfg.label}</span>
                }
              </div>
            </div>
          </div>
        );
      })}
    </Card>
  );
}