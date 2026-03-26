import { useState, useEffect, useCallback } from "react";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { RefreshCw } from "lucide-react";
import { db }                          from "../../firebase";
import { colors, font, radius }        from "../../styles/tokens";
import { PageHeader }                  from "../ui/Structure";
import { Select }                      from "../ui/Inputs";
import Button                          from "../ui/Button";
import { LOG_TYPES }                   from "../../utils/logger";

// ── Type display config ───────────────────────────────────────────
const TYPE_CONFIG = {
  [LOG_TYPES.SIGN_IN]:          { label: "Sign In",          color: colors.success,      bg: colors.successLight, border: colors.successBorder },
  [LOG_TYPES.SIGN_OUT]:         { label: "Sign Out",          color: colors.textMuted,    bg: colors.surfaceAlt,   border: colors.border        },
  [LOG_TYPES.EOD_CHECK]:        { label: "EOD Check",         color: colors.teal,         bg: colors.tealLight,    border: colors.tealMid       },
  [LOG_TYPES.ATTENDANCE_CHECK]: { label: "Attendance Check",  color: colors.info,         bg: colors.infoLight,    border: colors.infoBorder    },
  [LOG_TYPES.EMAIL_SENT]:       { label: "Email Sent",        color: colors.communitySM,  bg: "#F5F3FF",           border: "#DDD6FE"            },
  [LOG_TYPES.VA_INSPECT]:       { label: "VA Inspect",        color: colors.communityMain,bg: colors.infoLight,    border: colors.infoBorder    },
};

const TYPE_OPTIONS = Object.entries(TYPE_CONFIG).map(([v, c]) => ({ value: v, label: c.label }));
const FETCH_LIMIT  = 200;

// ── Helpers ───────────────────────────────────────────────────────
function timeAgo(date) {
  const s = Math.floor((Date.now() - date) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function groupByDate(logs) {
  const groups = {};
  for (const log of logs) {
    const d   = log._date;
    const key = d.toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    }).toUpperCase();
    if (!groups[key]) groups[key] = [];
    groups[key].push(log);
  }
  return groups;
}

// ── TypeBadge ─────────────────────────────────────────────────────
function TypeBadge({ type }) {
  const cfg = TYPE_CONFIG[type] ?? { label: type, color: colors.textMuted, bg: colors.surfaceAlt, border: colors.border };
  return (
    <span style={{
      display:       "inline-block",
      background:    cfg.bg,
      color:         cfg.color,
      border:        `1px solid ${cfg.border}`,
      borderRadius:  radius.sm,
      padding:       "2px 9px",
      fontSize:      font.xs,
      fontWeight:    700,
      whiteSpace:    "nowrap",
      letterSpacing: "0.03em",
    }}>
      {cfg.label}
    </span>
  );
}

// ── Root ──────────────────────────────────────────────────────────
export default function ActivityLogs() {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const q    = query(collection(db, "activity_logs"), orderBy("timestamp", "desc"), limit(FETCH_LIMIT));
      const snap = await getDocs(q);
      setLogs(snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        _date: d.data().timestamp?.toDate?.() ?? new Date(),
      })));
    } catch (err) {
      console.error("Failed to fetch activity logs:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const filtered = filter ? logs.filter((l) => l.type === filter) : logs;
  const grouped  = groupByDate(filtered);

  return (
    <div style={{ fontFamily: font.family, width: "100%" }}>
      <PageHeader
        title="Activity Logs"
        subtitle={`${filtered.length} event${filtered.length !== 1 ? "s" : ""} recorded`}
      />

      {/* Controls */}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 28, flexWrap: "wrap" }}>
        <Select
          label="Filter by Type"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="All Types"
          options={TYPE_OPTIONS}
          style={{ minWidth: 200 }}
        />
        <Button
          variant="secondary"
          icon={RefreshCw}
          onClick={fetchLogs}
          disabled={loading}
          style={{ alignSelf: "flex-end", height: 38 }}
        >
          {loading ? "Loading…" : "Refresh"}
        </Button>
      </div>

      {/* Body */}
      {loading ? (
        <div style={{ textAlign: "center", color: colors.textMuted, padding: "60px 0", fontSize: font.base }}>
          Loading activity logs…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          background: colors.surfaceAlt, border: `1px solid ${colors.border}`,
          borderRadius: radius.lg, padding: "32px 20px",
          textAlign: "center", color: colors.textFaint, fontSize: font.base,
        }}>
          No activity logs found.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {Object.entries(grouped).map(([dateLabel, entries]) => (
            <div key={dateLabel}>

              {/* Date header */}
              <div style={{
                fontSize:      font.xs,
                fontWeight:    700,
                color:         colors.textMuted,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom:  8,
                paddingBottom: 8,
                borderBottom:  `1px solid ${colors.border}`,
              }}>
                {dateLabel}
              </div>

              {/* Entries */}
              <div style={{
                background:   colors.surface,
                border:       `1px solid ${colors.border}`,
                borderRadius: radius.lg,
                overflow:     "hidden",
              }}>
                {entries.map((log, i) => {
                  const cfg = TYPE_CONFIG[log.type];
                  return (
                    <div key={log.id} style={{
                      display:      "flex",
                      alignItems:   "center",
                      gap:          16,
                      padding:      "14px 20px",
                      borderTop:    i > 0 ? `1px solid ${colors.border}` : "none",
                      background:   i % 2 === 0 ? colors.surface : colors.surfaceAlt,
                    }}>
                      {/* Color dot */}
                      <div style={{
                        width:        10,
                        height:       10,
                        borderRadius: "50%",
                        background:   cfg?.color ?? colors.textMuted,
                        flexShrink:   0,
                      }} />

                      {/* Badge + description */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <TypeBadge type={log.type} />
                          <span style={{ fontSize: font.base, fontWeight: 600, color: colors.textPrimary }}>
                            {log.description}
                          </span>
                        </div>
                        {log.performed_by && (
                          <div style={{ fontSize: font.sm, color: colors.textMuted, marginTop: 3 }}>
                            by {log.performed_by}
                          </div>
                        )}
                      </div>

                      {/* Time */}
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: font.sm, fontWeight: 600, color: colors.textMuted }}>
                          {timeAgo(log._date)}
                        </div>
                        <div style={{ fontSize: font.xs, color: colors.textFaint, marginTop: 2 }}>
                          {log._date.toLocaleString("en-US", {
                            month: "short", day: "numeric", year: "numeric",
                            hour: "numeric", minute: "2-digit", hour12: true,
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
}