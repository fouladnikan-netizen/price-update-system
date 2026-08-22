import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthState";

export function RequireAuth() {
  const { ready, authenticated } = useAuth();
  const location = useLocation();

  if (!ready) {
    return (
      <div className="login-screen">
        <p className="muted">در حال بررسی ورود…</p>
      </div>
    );
  }
  if (!authenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
