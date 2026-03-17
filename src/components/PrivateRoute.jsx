import { Navigate, Outlet } from "react-router-dom";

// Pokud uživatel není přihlášený, přesměruje na /login
// Outlet = vykreslí dětskou stránku (Dashboard, ModulA, ...)
export default function PrivateRoute({ user }) {
  return user ? <Outlet /> : <Navigate to="/login" />;
}