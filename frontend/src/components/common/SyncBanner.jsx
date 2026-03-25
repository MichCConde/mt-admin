import { useState } from "react";
import { triggerSync } from "../../api/internal";
import { timeAgoLabel } from "../../utils/dates";

export default function SyncBanner({ cachedAt, onSynced }) {
  const [syncing, setSyncing] = useState(false);
  const [error,   setError]   = useState(null);

  async function handleSync() {
    setSyncing(true);
    setError(null);
    try {
      await triggerSync();
      onSynced?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setSyncing(false);
    }
  }

  const label = cachedAt ? timeAgoLabel(cachedAt) : null;

  return (
    <div className="sync-banner">
      {label && <span className="sync-label">Last synced {label}</span>}
      <button
        className="sync-btn"
        onClick={handleSync}
        disabled={syncing}
      >
        {syncing ? "Syncing…" : "Sync Now"}
      </button>
      {error && <span className="sync-error">{error}</span>}
      <style>{`
        .sync-banner { display: flex; align-items: center; gap: 12px;
          padding: 6px 12px; background: #f9fafb; border-radius: 8px;
          font-size: 13px; color: #6b7280; }
        .sync-btn { padding: 4px 12px; border: 1px solid #d1d5db;
          border-radius: 6px; background: #fff; cursor: pointer;
          font-size: 13px; }
        .sync-btn:hover:not(:disabled) { background: #f3f4f6; }
        .sync-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .sync-error { color: #ef4444; font-size: 12px; }
      `}</style>
    </div>
  );
}