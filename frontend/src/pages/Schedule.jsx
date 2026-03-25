import { useEffect, useState } from "react";
import { fetchSchedules, fetchAvailable } from "../api/va";
import { Spinner } from "../ui/Indicators";
import { DataTable, Th, Td } from "../ui/Tables";
import { todayISO } from "../utils/dates";
import { cacheGet, cacheSet, TTL } from "../utils/cache";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TABS = ["Main Community", "CBA Community", "By VA", "Availability Finder"];

export default function Schedule() {
  const [tab,       setTab]       = useState("Main Community");
  const [schedules, setSchedules] = useState(() => cacheGet("schedules") || []);
  const [loading,   setLoading]   = useState(!cacheGet("schedules"));
  const [error,     setError]     = useState(null);
  const [findDate,  setFindDate]  = useState(todayISO());
  const [findTime,  setFindTime]  = useState("09:00");
  const [available, setAvailable] = useState(null);
  const [finding,   setFinding]   = useState(false);

  useEffect(() => {
    if (cacheGet("schedules")) { setLoading(false); return; }
    fetchSchedules()
      .then(res => {
        const data = res.schedules || [];
        cacheSet("schedules", data, TTL.H1);
        setSchedules(data);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleFind() {
    setFinding(true);
    try {
      const res = await fetchAvailable(findDate, findTime);
      setAvailable(res.available || []);
    } catch { setAvailable([]); }
    finally { setFinding(false); }
  }

  const main = schedules.filter(s => s.type === "Agency" || s.community === "Main");
  const cba  = schedules.filter(s => s.type === "CBA"    || s.community === "CBA");

  function DayGrid({ rows }) {
    return (
      <div className="schedule-grid">
        {DAYS.map(day => {
          const shifts = rows.filter(s => s.work_days?.includes(day));
          return (
            <div key={day} className="day-col">
              <div className="day-header">{day}</div>
              {shifts.length === 0
                ? <p className="empty-day">No shifts</p>
                : shifts.map(s => (
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
    );
  }

  return (
    <div className="page">
      <div>
        <h1 className="page-title">Schedule</h1>
        <p className="page-sub">View VA shift times across the week. All times are in EST.</p>
      </div>

      <div className="utabs">
        {TABS.map(t => (
          <button key={t} className={`utab ${tab === t ? "active" : ""}`}
            onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {error && <div className="banner-error">⚠ {error}</div>}

      {loading ? <Spinner fullPage /> : <>
        {tab === "Main Community"     && <DayGrid rows={main} />}
        {tab === "CBA Community"      && <DayGrid rows={cba} />}
        {tab === "By VA"              && (
          <div className="table-wrap">
            <DataTable>
              <thead>
                <tr><Th>VA Name</Th><Th>Work Days</Th><Th>Shift</Th><Th>Time</Th></tr>
              </thead>
              <tbody>
                {schedules.length === 0
                  ? <tr><td colSpan={4} className="empty">No schedules found.</td></tr>
                  : schedules.map(s => (
                      <tr key={s.id}>
                        <Td>{s.va_name}</Td>
                        <Td>{s.work_days?.join(", ") || "—"}</Td>
                        <Td>{s.shift || "—"}</Td>
                        <Td>{s.time_in} – {s.time_out}</Td>
                      </tr>
                    ))
                }
              </tbody>
            </DataTable>
          </div>
        )}
        {tab === "Availability Finder" && (
          <div className="card" style={{ maxWidth: 500 }}>
            <h2 className="section-title" style={{ marginBottom: 16 }}>Find Available VAs</h2>
            <div className="finder-row">
              <input type="date" className="input" value={findDate}
                onChange={e => setFindDate(e.target.value)} />
              <input type="time" className="input" value={findTime}
                onChange={e => setFindTime(e.target.value)} />
              <button className="btn btn-teal" onClick={handleFind} disabled={finding}>
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
        )}
      </>}
    </div>
  );
}