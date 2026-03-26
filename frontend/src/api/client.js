/**
 * Shared authenticated fetch helper.
 * Waits for Firebase Auth to finish restoring the session before
 * sending any request — fixes the 401 race condition on page load.
 */
import { getAuth } from "firebase/auth";

const BASE = import.meta.env.VITE_API_URL || "";

function waitForAuth() {
  return new Promise((resolve) => {
    const auth = getAuth();
    // If already resolved, return immediately
    if (auth.currentUser !== undefined) {
      resolve(auth.currentUser);
      return;
    }
    // Otherwise wait for the first auth state change
    const unsub = auth.onAuthStateChanged((user) => {
      unsub();
      resolve(user);
    });
  });
}

export async function apiFetch(path, options = {}) {
  const user  = await waitForAuth();
  const token = user ? await user.getIdToken() : null;

  const res = await fetch(`${BASE}${path}`, {
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