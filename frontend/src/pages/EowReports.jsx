import { useState } from "react";
import { fetchEOWReport } from "../api/internal";
import { sendEOWEmail } from "../api/email";
import EOWReport from "../components/internal/EOWReport";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { useAuth } from "../hooks/useAuth";

function currentWeek() {
  const now  = new Date();
  const year = now.getFullYear();
  const jan4 = new Date(year, 0, 4);
  const week = Math.ceil(((now - jan4) / 86400000 + jan4.getDay() + 1) / 7);
  return { year, week };
}

export default function EOWReports() {
  const { year: cYear, week: cWeek } = currentWeek();
  const [year,    setYear]    = useState(cYear);
  const [week,    setWeek]    = useState(cWeek);
  const [report,  setReport]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error,   setError]   = useState(null);
  const [sent,    setSent]    = useState(false);

  const { isAdmin } = useAuth();

  async function load(force = false) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchEOWReport(year, week, force);
      setReport(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendEmail() {
    setSending(true);
    setSent(false);
    try {
      await sendEOWEmail(year, week);
      setSent(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">EOW Reports</h1>
        <div className="controls">
          <input type="number" className="num-input" value={year}
            min={2024} max={2099} onChange={e => setYear(+e.target.value)} />
          <input type="number" className="num-input" value={week}
            min={1} max={53} onChange={e => setWeek(+e.target.value)} />
          <button className="btn-primary" onClick={() => load(false)} disabled={loading}>
            {loading ? "Loading…" : "Load Report"}
          </button>
          {report && isAdmin && (
            <button className="btn-secondary" onClick={handleSendEmail} disabled={sending}>
              {sending ? "Sending…" : "Send Email"}
            </button>
          )}
        </div>
      </div>

      {error && <p className="error-msg">{error}</p>}
      {sent  && <p className="success-msg">✓ EOW email sent to admin and HR.</p>}
      {loading ? <LoadingSpinner /> : report
        ? <EOWReport data={report.data} start={report.start} end={report.end} />
        : <p className="empty">Select a week and click "Load Report".</p>
      }

      <style>{`
        .page { display: flex; flex-direction: column; gap: 24px; }
        .page-header { display: flex; align-items: center;
          justify-content: space-between; flex-wrap: wrap; gap: 12px; }
        .page-title { font-size: 24px; font-weight: 700; color: #111827; }
        .controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .num-input { width: 80px; padding: 8px 10px; border: 1px solid #d1d5db;
          border-radius: 8px; font-size: 14px; }
        .btn-primary { padding: 8px 18px; background: #4f46e5; color: #fff;
          border: none; border-radius: 8px; cursor: pointer; font-size: 14px; }
        .btn-primary:hover:not(:disabled) { background: #4338ca; }
        .btn-secondary { padding: 8px 18px; background: #fff; color: #4f46e5;
          border: 1px solid #4f46e5; border-radius: 8px; cursor: pointer;
          font-size: 14px; }
        .btn-secondary:hover:not(:disabled) { background: #ede9fe; }
        .btn-primary:disabled, .btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }
        .error-msg { color: #dc2626; font-size: 14px; }
        .success-msg { color: #059669; font-size: 14px; }
        .empty { color: #9ca3af; font-size: 14px; }
      `}</style>
    </div>
  );
}