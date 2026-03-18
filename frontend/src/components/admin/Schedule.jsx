import { useState, useEffect } from "react";
import { CalendarDays, Users, Clock, AlertTriangle, Search, CheckCircle2, XCircle, MinusCircle } from "lucide-react";
import { colors, font, radius, shadow } from "../../styles/tokens";
import { apiFetch }   from "../../api";
import { ths, tds, tableWrap } from "../ui/TableStyles";
import Card, { SectionLabel } from "../ui/Card";
import { CommunityBadge }     from "../ui/Badge";
import StatusBox   from "../ui/StatusBox";
import PageHeader  from "../ui/PageHeader";
import TabBar      from "../ui/TabBar";
import Select      from "../ui/Select";
import Button      from "../ui/Button";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

const DAYS     = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_FULL = { Mon:"Monday", Tue:"Tuesday", Wed:"Wednesday", Thu:"Thursday", Fri:"Friday", Sat:"Saturday", Sun:"Sunday" };
const HOURS    = Array.from({ length: 17 }, (_, i) => i + 6); // 6 AM → 10 PM

function fmtHour(h) {
  const ap = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:00 ${ap}`;
}

function initials(name) {
  const p = name.trim().split(" ");
  return p.length === 1 ? p[0].slice(0,2).toUpperCase() : (p[0][0] + p[p.length-1][0]).toUpperCase();
}

// ── Root ──────────────────────────────────────────────────────────
export default function Schedule() {
  const [activeTab, setActiveTab] = useState("main");
  const [vas,       setVAs]       = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");

  useEffect(() => {
    apiFetch("/api/schedule")
      .then((d) => setVAs(d.vas ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const TABS = [
    { id: "main",  Icon: Users,        label: "Main Community"      },
    { id: "cba",   Icon: Users,        label: "CBA Community"       },
    { id: "by_va", Icon: CalendarDays, label: "By VA"               },
    { id: "avail", Icon: Clock,        label: "Availability Finder" },
  ];

  return (
    <div style={{ fontFamily: font.family, width: "100%" }}>
      <PageHeader title="Schedule" subtitle="View VA shift times across the week. All times are in EST." />
      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {loading && (
        <div style={{ color: colors.textMuted, fontSize: font.base, padding: "40px 0", textAlign: "center" }}>
          Loading schedule data…
        </div>
      )}
      {error && <StatusBox variant="danger">{error}</StatusBox>}

      {!loading && !error && (
        <>
          {activeTab === "main"  && <CommunityTab vas={vas.filter((v) => v.community === "Main")} community="Main" />}
          {activeTab === "cba"   && <CommunityTab vas={vas.filter((v) => v.community === "CBA")}  community="CBA"  />}
          {activeTab === "by_va" && <ByVATab      vas={vas} />}
          {activeTab === "avail" && <AvailabilityFinder vas={vas.filter((v) => v.community === "CBA")} />}
        </>
      )}
    </div>
  );
}

// ── Community Tab — VA-per-row table ──────────────────────────────
function CommunityTab({ vas, community }) {
  const [noShift, withShift] = [
    vas.filter((v) => !v.has_shift_data && !v.is_flexible),
    vas.filter((v) =>  v.has_shift_data ||  v.is_flexible),
  ];

  if (!vas.length) {
    return <StatusBox variant="info">No active {community} VAs found.</StatusBox>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Legend */}
      <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
        {[
          { color: colors.teal,         label: "Working (Main shift)" },
          { color: colors.communityCBA, label: "Working (CBA multi-client)" },
          { color: colors.border,       label: "Off / Not scheduled" },
        ].map((l, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: l.color, display: "inline-block", flexShrink: 0 }} />
            <span style={{ fontSize: font.sm, color: colors.textMuted }}>{l.label}</span>
          </div>
        ))}
        <span style={{ fontSize: font.xs, color: colors.textFaint, marginLeft: "auto" }}>All times EST</span>
      </div>

      {/* Main schedule table */}
      {withShift.length > 0 && (
        <Card noPadding style={{ overflowX: "auto" }}>
          <table style={{ ...tableWrap, minWidth: 700 }}>
            <thead>
              <tr style={{ background: colors.navy }}>
                <th style={{ ...ths, width: 180, textAlign: "left", paddingLeft: 20, borderRight: `1px solid ${colors.navyBorder}` }}>
                  VA
                </th>
                {DAYS.map((d) => (
                  <th key={d} style={{
                    ...ths,
                    background: (d === "Sat" || d === "Sun") ? colors.navyLight : colors.navy,
                    borderLeft: `1px solid ${colors.navyBorder}`,
                  }}>
                    <div>{d}</div>
                    <div style={{ fontSize: 9, opacity: 0.5, fontWeight: 400, marginTop: 1 }}>
                      {DAY_FULL[d].slice(0, 3)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {withShift.map((va, rowIdx) => (
                <tr key={va.id} style={{ background: rowIdx % 2 === 0 ? colors.surface : colors.surfaceAlt }}>
                  {/* VA name cell */}
                  <td style={{
                    padding: "10px 20px", borderTop: `1px solid ${colors.border}`,
                    borderRight: `1px solid ${colors.border}`,
                    verticalAlign: "middle",
                  }}>
                    <div style={{ fontWeight: 700, fontSize: font.base, color: colors.textPrimary }}>
                      {va.name}
                    </div>
                    {va.is_flexible && (
                      <span style={{ fontSize: font.xs, color: colors.teal, fontWeight: 600 }}>Flexible</span>
                    )}
                    {!va.is_flexible && va.shift_blocks?.length > 1 && (
                      <span style={{ fontSize: font.xs, color: colors.textMuted }}>
                        {va.shift_blocks.length} shifts
                      </span>
                    )}
                  </td>

                  {/* Day cells */}
                  {DAYS.map((day) => {
                    const works = va.schedule_days?.includes(day);
                    const isWeekend = day === "Sat" || day === "Sun";

                    if (va.is_flexible) {
                      return (
                        <td key={day} style={{ ...tds, borderLeft: `1px solid ${colors.border}`, background: "transparent" }}>
                          <div style={{ fontSize: font.xs, color: colors.teal, textAlign: "center", fontWeight: 600 }}>
                            FLEX
                          </div>
                        </td>
                      );
                    }

                    if (!works) {
                      return (
                        <td key={day} style={{
                          ...tds,
                          borderLeft: `1px solid ${colors.border}`,
                          background: isWeekend ? "#F3F4F6" : (rowIdx % 2 === 0 ? colors.surface : colors.surfaceAlt),
                        }}>
                          <div style={{ textAlign: "center", color: colors.border, fontSize: 16 }}>—</div>
                        </td>
                      );
                    }

                    // Working day — show shift blocks
                    return (
                      <td key={day} style={{
                        ...tds,
                        borderLeft: `1px solid ${colors.border}`,
                        padding: 6,
                        verticalAlign: "top",
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
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* VAs with no shift data */}
      {noShift.length > 0 && (
        <div>
          <SectionLabel style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <AlertTriangle size={12} color={colors.warning} />
            No Shift Time Set ({noShift.length})
          </SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {noShift.map((va, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 8,
                background: colors.surface,
                border: `1px dashed ${colors.warningBorder}`,
                borderRadius: radius.md, padding: "8px 14px",
              }}>
                <CommunityBadge community={va.community} />
                <span style={{ fontSize: font.sm, fontWeight: 600, color: colors.textMuted }}>{va.name}</span>
                <span style={{ fontSize: font.xs, color: colors.warning }}>Update in Notion</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shift Block pill inside a cell ────────────────────────────────
function ShiftBlock({ block, community }) {
  const [hovered, setHovered] = useState(false);
  const isMulti = !!block.label;
  const bg    = isMulti ? (community === "CBA" ? "#FEF3E2" : colors.tealLight) : colors.tealLight;
  const border = isMulti ? (community === "CBA" ? colors.warningBorder : colors.tealMid) : colors.tealMid;
  const textColor = isMulti ? (community === "CBA" ? colors.warning : colors.teal) : colors.teal;

  return (
    <div
      style={{ position: "relative" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{
        background: bg,
        border: `1.5px solid ${border}`,
        borderRadius: radius.sm,
        padding: "4px 7px",
        fontSize: font.xs,
        fontWeight: 700,
        color: textColor,
        lineHeight: 1.4,
        cursor: "default",
        whiteSpace: "nowrap",
      }}>
        {/* Show start-end time compactly */}
        {formatCompact(block.start_h, block.start_m)} – {formatCompact(block.end_h, block.end_m)}
        {block.label && (
          <span style={{ fontWeight: 400, color: colors.textMuted, marginLeft: 4 }}>
            ({block.label})
          </span>
        )}
      </div>

      {/* Tooltip on hover */}
      {hovered && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 6px)", left: "50%",
          transform: "translateX(-50%)",
          background: colors.navy, color: "#fff",
          borderRadius: radius.md, padding: "8px 12px",
          fontSize: font.sm, fontWeight: 600,
          whiteSpace: "nowrap", boxShadow: shadow.md,
          zIndex: 200, pointerEvents: "none",
        }}>
          {block.display}
          <div style={{
            position: "absolute", top: "100%", left: "50%",
            transform: "translateX(-50%)",
            borderWidth: 5, borderStyle: "solid",
            borderColor: `${colors.navy} transparent transparent transparent`,
          }} />
        </div>
      )}
    </div>
  );
}

function formatCompact(h, m) {
  const ap = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12}${ap}` : `${h12}:${String(m).padStart(2,"0")}${ap}`;
}

// ── By VA Tab ─────────────────────────────────────────────────────
function ByVATab({ vas }) {
  const [selected, setSelected] = useState("");
  const va = vas.find((v) => v.name === selected) ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <Card>
      <Select
        label="Select a VA"
        placeholder="Choose a VA…"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        groups={["Main","CBA"].flatMap((comm) => {
          const group = vas.filter((v) => v.community === comm);
          if (!group.length) return [];
          return [{ label: `${comm} Community`, options: group.map((v) => ({ value: v.name, label: v.name })) }];
        })}
        style={{ maxWidth: 340 }}
      />
      </Card>

      {va && <VAScheduleDetail va={va} />}
    </div>
  );
}

function VAScheduleDetail({ va }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* VA header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{
          width: 52, height: 52, borderRadius: radius.lg,
          background: colors.navy, color: colors.white,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: font.xl, fontWeight: 800, flexShrink: 0,
        }}>
          {initials(va.name)}
        </div>
        <div>
          <div style={{ fontSize: font.h3, fontWeight: 800, color: colors.textPrimary }}>{va.name}</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
            <CommunityBadge community={va.community} />
            <span style={{ fontSize: font.sm, color: colors.textMuted }}>{va.schedule || "No schedule set"}</span>
            <span style={{ fontSize: font.xs, color: colors.textFaint }}>· All times EST</span>
          </div>
        </div>
      </div>

      {/* Shift blocks summary */}
      {va.shift_blocks?.length > 0 ? (
        <Card title="Shift Times (EST)">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {va.shift_blocks.map((b, i) => (
              <div key={i} style={{
                background: colors.tealLight, border: `1.5px solid ${colors.tealMid}`,
                borderRadius: radius.md, padding: "10px 16px", minWidth: 160,
              }}>
                <div style={{ fontWeight: 700, fontSize: font.base, color: colors.teal }}>
                  {b.display}
                </div>
                {b.label && (
                  <div style={{ fontSize: font.sm, color: colors.textMuted, marginTop: 2 }}>
                    Client: {b.label}
                  </div>
                )}
              </div>
            ))}
          </div>
          {va.schedule_notes && (
            <div style={{ marginTop: 12, padding: "10px 14px", background: colors.warningLight, borderRadius: radius.md, border: `1px solid ${colors.warningBorder}` }}>
              <span style={{ fontSize: font.xs, fontWeight: 700, color: colors.warning }}>SCHEDULE NOTES: </span>
              <span style={{ fontSize: font.sm, color: colors.textBody }}>{va.schedule_notes}</span>
            </div>
          )}
        </Card>
      ) : va.is_flexible ? (
        <StatusBox variant="info">This VA is on a flexible schedule.</StatusBox>
      ) : (
        <StatusBox variant="warning">
          No shift time data found. Update the Shift Time field in their Notion VA record.
        </StatusBox>
      )}

      {/* Weekly grid for this VA */}
      {!va.is_flexible && va.has_shift_data && (
        <Card title="Weekly Schedule" subtitle="Highlighted hours show scheduled shifts" noPadding>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 600 }}>
              <thead>
                <tr style={{ background: colors.navy }}>
                  <th style={{ ...ths, width: 90, textAlign: "right", paddingRight: 14, borderRight: `1px solid ${colors.navyBorder}` }}>
                    Time
                  </th>
                  {DAYS.map((d) => {
                    const works = va.schedule_days?.includes(d);
                    return (
                      <th key={d} style={{
                        ...ths,
                        color: works ? "#fff" : colors.navyMuted,
                        background: works
                          ? ((d === "Sat" || d === "Sun") ? colors.navyLight : colors.navy)
                          : "#0A1525",
                        borderLeft: `1px solid ${colors.navyBorder}`,
                      }}>
                        {d}
                      </th>
                    );
                  })}
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
                      const works   = va.schedule_days?.includes(day);
                      const active  = va.shift_blocks?.filter((b) => {
                        const bs = b.start_h + b.start_m / 60;
                        const be = b.end_h   + b.end_m   / 60;
                        return bs < (hour + 1) && be > hour;
                      }) ?? [];
                      const isActive  = active.length > 0;
                      const isWeekend = day === "Sat" || day === "Sun";
                      const bg =
                        isActive   ? colors.tealLight :
                        !works     ? (isWeekend ? "#F0F1F2" : (ri%2===0 ? colors.surface : colors.surfaceAlt)) :
                        ri%2===0   ? colors.surface : colors.surfaceAlt;

                      return (
                        <td key={day} style={{
                          ...tds,
                          borderLeft: `1px solid ${colors.border}`,
                          background: bg,
                          textAlign: "center",
                        }}>
                          {isActive && active.map((b, i) => (
                            <div key={i} style={{
                              fontSize: 10, fontWeight: 700,
                              color: colors.teal, lineHeight: 1.4,
                            }}>
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
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Availability Finder (CBA only) ───────────────────────────────

// Time options: every 30 min from 6 AM to 10 PM
const TIME_OPTIONS = [];
for (let h = 6; h <= 22; h++) {
  for (let m of [0, 30]) {
    if (h === 22 && m === 30) continue;
    const ap  = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    const label = `${h12}:${String(m).padStart(2,"0")} ${ap} EST`;
    TIME_OPTIONS.push({ label, h, m });
  }
}

// Overlap check: does block [bS, bE] overlap requested window [rS, rE]?
function overlaps(block, rStartH, rStartM, rEndH, rEndM) {
  const bS = block.start_h + block.start_m / 60;
  const bE = block.end_h   + block.end_m   / 60;
  const rS = rStartH + rStartM / 60;
  const rE = rEndH   + rEndM   / 60;
  return bS < rE && bE > rS;
}

// For a VA, classify their status against the requested window:
// "available"   — no shift blocks overlap the window at all
// "partial"     — shift overlaps but doesn't fully cover the window
// "unavailable" — a shift block fully covers the window
function classifyVA(va, day, rStartH, rStartM, rEndH, rEndM) {
  const worksOnDay = va.is_flexible || va.schedule_days?.includes(day);
  if (!worksOnDay) return { status: "off", blocks: [] };

  if (va.is_flexible) return { status: "flexible", blocks: [] };
  if (!va.shift_blocks?.length) return { status: "no_data", blocks: [] };

  const rS = rStartH + rStartM / 60;
  const rE = rEndH   + rEndM   / 60;

  const conflicting = va.shift_blocks.filter((b) =>
    overlaps(b, rStartH, rStartM, rEndH, rEndM)
  );

  if (!conflicting.length) return { status: "available", blocks: [] };

  // Check if fully covered (any single block spans the entire window)
  const fullyCovered = conflicting.some((b) => {
    const bS = b.start_h + b.start_m / 60;
    const bE = b.end_h   + b.end_m   / 60;
    return bS <= rS && bE >= rE;
  });

  return {
    status: fullyCovered ? "unavailable" : "partial",
    blocks: conflicting,
  };
}

const STATUS_CONFIG = {
  available:   { color: colors.success,  bg: colors.successLight,  border: colors.successBorder,  Icon: CheckCircle2, label: "Available"         },
  partial:     { color: colors.warning,  bg: colors.warningLight,  border: colors.warningBorder,  Icon: MinusCircle,  label: "Partially Booked"  },
  unavailable: { color: colors.danger,   bg: colors.dangerLight,   border: colors.dangerBorder,   Icon: XCircle,      label: "Unavailable"       },
  flexible:    { color: colors.teal,     bg: colors.tealLight,     border: colors.tealMid,        Icon: CheckCircle2, label: "Flexible (check)"  },
  off:         { color: colors.textFaint,bg: colors.surfaceAlt,    border: colors.border,         Icon: MinusCircle,  label: "Day off"           },
  no_data:     { color: colors.textFaint,bg: colors.surfaceAlt,    border: colors.border,         Icon: MinusCircle,  label: "No shift data"     },
};

function AvailabilityFinder({ vas }) {
  const [startIdx, setStartIdx] = useState(6);  // defaults to 9:00 AM
  const [endIdx,   setEndIdx]   = useState(8);   // defaults to 10:00 AM
  const [day,      setDay]      = useState("Mon");
  const [results,  setResults]  = useState(null);

  const start = TIME_OPTIONS[startIdx];
  const end   = TIME_OPTIONS[endIdx];
  const valid = start && end && (start.h + start.m / 60) < (end.h + end.m / 60);

  function runSearch() {
    if (!valid) return;
    const classified = vas.map((va) => ({
      va,
      ...classifyVA(va, day, start.h, start.m, end.h, end.m),
    }));

    // Sort: available first, then flexible, then partial, then unavailable/off
    const ORDER = { available: 0, flexible: 1, partial: 2, unavailable: 3, off: 4, no_data: 5 };
    classified.sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9));
    setResults(classified);
  }

  const available = results?.filter((r) => r.status === "available"  || r.status === "flexible") ?? [];
  const partial   = results?.filter((r) => r.status === "partial")   ?? [];
  const busy      = results?.filter((r) => r.status === "unavailable"|| r.status === "off" || r.status === "no_data") ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header description */}
      <div style={{
        background: colors.tealLight, border: `1.5px solid ${colors.tealMid}`,
        borderRadius: radius.lg, padding: "14px 20px",
        fontSize: font.sm, color: colors.teal, fontWeight: 600, lineHeight: 1.6,
      }}>
        Find CBA VAs who are available for a specific time window. Useful when onboarding a new client
        and you need to match them with a VA whose schedule has an open slot.
      </div>

      {/* Search controls */}
      <Card title="Search Availability">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          {/* Day picker */}
          <div style={{ minWidth: 130 }}>
            <label style={s.label}>Day</label>
            <div style={{ position: "relative" }}>
              <select value={day} onChange={(e) => setDay(e.target.value)} style={s.select}>
                {DAYS.map((d) => (
                  <option key={d} value={d}>{DAY_FULL[d]}</option>
                ))}
              </select>
              <ChevronDown size={14} color={colors.textMuted}
                style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }} />
            </div>
          </div>

          {/* Start time */}
          <div style={{ minWidth: 160 }}>
            <label style={s.label}>Shift Start</label>
            <div style={{ position: "relative" }}>
              <select value={startIdx} onChange={(e) => setStartIdx(Number(e.target.value))} style={s.select}>
                {TIME_OPTIONS.map((t, i) => (
                  <option key={i} value={i}>{t.label}</option>
                ))}
              </select>
              <ChevronDown size={14} color={colors.textMuted}
                style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }} />
            </div>
          </div>

          {/* End time */}
          <div style={{ minWidth: 160 }}>
            <label style={s.label}>Shift End</label>
            <div style={{ position: "relative" }}>
              <select value={endIdx} onChange={(e) => setEndIdx(Number(e.target.value))} style={s.select}>
                {TIME_OPTIONS.map((t, i) => (
                  <option key={i} value={i}>{t.label}</option>
                ))}
              </select>
              <ChevronDown size={14} color={colors.textMuted}
                style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }} />
            </div>
          </div>

          {/* Search button */}
          <button
            onClick={runSearch}
            disabled={!valid}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              background: valid ? colors.teal : colors.border,
              color: valid ? "#fff" : colors.textFaint,
              border: "none", borderRadius: radius.md,
              padding: "9px 20px", fontSize: font.base,
              fontWeight: 700, cursor: valid ? "pointer" : "not-allowed",
              fontFamily: font.family, height: 38,
            }}
          >
            <Search size={14} />
            Find Available VAs
          </button>
        </div>

        {!valid && start && end && (
          <div style={{ marginTop: 10, fontSize: font.sm, color: colors.danger }}>
            End time must be after start time.
          </div>
        )}
      </Card>

      {/* Results */}
      {results && (
        <>
          {/* Summary bar */}
          <div style={{
            display: "flex", gap: 12, flexWrap: "wrap",
            background: colors.surface, border: `1.5px solid ${colors.border}`,
            borderRadius: radius.lg, padding: "16px 20px",
            boxShadow: shadow.card,
          }}>
            <SummaryPill count={available.length} label="Available"       color={colors.success}  bg={colors.successLight}  />
            <SummaryPill count={partial.length}   label="Partially Booked"color={colors.warning}  bg={colors.warningLight}  />
            <SummaryPill count={busy.length}      label="Unavailable"     color={colors.danger}   bg={colors.dangerLight}   />
            <div style={{ marginLeft: "auto", fontSize: font.sm, color: colors.textMuted, alignSelf: "center" }}>
              {DAY_FULL[day]}  ·  {start.label} – {end.label}
            </div>
          </div>

          {/* Available */}
          {available.length > 0 && (
            <ResultSection
              title={`Available (${available.length})`}
              items={available}
              headerBg={colors.successLight}
              headerBorder={colors.successBorder}
            />
          )}

          {/* Partially booked */}
          {partial.length > 0 && (
            <ResultSection
              title={`Partially Booked (${partial.length})`}
              subtitle="These VAs have a shift that overlaps part of your window but are free for the rest."
              items={partial}
              headerBg={colors.warningLight}
              headerBorder={colors.warningBorder}
            />
          )}

          {/* Unavailable / off */}
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
        </>
      )}
    </div>
  );
}

function SummaryPill({ count, label, color, bg }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      background: bg, borderRadius: radius.md, padding: "8px 14px",
    }}>
      <span style={{ fontSize: 22, fontWeight: 800, color }}>{count}</span>
      <span style={{ fontSize: font.sm, fontWeight: 600, color }}>{label}</span>
    </div>
  );
}

function ResultSection({ title, subtitle, items, headerBg, headerBorder }) {
  return (
    <Card noPadding>
      <div style={{
        padding: "12px 20px",
        background: headerBg,
        borderBottom: `1px solid ${headerBorder}`,
      }}>
        <div style={{ fontWeight: 700, fontSize: font.base, color: colors.textPrimary }}>{title}</div>
        {subtitle && (
          <div style={{ fontSize: font.sm, color: colors.textMuted, marginTop: 2 }}>{subtitle}</div>
        )}
      </div>

      {items.map(({ va, status, blocks }, i) => {
        const cfg = STATUS_CONFIG[status];
        const Icon = cfg.Icon;
        return (
          <div key={i} style={{
            display: "flex", alignItems: "flex-start", gap: 14,
            padding: "12px 20px",
            borderTop: i > 0 ? `1px solid ${colors.border}` : "none",
            background: i % 2 === 0 ? colors.surface : colors.surfaceAlt,
          }}>
            {/* Status icon */}
            <Icon size={18} color={cfg.color} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />

            {/* VA info */}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: font.base, color: colors.textPrimary }}>
                {va.name}
              </div>
              {/* Existing schedule */}
              <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {va.shift_blocks?.length > 0
                  ? va.shift_blocks.map((b, bi) => (
                      <span key={bi} style={{
                        background: colors.bg, border: `1px solid ${colors.border}`,
                        borderRadius: radius.sm, padding: "2px 8px",
                        fontSize: font.xs, color: colors.textMuted, fontWeight: 600,
                      }}>
                        {b.display}
                      </span>
                    ))
                  : <span style={{ fontSize: font.xs, color: colors.textFaint, fontStyle: "italic" }}>
                      {va.is_flexible ? "Flexible schedule" : "No shift data"}
                    </span>
                }
              </div>
            </div>

            {/* Status badge */}
            <span style={{
              flexShrink: 0,
              background: cfg.bg,
              color: cfg.color,
              border: `1px solid ${cfg.border}`,
              borderRadius: radius.sm,
              padding: "3px 10px",
              fontSize: font.xs,
              fontWeight: 700,
            }}>
              {cfg.label}
            </span>
          </div>
        );
      })}
    </Card>
  );
}