import { getAuth } from "firebase/auth";
const BASE = import.meta.env.VITE_API_URL || "";

export async function apiFetch(path, options = {}) {
  const user  = getAuth().currentUser;
  const token = user ? await user.getIdToken() : null;
  const res   = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export const fetchDashboard    = ()              => apiFetch("/api/dashboard");
export const fetchEOWReport    = (start, end)    => apiFetch(`/api/eow?start=${start}&end=${end}`);
export const fetchActivityLogs = (limit = 200)   => apiFetch(`/api/activity?limit=${limit}`);