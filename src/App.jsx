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
import PublicPage    from "./pages/PublicPage";   // ← nový import

// Ochrana přihlášených stránek
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

        {/* ✅ Veřejná publikovaná stránka — BEZ přihlášení */}
        <Route path="/p/:id"          element={<PublicPage />} />

        {/* Chráněné stránky (vyžadují přihlášení) */}
        <Route element={<PrivateRoute user={user} />}>
          <Route path="/dashboard"  element={<Dashboard />} />
          <Route path="/pages"      element={<Pages />} />
          <Route path="/editor/:id" element={<PageEditor />} />
          {/* Sem budeš přidávat nové moduly: */}
          {/* <Route path="/modul-a" element={<ModulA />} /> */}
        </Route>

        {/* Výchozí přesměrování */}
        <Route path="*" element={<Navigate to={user ? "/dashboard" : "/login"} />} />
      </Routes>
    </BrowserRouter>
  );
}