import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";

/**
 * All supported action types.
 * Import these constants instead of using raw strings.
 */
export const LOG_TYPES = {
  SIGN_IN:          "SIGN_IN",
  SIGN_OUT:         "SIGN_OUT",
  EOD_CHECK:        "EOD_CHECK",
  ATTENDANCE_CHECK: "ATTENDANCE_CHECK",
  EMAIL_SENT:       "EMAIL_SENT",
  VA_INSPECT:       "VA_INSPECT",
};

/**
 * Write an activity log entry to Firestore.
 * Silently swallows errors — logging must never break the app.
 *
 * @param {string} type        — one of LOG_TYPES
 * @param {string} description — human-readable summary
 * @param {object} metadata    — optional extra data (date, va name, etc.)
 */
export async function logActivity(type, description, metadata = {}) {
  try {
    await addDoc(collection(db, "activity_logs"), {
      type,
      description,
      performed_by: auth.currentUser?.email ?? "unknown",
      metadata,
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.warn("[logger] Activity log failed silently:", err);
  }
}