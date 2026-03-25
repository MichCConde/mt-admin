// Spinner
export function Spinner({ fullPage = false }) {
  return (
    <div className={`spinner-wrap ${fullPage ? "full" : ""}`}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="spinner">
        <circle cx="12" cy="12" r="10" stroke="#e2e8f0" strokeWidth="3"/>
        <path d="M12 2a10 10 0 0 1 10 10" stroke="#00c9a7"
          strokeWidth="3" strokeLinecap="round"/>
      </svg>
    </div>
  );
}

// Banners
export function CachedBanner({ cachedAt, expiresInMin, onRefresh, refreshing }) {
  const { timeAgoLabel } = require("../utils/dates");
  if (!cachedAt) return null;
  return (
    <div className="banner-cached">
      <span>
        Showing cached data
        {expiresInMin != null
          ? ` · expires in ${expiresInMin} min`
          : cachedAt ? ` · ${timeAgoLabel(cachedAt)}` : ""}
      </span>
      <button className="btn-refresh" onClick={onRefresh} disabled={refreshing}>
        {refreshing ? "Refreshing…" : "↻ Refresh"}
      </button>
    </div>
  );
}

export function ErrorBanner({ message }) {
  if (!message) return null;
  return <div className="banner-error">⚠ {message}</div>;
}

export function SuccessBanner({ message }) {
  if (!message) return null;
  return <div className="banner-success">✓ {message}</div>;
}

// Badges
export function Badge({ type = "default", children }) {
  return <span className={`badge badge-${type}`}>{children}</span>;
}