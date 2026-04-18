import { useState, useEffect } from "react";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../../firebase";
import { colors, font, radius, shadow } from "../../styles/tokens";
import { Lock, Mail, AlertTriangle, Eye, EyeOff, CheckCircle2, ArrowLeft, Clock } from "lucide-react";
import { logActivity, LOG_TYPES } from "../../utils/logger";

export default function Login() {
  const [mode,      setMode]      = useState("signin"); // "signin" | "forgot"
  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [showPw,    setShowPw]    = useState(false);
  const [error,     setError]     = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [loading,   setLoading]   = useState(false);

  // Inactivity logout notice
  const [inactive, setInactive] = useState(
    () => sessionStorage.getItem("mt_inactivity_logout") === "1"
  );

  useEffect(() => {
    if (inactive) sessionStorage.removeItem("mt_inactivity_logout");
  }, [inactive]);

  async function handleSignIn(e) {
    e.preventDefault();
    setError("");
    setInactive(false);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      logActivity(LOG_TYPES.SIGN_IN, `${email} signed in`);
    } catch (err) {
      setError(friendlyError(err.code));
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword(e) {
    e.preventDefault();
    setError("");
    setResetSent(false);
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch (err) {
      setError(friendlyError(err.code));
    } finally {
      setLoading(false);
    }
  }

  function switchToForgot() {
    setMode("forgot");
    setError("");
    setPassword("");
    setResetSent(false);
    setInactive(false);
  }

  function switchToSignIn() {
    setMode("signin");
    setError("");
    setResetSent(false);
  }

  return (
    <div style={s.page}>
      <div style={s.card}>

        {/* Heading */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <h1 style={{ fontSize: font.h3, fontWeight: 800, color: colors.textPrimary, margin: 0 }}>
            {mode === "signin" ? "MT Staff Portal" : "Reset Password"}
          </h1>
          <p style={{ fontSize: font.sm, color: colors.textMuted, marginTop: 6 }}>
            {mode === "signin"
              ? "Sign in to access the VA admin dashboard"
              : "Enter your email to receive a password reset link"}
          </p>
        </div>

        {/* Inactivity notice */}
        {mode === "signin" && inactive && !error && (
          <div style={s.warnBox}>
            <Clock size={15} color="#B45309" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: font.sm, color: "#78350F" }}>
              You were signed out due to inactivity. Please sign in again.
            </span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={s.errorBox}>
            <AlertTriangle size={15} color={colors.danger} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: font.sm, color: colors.danger }}>{error}</span>
          </div>
        )}

        {/* Reset success */}
        {resetSent && (
          <div style={s.successBox}>
            <CheckCircle2 size={15} color="#16A34A" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: font.sm, color: "#14532D" }}>
              Password reset email sent. Check your inbox.
            </span>
          </div>
        )}

        {/* Sign In Form */}
        {mode === "signin" && (
          <form onSubmit={handleSignIn} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={s.label}>Email address</label>
              <div style={s.inputWrap}>
                <Mail size={15} color={colors.textFaint} style={s.inputIcon} />
                <input
                  type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@monstertask.com"
                  required autoComplete="email"
                  style={s.input}
                  onFocus={(e) => e.target.style.borderColor = colors.teal}
                  onBlur={(e)  => e.target.style.borderColor = colors.border}
                />
              </div>
            </div>

            <div>
              <label style={s.label}>Password</label>
              <div style={s.inputWrap}>
                <Lock size={15} color={colors.textFaint} style={s.inputIcon} />
                <input
                  type={showPw ? "text" : "password"} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required autoComplete="current-password"
                  style={{ ...s.input, paddingRight: 42 }}
                  onFocus={(e) => e.target.style.borderColor = colors.teal}
                  onBlur={(e)  => e.target.style.borderColor = colors.border}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  style={s.eyeBtn}
                  tabIndex={-1}
                >
                  {showPw
                    ? <EyeOff size={16} color={colors.textFaint} />
                    : <Eye size={16} color={colors.textFaint} />}
                </button>
              </div>
            </div>

            <button
              type="submit" disabled={loading}
              style={{ ...s.btn, opacity: loading ? 0.75 : 1, cursor: loading ? "not-allowed" : "pointer" }}
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>

            <button
              type="button"
              onClick={switchToForgot}
              style={s.linkBtn}
            >
              Forgot password?
            </button>
          </form>
        )}

        {/* Forgot Password Form */}
        {mode === "forgot" && (
          <form onSubmit={handleForgotPassword} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={s.label}>Email address</label>
              <div style={s.inputWrap}>
                <Mail size={15} color={colors.textFaint} style={s.inputIcon} />
                <input
                  type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@monstertask.com"
                  required autoComplete="email"
                  style={s.input}
                  onFocus={(e) => e.target.style.borderColor = colors.teal}
                  onBlur={(e)  => e.target.style.borderColor = colors.border}
                />
              </div>
            </div>

            <button
              type="submit" disabled={loading || resetSent}
              style={{
                ...s.btn,
                opacity: (loading || resetSent) ? 0.75 : 1,
                cursor: (loading || resetSent) ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Sending…" : resetSent ? "Email Sent" : "Send Reset Link"}
            </button>

            <button
              type="button"
              onClick={switchToSignIn}
              style={{ ...s.linkBtn, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            >
              <ArrowLeft size={13} />
              Back to sign in
            </button>
          </form>
        )}

        <p style={{ textAlign: "center", fontSize: font.xs, color: colors.textFaint, marginTop: 24 }}>
          Access is restricted to MT Staff only.
        </p>
      </div>
    </div>
  );
}

function friendlyError(code) {
  switch (code) {
    case "auth/invalid-email":          return "Please enter a valid email address.";
    case "auth/user-not-found":         return "No account found with this email.";
    case "auth/wrong-password":         return "Incorrect password. Please try again.";
    case "auth/invalid-credential":     return "Invalid email or password. Please try again.";
    case "auth/too-many-requests":      return "Too many attempts. Please wait and try again.";
    case "auth/user-disabled":          return "This account has been disabled.";
    case "auth/network-request-failed": return "Network error. Check your connection.";
    case "auth/missing-email":          return "Please enter your email address.";
    default:                            return "Something went wrong. Please try again.";
  }
}

const s = {
  page: {
    minHeight: "100vh", background: colors.navy,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: font.family, padding: 24,
  },
  card: {
    background: colors.surface, borderRadius: radius.xl,
    padding: "40px 40px 32px", width: "100%", maxWidth: 420,
    boxShadow: shadow.lg,
  },
  errorBox: {
    display: "flex", alignItems: "center", gap: 8,
    background: colors.dangerLight, border: `1px solid ${colors.dangerBorder}`,
    borderRadius: radius.md, padding: "10px 14px", marginBottom: 16,
  },
  successBox: {
    display: "flex", alignItems: "center", gap: 8,
    background: "#E8F7EE", border: "1px solid #B7E4C7",
    borderRadius: radius.md, padding: "10px 14px", marginBottom: 16,
  },
  warnBox: {
    display: "flex", alignItems: "center", gap: 8,
    background: "#FEF3C7", border: "1px solid #FCD34D",
    borderRadius: radius.md, padding: "10px 14px", marginBottom: 16,
  },
  label: {
    display: "block", fontSize: font.sm, fontWeight: 700,
    color: colors.textBody, marginBottom: 6,
  },
  inputWrap: { position: "relative", display: "flex", alignItems: "center" },
  inputIcon: { position: "absolute", left: 13, pointerEvents: "none" },
  input: {
    width: "100%", border: `1.5px solid ${colors.border}`,
    borderRadius: radius.md, padding: "10px 14px 10px 38px",
    fontSize: font.base, outline: "none", fontFamily: font.family,
    color: colors.textPrimary, background: colors.surface,
    boxSizing: "border-box", transition: "border-color .12s",
  },
  eyeBtn: {
    position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
    background: "none", border: "none", cursor: "pointer", padding: 4,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  btn: {
    width: "100%", background: colors.teal, color: "#fff",
    border: "none", borderRadius: radius.md, padding: "12px 0",
    fontSize: font.base, fontWeight: 800, fontFamily: font.family, marginTop: 4,
  },
  linkBtn: {
    background: "none", border: "none",
    color: colors.teal, fontSize: font.sm, fontWeight: 600,
    cursor: "pointer", fontFamily: font.family,
    textAlign: "center", padding: "4px 0",
  },
};