import { useEffect, useState }  from "react";
import { Users, UserCheck, UserX, RefreshCw, Clock, FileCheck } from "lucide-react";
import { colors, font, radius }  from "../../styles/tokens";
import { apiFetch }              from "../../api";
import { StatCard, CommunityBadge, StatusBadge } from "../ui/Indicators";
import { Card, PageHeader, StatRow } from "../ui/Structure";
import { cacheGet, cacheSet, cacheClear, cacheTimeLeft, CACHE_KEYS } from "../../utils/reportCache";
import Button from "../ui/Button";
import { VANameLink } from "../../contexts/VAProfileContext";

// ── Action badge for activity feed ────────────────────────────────
function ActionBadge({ action }) {
  const isClockIn = action === "Clock In";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: font.xs, fontWeight: 700,
      color: isClockIn ? colors.teal : colors.communitySM,
      background: isClockIn ? colors.tealLight : "#F5F3FF",
      border: `1px solid ${isClockIn ? colors.tealMid : "#DDD6FE"}`,
      borderRadius: radius.sm, padding: "2px 8px",
    }}>
      {isClockIn
        ? <Clock size={10} style={{ flexShrink: 0 }} />
        : <FileCheck size={10} style={{ flexShrink: 0 }} />
      }
      {action}
    </span>
  );
}

// ── Activity Feed Table ───────────────────────────────────────────
function ActivityFeed({ feed, date }) {
  const [filter, setFilter] = useState("all");

  const filtered = filter === "all"
    ? feed
    : filter === "clockin"
      ? feed.filter(f => f.action === "Clock In")
      : feed.filter(f => f.action === "EOD Report");

  const clockInCount = feed.filter(f => f.action === "Clock In").length;
  const eodCount     = feed.filter(f => f.action === "EOD Report").length;

  const fmtDate = date
    ? new Date(date + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric",
      })
    : "Today";

  const pillStyle = (active) => ({
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "4px 12px", borderRadius: 16, cursor: "pointer",
    fontSize: font.xs, fontWeight: 700, border: "1.5px solid",
    transition: "all .15s",
    background: active ? colors.teal : colors.surface,
    color: active ? "#fff" : colors.textMuted,
    borderColor: active ? colors.teal : colors.border,
  });

  const th = {
    padding: "8px 12px", fontSize: font.xs, fontWeight: 700,
    color: "#fff", textAlign: "left", letterSpacing: "0.04em",
    textTransform: "uppercase",
  };
  const td = {
    padding: "10px 12px", fontSize: font.sm, color: colors.textBody,
    borderTop: `1px solid ${colors.border}`,
  };

  return (
    <Card
      title={`Today's Activity`}
      subtitle={fmtDate}
      noPadding
    >
      {/* Filter pills */}
      <div style={{ display: "flex", gap: 6, padding: "12px 20px", borderBottom: `1px solid ${colors.border}` }}>
        <span style={pillStyle(filter === "all")} onClick={() => setFilter("all")}>
          All {feed.length}
        </span>
        <span style={pillStyle(filter === "clockin")} onClick={() => setFilter("clockin")}>
          <Clock size={10} /> Clock Ins {clockInCount}
        </span>
        <span style={pillStyle(filter === "eod")} onClick={() => setFilter("eod")}>
          <FileCheck size={10} /> EOD Reports {eodCount}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: "32px 20px", textAlign: "center", color: colors.textFaint, fontSize: font.sm }}>
          No activity recorded yet today.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: colors.navy }}>
                <th style={th}>VA</th>
                <th style={th}>Action</th>
                <th style={th}>Client</th>
                <th style={{ ...th, textAlign: "right" }}>Time (EST)</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? colors.surface : colors.surfaceAlt }}>
                  <td style={td}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <CommunityBadge community={row.community} />
                      <VANameLink name={row.va_name} style={{ fontWeight: 600, color: colors.textPrimary }} />
                    </div>
                  </td>
                  <td style={td}>
                    <ActionBadge action={row.action} />
                  </td>
                  <td style={{ ...td, color: row.client === "—" ? colors.textFaint : colors.textBody }}>
                    {row.client}
                  </td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                    {row.time_est}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ── VA row in missing / flagged lists ─────────────────────────────
function VARow({ va, badge, i }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "10px 20px",
      borderTop: i > 0 ? `1px solid ${colors.border}` : "none",
      background: i % 2 === 0 ? colors.surface : colors.surfaceAlt,
    }}>
      <CommunityBadge community={va.community} />
      <span style={{ flex: 1, fontWeight: 600, fontSize: font.base, color: colors.textPrimary }}>
        <VANameLink name={va.name} />
      </span>
      {badge}
    </div>
  );
}

// ── Cached data banner ────────────────────────────────────────────
function CachedBanner({ cacheKey, onRefresh, loading }) {
  const mins = cacheTimeLeft(cacheKey);
  if (!mins) return null;
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      background: colors.tealLight, border: `1px solid ${colors.tealMid}`,
      borderRadius: radius.md, padding: "8px 14px",
    }}>
      <span style={{ fontSize: font.sm, color: colors.teal, fontWeight: 600 }}>
        Showing cached data · expires in {mins} min
      </span>
      <Button variant="ghost" icon={RefreshCw} onClick={onRefresh} disabled={loading} size="sm">
        Refresh
      </Button>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────
const CACHE_KEY = CACHE_KEYS.DASHBOARD;

export default function Dashboard() {
  const [data,    setData]    = useState(() => cacheGet(CACHE_KEY));
  const [loading, setLoading] = useState(!cacheGet(CACHE_KEY));
  const [error,   setError]   = useState("");

  useEffect(() => {
    if (cacheGet(CACHE_KEY)) return;
    apiFetch("/api/dashboard")
      .then(d => { cacheSet(CACHE_KEY, d); setData(d); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function refresh() {
    cacheClear(CACHE_KEY);
    setLoading(true); setError(""); setData(null);
    apiFetch("/api/dashboard")
      .then(d => { cacheSet(CACHE_KEY, d); setData(d); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }

  const fmtDate = iso => iso
    ? new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric",
      })
    : "";

  if (loading) {
    return (
      <div style={{ color: colors.textMuted, fontSize: font.base, padding: "60px 0", textAlign: "center" }}>
        Loading dashboard…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        background: colors.dangerLight, border: `1.5px solid ${colors.dangerBorder}`,
        borderRadius: radius.lg, padding: "16px 20px",
        color: colors.danger, fontWeight: 600, fontSize: font.base,
      }}>
        Failed to load dashboard: {error}
      </div>
    );
  }

  if (!data) return null;

  const { va_counts, activity_feed = [], activity_date, missing } = data;

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 28 }}>
      <PageHeader
        title="Dashboard"
        subtitle="Live overview of your VA team and today's report status."
      />

      <CachedBanner cacheKey={CACHE_KEY} onRefresh={refresh} loading={loading} />

      {/* ── Row 1: VA Count stat cards ─────────────────────────── */}
      <StatRow>
        <StatCard icon={Users}     label="Total Active VAs" value={va_counts.total} />
        <StatCard icon={UserCheck} label="Main Community"   value={va_counts.main}  highlight="teal" />
        <StatCard icon={UserCheck} label="CBA Community"    value={va_counts.cba}   highlight="teal" />
        <StatCard
          icon={UserX}
          label="No Contract VAs"
          value={va_counts.no_contract ?? 0}
          highlight={(va_counts.no_contract ?? 0) > 0 ? "warning" : "success"}
        />
      </StatRow>

      {/* ── Row 2: Activity Feed + Missing Reports ─────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>

        {/* Today's Activity */}
        <ActivityFeed feed={activity_feed} date={activity_date} />

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Flagged (2+ consecutive days) */}
          <Card
            title={`⚑ Flagged VAs — ${missing.flagged_count} consecutive miss${missing.flagged_count !== 1 ? "es" : ""}`}
            subtitle="Missed EOD 2 or more days in a row"
            noPadding
          >
            {missing.flagged_vas.length === 0 ? (
              <div style={{ padding: "16px 20px", fontSize: font.sm, color: colors.textMuted }}>
                No VAs flagged. All clear.
              </div>
            ) : (
              missing.flagged_vas.map((va, i) => (
                <VARow key={i} va={va} i={i}
                  badge={<StatusBadge variant="danger">Flagged</StatusBadge>}
                />
              ))
            )}
          </Card>

          {/* All missing yesterday */}
          <Card
            title={`Missing Yesterday — ${missing.count} VA${missing.count !== 1 ? "s" : ""}`}
            subtitle={fmtDate(missing.date)}
            noPadding
          >
            {missing.vas.length === 0 ? (
              <div style={{ padding: "16px 20px", fontSize: font.sm, color: colors.textMuted }}>
                All VAs submitted their EOD reports.
              </div>
            ) : (
              missing.vas.map((va, i) => (
                <VARow
                  key={i} va={va} i={i}
                  badge={
                    missing.flagged_vas.some(f => f.name === va.name)
                      ? <StatusBadge variant="danger">Flagged</StatusBadge>
                      : <StatusBadge variant="warning">1 day</StatusBadge>
                  }
                />
              ))
            )}
          </Card>

        </div>
      </div>
    </div>
  );
}