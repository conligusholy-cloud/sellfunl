import { useState, useEffect } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase/config";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { useAuthState } from "../hooks/useAuthState";
import logo from "../assets/logo.svg";

const menuItems = [
  { icon: "🏠", label: "Přehled",   path: "/dashboard" },
  { icon: "📄", label: "Stránky",   path: "/pages" },
];

export default function Dashboard() {
  const { user } = useAuthState();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  async function handleLogout() {
    await signOut(auth);
    navigate("/login");
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>

      {/* SIDEBAR */}
      <aside style={{
        width: collapsed ? "64px" : "220px",
        minWidth: collapsed ? "64px" : "220px",
        background: "var(--bg-card)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        transition: "width .2s, min-width .2s",
        overflow: "hidden",
      }}>

        {/* logo */}
        <div style={{ padding: "20px 16px", display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid var(--border)" }}>
          <img src={logo} alt="SellFunl" style={{ height: "32px", minWidth: "32px" }} />
          {!collapsed && <span style={{ fontWeight: 700, fontSize: "1.1rem", whiteSpace: "nowrap" }}>SellFunl</span>}
        </div>

        {/* menu */}
        <nav style={{ flex: 1, padding: "12px 8px", display: "flex", flexDirection: "column", gap: "4px" }}>
          {menuItems.map(item => {
            const active = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                title={collapsed ? item.label : ""}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                  background: active ? "#ede9fe" : "transparent",
                  color: active ? "#7c3aed" : "var(--text)",
                  fontWeight: active ? 600 : 400,
                  fontSize: ".9rem",
                  textAlign: "left",
                  whiteSpace: "nowrap",
                  transition: "background .15s",
                  width: "100%",
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--border)"; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ fontSize: "1.1rem", minWidth: "20px", textAlign: "center" }}>{item.icon}</span>
                {!collapsed && item.label}
              </button>
            );
          })}
        </nav>

        {/* collapse button */}
        <button
          onClick={() => setCollapsed(c => !c)}
          style={{ margin: "8px", padding: "8px", borderRadius: "8px", border: "1px solid var(--border)", background: "transparent", cursor: "pointer", color: "var(--text-muted)", fontSize: ".85rem" }}
        >
          {collapsed ? "→" : "← Sbalit"}
        </button>
      </aside>

      {/* HLAVNÍ OBSAH */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "auto" }}>

        {/* topbar */}
        <header style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "12px", padding: "12px 24px", borderBottom: "1px solid var(--border)", background: "var(--bg-card)" }}>
          <span style={{ fontSize: ".85rem", color: "var(--text-muted)" }}>{user?.email}</span>
          <button
            onClick={() => setTheme(t => t === "light" ? "dark" : "light")}
            style={{ display:"flex", alignItems:"center", gap:"6px", padding:"8px 14px", borderRadius:"8px", border:"none", cursor:"pointer", background:"#ede9fe", color:"#7c3aed", fontWeight:600, fontSize:".9rem" }}
          >
            {theme === "light" ? "🌙 Dark" : "☀️ Light"}
          </button>
          <button
            onClick={handleLogout}
            style={{ display:"flex", alignItems:"center", gap:"6px", padding:"8px 14px", borderRadius:"8px", border:"none", cursor:"pointer", background:"#ede9fe", color:"#7c3aed", fontWeight:600, fontSize:".9rem" }}
          >
            Odhlásit se
          </button>
        </header>

        {/* obsah stránky */}
        <main style={{ flex: 1, padding: "32px 24px" }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}