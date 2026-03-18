import { auth } from "./firebase";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

/**
 * Gets the current Firebase ID token.
 * auth.currentUser is always available here because App.jsx
 * only renders components after useAuth() confirms the user is logged in.
 */
async function getToken() {
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