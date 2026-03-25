import { timeAgoLabel } from "../utils/dates";

/* ── Spinner ─────────────────────────────────────── */
export function Spinner({ full = false }) {
  return (
    <div className={`spin-wrap ${full ? "full" : ""}`}>
      <svg className="spin-svg" width="28" height="28" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="#e5e7eb" strokeWidth="2.5"/>
        <path d="M12 2a10 10 0 0 1 10 10" stroke="var(--teal)"
          strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
    </div>
  );
}

/* ── Banners ─────────────────────────────────────── */
export function CachedBanner({ cachedAt, expiresInMin, onRefresh, refreshing }) {
  if (!cachedAt) return null;
  const label = expiresInMin != null
    ? `expires in ${expiresInMin} min`
    : timeAgoLabel(cachedAt);
  return (
    <div className="banner banner-info">
      <span>Showing cached data · {label}</span>
      <button className="banner-btn" onClick={onRefresh} disabled={refreshing}>
        {refreshing ? "Refreshing…" : "↻ Refresh"}
      </button>
    </div>
  );
}

export function ErrorBanner({ message }) {
  if (!message) return null;
  return <div className="banner banner-error">⚠ {message}</div>;
}

export function SuccessBanner({ message }) {
  if (!message) return null;
  return <div className="banner banner-success">✓ {message}</div>;
}

/* ── Badge ───────────────────────────────────────── */
export function Badge({ variant = "default", children }) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}