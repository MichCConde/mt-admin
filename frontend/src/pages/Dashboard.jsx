import { useEffect, useState, useCallback } from "react";
import { fetchDashboard } from "../api/internal";
import DashboardStats from "../components/internal/DashboardStats";
import { Spinner, CachedBanner, ErrorBanner } from "../ui/Indicators";
import { todayISO } from "../utils/dates";
import { cacheGet, cacheSet, getCachedAt, TTL } from "../utils/cache";

export default function Dashboard() {
  const [data,       setData]       = useState(() => cacheGet("dash:summary"));
  const [loading,    setLoading]    = useState(!cacheGet("dash:summary"));
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState(null);
  const [cachedAt,   setCachedAt]   = useState(() => getCachedAt("dash:summary"));

  const load = useCallback(async (force = false) => {
    if (!force && cacheGet("dash:summary")) return;
    force ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const res = await fetchDashboard();
      cacheSet("dash:summary", res, TTL.MIN5);
      setData(res);
      setCachedAt(getCachedAt("dash:summary"));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
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

      <CachedBanner cachedAt={cachedAt} expiresInMin={5}
        onRefresh={() => load(true)} refreshing={refreshing} />
      <ErrorBanner message={error} />

      <DashboardStats data={data} />
    </div>
  );
}