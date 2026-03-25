import { useState } from "react";
import { useVAList } from "../hooks/useVAList";
import { useEOD } from "../hooks/useEOD";
import { todayISO, formatDate } from "../utils/dates";
import { Spinner } from "../ui/Indicators";
import { DataTable, Th, Td } from "../ui/Tables";
import EODTable from "../components/va/EODTable";
import AttendanceTable from "../components/va/AttendanceTable";

const TABS = ["Active", "Agency (Main)", "CBA", "EOD Reports", "Attendance"];

export default function VirtualAssistants() {
  const [tab,  setTab]  = useState("Active");
  const [date, setDate] = useState(todayISO());

  const { data: vas, loading, error, refresh } = useVAList();
  const { eod, attendance, loading: eodLoading } = useEOD(date);

  const total       = vas.length;
  const multiClient = vas.filter(v => (v.clients || []).length >= 2).length;
  const mainCount   = vas.filter(v => v.type === "Agency").length;
  const cbaCount    = vas.filter(v => v.type === "CBA").length;

  const listMap = {
    "Active":        vas,
    "Agency (Main)": vas.filter(v => v.type === "Agency"),
    "CBA":           vas.filter(v => v.type === "CBA"),
  };

  function renderVATable(rows) {
    if (loading) return <Spinner fullPage />;
    return (
      <div className="table-wrap">
        {error && <div className="banner-error" style={{ margin: "12px 16px" }}>⚠ {error}</div>}
        <DataTable>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Schedule</Th>
              <Th>Community</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="empty">No VAs found.</td>
              </tr>
            ) : rows.map(v => (
              <tr key={v.id}>
                <Td>
                  <div className="va-name-primary">{v.name}</div>
                  {v.client && <div className="va-name-secondary">{v.client}</div>}
                </Td>
                <Td>{v.shift || "—"}</Td>
                <Td>
                  <span className={`badge badge-${v.type === "CBA" ? "cba" : "main"}`}>
                    {v.type === "CBA" ? "CBA" : "Main"}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </div>
    );
  }

  return (
    <div className="page">
      <div>
        <h1 className="page-title">Virtual Assistants</h1>
        <p className="page-sub">Directory of all active VAs with EOD report history and profile details.</p>
      </div>

      {/* Stat Pills */}
      <div className="va-pills">
        <Pill label="Total"              value={total}       color="#00c9a7" />
        <Pill label="VAs with 2+ Clients" value={multiClient} color="#4f46e5" />
        <Pill label="Main Community"     value={mainCount}   color="#4f46e5" />
        <Pill label="CBA Community"      value={cbaCount}    color="#f59e0b" />
      </div>

      {/* Tabs */}
      <div className="utabs">
        {TABS.map(t => (
          <button key={t} className={`utab ${tab === t ? "active" : ""}`}
            onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      {["Active","Agency (Main)","CBA"].includes(tab) && renderVATable(listMap[tab])}

      {tab === "EOD Reports" && (
        <div className="section">
          <div className="page-header">
            <h2 className="section-title">EOD Reports — {formatDate(date)}</h2>
            <input type="date" className="input input-sm" value={date}
              onChange={e => setDate(e.target.value)} />
          </div>
          <EODTable reports={eod?.main || []} loading={eodLoading} label="Agency (Main)" />
          <EODTable reports={eod?.cba  || []} loading={eodLoading} label="CBA" />
        </div>
      )}

      {tab === "Attendance" && (
        <div className="section">
          <div className="page-header">
            <h2 className="section-title">Attendance — {formatDate(date)}</h2>
            <input type="date" className="input input-sm" value={date}
              onChange={e => setDate(e.target.value)} />
          </div>
          <AttendanceTable records={attendance} loading={eodLoading} />
        </div>
      )}
    </div>
  );
}

function Pill({ label, value, color }) {
  return (
    <div className="va-pill">
      <span className="va-pill-dot" style={{ background: color }}>{value}</span>
      <span>{label}</span>
    </div>
  );
}