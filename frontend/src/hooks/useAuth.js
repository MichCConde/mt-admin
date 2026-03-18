import { useState, useEffect } from "react";
import { onAuthStateChanged }  from "firebase/auth";
import { doc, getDoc }         from "firebase/firestore";
import { auth, db }            from "../firebase";

/**
 * Tracks Firebase auth state AND verifies the user exists
 * in the Firestore `staff` collection.
 *
 * Returns:
 *   loading  — true while checking auth + Firestore
 *   user     — Firebase user object, or null
 *   staff    — Firestore staff document data, or null
 *   denied   — true if Firebase Auth succeeded but user is NOT in staff collection
 */
export function useAuth() {
  const [user,    setUser]    = useState(null);
  const [staff,   setStaff]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [denied,  setDenied]  = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        // Not logged in at all
        setUser(null);
        setStaff(null);
        setDenied(false);
        setLoading(false);
        return;
      }

      // Firebase Auth succeeded — now check Firestore staff collection
      try {
        const staffRef  = doc(db, "staff", firebaseUser.uid);
        const staffSnap = await getDoc(staffRef);

        if (staffSnap.exists()) {
          // ✅ Found in staff collection — allow access
          setUser(firebaseUser);
          setStaff(staffSnap.data());
          setDenied(false);
        } else {
          // ❌ Not in staff collection — deny access
          setUser(null);
          setStaff(null);
          setDenied(true);
          await auth.signOut(); // sign them out immediately
        }
      } catch (err) {
        console.error("Firestore staff check failed:", err);
        setUser(null);
        setStaff(null);
        setDenied(false);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  return { user, staff, loading, denied };
}