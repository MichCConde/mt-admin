import { useState } from "react";
import VAList from "../components/va/VAList";
import EODTable from "../components/va/EODTable";
import AttendanceTable from "../components/va/AttendanceTable";
import CachedBanner from "../components/common/CachedBanner";
import { useVAList } from "../hooks/useVAList";
import { useEOD } from "../hooks/useEOD";
import { todayISO } from "../utils/dates";

export default function VirtualAssistants() {
  const [filter, setFilter] = useState("");
  const [tab,    setTab]    = useState("all"); // "all" | "agency" | "cba"
  const [date,   setDate]   = useState(todayISO());

  const { data: vas, loading: vasLoading, cachedAt, refreshing, refresh } = useVAList();
  const { eod, attendance, loading: eodLoading, refresh: refreshEOD } = useEOD(date);

  const filtered = vas.filter(v =>
    (tab === "all" || v.type?.toLowerCase() === tab) &&
    (v.name.toLowerCase().includes(filter.toLowerCase()) ||
     (v.client || "").toLowerCase().includes(filter.toLowerCase()))
  );

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Virtual Assistants</h1>
        <input
          className="search-input"
          placeholder="Search by name or client…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
      </div>

      <CachedBanner cachedAt={cachedAt} onRefresh={refresh} refreshing={refreshing} />

      <div className="tabs">
        {["all","agency","cba"].map(t => (
          <button
            key={t}
            className={`tab ${tab === t ? "tab-active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      <VAList vas={filtered} loading={vasLoading} />

      <div className="section">
        <div className="section-header">
          <h2 className="section-title">EOD Reports</h2>
          <input
            type="date"
            className="date-input"
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </div>
        <EODTable reports={eod?.main || []} loading={eodLoading} label="Agency" />
        <EODTable reports={eod?.cba  || []} loading={eodLoading} label="CBA" />
      </div>

      <div className="section">
        <h2 className="section-title">Attendance</h2>
        <AttendanceTable records={attendance} loading={eodLoading} />
      </div>

      <style>{`
        .page { display: flex; flex-direction: column; gap: 24px; }
        .page-header { display: flex; align-items: center;
          justify-content: space-between; flex-wrap: wrap; gap: 12px; }
        .page-title { font-size: 24px; font-weight: 700; color: #111827; }
        .search-input { padding: 8px 12px; border: 1px solid #d1d5db;
          border-radius: 8px; font-size: 14px; width: 240px; }
        .tabs { display: flex; gap: 8px; }
        .tab { padding: 6px 16px; border: 1px solid #d1d5db;
          border-radius: 20px; background: #fff; cursor: pointer;
          font-size: 13px; font-weight: 500; color: #6b7280; }
        .tab.tab-active { background: #4f46e5; color: #fff; border-color: #4f46e5; }
        .section { display: flex; flex-direction: column; gap: 14px; }
        .section-header { display: flex; align-items: center;
          justify-content: space-between; }
        .section-title { font-size: 17px; font-weight: 600; color: #111827; }
        .date-input { padding: 6px 10px; border: 1px solid #d1d5db;
          border-radius: 8px; font-size: 13px; }
      `}</style>
    </div>
  );
}