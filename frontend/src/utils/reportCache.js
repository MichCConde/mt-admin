const TTL_MS = 45 * 60 * 1000; // 45 minutes

// ── Centralised key registry ──────────────────────────────────────
// Import CACHE_KEYS in any component instead of hard-coding strings.
export const CACHE_KEYS = {
  DASHBOARD : "dashboard:summary",
  SCHEDULE  : "schedule:vas",
  VA_LIST   : "va:list",
  EOW_ALL   : "eow:all",
  EOW_VA    : "eow:va",
  REPORT  : "report:data",
  STAFF     : "staff:list",
};

// ── Core helpers ──────────────────────────────────────────────────
export function cacheSet(key, data) {
  try {
    sessionStorage.setItem(key, JSON.stringify({
      data,
      expires: Date.now() + TTL_MS,
    }));
  } catch (e) {
    // sessionStorage can fail if storage is full — fail silently
    console.warn("[reportCache] Failed to cache:", key, e);
  }
}

export function cacheGet(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { data, expires } = JSON.parse(raw);
    if (Date.now() > expires) {
      sessionStorage.removeItem(key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function cacheClear(key) {
  try { sessionStorage.removeItem(key); } catch {}
}

/** Wipe every known cache entry at once (e.g. on sign-out or manual purge). */
export function cacheClearAll() {
  Object.values(CACHE_KEYS).forEach(cacheClear);
}

/** Returns how many minutes are left before a cached item expires (0 = not cached). */
export function cacheTimeLeft(key) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return 0;
    const { expires } = JSON.parse(raw);
    return Math.max(0, Math.round((expires - Date.now()) / 60000));
  } catch {
    return 0;
  }
}