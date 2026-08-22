import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthState";

export function LoginPage() {
  const { ready, authenticated, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (ready && authenticated) return <Navigate to="/" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const message = await login(username, password);
    setBusy(false);
    if (message) {
      setError(message);
      return;
    }
    navigate("/", { replace: true });
  }

  return (
    <div className="login-screen">
      <form className="login-card settings-form" onSubmit={(event) => void submit(event)}>
        <p className="kicker">میز قیمت</p>
        <h1>ورود به سامانه</h1>
        <p className="muted">این پنل فقط برای اپراتور سازمان است.</p>
        <label>
          نام کاربری
          <input
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
        </label>
        <label>
          رمز عبور
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {error ? <p className="workspace-bar-error">{error}</p> : null}
        <button className="btn primary" type="submit" disabled={busy || !ready}>
          {busy ? "در حال ورود…" : "ورود"}
        </button>
      </form>
    </div>
  );
}
