import { auth } from "./firebase";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

/**
 * Waits for Firebase Auth to fully initialize, then returns the ID token.
 * This prevents race conditions where currentUser is null on first load
 * even when the user is already signed in from a previous session.
 */
function waitForToken() {
  return new Promise((resolve, reject) => {
    // Fast path: auth is already initialized with a user
    if (auth.currentUser) {
      auth.currentUser.getIdToken()
        .then(resolve)
        .catch(reject);
      return;
    }

    // Slow path: wait for Firebase to restore the session from storage
    // onAuthStateChanged fires once immediately when auth is ready
    const unsubscribe = auth.onAuthStateChanged(
      (user) => {
        unsubscribe(); // cleanup — only need this to fire once
        if (user) {
          user.getIdToken().then(resolve).catch(reject);
        } else {
          resolve(null); // genuinely not signed in
        }
      },
      reject
    );
  });
}

/**
 * Authenticated fetch — attaches Firebase ID token to every request.
 * Always waits for auth to be ready before sending.
 */
export async function apiFetch(path, options = {}) {
  const token = await waitForToken();

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