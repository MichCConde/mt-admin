import { useState } from "react";
import { useVAList } from "../hooks/useVAList";
import { todayISO, formatDate } from "../utils/dates";
import { Spinner, ErrorBanner } from "../ui/Indicators";
import { Table, Th, Td } from "../ui/Tables";

const TABS = ["Active", "Main", "CBA", "EOD Reports", "Attendance"];

export default function VirtualAssistants() {
  const [tab,  setTab]  = useState("Active");
  const [date, setDate] = useState(todayISO());
  const [eodData, setEodData]  = useState(null);
  const [attData, setAttData]  = useState(null);
  const [fetching, setFetching] = useState(false);

  const { data: vas, loading, error } = useVAList();

  const mainVAs = vas.filter(v => v.community === "Main");
  const cbaVAs  = vas.filter(v => v.community === "CBA");
  const multiClient = vas.filter(v => (v.contracts || []).length >= 2).length;

  const lists = { "Active": vas, "Main": mainVAs, "CBA": cbaVAs };

  async function loadEOD(d) {
    setFetching(true);
    try {
      const { apiFetch } = await import("../api/internal");
      const [eodRes, attRes] = await Promise.all([
        apiFetch(`/api/eod?date=${d}`),
        apiFetch(`/api/attendance?date=${d}`),
      ]);
      setEodData(eodRes);
      setAttData(attRes);
    } catch (e) {
      console.error(e);
    } finally {
      setFetching(false);
    }
  }

  function handleDateChange(e) {
    setDate(e.target.value);
    loadEOD(e.target.value);
  }

  function handleTabChange(t) {
    setTab(t);
    if ((t === "EOD Reports" || t === "Attendance") && !eodData) {
      loadEOD(date);
    }
  }

  function VATable({ rows }) {
    if (loading) return <Spinner full />;
    return (
      <Table>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Schedule</Th>
            <Th>Shift Time</Th>
            <Th>Client(s)</Th>
            <Th>Community</Th>
          </tr>
        </thead>
        <tbody>
          {!rows.length
            ? <tr><td colSpan={5} className="tbl-empty">No VAs found.</td></tr>
            : rows.map(v => (
                <tr key={v.id}>
                  <Td>
                    <div className="va-cell-name">{v.name}</div>
                  </Td>
                  <Td>
                    <span style={{ fontSize: 13, color: "var(--text-2)" }}>
                      {v.schedule || "—"}
                    </span>
                  </Td>
                  <Td>
                    <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                      {v.shift_time || "—"}
                    </span>
                  </Td>
                  <Td>
                    {(v.contracts || []).length
                      ? (v.contracts || []).map((c, i) => (
                          <div key={i} style={{ fontSize: 13 }}>{c.client_name}</div>
                        ))
                      : <span style={{ color: "var(--text-3)", fontSize: 13 }}>No contract</span>
                    }
                  </Td>
                  <Td>
                    <span className={`badge ${v.community === "CBA" ? "badge-cba" : "badge-main"}`}>
                      {v.community || "—"}
                    </span>
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
          { label: "Total",               val: vas.length,     color: "var(--teal)"   },
          { label: "VAs with 2+ Clients", val: multiClient,    color: "var(--indigo)" },
          { label: "Main Community",      val: mainVAs.length, color: "var(--indigo)" },
          { label: "CBA Community",       val: cbaVAs.length,  color: "var(--amber)"  },
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
            onClick={() => handleTabChange(t)}>{t}</button>
        ))}
      </div>

      <ErrorBanner message={error} />

      {["Active","Main","CBA"].includes(tab) && <VATable rows={lists[tab] || []} />}

      {tab === "EOD Reports" && (
        <div className="section">
          <div className="page-row">
            <h2 className="section-title">EOD Reports — {formatDate(date)}</h2>
            <input type="date" className="inp inp-sm" value={date}
              onChange={handleDateChange} />
          </div>
          {fetching ? <Spinner full /> : eodData ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)",
                  textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
                  Main Community
                </p>
                <EodMiniTable reports={(eodData.eod_submissions || []).filter(r => r.community === "Main")} />
              </div>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-3)",
                  textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>
                  CBA Community
                </p>
                <EodMiniTable reports={(eodData.eod_submissions || []).filter(r => r.community === "CBA")} />
              </div>
            </div>
          ) : <p className="empty">Select a date to load reports.</p>}
        </div>
      )}

      {tab === "Attendance" && (
        <div className="section">
          <div className="page-row">
            <h2 className="section-title">Attendance — {formatDate(date)}</h2>
            <input type="date" className="inp inp-sm" value={date}
              onChange={handleDateChange} />
          </div>
          {fetching ? <Spinner full /> : attData ? (
            <AttMiniTable clockIns={attData.clock_ins || []} clockOuts={attData.clock_outs || []} />
          ) : <p className="empty">Select a date to load attendance.</p>}
        </div>
      )}
    </div>
  );
}

function EodMiniTable({ reports }) {
  if (!reports.length) return <p className="empty">No reports found.</p>;
  return (
    <Table>
      <thead>
        <tr><Th>Name</Th><Th>Time In</Th><Th>Time Out</Th></tr>
      </thead>
      <tbody>
        {reports.map(r => (
          <tr key={r.id}>
            <Td><span className="va-cell-name">{r.name}</span></Td>
            <Td>{r.time_in  || "—"}</Td>
            <Td>{r.time_out || "—"}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function AttMiniTable({ clockIns, clockOuts }) {
  const all = [...clockIns, ...clockOuts];
  if (!all.length) return <p className="empty">No attendance records.</p>;
  return (
    <Table>
      <thead>
        <tr><Th>Name</Th><Th>Type</Th><Th>Time</Th></tr>
      </thead>
      <tbody>
        {all.map(r => (
          <tr key={r.id}>
            <Td><span className="va-cell-name" style={{ textTransform: "capitalize" }}>{r.last_name}</span></Td>
            <Td><span className={`badge ${r.type === "IN" ? "badge-teal" : "badge-gray"}`}>{r.type}</span></Td>
            <Td>{r.created_time ? new Date(r.created_time).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"}) : "—"}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}