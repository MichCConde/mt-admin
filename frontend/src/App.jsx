import { useAuth }  from "./hooks/useAuth";
import Layout        from "./components/pages/Layout";
import Login         from "./components/pages/Login";
import { colors, font } from "./styles/tokens";

export default function App() {
  const { user, staff, loading, denied } = useAuth();

  // ── 1. Still checking auth + Firestore ──────────────────────────
  if (loading) {
    return (
      <div style={{
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        height: "100vh", background: colors.navy,
        fontFamily: font.family, gap: 20,
      }}>
        <img
          src="https://images.leadconnectorhq.com/image/f_webp/q_80/r_1200/u_https://assets.cdn.filesafe.space/y0alJIjtUPUtCbTJC8PG/media/68710a1e0d2af8dd5e7394be.png"
          alt="Monster Task"
          style={{ width: 140, opacity: 0.6 }}
        />
        <div style={{ color: "#4A6080", fontSize: font.sm, fontWeight: 500 }}>
          Loading…
        </div>
      </div>
    );
  }

  // ── 2. Logged into Firebase but NOT in staff collection ──────────
  if (denied) {
    return (
      <div style={{
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        height: "100vh", background: colors.navy,
        fontFamily: font.family, gap: 16, padding: 24,
      }}>
        <img
          src="https://images.leadconnectorhq.com/image/f_webp/q_80/r_1200/u_https://assets.cdn.filesafe.space/y0alJIjtUPUtCbTJC8PG/media/68710a1e0d2af8dd5e7394be.png"
          alt="Monster Task"
          style={{ width: 140, opacity: 0.6 }}
        />
        <div style={{
          background: colors.dangerLight, border: `1.5px solid ${colors.dangerBorder}`,
          borderRadius: 12, padding: "20px 28px", textAlign: "center", maxWidth: 380,
        }}>
          <div style={{ fontWeight: 700, color: colors.danger, fontSize: font.lg, marginBottom: 8 }}>
            Access Denied
          </div>
          <div style={{ fontSize: font.base, color: colors.textBody, lineHeight: 1.6 }}>
            Your account is not registered as MT Staff.
            Please contact your administrator.
          </div>
        </div>
      </div>
    );
  }

  // ── 3. Not logged in → show Login ────────────────────────────────
  if (!user) return <Login />;

  // ── 4. Logged in + in staff collection → show app ────────────────
  // At this point auth.currentUser is guaranteed to be set,
  // so apiFetch() will always have a token available.
  return <Layout user={user} staff={staff} />;
}