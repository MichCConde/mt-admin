import { auth } from "./firebase";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

/**
 * Waits for Firebase to finish restoring auth state, then returns
 * the current user's ID token. Returns null if not logged in.
 *
 * Without authStateReady(), auth.currentUser is null during the brief
 * async window on page load — causing "Authorization header missing" errors.
 */
async function getToken() {
  await auth.authStateReady(); // ← wait for Firebase session to restore
  if (!auth.currentUser) return null;
  return auth.currentUser.getIdToken();
}

/**
 * Authenticated fetch — attaches Firebase token to every request.
 */
export async function apiFetch(path, options = {}) {
  const token = await getToken();

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Request failed (${res.status})`);
  }

  return res.json();
}

/**
 * Fire-and-forget ping to the /health endpoint.
 *
 * UptimeRobot already keeps the backend warm every 5 min, but this gives
 * an extra warm-up kick the moment the user opens the app — so the first
 * real API call never hits a cold-start delay.
 *
 * Called once from Layout on mount. No auth needed (/health is public).
 */
export function wakeBackend() {
  fetch(`${BASE}/health`).catch(() => {});
}