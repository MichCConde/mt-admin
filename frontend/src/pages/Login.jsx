import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

export default function Login() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState(null);
  const [loading,  setLoading]  = useState(false);
  const navigate = useNavigate();

  const submit = async e => {
    e.preventDefault();
    setLoading(true); setError(null);
    try { await signInWithEmailAndPassword(getAuth(), email, password); navigate("/"); }
    catch { setError("Invalid email or password."); }
    finally { setLoading(false); }
  };

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-logo">
          <div className="login-logo-box">MT</div>
          <div>
            <div className="login-title">Monster Task</div>
            <div className="login-sub-title">Admin Portal</div>
          </div>
        </div>
        <form className="login-form" onSubmit={submit}>
          <div>
            <label className="login-label">Email</label>
            <input className="inp" type="email" value={email} style={{ width:"100%" }}
              onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="login-label">Password</label>
            <input className="inp" type="password" value={password} style={{ width:"100%" }}
              onChange={e => setPassword(e.target.value)} required />
          </div>
          {error && <p className="login-err">{error}</p>}
          <button className="btn btn-teal" type="submit" disabled={loading}
            style={{ width:"100%", justifyContent:"center" }}>
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}