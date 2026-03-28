import { useState, useEffect } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../firebase/config";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { useAuthState } from "../hooks/useAuthState";
import StripeConnect from "../components/StripeConnect";
import AIAssistant from "../components/AIAssistant";
import logo from "../assets/logo.svg";

const menuItems = [
  { icon: "🏠", label: "Přehled",    path: "/dashboard" },
  { icon: "📄", label: "Stránky",    path: "/pages" },
  { icon: "🔀", label: "Funely",     path: "/funnels" },
  { icon: "🌐", label: "Domény",     path: "/domains" },
  { icon: "📣", label: "FB reklamy", path: "/fb-ads" },
];

export default function Dashboard() {
  const { user }  = useAuthState();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [theme,      setTheme]      = useState(localStorage.getItem("theme") || "light");
  const [collapsed,  setCollapsed]  = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile,   setIsMobile]   = useState(window.innerWidth < 768);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    function onResize() { setIsMobile(window.innerWidth < 768); }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  async function handleLogout() {
    await signOut(auth);
    navigate("/login");
  }

  const sidebarW = isMobile ? "240px" : collapsed ? "64px" : "220px";

  return (
    <div style={{ display:"flex", minHeight:"100vh", background:"var(--bg)", position:"relative" }}>

      {isMobile && mobileOpen && (
        <div onClick={() => setMobileOpen(false)}
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.4)", zIndex:49 }} />
      )}

      <aside style={{
        width: sidebarW, minWidth: sidebarW,
        background: "var(--bg-card)",
        borderRight: "1px solid var(--border)",
        display: "flex", flexDirection: "column",
        transition: "width .2s, min-width .2s, transform .2s",
        overflow: "hidden",
        ...(isMobile ? {
          position:"fixed", top:0, left:0, height:"100vh", zIndex:50,
          transform: mobileOpen ? "translateX(0)" : "translateX(-100%)",
          boxShadow: mobileOpen ? "4px 0 24px rgba(0,0,0,.15)" : "none",
        } : {}),
      }}>

        <div style={{ padding:"20px 16px", display:"flex", alignItems:"center", gap:"10px", borderBottom:"1px solid var(--border)" }}>
          <img src={logo} alt="SellFunl" style={{ height:"32px", minWidth:"32px" }} />
          {(!collapsed || isMobile) && <span style={{ fontWeight:700, fontSize:"1.1rem", whiteSpace:"nowrap" }}>SellFunl</span>}
          {isMobile && (
            <button onClick={() => setMobileOpen(false)}
              style={{ marginLeft:"auto", background:"none", border:"none", cursor:"pointer", fontSize:"1.2rem", color:"var(--text-muted)" }}>✕</button>
          )}
        </div>

        <nav style={{ flex:1, padding:"12px 8px", display:"flex", flexDirection:"column", gap:"4px" }}>
          {menuItems.map(item => {
            const active = location.pathname === item.path;
            return (
              <button key={item.path} onClick={() => navigate(item.path)}
                title={collapsed && !isMobile ? item.label : ""}
                style={{
                  display:"flex", alignItems:"center", gap:"10px",
                  padding:"10px 12px", borderRadius:"8px", border:"none", cursor:"pointer",
                  background: active ? "#ede9fe" : "transparent",
                  color: active ? "#7c3aed" : "var(--text)",
                  fontWeight: active ? 600 : 400,
                  fontSize:".9rem", textAlign:"left", whiteSpace:"nowrap",
                  transition:"background .15s", width:"100%",
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--border)"; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ fontSize:"1.1rem", minWidth:"20px", textAlign:"center" }}>{item.icon}</span>
                {(!collapsed || isMobile) && item.label}
              </button>
            );
          })}
        </nav>

        {!isMobile && (
          <button onClick={() => setCollapsed(c => !c)}
            style={{ margin:"8px", padding:"8px", borderRadius:"8px", border:"1px solid var(--border)", background:"transparent", cursor:"pointer", color:"var(--text-muted)", fontSize:".85rem" }}>
            {collapsed ? "→" : "← Sbalit"}
          </button>
        )}

        {isMobile && (
          <div style={{ padding:"12px", borderTop:"1px solid var(--border)" }}>
            <button onClick={handleLogout}
              style={{ width:"100%", padding:"10px", borderRadius:"8px", border:"none", cursor:"pointer", background:"#ede9fe", color:"#7c3aed", fontWeight:600, fontSize:".9rem" }}>
              Odhlásit se
            </button>
          </div>
        )}
      </aside>

      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"auto", minWidth:0 }}>

        <header style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:"12px", padding:"12px 16px", borderBottom:"1px solid var(--border)", background:"var(--bg-card)", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
            {isMobile && (
              <button onClick={() => setMobileOpen(true)}
                style={{ background:"none", border:"none", cursor:"pointer", fontSize:"1.4rem", color:"var(--text)", padding:"4px", lineHeight:1 }}>☰</button>
            )}
            {isMobile && <img src={logo} alt="SellFunl" style={{ height:"24px" }} />}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:"8px", marginLeft:"auto" }}>
            {!isMobile && <span style={{ fontSize:".7rem", color:"var(--text-muted)", opacity: 0.6 }} title="Verze aplikace">v{__APP_VERSION__}</span>}
            {!isMobile && <span style={{ fontSize:".85rem", color:"var(--text-muted)" }}>{user?.email}</span>}
            <button onClick={() => setTheme(t => t === "light" ? "dark" : "light")}
              style={{ padding:"7px 12px", borderRadius:"8px", border:"none", cursor:"pointer", background:"#ede9fe", color:"#7c3aed", fontWeight:600, fontSize:".85rem" }}>
              {theme === "light" ? "🌙" : "☀️"}
            </button>
            {!isMobile && (
              <button onClick={handleLogout}
                style={{ padding:"7px 12px", borderRadius:"8px", border:"none", cursor:"pointer", background:"#ede9fe", color:"#7c3aed", fontWeight:600, fontSize:".85rem" }}>
                Odhlásit se
              </button>
            )}
          </div>
        </header>

        <main style={{ flex:1, padding: isMobile ? "16px" : "32px 24px", overflowX:"hidden" }}>
          {location.pathname === "/dashboard" && (
            <div>
              <h2 style={{ fontSize:"1.3rem", fontWeight:700, marginBottom:"24px", color:"var(--text)" }}>
                Přehled
              </h2>
              <div style={{ padding:"20px", borderRadius:"12px", background:"var(--bg-card)", border:"1px solid var(--border)", marginBottom:"20px" }}>
                <p style={{ fontSize:"1rem", fontWeight:600, color:"var(--text)", marginBottom:"4px" }}>
                  Vítej zpět{user?.email ? `, ${user.email.split("@")[0]}` : ""}!
                </p>
                <p style={{ fontSize:".88rem", color:"var(--text-muted)" }}>
                  Zde najdeš přehled svého účtu a nastavení plateb.
                </p>
              </div>
              <div style={{ marginBottom:"24px" }}>
                <h3 style={{ fontSize:".85rem", fontWeight:600, color:"var(--text-muted)", marginBottom:"12px", textTransform:"uppercase", letterSpacing:".05em" }}>
                  Platební účet
                </h3>
                <StripeConnect />
              </div>
            </div>
          )}
          <Outlet />
        </main>
      </div>
      <AIAssistant />
    </div>
  );
}