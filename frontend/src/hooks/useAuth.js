import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";

export function useAuth() {
  const [user,    setUser]    = useState(null);
  const [role,    setRole]    = useState(null);  // "admin" | "hr" | null
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setRole(null);
        setLoading(false);
        return;
      }
      setUser(firebaseUser);
      // Fetch role from Firestore staff collection
      try {
        const db   = getFirestore();
        const snap = await getDoc(doc(db, "staff", firebaseUser.uid));
        setRole(snap.exists() ? snap.data().role || "viewer" : null);
      } catch {
        setRole(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  return { user, role, loading, isAdmin: role === "admin" };
}