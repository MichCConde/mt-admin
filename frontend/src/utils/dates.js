/**
 * Returns today's date as "YYYY-MM-DD"
 */
export function todayISO() {
  return new Date().toISOString().split("T")[0];
}

/**
 * "2026-03-24" → "March 24, 2026"
 */
export function formatDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun",
                  "Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[+m - 1]} ${+d}, ${y}`;
}

/**
 * Returns Monday and Saturday of the ISO week containing `date`.
 */
export function weekRange(date = new Date()) {
  const d   = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  const sat = new Date(mon);
  sat.setDate(mon.getDate() + 5);
  return {
    start: mon.toISOString().split("T")[0],
    end:   sat.toISOString().split("T")[0],
  };
}

/**
 * "2026-03-24T08:30:00Z" → "8:30 AM"
 */
export function formatTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/**
 * Minutes since a timestamp (ms).
 */
export function minutesAgo(ms) {
  return Math.floor((Date.now() - ms) / 60_000);
}

/**
 * "3 minutes ago" / "just now"
 */
export function timeAgoLabel(ms) {
  if (!ms) return null;
  const m = minutesAgo(ms);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}