import { useEffect, useState } from "react";
import { fetchActivityLogs } from "../api/internal";
import ActivityLog from "../components/internal/ActivityLog";
import LoadingSpinner from "../components/common/LoadingSpinner";

export default function ActivityLogs() {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [limit,   setLimit]   = useState(50);

  async function load() {
    setLoading(true);
    try {
      const res = await fetchActivityLogs(limit);
      setLogs(res.logs || []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [limit]);

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Activity Logs</h1>
        <div className="controls">
          <select className="select-input" value={limit}
            onChange={e => setLimit(+e.target.value)}>
            <option value={25}>25 entries</option>
            <option value={50}>50 entries</option>
            <option value={100}>100 entries</option>
            <option value={200}>200 entries</option>
          </select>
          <button className="btn-refresh" onClick={load} disabled={loading}>
            ↻ Refresh
          </button>
        </div>
      </div>

      <div className="log-card">
        {loading ? <LoadingSpinner /> : <ActivityLog logs={logs} loading={false} />}
      </div>

      <style>{`
        .page { display: flex; flex-direction: column; gap: 24px; }
        .page-header { display: flex; align-items: center;
          justify-content: space-between; flex-wrap: wrap; gap: 12px; }
        .page-title { font-size: 24px; font-weight: 700; color: #111827; }
        .controls { display: flex; gap: 8px; align-items: center; }
        .select-input { padding: 7px 10px; border: 1px solid #d1d5db;
          border-radius: 8px; font-size: 14px; }
        .btn-refresh { padding: 7px 14px; border: 1px solid #d1d5db;
          border-radius: 8px; background: #fff; cursor: pointer; font-size: 14px; }
        .btn-refresh:hover:not(:disabled) { background: #f9fafb; }
        .log-card { background: #fff; border: 1px solid #e5e7eb;
          border-radius: 12px; padding: 20px; }
      `}</style>
    </div>
  );
}