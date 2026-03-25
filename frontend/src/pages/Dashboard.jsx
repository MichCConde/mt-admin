import { useEffect, useState, useCallback } from "react";
import { fetchDashboard } from "../api/internal";
import { fetchEOD, fetchAttendance } from "../api/va";
import DashboardStats from "../components/internal/DashboardStats";
import EODTable from "../components/va/EODTable";
import AttendanceTable from "../components/va/AttendanceTable";
import CachedBanner from "../components/common/CachedBanner";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { todayISO, formatDate } from "../utils/dates";
import { cacheGet, cacheSet, getCachedAt, TTL } from "../utils/cache";
import { colors } from "../styles/tokens";

const TODAY = todayISO();
const CACHE_TTL_MIN = 45;

export default function Dashboard() {
  const [summary,    setSummary]    = useState(() => cacheGet("dashboard:summary"));
  const [eod,        setEOD]        = useState(() => cacheGet(`eod:${TODAY}`));
  const [attendance, setAttendance] = useState(() => cacheGet(`attendance:${TODAY}`));
  const [loading,    setLoading]    = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState(null);
  const [cachedAt,   setCachedAt]   = useState(() => getCachedAt("dashboard:summary"));

  const load = useCallback(async (force = false) => {
    if (!force && cacheGet("dashboard:summary")) return;
    force ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const [dash, eodRes, attRes] = await Promise.all([
        fetchDashboard(),
        fetchEOD(TODAY, force),
        fetchAttendance(TODAY, force),
      ]);
      cacheSet("dashboard:summary", dash,         TTL.MIN15);
      cacheSet(`eod:${TODAY}`,      eodRes.data,  TTL.MIN15);
      cacheSet(`attendance:${TODAY}`, attRes.data, TTL.MIN15);
      setSummary(dash);
      setEOD(eodRes.data);
      setAttendance(attRes.data);
      setCachedAt(getCachedAt("dashboard:summary"));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const hasCached = !!cacheGet("dashboard:summary");
    if (!hasCached) {
      load(false);
    } else {
      // Revalidate silently in background
      load(true);
    }
  }, [load]);

  const mainReports = eod?.main || [];
  const cbaReports  = eod?.cba  || [];

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Dashboard</h1>
          <p style={styles.sub}>Live overview of your VA team and today's report status.</p>
        </div>
      </div>

      {/* Cached banner */}
      <CachedBanner
        cachedAt={cachedAt}
        expiresInMin={CACHE_TTL_MIN}
        onRefresh={() => load(true)}
        refreshing={refreshing}
      />

      {/* Error */}
      {error && <p style={styles.error}>⚠ {error}</p>}

      {/* Stats */}
      {loading
        ? <LoadingSpinner fullPage />
        : <DashboardStats data={summary} />
      }

      {/* EOD Reports */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Today's EOD Reports — {formatDate(TODAY)}</h2>
        <div style={styles.twoCol}>
          <div>
            <p style={styles.colLabel}>Agency (Main)</p>
            <EODTable reports={mainReports} loading={loading} />
          </div>
          <div>
            <p style={styles.colLabel}>CBA</p>
            <EODTable reports={cbaReports} loading={loading} />
          </div>
        </div>
      </section>

      {/* Attendance */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Today's Attendance</h2>
        <AttendanceTable records={attendance} loading={loading} />
      </section>
    </div>
  );
}

const styles = {
  page: { display: "flex", flexDirection: "column", gap: "20px" },
  header: {
    display: "flex", alignItems: "flex-start",
    justifyContent: "space-between", flexWrap: "wrap", gap: "12px",
  },
  title: {
    fontSize: "26px", fontWeight: "700",
    color: colors.textPrimary, margin: 0,
  },
  sub: { fontSize: "14px", color: colors.textSecondary, margin: "4px 0 0" },
  error: { color: colors.red, fontSize: "14px" },
  section: { display: "flex", flexDirection: "column", gap: "12px" },
  sectionTitle: {
    fontSize: "16px", fontWeight: "600",
    color: colors.textPrimary, margin: 0,
  },
  twoCol: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
  },
  colLabel: {
    fontSize: "13px", fontWeight: "600",
    color: colors.textSecondary, marginBottom: "8px",
  },
};