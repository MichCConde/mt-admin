const STATS = [
  { key: "total_active", label: "Total Active VAs", color: "#4f46e5", bg: "#ede9fe", icon: "👥" },
  { key: "agency_count", label: "Main Community",   color: "#00c9a7", bg: "#e6faf6", icon: "👤" },
  { key: "cba_count",    label: "CBA Community",    color: "#f59e0b", bg: "#fef3c7", icon: "👤" },
  { key: "no_client",    label: "Missing Reports",  color: "#ef4444", bg: "#fee2e2", icon: "👤" },
];

export default function DashboardStats({ data }) {
  if (!data) return null;
  return (
    <div className="stats-grid">
      {STATS.map(({ key, label, color, bg, icon }) => (
        <div key={key} className="stat-card">
          <div className="stat-icon" style={{ background: bg }}>
            <span>{icon}</span>
          </div>
          <div>
            <div className="stat-value" style={{ color }}>{data[key] ?? "—"}</div>
            <div className="stat-label">{label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}