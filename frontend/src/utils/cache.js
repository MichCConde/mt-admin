const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes

export function cacheGet(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { value, expiresAt } = JSON.parse(raw);
    if (expiresAt && Date.now() > expiresAt) {
      localStorage.removeItem(key);
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

export function cacheSet(key, value, ttlMs = DEFAULT_TTL_MS) {
  try {
    localStorage.setItem(key, JSON.stringify({
      value,
      cachedAt: Date.now(),
      expiresAt: ttlMs ? Date.now() + ttlMs : null,
    }));
  } catch {
    // localStorage quota exceeded — fail silently
  }
}

export function getCachedAt(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw).cachedAt : null;
  } catch {
    return null;
  }
}

export function cacheInvalidate(key) {
  localStorage.removeItem(key);
}

export function cacheInvalidateAll() {
  Object.keys(localStorage).forEach(k => localStorage.removeItem(k));
}

// TTL presets
export const TTL = {
  FOREVER:  null,
  H24:      24 * 60 * 60 * 1000,
  H1:       60 * 60 * 1000,
  MIN30:    30 * 60 * 1000,
  MIN15:    15 * 60 * 1000,
  MIN5:     5  * 60 * 1000,
};