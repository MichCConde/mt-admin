import { useAuth } from "./hooks/useAuth";
import Layout from "./components/pages/Layout";
import Login  from "./components/pages/Login";
import { colors, font } from "./styles/tokens";

export default function App() {
  const { user, loading } = useAuth();

  // ── Still waiting for Firebase to restore session ──
  // Do NOT render Layout here — that would trigger API calls
  // before the token is available, causing 401 errors.
  if (loading) {
    return (
      <div style={{
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        justifyContent: "center",
        height:         "100vh",
        background:     colors.navy,
        fontFamily:     font.family,
        gap:            20,
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

  // ── Auth settled: show login or the app ──
  return user ? <Layout user={user} /> : <Login />;
}