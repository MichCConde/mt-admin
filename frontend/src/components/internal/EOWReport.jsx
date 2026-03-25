import { formatDate } from "../../utils/dates";

function Section({ title, children }) {
  return (
    <div className="eow-section">
      <h3 className="eow-section-title">{title}</h3>
      {children}
    </div>
  );
}

function FlagTable({ flags }) {
  if (!flags?.length) return <p className="empty">No flags this week.</p>;
  return (
    <table className="data-table">
      <thead>
        <tr><th>VA</th><th>Date</th><th>Keywords</th></tr>
      </thead>
      <tbody>
        {flags.map((f, i) => (
          <tr key={i}>
            <td>{f.va_name}</td>
            <td>{formatDate(f.date)}</td>
            <td>{f.keywords.join(", ")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DupTable({ dups }) {
  if (!dups?.length) return <p className="empty">No duplicates found.</p>;
  return (
    <table className="data-table">
      <thead>
        <tr><th>VA</th><th>Type</th><th>Detail</th></tr>
      </thead>
      <tbody>
        {dups.map((d, i) => (
          <tr key={i}>
            <td>{d.va_name}</td>
            <td><span className="badge badge-dup">{d.type}</span></td>
            <td>{d.detail}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function EOWReport({ data, start, end }) {
  if (!data) return null;

  const { summary, duplicates, flags, days } = data;

  return (
    <div className="eow-report">
      <div className="eow-header">
        <h2>EOW Report</h2>
        <span className="eow-range">{formatDate(start)} — {formatDate(end)}</span>
      </div>

      <div className="eow-summary">
        <div className="summary-pill">📄 {summary.total_reports} reports</div>
        <div className="summary-pill warn">⚠️ {summary.total_duplicates} duplicates</div>
        <div className="summary-pill danger">🚩 {summary.total_flags} flags</div>
      </div>

      <Section title="Flagged Comments">
        <FlagTable flags={flags} />
      </Section>

      <Section title="Duplicate / Copy-Paste Reports">
        <DupTable dups={duplicates} />
      </Section>

      <Section title="Daily Breakdown">
        {Object.entries(days || {}).map(([date, day]) => (
          <div key={date} className="day-block">
            <h4>{formatDate(date)}</h4>
            {day.missing_eod?.length > 0 && (
              <p className="missing-label">
                Missing EOD: {day.missing_eod.map(v => v.va_name).join(", ")}
              </p>
            )}
            {day.missing_attendance?.length > 0 && (
              <p className="missing-label">
                Missing Clock-In: {day.missing_attendance.map(v => v.va_name).join(", ")}
              </p>
            )}
          </div>
        ))}
      </Section>

      <style>{`
        .eow-report { display: flex; flex-direction: column; gap: 24px; }
        .eow-header { display: flex; align-items: baseline; gap: 14px; }
        .eow-header h2 { font-size: 20px; font-weight: 700; color: #111827; }
        .eow-range { font-size: 14px; color: #6b7280; }
        .eow-summary { display: flex; gap: 10px; flex-wrap: wrap; }
        .summary-pill { padding: 6px 14px; border-radius: 20px;
          background: #f0f9ff; color: #0c4a6e; font-size: 13px; font-weight: 500; }
        .summary-pill.warn { background: #fffbeb; color: #92400e; }
        .summary-pill.danger { background: #fff1f2; color: #881337; }
        .eow-section { background: #fff; border: 1px solid #e5e7eb;
          border-radius: 12px; padding: 20px; }
        .eow-section-title { font-size: 15px; font-weight: 600;
          color: #374151; margin-bottom: 14px; }
        .data-table { width: 100%; border-collapse: collapse; font-size: 14px; }
        .data-table th { background: #f9fafb; padding: 10px 12px;
          text-align: left; font-weight: 600; color: #374151;
          border-bottom: 2px solid #e5e7eb; }
        .data-table td { padding: 10px 12px; border-bottom: 1px solid #f3f4f6; }
        .badge { padding: 2px 8px; border-radius: 10px; font-size: 12px; }
        .badge-dup { background: #fef3c7; color: #92400e; }
        .day-block { padding: 10px 0; border-bottom: 1px solid #f3f4f6; }
        .day-block h4 { font-size: 13px; font-weight: 600;
          color: #374151; margin-bottom: 4px; }
        .missing-label { font-size: 13px; color: #dc2626; margin: 2px 0; }
        .empty { font-size: 13px; color: #9ca3af; }
      `}</style>
    </div>
  );
}