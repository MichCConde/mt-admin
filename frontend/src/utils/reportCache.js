const TTL_MS = 45 * 60 * 1000; // 45 minutes

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

/** Returns how many minutes are left before a cached item expires. */
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