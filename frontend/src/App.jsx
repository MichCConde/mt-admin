import { useAuth } from "./hooks/useAuth";
import Layout from "./components/pages/Layout";
import Login  from "./components/pages/Login";
import { colors, font } from "./styles/tokens";

export default function App() {
  const { user, loading } = useAuth();

  // While Firebase is checking the session, show a minimal loader
  if (loading) {
    return (
      <div style={{
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        height:         "100vh",
        background:     colors.navy,
        fontFamily:     font.family,
      }}>
        <div style={{ textAlign: "center" }}>
          <img
            src="https://images.leadconnectorhq.com/image/f_webp/q_80/r_1200/u_https://assets.cdn.filesafe.space/y0alJIjtUPUtCbTJC8PG/media/68710a1e0d2af8dd5e7394be.png"
            alt="Monster Task"
            style={{ width: 140, opacity: 0.7 }}
          />
          <div style={{ color: "#4A6080", fontSize: font.sm, marginTop: 16 }}>
            Loading…
          </div>
        </div>
      </div>
    );
  }

  // Not signed in → show Login
  if (!user) return <Login />;

  // Signed in → show the app
  return <Layout user={user} />;
}