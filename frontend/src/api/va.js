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

// VA list — returns { vas: [...] }
export const fetchVAs = () =>
  apiFetch("/api/inspector/vas");

// EOD check for a date — returns eod_submissions, missing, etc.
export const fetchEOD = (date) =>
  apiFetch(`/api/eod?date=${date}`);

// Attendance check for a date
export const fetchAttendance = (date) =>
  apiFetch(`/api/attendance?date=${date}`);

// Schedule
export const fetchSchedules = () =>
  apiFetch("/api/schedule");

export const fetchAvailable = (date, time) =>
  apiFetch(`/api/schedule/available?date=${date}&time=${time}`);