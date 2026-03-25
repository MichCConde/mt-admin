import { useState } from "react";
import { fetchEOWReport } from "../api/internal";
import { sendEOWEmail } from "../api/email";
import { Spinner, ErrorBanner, SuccessBanner, Badge } from "../ui/Indicators";
import { Table, Th, Td } from "../ui/Tables";
import { useAuth } from "../hooks/useAuth";
import { formatDate } from "../utils/dates";

// Get Monday and Saturday of current week
function currentWeekRange() {
  const today = new Date();
  const day   = today.getDay();
  const diff  = day === 0 ? -6 : 1 - day;
  const mon   = new Date(today); mon.setDate(today.getDate() + diff);
  const sat   = new Date(mon);   sat.setDate(mon.getDate() + 5);
  const fmt   = d => d.toISOString().split("T")[0];
  return { start: fmt(mon), end: fmt(sat) };
}

const TABS = ["All VAs", "By VA"];

export default function EOWReports() {
  const { start: defStart, end: defEnd } = currentWeekRange();
  const [tab,     setTab]     = useState("All VAs");
  const [start,   setStart]   = useState(defStart);
  const [end,     setEnd]     = useState(defEnd);
  const [report,  setReport]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error,   setError]   = useState(null);
  const [sent,    setSent]    = useState(false);
  const { isAdmin } = useAuth();

  async function generate() {
    setLoading(true); setError(null); setSent(false);
    try {
      // Convert date range to year/week for the backend
      const d    = new Date(start);
      const year = d.getFullYear();
      const jan4 = new Date(year, 0, 4);
      const week = Math.ceil(((d - jan4) / 86400000 + jan4.getDay() + 1) / 7);
      const res  = await fetchEOWReport(year, week, true);
      setReport(res);
    } catch (e) { setError(e.message); }
    finally    { setLoading(false); }
  }

  async function sendEmail() {
    setSending(true); setSent(false);
    try { await sendEOWEmail(); setSent(true); }
    catch (e) { setError(e.message); }
    finally   { setSending(false); }
  }

  const data = report?.data;

  // Collect all VAs that appear in missing lists across all days
  const allMissingByVA = {};
  if (data?.days) {
    for (const [date, day] of Object.entries(data.days)) {
      for (const v of (day.missing_eod || [])) {
        if (!allMissingByVA[v.va_name]) allMissingByVA[v.va_name] = { eod: [], att: [] };
        allMissingByVA[v.va_name].eod.push(date);
      }
      for (const v of (day.missing_attendance || [])) {
        if (!allMissingByVA[v.va_name]) allMissingByVA[v.va_name] = { eod: [], att: [] };
        allMissingByVA[v.va_name].att.push(date);
      }
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">EOW Reports</h1>
        <p className="page-sub">End-of-week summary of VA attendance, EOD submissions, and content flags.</p>
      </div>

      <div className="utabs">
        {TABS.map(t => (
          <button key={t} className={`utab ${tab === t ? "active" : ""}`}
            onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      {/* Controls */}
      <div className="eow-controls">
        <div className="eow-ctrl-group">
          <label className="eow-ctrl-label">Week Start (Mon)</label>
          <input type="date" className="inp" value={start}
            onChange={e => setStart(e.target.value)} />
        </div>
        <div className="eow-ctrl-group">
          <label className="eow-ctrl-label">Week End (Sat)</label>
          <input type="date" className="inp" value={end}
            onChange={e => setEnd(e.target.value)} />
        </div>
        <button className="btn btn-teal" onClick={generate} disabled={loading}
          style={{ alignSelf: "flex-end" }}>
          {loading
            ? <><Spinner /> Generating…</>
            : <>🔍 Generate Report</>}
        </button>
        {report && isAdmin && (
          <button className="btn btn-ghost" onClick={sendEmail} disabled={sending}
            style={{ alignSelf: "flex-end" }}>
            {sending ? "Sending…" : "✉ Send Email"}
          </button>
        )}
      </div>

      <ErrorBanner   message={error} />
      <SuccessBanner message={sent ? "EOW email sent to admin and HR." : null} />

      {loading && <Spinner full />}

      {!loading && data && (
        <>
          {/* Summary chips */}
          <div className="eow-stat-row">
            <span className="eow-stat-chip" style={{ background: "#eff6ff", color: "#1e40af" }}>
              📄 {data.summary?.total_reports ?? 0} reports
            </span>
            <span className="eow-stat-chip" style={{ background: "var(--amber-dim)", color: "#92400e" }}>
              ⚠️ {data.summary?.total_duplicates ?? 0} duplicates
            </span>
            <span className="eow-stat-chip" style={{ background: "var(--red-dim)", color: "#991b1b" }}>
              🚩 {data.summary?.total_flags ?? 0} flags
            </span>
          </div>

          {tab === "All VAs" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Missing by day */}
              <div className="eow-result-card">
                <p className="eow-result-title">Daily Breakdown</p>
                {Object.entries(data.days || {}).map(([date, day]) => (
                  <div key={date} className="eow-missing-row">
                    <p className="eow-missing-date">{formatDate(date)}</p>
                    <div className="eow-missing-list">
                      {day.missing_eod?.length > 0 && (
                        <p><span className="eow-miss-label">Missing EOD:</span>
                          {day.missing_eod.map(v => v.va_name).join(", ")}
                        </p>
                      )}
                      {day.missing_attendance?.length > 0 && (
                        <p><span className="eow-miss-label">Missing Clock-In:</span>
                          {day.missing_attendance.map(v => v.va_name).join(", ")}
                        </p>
                      )}
                      {!day.missing_eod?.length && !day.missing_attendance?.length && (
                        <p style={{ color: "var(--teal)", fontSize: 13 }}>✓ All present</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Flags */}
              {data.flags?.length > 0 && (
                <div className="eow-result-card">
                  <p className="eow-result-title">🚩 Flagged Comments</p>
                  <Table>
                    <thead>
                      <tr><Th>VA</Th><Th>Date</Th><Th>Keywords</Th></tr>
                    </thead>
                    <tbody>
                      {data.flags.map((f, i) => (
                        <tr key={i}>
                          <Td>{f.va_name}</Td>
                          <Td>{formatDate(f.date)}</Td>
                          <Td>{f.keywords.join(", ")}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}

              {/* Duplicates */}
              {data.duplicates?.length > 0 && (
                <div className="eow-result-card">
                  <p className="eow-result-title">⚠️ Duplicate / Copy-Paste Reports</p>
                  <Table>
                    <thead>
                      <tr><Th>VA</Th><Th>Type</Th><Th>Detail</Th></tr>
                    </thead>
                    <tbody>
                      {data.duplicates.map((d, i) => (
                        <tr key={i}>
                          <Td>{d.va_name}</Td>
                          <Td><Badge variant="amber">{d.type}</Badge></Td>
                          <Td>{d.detail}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </div>
          )}

          {tab === "By VA" && (
            <div className="eow-result-card">
              <p className="eow-result-title">VA Summary</p>
              {!Object.keys(allMissingByVA).length
                ? <p className="empty">No missing reports or clock-ins this week. 🎉</p>
                : (
                  <Table>
                    <thead>
                      <tr>
                        <Th>VA Name</Th>
                        <Th>Missing EOD</Th>
                        <Th>Missing Clock-In</Th>
                        <Th>Status</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(allMissingByVA).map(([name, rec]) => (
                        <tr key={name}>
                          <Td><span style={{ fontWeight: 600 }}>{name}</span></Td>
                          <Td>
                            {rec.eod.length
                              ? <Badge variant="red">{rec.eod.length} day{rec.eod.length > 1 ? "s" : ""}</Badge>
                              : <Badge variant="green">✓ OK</Badge>}
                          </Td>
                          <Td>
                            {rec.att.length
                              ? <Badge variant="amber">{rec.att.length} day{rec.att.length > 1 ? "s" : ""}</Badge>
                              : <Badge variant="green">✓ OK</Badge>}
                          </Td>
                          <Td>
                            {rec.eod.length + rec.att.length >= 3
                              ? <Badge variant="red">⚑ Flag</Badge>
                              : <Badge variant="default">Monitor</Badge>}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )
              }
            </div>
          )}
        </>
      )}

      {!loading && !data && !error && (
        <p className="empty">Select a date range and click "Generate Report".</p>
      )}
    </div>
  );
}