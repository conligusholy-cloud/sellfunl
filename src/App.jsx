import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthState } from "./hooks/useAuthState";

// Stránky
import Landing       from "./pages/Landing";
import Login         from "./pages/Login";
import Register      from "./pages/Register";
import ResetPassword from "./pages/ResetPassword";
import Dashboard     from "./pages/Dashboard";
import Pages         from "./pages/modules/Pages";
import PageEditor    from "./pages/modules/PageEditor";
import PublicPage    from "./pages/PublicPage";
import Domains       from "./pages/Domains";
import FacebookAds   from "./pages/modules/FacebookAds";
import FacebookCallback from "./pages/modules/FacebookCallback";

// Komponenty
import PrivateRoute  from "./components/PrivateRoute";

export default function App() {
  const { user, loading } = useAuthState();

  if (loading) return <div className="loading">Načítám...</div>;

  return (
    <BrowserRouter>
      <Routes>
        {/* Veřejné stránky */}
        <Route path="/"               element={<Landing />} />
        <Route path="/login"          element={<Login />} />
        <Route path="/register"       element={<Register />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Veřejná publikovaná stránka — BEZ přihlášení */}
        <Route path="/p/:id"          element={<PublicPage />} />

        {/* Chráněné stránky (vyžadují přihlášení) */}
        <Route element={<PrivateRoute user={user} />}>
          {/* Dashboard jako layout — sidebar + header na všech podstránkách */}
          <Route element={<Dashboard />}>
            <Route path="/dashboard"  element={<></>} />
            <Route path="/pages"      element={<Pages />} />
            <Route path="/editor/:id" element={<PageEditor />} />
            <Route path="/domains"    element={<Domains />} />
            <Route path="/fb-ads"     element={<FacebookAds />} />
          </Route>
          {/* Callback je popup — bez sidebaru */}
          <Route path="/fb-ads/callback" element={<FacebookCallback />} />
        </Route>

        {/* Výchozí přesměrování */}
        <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
      </Routes>

    </BrowserRouter>
  );
}