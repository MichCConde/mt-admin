import { auth } from "./firebase";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

/**
 * Returns a promise that resolves to the current Firebase ID token.
 * Waits for the auth state to be fully initialized before resolving.
 * This prevents the "Authorization header missing" error on page load.
 */
function getToken() {
  return new Promise((resolve, reject) => {
    // If already signed in, get token immediately
    if (auth.currentUser) {
      auth.currentUser.getIdToken().then(resolve).catch(reject);
      return;
    }
    // Otherwise wait for auth state to initialize (runs once, then unsubscribes)
    const unsubscribe = auth.onAuthStateChanged((user) => {
      unsubscribe();
      if (user) {
        user.getIdToken().then(resolve).catch(reject);
      } else {
        resolve(null); // Not signed in
      }
    });
  });
}

/**
 * Authenticated fetch wrapper.
 * Always waits for Firebase auth to be ready before sending the request.
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