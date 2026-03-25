/**
 * Lightweight frontend activity logger.
 * Fires-and-forgets a POST to the activity log endpoint.
 */
import { apiFetch } from "../api/internal";

export function logActivity(action, detail = {}) {
  apiFetch("/api/internal/activity", {
    method: "POST",
    body: JSON.stringify({ action, detail }),
  }).catch(() => {}); // never throw
}