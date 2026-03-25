import { Spinner } from "../../ui/Indicators";

const ACTION_COLORS = {
  email_sent:  "#4f46e5",
  sync:        "#00c9a7",
  report_view: "#718096",
  flag_added:  "#f59e0b",
};

export default function ActivityLog({ logs = [], loading }) {
  if (loading) return <Spinner />;
  if (!logs.length) return <p className="empty">No activity yet.</p>;
  return (
    <div className="log-list">
      {logs.map((log, i) => (
        <div key={i} className="log-item">
          <span className="log-dot"
            style={{ background: ACTION_COLORS[log.action] || "#9ca3af" }} />
          <div className="log-body">
            <span className="log-action">{log.action}</span>
            {log.detail && (
              <span className="log-detail">{JSON.stringify(log.detail)}</span>
            )}
          </div>
          <span className="log-time">{log.created_at || "—"}</span>
        </div>
      ))}
    </div>
  );
}