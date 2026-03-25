import { getAuth } from "firebase/auth";

const BASE = import.meta.env.VITE_API_URL || "";

async function apiFetch(path, options = {}) {
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

export const fetchVAs = () =>
  apiFetch("/api/va/inspector");

export const fetchVA = (id) =>
  apiFetch(`/api/va/inspector/${id}`);

export const fetchEOD = (date, force = false) =>
  apiFetch(`/api/va/eod?date=${date}&force=${force}`);

export const fetchAttendance = (date, force = false) =>
  apiFetch(`/api/va/attendance?date=${date}&force=${force}`);

export const fetchSchedules = () =>
  apiFetch("/api/va/schedule");

export const fetchAvailable = (date, time) =>
  apiFetch(`/api/va/schedule/available?date=${date}&time=${time}`);