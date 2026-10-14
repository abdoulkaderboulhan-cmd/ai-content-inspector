import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (fullName.trim().length < 2) return setError("Enter your full name.");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Enter a valid email address.");
    if (password.length < 8) return setError("The password must have at least 8 characters.");
    if (password !== confirm) return setError("The two passwords do not match.");
    setBusy(true);
    try {
      await register(fullName.trim(), email.trim(), password);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card auth-box">
      <h2>Create your account</h2>
      <form className="form" onSubmit={submit} noValidate>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="field">
          <label htmlFor="name">Full name</label>
          <input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          <div className="hint">At least 8 characters.</div>
        </div>
        <div className="field">
          <label htmlFor="confirm">Confirm password</label>
          <input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </div>
        <button className="btn btn-primary" disabled={busy}>{busy ? "Creating..." : "Sign up"}</button>
      </form>
      <p className="center muted" style={{ marginTop: 16, marginBottom: 0 }}>
        Already registered? <Link to="/login">Login</Link>
      </p>
    </div>
  );
}
