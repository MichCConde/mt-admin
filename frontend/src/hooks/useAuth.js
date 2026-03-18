import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";

/**
 * Tracks Firebase auth state.
 * loading = true  → Firebase hasn't finished restoring session yet
 * loading = false → auth state is known (user is either logged in or not)
 * user = null     → not signed in
 * user = object   → signed in Firebase user
 */
export function useAuth() {
  const [user,    setUser]    = useState(undefined); // undefined = still loading
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // onAuthStateChanged fires immediately once Firebase is ready
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser ?? null);
      setLoading(false);
    });
    return unsubscribe; // cleanup listener on unmount
  }, []);

  return { user, loading };
}