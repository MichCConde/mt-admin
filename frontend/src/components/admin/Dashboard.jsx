import { useEffect, useState }  from "react";
import { Users, UserCheck, UserX, RefreshCw } from "lucide-react";
import { colors, font, radius }  from "../../styles/tokens";
import { apiFetch }              from "../../api";
import { StatCard, CommunityBadge, StatusBadge } from "../ui/Indicators";
import { Card, PageHeader, StatRow } from "../ui/Structure";
import { cacheGet, cacheSet, cacheClear, cacheTimeLeft } from "../../utils/reportCache";
import Button from "../ui/Button";

// ── Bar chart used in CBA distribution ───────────────────────────
function BarChart({ items, max }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {items.map((item, i) => {
        const pct = max > 0 ? (item.count / max) * 100 : 0;
        const BAR_COLORS = [colors.teal, colors.communityMain, colors.communitySM, colors.communityCBA];
        return (
          <div key={i}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: font.sm, fontWeight: 600, color: colors.textBody }}>{item.label}</span>
              <span style={{ fontSize: font.sm, fontWeight: 700, color: colors.textPrimary }}>{item.count}</span>
            </div>
            <div style={{ width: "100%", height: 8, background: colors.bg, borderRadius: 99, overflow: "hidden" }}>
              <div style={{
                width: `${pct}%`, height: "100%",
                background: BAR_COLORS[i % BAR_COLORS.length],
                borderRadius: 99, transition: "width .5s ease",
              }} />
            </div>
            {item.vas?.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                {item.vas.map((name, j) => (
                  <span key={j} style={{
                    fontSize: font.xs, color: colors.textMuted,
                    background: colors.surfaceAlt, border: `1px solid ${colors.border}`,
                    borderRadius: radius.sm, padding: "2px 8px",
                  }}>{name}</span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
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
        {va.name}
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
const CACHE_KEY = "dashboard:summary";

export default function Dashboard() {
  const [data,    setData]    = useState(() => cacheGet(CACHE_KEY));
  const [loading, setLoading] = useState(!cacheGet(CACHE_KEY));
  const [error,   setError]   = useState("");

  useEffect(() => {
    if (cacheGet(CACHE_KEY)) return;   // already cached — skip fetch
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

  const { va_counts, cba_distribution, missing } = data;
  const maxCBA = Math.max(...cba_distribution.map(d => d.count), 1);

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
          icon={missing.count > 0 ? UserX : UserCheck}
          label={`Missing Reports · ${fmtDate(missing.date)}`}
          value={missing.count}
          highlight={missing.count > 0 ? "danger" : "success"}
        />
      </StatRow>

      {/* ── Row 2: CBA Distribution + Missing Reports ──────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>

        {/* CBA Client Distribution */}
        <Card title="CBA VA Hours Distribution" subtitle="VAs grouped by number of active clients">
          <BarChart items={cba_distribution} max={maxCBA} />
        </Card>

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