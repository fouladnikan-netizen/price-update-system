import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthStateProvider } from "./auth/AuthState";
import { RequireAuth } from "./auth/RequireAuth";
import { LoginPage } from "./pages/LoginPage";

const AuthenticatedApp = lazy(() => import("./AuthenticatedApp"));

function LoadingScreen() {
  return (
    <div className="login-screen">
      <p className="muted">در حال بارگذاری میز قیمت…</p>
    </div>
  );
}

export default function App() {
  return (
    <AuthStateProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route
              path="*"
              element={
                <Suspense fallback={<LoadingScreen />}>
                  <AuthenticatedApp />
                </Suspense>
              }
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthStateProvider>
  );
}
