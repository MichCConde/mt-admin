import { useEffect, useState } from "react";
import { fetchSchedules, fetchAvailable } from "../api/va";
import { Spinner, ErrorBanner } from "../ui/Indicators";
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
      .then(r => { cacheSet("schedules", r.schedules || [], TTL.H1); setSchedules(r.schedules || []); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleFind = async () => {
    setFinding(true);
    try { const r = await fetchAvailable(findDate, findTime); setAvailable(r.available || []); }
    catch { setAvailable([]); }
    finally { setFinding(false); }
  };

  const main = schedules.filter(s => s.type === "Agency" || s.community === "Main");
  const cba  = schedules.filter(s => s.type === "CBA"    || s.community === "CBA");

  // Build a VA→days map for table view
  function buildTable(rows) {
    const map = {};
    for (const s of rows) {
      if (!map[s.va_name]) map[s.va_name] = { va_name: s.va_name, shift: s.shift, days: {} };
      for (const d of (s.work_days || [])) {
        map[s.va_name].days[d] = `${s.time_in || ""}–${s.time_out || ""}`;
      }
    }
    return Object.values(map);
  }

  function ScheduleTable({ rows }) {
    const tableData = buildTable(rows);
    if (!tableData.length) return <p className="empty">No schedules found.</p>;
    return (
      <div className="sched-table-wrap">
        <table className="sched-table">
          <thead>
            <tr>
              <th>VA Name</th>
              <th>Shift</th>
              {DAYS.map(d => <th key={d}>{d.slice(0, 3)}</th>)}
            </tr>
          </thead>
          <tbody>
            {tableData.map(row => (
              <tr key={row.va_name}>
                <td><span style={{ fontWeight: 600, color: "var(--text-1)" }}>{row.va_name}</span></td>
                <td>
                  {row.shift
                    ? <span className="badge badge-teal">{row.shift}</span>
                    : <span className="sched-empty-cell">—</span>}
                </td>
                {DAYS.map(d => (
                  <td key={d}>
                    {row.days[d]
                      ? <span className="sched-time-cell">
                          <span className="sched-dot" />
                          {row.days[d]}
                        </span>
                      : <span className="sched-empty-cell">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Schedule</h1>
        <p className="page-sub">View VA shift times across the week. All times are in EST.</p>
      </div>

      <div className="utabs">
        {TABS.map(t => (
          <button key={t} className={`utab ${tab === t ? "active" : ""}`}
            onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      <ErrorBanner message={error} />

      {loading ? <Spinner full /> : (
        <>
          {tab === "Main Community" && <ScheduleTable rows={main} />}
          {tab === "CBA Community"  && <ScheduleTable rows={cba}  />}
          {tab === "By VA"          && <ScheduleTable rows={schedules} />}
          {tab === "Availability Finder" && (
            <div className="card card-pad" style={{ maxWidth: 480 }}>
              <h2 className="section-title" style={{ marginBottom: 16 }}>Find Available VAs</h2>
              <div className="finder-row">
                <input type="date" className="inp" value={findDate}
                  onChange={e => setFindDate(e.target.value)} />
                <input type="time" className="inp" value={findTime}
                  onChange={e => setFindTime(e.target.value)} />
                <button className="btn btn-teal" onClick={handleFind} disabled={finding}>
                  {finding ? "Searching…" : "Find"}
                </button>
              </div>
              {available !== null && (
                <div className="finder-results">
                  {!available.length
                    ? <p className="empty" style={{ padding: "12px 0" }}>No VAs available.</p>
                    : available.map(s => (
                        <div key={s.id} className="res-pill">
                          {s.va_name}
                          {s.shift && <span className="res-pill-shift">{s.shift}</span>}
                        </div>
                      ))
                  }
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}