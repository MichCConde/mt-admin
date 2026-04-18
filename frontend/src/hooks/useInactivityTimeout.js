import { useEffect, useRef } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { cacheClearAll } from "../utils/reportCache";

const ACTIVITY_EVENTS = ["mousedown", "keydown", "scroll", "touchstart", "mousemove"];
const RESET_THROTTLE_MS = 1000; // Only reset the timer once per second max

/**
 * Signs the user out after `timeoutMinutes` of no activity.
 * Activity = mouse movement, clicks, typing, scrolling, or touch.
 */
export function useInactivityTimeout(timeoutMinutes = 15) {
  const timeoutRef   = useRef(null);
  const lastResetRef = useRef(0);

  useEffect(() => {
    const timeoutMs = timeoutMinutes * 60 * 1000;

    async function handleLogout() {
      cacheClearAll();
      sessionStorage.setItem("mt_inactivity_logout", "1");
      try { await signOut(auth); } catch (err) {
        console.warn("Inactivity sign-out failed:", err);
      }
    }

    function resetTimer() {
      const now = Date.now();
      if (now - lastResetRef.current < RESET_THROTTLE_MS) return;
      lastResetRef.current = now;

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(handleLogout, timeoutMs);
    }

    resetTimer(); // Start the initial timer

    ACTIVITY_EVENTS.forEach(ev =>
      window.addEventListener(ev, resetTimer, { passive: true })
    );

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      ACTIVITY_EVENTS.forEach(ev =>
        window.removeEventListener(ev, resetTimer)
      );
    };
  }, [timeoutMinutes]);
}