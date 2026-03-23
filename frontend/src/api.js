import { auth } from "./firebase";
import { signOut } from "firebase/auth";
import { cacheClearAll } from "./utils/reportCache";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

// ── Auth error ────────────────────────────────────────────────────
/**
 * Thrown when a 401 is received or the token can't be retrieved.
 * Callers (ErrorBoundary, components) can check instanceof AuthError
 * to show a friendlier message instead of a generic "Request failed".
 */
export class AuthError extends Error {
  constructor(message = "Your session has expired. Please sign in again.") {
    super(message);
    this.name = "AuthError";
  }
}

// ── Sign-out helper ───────────────────────────────────────────────
/**
 * Clears all caches, signs out of Firebase, and lets onAuthStateChanged
 * in useAuth.js naturally flip user → null, which causes App.jsx to
 * render <Login /> without any hard redirect needed.
 */
async function forceSignOut() {
  cacheClearAll();
  try {
    await signOut(auth);
  } catch {
    // If sign-out itself fails (e.g. already signed out), ignore it
  }
}

// ── Token retrieval ───────────────────────────────────────────────
/**
 * Waits for Firebase to finish restoring auth state, then returns
 * the current user's ID token.
 *
 * - Passes forceRefresh=false so Firebase uses its internal refresh
 *   logic automatically (tokens refresh ~5 min before expiry).
 * - If getIdToken() throws for any reason (network issue, revoked token),
 *   we force a sign-out instead of silently sending a null token which
 *   would produce a confusing "Authorization header missing" 401.
 */
async function getToken() {
  await auth.authStateReady();
  if (!auth.currentUser) return null;

  try {
    return await auth.currentUser.getIdToken();
  } catch (err) {
    console.warn("[api] Failed to retrieve Firebase token:", err.message);
    await forceSignOut();
    throw new AuthError();
  }
}

// ── Authenticated fetch ───────────────────────────────────────────
/**
 * Attaches the Firebase token to every request and handles
 * 401 responses globally — signs the user out so App.jsx
 * redirects to Login automatically.
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

  // ── Global 401 handler ────────────────────────────────────────
  if (res.status === 401) {
    await forceSignOut();
    throw new AuthError();
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Request failed (${res.status})`);
  }

  return res.json();
}

// ── Backend warm-up ───────────────────────────────────────────────
/**
 * Fire-and-forget ping to /health on app load so the backend is
 * warm before the first real API call. No auth needed (/health is public).
 */
export function wakeBackend() {
  fetch(`${BASE}/health`).catch(() => {});
}