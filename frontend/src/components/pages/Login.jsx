import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../firebase";
import { colors, font, radius, shadow } from "../../styles/tokens";
import { Lock, Mail, AlertTriangle } from "lucide-react";

export default function Login() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged in useAuth.js handles the redirect automatically
    } catch (err) {
      setError(friendlyError(err.code));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>

        {/* Logo */}
        <div style={s.logoWrap}>
          <img
            src="https://images.leadconnectorhq.com/image/f_webp/q_80/r_1200/u_https://assets.cdn.filesafe.space/y0alJIjtUPUtCbTJC8PG/media/68710a1e0d2af8dd5e7394be.png"
            alt="Monster Task"
            style={{ width: 160, objectFit: "contain" }}
          />
        </div>

        {/* Heading */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <h1 style={{ fontSize: font.h3, fontWeight: 800, color: colors.textPrimary, margin: 0 }}>
            Admin Portal
          </h1>
          <p style={{ fontSize: font.sm, color: colors.textMuted, marginTop: 6 }}>
            Sign in to access the VA dashboard
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div style={s.errorBox}>
            <AlertTriangle size={15} color={colors.danger} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: font.sm, color: colors.danger }}>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Email */}
          <div>
            <label style={s.label}>Email address</label>
            <div style={s.inputWrap}>
              <Mail size={15} color={colors.textFaint} style={s.inputIcon} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@monstertask.com"
                required
                autoComplete="email"
                style={s.input}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label style={s.label}>Password</label>
            <div style={s.inputWrap}>
              <Lock size={15} color={colors.textFaint} style={s.inputIcon} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                style={s.input}
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              ...s.submitBtn,
              opacity:  loading ? 0.75 : 1,
              cursor:   loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        {/* Footer note */}
        <p style={{ textAlign: "center", fontSize: font.xs, color: colors.textFaint, marginTop: 28 }}>
          Access is restricted to Monster Task admins only.
        </p>
      </div>
    </div>
  );
}

// ── Map Firebase error codes to human-readable messages ──────────
function friendlyError(code) {
  switch (code) {
    case "auth/invalid-email":          return "Please enter a valid email address.";
    case "auth/user-not-found":         return "No account found with this email.";
    case "auth/wrong-password":         return "Incorrect password. Please try again.";
    case "auth/invalid-credential":     return "Invalid email or password. Please try again.";
    case "auth/too-many-requests":      return "Too many failed attempts. Please wait a moment and try again.";
    case "auth/user-disabled":          return "This account has been disabled. Contact your administrator.";
    case "auth/network-request-failed": return "Network error. Check your connection and try again.";
    default:                            return "Sign-in failed. Please try again.";
  }
}

// ── Styles ────────────────────────────────────────────────────────
const s = {
  page: {
    minHeight:      "100vh",
    background:     colors.navy,
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    fontFamily:     font.family,
    padding:        24,
  },
  card: {
    background:   colors.surface,
    borderRadius: radius.xl,
    padding:      "40px 40px 32px",
    width:        "100%",
    maxWidth:     420,
    boxShadow:    shadow.lg,
  },
  logoWrap: {
    display:        "flex",
    justifyContent: "center",
    marginBottom:   28,
    paddingBottom:  24,
    borderBottom:   `1px solid ${colors.border}`,
  },
  errorBox: {
    display:      "flex",
    alignItems:   "center",
    gap:          8,
    background:   colors.dangerLight,
    border:       `1px solid ${colors.dangerBorder}`,
    borderRadius: radius.md,
    padding:      "10px 14px",
    marginBottom: 16,
  },
  label: {
    display:      "block",
    fontSize:     font.sm,
    fontWeight:   700,
    color:        colors.textBody,
    marginBottom: 6,
    letterSpacing:"0.02em",
  },
  inputWrap: {
    position: "relative",
    display:  "flex",
    alignItems:"center",
  },
  inputIcon: {
    position:  "absolute",
    left:      13,
    pointerEvents: "none",
  },
  input: {
    width:        "100%",
    border:       `1.5px solid ${colors.border}`,
    borderRadius: radius.md,
    padding:      "10px 14px 10px 38px",
    fontSize:     font.base,
    outline:      "none",
    fontFamily:   font.family,
    color:        colors.textPrimary,
    background:   colors.surface,
    boxSizing:    "border-box",
    transition:   "border-color .12s",
  },
  submitBtn: {
    width:        "100%",
    background:   colors.teal,
    color:        "#fff",
    border:       "none",
    borderRadius: radius.md,
    padding:      "12px 0",
    fontSize:     font.base,
    fontWeight:   800,
    fontFamily:   font.family,
    marginTop:    4,
    letterSpacing:"0.02em",
  },
};