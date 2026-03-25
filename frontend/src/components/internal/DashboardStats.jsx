const STATS = [
  { key: "total_active", label: "Total Active VAs", color: "var(--indigo)", bg: "var(--indigo-dim)", icon: "👥" },
  { key: "agency_count", label: "Main Community",   color: "var(--teal)",   bg: "var(--teal-dim)",   icon: "👤" },
  { key: "cba_count",    label: "CBA Community",    color: "var(--amber)",  bg: "var(--amber-dim)",  icon: "👤" },
  { key: "no_client",    label: "Missing Reports",  color: "var(--red)",    bg: "var(--red-dim)",    icon: "⚠️" },
];

export default function DashboardStats({ data }) {
  if (!data) return null;
  return (
    <div className="stat-grid">
      {STATS.map(({ key, label, color, bg, icon }) => (
        <div key={key} className="stat-card">
          <div className="stat-icon-wrap" style={{ background: bg }}>
            <span style={{ fontSize: 22 }}>{icon}</span>
          </div>
          <div>
            <div className="stat-num" style={{ color }}>{data[key] ?? "—"}</div>
            <div className="stat-lbl">{label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}