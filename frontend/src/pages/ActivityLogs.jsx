import { useEffect, useState } from "react";
import { fetchActivityLogs } from "../api/internal";
import { Spinner } from "../ui/Indicators";

const TYPES = {
  email_sent:  { label: "Email Sent",  color: "#7c3aed", bg: "#ede9fe" },
  eod_check:   { label: "EOD Check",   color: "#0d9488", bg: "#ccfbf1" },
  sign_in:     { label: "Sign In",     color: "#0d9488", bg: "#ccfbf1" },
  sync:        { label: "Sync",        color: "#2563eb", bg: "#dbeafe" },
  flag_added:  { label: "Flag",        color: "#b45309", bg: "#fef3c7" },
};

const cfg  = (a = "") => TYPES[a.toLowerCase().replace(/ /g,"_")]
                      || { label: a, color: "var(--text-2)", bg: "#f3f4f6" };
const ago  = r => { if (!r) return ""; const m = Math.floor((Date.now()-new Date(r))/60000);
                    return m<60 ? `${m}m ago` : m<1440 ? `${Math.floor(m/60)}h ago` : `${Math.floor(m/1440)}d ago`; };
const full = r => r ? new Date(r).toLocaleString("en-US",{month:"short",day:"numeric",
                    year:"numeric",hour:"numeric",minute:"2-digit"}) : "";
const grp  = logs => {
  const out = {};
  for (const l of logs) {
    const k = l.created_at
      ? new Date(l.created_at).toLocaleDateString("en-US",
          {weekday:"long",year:"numeric",month:"long",day:"numeric"}).toUpperCase()
      : "UNKNOWN DATE";
    (out[k]=out[k]||[]).push(l);
  }
  return out;
};

export default function ActivityLogs() {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState("all");

  const load = async () => {
    setLoading(true);
    try { const r = await fetchActivityLogs(200); setLogs(r.logs || []); }
    catch { setLogs([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const types    = ["all", ...new Set(logs.map(l => l.action).filter(Boolean))];
  const filtered = filter === "all" ? logs : logs.filter(l => l.action === filter);
  const grouped  = grp(filtered);

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">Activity Logs</h1>
        <p className="page-sub">{logs.length} events recorded</p>
      </div>

      <div className="flex-row">
        <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
          <label style={{ fontSize:12, fontWeight:600, color:"var(--text-3)",
            textTransform:"uppercase", letterSpacing:"0.5px" }}>Filter by Type</label>
          <select className="sel" value={filter} onChange={e => setFilter(e.target.value)}
            style={{ minWidth: 200 }}>
            {types.map(t => <option key={t} value={t}>{t === "all" ? "All Types" : cfg(t).label}</option>)}
          </select>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load} disabled={loading}
          style={{ alignSelf:"flex-end" }}>
          ↻ Refresh
        </button>
      </div>

      {loading ? <Spinner full /> : (
        <div className="feed">
          {Object.entries(grouped).map(([date, entries]) => (
            <div key={date} className="feed-group">
              <p className="feed-date">{date}</p>
              <div className="feed-card">
                {entries.map((l, i) => {
                  const c   = cfg(l.action);
                  const ts  = l.created_at || "";
                  const desc = l.detail?.description || l.detail?.type
                             || (typeof l.detail === "string" ? l.detail : "") || l.action;
                  return (
                    <div key={i} className="feed-row">
                      <span className="feed-dot" style={{ background: c.color }} />
                      <div className="feed-body">
                        <div className="feed-top">
                          <span className="feed-badge" style={{ color:c.color, background:c.bg }}>
                            {c.label}
                          </span>
                          <span className="feed-desc">{desc}</span>
                        </div>
                        {(l.user_email || l.user_uid) && (
                          <p className="feed-by">by {l.user_email || l.user_uid}</p>
                        )}
                      </div>
                      <div className="feed-time">
                        <span className="feed-ago">{ago(ts)}</span>
                        <span className="feed-full">{full(ts)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {!Object.keys(grouped).length && <p className="empty">No activity found.</p>}
        </div>
      )}
    </div>
  );
}