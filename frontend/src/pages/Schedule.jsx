import { useEffect, useState } from "react";
import { fetchSchedules, fetchAvailable } from "../api/va";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { todayISO } from "../utils/dates";
import { cacheGet, cacheSet, TTL } from "../utils/cache";

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

export default function Schedule() {
  const [schedules, setSchedules] = useState(() => cacheGet("schedules") || []);
  const [loading,   setLoading]   = useState(!cacheGet("schedules"));

  // Availability finder state
  const [findDate, setFindDate] = useState(todayISO());
  const [findTime, setFindTime] = useState("09:00");
  const [available, setAvailable] = useState(null);
  const [finding,   setFinding]   = useState(false);

  useEffect(() => {
    if (cacheGet("schedules")) return;
    fetchSchedules().then(res => {
      cacheSet("schedules", res.schedules, TTL.H1);
      setSchedules(res.schedules);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function handleFind() {
    setFinding(true);
    try {
      const res = await fetchAvailable(findDate, findTime);
      setAvailable(res.available || []);
    } catch {
      setAvailable([]);
    } finally {
      setFinding(false);
    }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page">
      <h1 className="page-title">Schedule</h1>

      {/* Availability Finder */}
      <div className="finder-card">
        <h2 className="finder-title">Find Available VAs</h2>
        <div className="finder-row">
          <input type="date" className="date-input" value={findDate}
            onChange={e => setFindDate(e.target.value)} />
          <input type="time" className="date-input" value={findTime}
            onChange={e => setFindTime(e.target.value)} />
          <button className="find-btn" onClick={handleFind} disabled={finding}>
            {finding ? "Searching…" : "Find"}
          </button>
        </div>
        {available !== null && (
          <div className="finder-results">
            {available.length === 0
              ? <p className="empty">No VAs available at that time.</p>
              : available.map(s => (
                  <div key={s.id} className="result-pill">
                    {s.va_name}
                    <span className="result-shift">{s.shift}</span>
                  </div>
                ))
            }
          </div>
        )}
      </div>

      {/* Weekly Schedule Grid */}
      <div className="schedule-grid">
        {DAYS.map(day => {
          const daySchedules = schedules.filter(s =>
            s.work_days?.includes(day)
          );
          return (
            <div key={day} className="day-col">
              <div className="day-header">{day}</div>
              {daySchedules.length === 0
                ? <p className="empty-day">—</p>
                : daySchedules.map(s => (
                    <div key={s.id} className="schedule-pill">
                      <span className="sched-name">{s.va_name}</span>
                      <span className="sched-time">{s.time_in} – {s.time_out}</span>
                    </div>
                  ))
              }
            </div>
          );
        })}
      </div>

      <style>{`
        .page { display: flex; flex-direction: column; gap: 24px; }
        .page-title { font-size: 24px; font-weight: 700; color: #111827; }
        .finder-card { background: #fff; border: 1px solid #e5e7eb;
          border-radius: 12px; padding: 20px;
          display: flex; flex-direction: column; gap: 14px; }
        .finder-title { font-size: 16px; font-weight: 600; color: #374151; }
        .finder-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
        .date-input { padding: 8px 10px; border: 1px solid #d1d5db;
          border-radius: 8px; font-size: 14px; }
        .find-btn { padding: 8px 20px; background: #4f46e5; color: #fff;
          border: none; border-radius: 8px; cursor: pointer; font-size: 14px; }
        .find-btn:hover:not(:disabled) { background: #4338ca; }
        .find-btn:disabled { opacity: 0.5; }
        .finder-results { display: flex; flex-wrap: wrap; gap: 8px; }
        .result-pill { display: flex; align-items: center; gap: 8px;
          background: #ede9fe; color: #5b21b6; padding: 6px 14px;
          border-radius: 20px; font-size: 13px; font-weight: 500; }
        .result-shift { background: #c4b5fd; border-radius: 10px;
          padding: 1px 8px; font-size: 12px; }
        .schedule-grid { display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px; }
        .day-col { background: #fff; border: 1px solid #e5e7eb;
          border-radius: 10px; overflow: hidden; }
        .day-header { background: #4f46e5; color: #fff; padding: 8px 12px;
          font-size: 13px; font-weight: 600; }
        .schedule-pill { padding: 8px 12px; border-bottom: 1px solid #f3f4f6;
          display: flex; flex-direction: column; gap: 2px; }
        .sched-name { font-size: 13px; font-weight: 500; color: #111827; }
        .sched-time { font-size: 11px; color: #6b7280; }
        .empty-day { font-size: 12px; color: #d1d5db; padding: 8px 12px; }
        .empty { font-size: 13px; color: #9ca3af; }
      `}</style>
    </div>
  );
}