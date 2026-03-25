import { useState } from "react";
import { useVAList } from "../hooks/useVAList";
import { useEOD } from "../hooks/useEOD";
import { todayISO, formatDate } from "../utils/dates";
import { Spinner, ErrorBanner, Badge } from "../ui/Indicators";
import { Table, Th, Td } from "../ui/Tables";
import EODTable from "../components/va/EODTable";
import AttendanceTable from "../components/va/AttendanceTable";

const TABS = ["Active", "Agency (Main)", "CBA", "EOD Reports", "Attendance"];

export default function VirtualAssistants() {
  const [tab,  setTab]  = useState("Active");
  const [date, setDate] = useState(todayISO());

  const { data: vas, loading, error } = useVAList();
  const { eod, attendance, loading: eodLoading } = useEOD(date);

  const lists = {
    "Active":        vas,
    "Agency (Main)": vas.filter(v => v.type === "Agency"),
    "CBA":           vas.filter(v => v.type === "CBA"),
  };

  const total       = vas.length;
  const multiClient = vas.filter(v => (v.clients || []).length >= 2).length;
  const mainCount   = vas.filter(v => v.type === "Agency").length;
  const cbaCount    = vas.filter(v => v.type === "CBA").length;

  function VATable({ rows }) {
    if (loading) return <Spinner full />;
    return (
      <Table>
        <thead>
          <tr><Th>Name</Th><Th>Schedule</Th><Th>Community</Th></tr>
        </thead>
        <tbody>
          {!rows.length
            ? <tr><td colSpan={3} className="tbl-empty">No VAs found.</td></tr>
            : rows.map(v => (
                <tr key={v.id}>
                  <Td>
                    <div className="va-cell-name">{v.name}</div>
                    {v.client && <div className="va-cell-meta">{v.client}</div>}
                  </Td>
                  <Td>{v.shift || "—"}</Td>
                  <Td>
                    <Badge variant={v.type === "CBA" ? "cba" : "main"}>
                      {v.type === "CBA" ? "CBA" : "Main"}
                    </Badge>
                  </Td>
                </tr>
              ))
          }
        </tbody>
      </Table>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Virtual Assistants</h1>
        <p className="page-sub">Directory of all active VAs with EOD report history and profile details.</p>
      </div>

      <div className="va-pills">
        {[
          { label: "Total",              val: total,       color: "var(--teal)"   },
          { label: "VAs with 2+ Clients",val: multiClient, color: "var(--indigo)" },
          { label: "Main Community",     val: mainCount,   color: "var(--indigo)" },
          { label: "CBA Community",      val: cbaCount,    color: "var(--amber)"  },
        ].map(p => (
          <div key={p.label} className="va-pill">
            <span className="va-pill-dot" style={{ background: p.color }}>{p.val}</span>
            <span>{p.label}</span>
          </div>
        ))}
      </div>

      <div className="utabs">
        {TABS.map(t => (
          <button key={t} className={`utab ${tab === t ? "active" : ""}`}
            onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      <ErrorBanner message={error} />

      {["Active","Agency (Main)","CBA"].includes(tab) && <VATable rows={lists[tab]} />}

      {tab === "EOD Reports" && (
        <div className="section">
          <div className="page-row">
            <h2 className="section-title">EOD Reports — {formatDate(date)}</h2>
            <input type="date" className="inp inp-sm" value={date}
              onChange={e => setDate(e.target.value)} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <p style={{ fontSize:12, fontWeight:600, color:"var(--text-3)",
                textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:8 }}>Agency (Main)</p>
              <EODTable reports={eod?.main || []} loading={eodLoading} />
            </div>
            <div>
              <p style={{ fontSize:12, fontWeight:600, color:"var(--text-3)",
                textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:8 }}>CBA</p>
              <EODTable reports={eod?.cba  || []} loading={eodLoading} />
            </div>
          </div>
        </div>
      )}

      {tab === "Attendance" && (
        <div className="section">
          <div className="page-row">
            <h2 className="section-title">Attendance — {formatDate(date)}</h2>
            <input type="date" className="inp inp-sm" value={date}
              onChange={e => setDate(e.target.value)} />
          </div>
          <AttendanceTable records={attendance} loading={eodLoading} />
        </div>
      )}
    </div>
  );
}