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

export const fetchDashboard = () =>
  apiFetch("/api/internal/dashboard");

export const fetchEOWReport = (year, week, force = false) =>
  apiFetch(`/api/internal/eow?year=${year}&week=${week}&force=${force}`);

export const fetchActivityLogs = (limit = 50) =>
  apiFetch(`/api/internal/activity?limit=${limit}`);

export const fetchSyncStatus = () =>
  apiFetch("/api/internal/sync/status");

export const triggerSync = () =>
  apiFetch("/api/internal/sync/notion", { method: "POST" });