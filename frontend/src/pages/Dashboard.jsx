import { useEffect, useState, useCallback } from "react";
import { fetchDashboard } from "../api/internal";
import { fetchEOD, fetchAttendance } from "../api/va";
import DashboardStats from "../components/internal/DashboardStats";
import EODTable from "../components/va/EODTable";
import AttendanceTable from "../components/va/AttendanceTable";
import { Spinner, CachedBanner, ErrorBanner } from "../ui/Indicators";
import { todayISO, formatDate } from "../utils/dates";
import { cacheGet, cacheSet, getCachedAt, TTL } from "../utils/cache";

const TODAY = todayISO();

export default function Dashboard() {
  const [summary,    setSummary]    = useState(() => cacheGet("dash:summary"));
  const [eod,        setEOD]        = useState(() => cacheGet(`eod:${TODAY}`));
  const [attendance, setAttendance] = useState(() => cacheGet(`att:${TODAY}`));
  const [loading,    setLoading]    = useState(!cacheGet("dash:summary"));
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState(null);
  const [cachedAt,   setCachedAt]   = useState(() => getCachedAt("dash:summary"));

  const load = useCallback(async (force = false) => {
    if (!force && cacheGet("dash:summary")) return;
    force ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const [dash, eodRes, attRes] = await Promise.all([
        fetchDashboard(),
        fetchEOD(TODAY, force),
        fetchAttendance(TODAY, force),
      ]);
      cacheSet("dash:summary",  dash,         TTL.MIN15);
      cacheSet(`eod:${TODAY}`,  eodRes.data,  TTL.MIN15);
      cacheSet(`att:${TODAY}`,  attRes.data,  TTL.MIN15);
      setSummary(dash);
      setEOD(eodRes.data);
      setAttendance(attRes.data);
      setCachedAt(getCachedAt("dash:summary"));
    } catch (e) { setError(e.message); }
    finally     { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    cacheGet("dash:summary") ? load(true) : load(false);
  }, [load]);

  if (loading) return <Spinner full />;

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-sub">Live overview of your VA team and today's report status.</p>
      </div>

      <CachedBanner cachedAt={cachedAt} expiresInMin={15}
        onRefresh={() => load(true)} refreshing={refreshing} />
      <ErrorBanner message={error} />

      <DashboardStats data={summary} />

      <div className="section">
        <div className="page-row">
          <h2 className="section-title">Today's EOD Reports — {formatDate(TODAY)}</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)",
              textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
              Agency (Main)
            </p>
            <EODTable reports={eod?.main || []} loading={false} />
          </div>
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)",
              textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
              CBA
            </p>
            <EODTable reports={eod?.cba || []} loading={false} />
          </div>
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Today's Attendance</h2>
        <AttendanceTable records={attendance} loading={false} />
      </div>
    </div>
  );
}