import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";

/**
 * Returns the current Firebase auth state.
 * - loading: true while Firebase is determining the session
 * - user:    the Firebase User object, or null if not signed in
 */
export function useAuth() {
  const [user,    setUser]    = useState(undefined); // undefined = still loading
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe; // cleanup listener on unmount
  }, []);

  return { user, loading };
}