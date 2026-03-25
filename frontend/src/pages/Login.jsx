import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

export default function Login() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState(null);
  const [loading,  setLoading]  = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(getAuth(), email, password);
      navigate("/");
    } catch {
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <h1 className="login-title">Monster Task</h1>
        <p className="login-sub">Admin Portal</p>
        <form onSubmit={handleSubmit} className="login-form">
          <input className="login-input" type="email" placeholder="Email"
            value={email} onChange={e => setEmail(e.target.value)} required />
          <input className="login-input" type="password" placeholder="Password"
            value={password} onChange={e => setPassword(e.target.value)} required />
          {error && <p className="login-error">{error}</p>}
          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
      <style>{`
        .login-wrapper { min-height: 100vh; display: flex;
          align-items: center; justify-content: center;
          background: #1e1b4b; }
        .login-card { background: #fff; border-radius: 16px;
          padding: 40px; width: 100%; max-width: 380px;
          display: flex; flex-direction: column; gap: 8px; }
        .login-title { font-size: 24px; font-weight: 700;
          color: #111827; text-align: center; }
        .login-sub { font-size: 14px; color: #6b7280;
          text-align: center; margin-bottom: 16px; }
        .login-form { display: flex; flex-direction: column; gap: 12px; }
        .login-input { padding: 10px 14px; border: 1px solid #d1d5db;
          border-radius: 8px; font-size: 14px; }
        .login-btn { padding: 10px; background: #4f46e5; color: #fff;
          border: none; border-radius: 8px; font-size: 15px;
          font-weight: 600; cursor: pointer; margin-top: 4px; }
        .login-btn:hover:not(:disabled) { background: #4338ca; }
        .login-btn:disabled { opacity: 0.5; }
        .login-error { color: #dc2626; font-size: 13px; }
      `}</style>
    </div>
  );
}