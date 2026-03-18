import { useState, useEffect }              from "react";
import { onAuthStateChanged }               from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { auth, db }                         from "../firebase";

/**
 * Tracks Firebase auth state AND verifies the user exists
 * in the Firestore `staff` collection via a `uid` field.
 *
 * Returns:
 *   loading  — true while checking auth + Firestore
 *   user     — Firebase user object, or null
 *   staff    — Firestore staff document data, or null
 *   denied   — true if Firebase Auth succeeded but user is NOT in staff collection
 *   authError — string message if a Firestore error occurred
 */
export function useAuth() {
  const [user,      setUser]      = useState(null);
  const [staff,     setStaff]     = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [denied,    setDenied]    = useState(false);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        // Not logged in at all
        setUser(null);
        setStaff(null);
        setDenied(false);
        setAuthError("");
        setLoading(false);
        return;
      }

      // Firebase Auth succeeded — now check Firestore staff collection by uid field
      try {
        const staffQuery = query(
          collection(db, "staff"),
          where("uid", "==", firebaseUser.uid)
        );
        const staffSnap = await getDocs(staffQuery);

        if (!staffSnap.empty) {
          // ✅ Found in staff collection — allow access
          setUser(firebaseUser);
          setStaff(staffSnap.docs[0].data());
          setDenied(false);
          setAuthError("");
        } else {
          // ❌ Not in staff collection — deny access
          setUser(null);
          setStaff(null);
          setDenied(true);
          setAuthError("");
          await auth.signOut();
        }
      } catch (err) {
        console.error("Firestore staff check failed:", err);
        setUser(null);
        setStaff(null);
        setDenied(true);
        setAuthError(
          "Unable to verify your staff access. Please check your connection or contact your administrator."
        );
        await auth.signOut();
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  return { user, staff, loading, denied, authError };
}