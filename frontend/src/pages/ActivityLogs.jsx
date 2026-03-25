import { useEffect, useState } from "react";
import { fetchActivityLogs } from "../api/internal";
import { Spinner } from "../ui/Indicators";

const TYPE_CONFIG = {
  email_sent:  { label: "Email Sent",  color: "#7c3aed", bg: "#ede9fe" },
  eod_check:   { label: "EOD Check",   color: "#0d9488", bg: "#ccfbf1" },
  sign_in:     { label: "Sign In",     color: "#0d9488", bg: "#ccfbf1" },
  sync:        { label: "Sync",        color: "#0d9488", bg: "#ccfbf1" },
  flag_added:  { label: "Flag Added",  color: "#b45309", bg: "#fef3c7" },
};

function getCfg(action = "") {
  return TYPE_CONFIG[action.toLowerCase().replace(/ /g, "_")]
    || { label: action, color: "#374151", bg: "#f3f4f6" };
}

function groupByDate(logs) {
  const out = {};
  for (const log of logs) {
    const raw = log.created_at || "";
    const key = raw
      ? new Date(raw).toLocaleDateString("en-US", {
          weekday: "long", year: "numeric", month: "long", day: "numeric"
        }).toUpperCase()
      : "UNKNOWN DATE";
    (out[key] = out[key] || []).push(log);
  }
  return out;
}

function timeAgo(raw) {
  if (!raw) return "";
  const m = Math.floor((Date.now() - new Date(raw)) / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fullDT(raw) {
  if (!raw) return "";
  return new Date(raw).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

export default function ActivityLogs() {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState("all");

  async function load() {
    setLoading(true);
    try {
      const res = await fetchActivityLogs(200);
      setLogs(res.logs || []);
    } catch { setLogs([]); }
    finally  { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const types    = ["all", ...new Set(logs.map(l => l.action).filter(Boolean))];
  const filtered = filter === "all" ? logs : logs.filter(l => l.action === filter);
  const grouped  = groupByDate(filtered);

  return (
    <div className="page">
      <div>
        <h1 className="page-title">Activity Logs</h1>
        <p className="page-sub">{logs.length} events recorded</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 500 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Filter by Type</label>
        <select className="select" value={filter} onChange={e => setFilter(e.target.value)}>
          {types.map(t => (
            <option key={t} value={t}>
              {t === "all" ? "All Types" : getCfg(t).label}
            </option>
          ))}
        </select>
      </div>

      <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading}
        style={{ alignSelf: "flex-start" }}>
        ↻ Refresh
      </button>

      {loading ? <Spinner fullPage /> : (
        <div className="activity-feed">
          {Object.entries(grouped).map(([dateLabel, entries]) => (
            <div key={dateLabel} className="activity-group">
              <p className="activity-date-label">{dateLabel}</p>
              <div className="activity-card">
                {entries.map((log, i) => {
                  const cfg = getCfg(log.action);
                  const ts  = log.created_at || "";
                  const desc = log.detail?.description
                    || log.detail?.type
                    || (typeof log.detail === "string" ? log.detail : "")
                    || log.action;
                  return (
                    <div key={i} className="activity-row">
                      <span className="activity-dot" style={{ background: cfg.color }} />
                      <div className="activity-body">
                        <div className="activity-top">
                          <span className="activity-badge"
                            style={{ color: cfg.color, background: cfg.bg }}>
                            {cfg.label}
                          </span>
                          <span className="activity-desc">{desc}</span>
                        </div>
                        {(log.user_email || log.user_uid) && (
                          <p className="activity-by">
                            by {log.user_email || log.user_uid}
                          </p>
                        )}
                      </div>
                      <div className="activity-time">
                        <span className="activity-ago">{timeAgo(ts)}</span>
                        <span className="activity-full-time">{fullDT(ts)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {Object.keys(grouped).length === 0 && (
            <p className="empty">No activity found.</p>
          )}
        </div>
      )}
    </div>
  );
}