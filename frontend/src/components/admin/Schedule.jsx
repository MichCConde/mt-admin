import { useState, useEffect }   from "react";
import { CalendarDays, Users, Clock, Search, CheckCircle2, XCircle, MinusCircle } from "lucide-react";
import { colors, font, radius }  from "../../styles/tokens";
import { apiFetch }              from "../../api";
import Button                           from "../ui/Button";
import { Card, ControlBar, PageHeader, TabBar } from "../ui/Structure";
import { Select }                              from "../ui/Inputs";
import { Avatar, CommunityBadge, StatusBox }   from "../ui/Indicators";
import { ths, tds, tableWrap }          from "../ui/Tables";

const DAYS     = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_FULL = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };
const HOURS    = Array.from({ length: 17 }, (_, i) => i + 6); // 6 AM → 10 PM

function fmtHour(h) {
  const ap = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:00 ${ap}`;
}

function initials(name) {
  const p = name.trim().split(" ");
  return p.length === 1 ? p[0].slice(0, 2).toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase();
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

// ── Community Tab ─────────────────────────────────────────────────
function CommunityTab({ vas, community }) {
  const noShift  = vas.filter((v) => !v.has_shift_data && !v.is_flexible);
  const withShift = vas.filter((v) =>  v.has_shift_data ||  v.is_flexible);

  if (!vas.length) {
    return <StatusBox variant="info">No active {community} VAs found.</StatusBox>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Legend */}
      <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
        {[
          { color: colors.teal,         label: "Main shift"        },
          { color: colors.communityCBA, label: "CBA multi-client"  },
          { color: colors.border,       label: "Off / Not scheduled" },
        ].map((l, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: l.color, display: "inline-block", flexShrink: 0 }} />
            <span style={{ fontSize: font.sm, color: colors.textMuted }}>{l.label}</span>
          </div>
        ))}
        <span style={{ fontSize: font.xs, color: colors.textFaint, marginLeft: "auto" }}>All times EST</span>
      </div>

      {/* VA × Day table */}
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
                    background: (d === "Sat" || d === "Sun") ? "#0A1525" : colors.navy,
                    borderLeft: `1px solid ${colors.navyBorder}`,
                  }}>
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {withShift.map((va, rowIdx) => (
                <tr key={va.name}>
                  <td style={{
                    ...tds,
                    fontWeight:   600,
                    paddingLeft:  20,
                    borderRight:  `1px solid ${colors.border}`,
                    whiteSpace:   "nowrap",
                    background:   rowIdx % 2 === 0 ? colors.surface : colors.surfaceAlt,
                    color:        colors.textPrimary,
                  }}>
                    {va.name}
                  </td>
                  {DAYS.map((day) => {
                    const works     = va.schedule_days?.includes(day);
                    const isWeekend = day === "Sat" || day === "Sun";

                    // Flexible VA — show a note on working days
                    if (va.is_flexible && !isWeekend) {
                      return (
                        <td key={day} style={{
                          ...tds, borderLeft: `1px solid ${colors.border}`,
                          background: colors.tealLight, padding: 6, textAlign: "center",
                        }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: colors.teal }}>Flexible</span>
                        </td>
                      );
                    }

                    // Day off
                    if (!works) {
                      return (
                        <td key={day} style={{
                          ...tds, borderLeft: `1px solid ${colors.border}`,
                          background: isWeekend ? "#F3F4F6" : (rowIdx % 2 === 0 ? colors.surface : colors.surfaceAlt),
                          textAlign: "center", color: colors.border, fontSize: 16,
                        }}>
                          —
                        </td>
                      );
                    }

                    // Working day — show ALL shift blocks (each client for CBA)
                    return (
                      <td key={day} style={{
                        ...tds,
                        borderLeft:    `1px solid ${colors.border}`,
                        padding:       6,
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
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <span style={{ fontSize: font.xs, fontWeight: 700, color: colors.warning, textTransform: "uppercase", letterSpacing: "0.07em" }}>
              ⚠ No Shift Time Set ({noShift.length})
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {noShift.map((va, i) => (
              <div key={i} style={{
                display:      "flex",
                alignItems:   "center",
                gap:          8,
                background:   colors.surface,
                border:       `1px dashed ${colors.warningBorder}`,
                borderRadius: radius.md,
                padding:      "8px 14px",
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

// ── ShiftBlock pill — shown inside each day cell ──────────────────
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

function fmtShortTime(h, m) {
  const ap  = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12}${ap}` : `${h12}:${String(m).padStart(2, "0")}${ap}`;
}

// ── By VA Tab ─────────────────────────────────────────────────────
function ByVATab({ vas }) {
  const [selected, setSelected] = useState("");
  const va = vas.find((v) => v.name === selected) ?? null;

  const groups = ["Main", "CBA"].flatMap((comm) => {
    const group = vas.filter((v) => v.community === comm);
    if (!group.length) return [];
    return [{ label: `${comm} Community`, options: group.map((v) => ({ value: v.name, label: v.name })) }];
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <Card>
        <Select
          label="Select a VA"
          placeholder="Choose a VA…"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          groups={groups}
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
        <Avatar name={va.name} size={52} />
        <div>
          <div style={{ fontSize: font.h3, fontWeight: 800, color: colors.textPrimary }}>{va.name}</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
            <CommunityBadge community={va.community} />
            <span style={{ fontSize: font.sm, color: colors.textMuted }}>{va.schedule || "No schedule set"}</span>
            <span style={{ fontSize: font.xs, color: colors.textFaint }}>· All times EST</span>
          </div>
        </div>
      </div>

      {/* Shift blocks */}
      {va.shift_blocks?.length > 0 ? (
        <Card noPadding style={{ overflowX: "auto" }}>
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

// ── Availability Finder (CBA only) ────────────────────────────────
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
  const [startIdx, setStartIdx] = useState(6);   // default 9:00 AM
  const [endIdx,   setEndIdx]   = useState(8);   // default 10:00 AM
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
    const ORDER = { available: 0, flexible: 1, partial: 2, unavailable: 3, off: 4, no_data: 5 };
    classified.sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9));
    setResults(classified);
  }

  const available = results?.filter((r) => ["available", "flexible"].includes(r.status)) ?? [];
  const partial   = results?.filter((r) => r.status === "partial")   ?? [];
  const busy      = results?.filter((r) => ["unavailable", "off", "no_data"].includes(r.status)) ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Info banner */}
      <StatusBox variant="info">
        Find CBA VAs available for a specific time window — useful when onboarding a new client.
      </StatusBox>

      {/* Controls */}
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
        <>
          {/* Summary pills */}
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
        </>
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
        return (
          <div key={i} style={{
            display:    "flex",
            alignItems: "flex-start",
            gap:        14,
            padding:    "12px 20px",
            borderTop:  i > 0 ? `1px solid ${colors.border}` : "none",
            background: i % 2 === 0 ? colors.surface : colors.surfaceAlt,
          }}>
            <Icon size={18} color={cfg.color} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: font.base, color: colors.textPrimary }}>{va.name}</div>
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