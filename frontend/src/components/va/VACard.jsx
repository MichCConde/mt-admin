export default function VACard({ va }) {
  const color = va.type === "CBA" ? "#f59e0b" : "#4f46e5";
  return (
    <div className="va-card">
      <div className="va-card-header">
        <span className="va-name">{va.name}</span>
        <span className="va-type-badge" style={{ background: color }}>{va.type}</span>
      </div>
      <div className="va-detail">
        <span>👤 {va.community || "—"}</span>
        <span>💼 {va.client || "No client"}</span>
      </div>
    </div>
  );
}