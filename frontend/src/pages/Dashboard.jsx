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
      cacheSet("dashboard:summary", dash,           TTL.MIN15);
      cacheSet(`eod:${TODAY}`,      eodRes.data,    TTL.MIN15);
      cacheSet(`attendance:${TODAY}`, attRes.data,  TTL.MIN15);
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
    if (!cacheGet("dashboard:summary")) load(false);
    else load(true);
  }, [load]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">Live overview of your VA team and today's report status.</p>
        </div>
      </div>

      <CachedBanner
        cachedAt={cachedAt}
        expiresInMin={CACHE_TTL_MIN}
        onRefresh={() => load(true)}
        refreshing={refreshing}
      />

      {error && <div className="banner-error">⚠ {error}</div>}

      {loading
        ? <LoadingSpinner fullPage />
        : <DashboardStats data={summary} />
      }

      <section className="section">
        <h2 className="section-title">Today's EOD Reports — {formatDate(TODAY)}</h2>
        <div className="two-col">
          <div>
            <p className="col-label">Agency (Main)</p>
            <EODTable reports={eod?.main || []} loading={loading} />
          </div>
          <div>
            <p className="col-label">CBA</p>
            <EODTable reports={eod?.cba || []} loading={loading} />
          </div>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Today's Attendance</h2>
        <AttendanceTable records={attendance} loading={loading} />
      </section>
    </div>
  );
}