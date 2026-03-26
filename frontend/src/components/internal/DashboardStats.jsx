export default function DashboardStats({ data }) {
  if (!data) return null;

  // data.va_counts = { total, main, cba, no_contract }
  const counts = data.va_counts || {};
  const dist   = data.cba_distribution || [];

  const CARDS = [
    { key: "total",       label: "Total Active VAs", color: "var(--indigo)", bg: "var(--indigo-dim)" },
    { key: "main",        label: "Main Community",   color: "var(--teal)",   bg: "var(--teal-dim)"   },
    { key: "cba",         label: "CBA Community",    color: "var(--amber)",  bg: "var(--amber-dim)"  },
    { key: "no_contract", label: "No Contract",      color: "var(--red)",    bg: "var(--red-dim)"    },
  ];

  const missing     = data.missing || {};
  const missingList = missing.vas || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Top stat cards */}
      <div className="stat-grid">
        {CARDS.map(({ key, label, color, bg }) => (
          <div key={key} className="stat-card">
            <div className="stat-icon-wrap" style={{ background: bg }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke={color} strokeWidth="2">
                <circle cx="12" cy="8" r="4"/>
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
              </svg>
            </div>
            <div>
              <div className="stat-num" style={{ color }}>{counts[key] ?? "—"}</div>
              <div className="stat-lbl">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Left — CBA client distribution */}
        <div className="card card-pad">
          <p className="section-title" style={{ marginBottom: 14 }}>CBA Client Distribution</p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th style={{ textAlign: "left",  padding: "6px 0", fontSize: 11,
                  fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase",
                  letterSpacing: "0.5px" }}>Clients</th>
                <th style={{ textAlign: "right", padding: "6px 0", fontSize: 11,
                  fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase",
                  letterSpacing: "0.5px" }}>VAs</th>
              </tr>
            </thead>
            <tbody>
              {dist.map(row => (
                <tr key={row.label} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                  <td style={{ padding: "10px 0", color: "var(--text-2)", fontWeight: 500 }}>
                    {row.label}
                  </td>
                  <td style={{ padding: "10px 0", textAlign: "right" }}>
                    <span style={{ fontWeight: 700, fontSize: 16,
                      color: row.count > 0 ? "var(--indigo)" : "var(--text-3)" }}>
                      {row.count}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Right — Missing EOD yesterday */}
        <div className="card card-pad">
          <p className="section-title" style={{ marginBottom: 4 }}>Missing EOD Reports</p>
          <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 14 }}>
            {missing.date || "Yesterday"}
          </p>
          {!missingList.length ? (
            <p style={{ fontSize: 13, color: "var(--teal)" }}>All VAs submitted.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column",
              maxHeight: 280, overflowY: "auto" }}>
              {missingList.map((v, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 0", borderBottom: "1px solid var(--border-soft)",
                  fontSize: 13,
                }}>
                  <span style={{ fontWeight: 500, color: "var(--text-1)" }}>
                    {v.name}
                  </span>
                  <span className={`badge ${v.community === "CBA" ? "badge-cba" : "badge-main"}`}>
                    {v.community}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}