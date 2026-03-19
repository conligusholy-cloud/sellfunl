import { Link } from "react-router-dom";
import { useEffect } from "react";
import logo from "../assets/logo.svg";

const features = [
  { icon: "⚡", title: "Prodejní stránka za minuty", desc: "Profesionální prodejní stránka přímo napojená na platební bránu — bez kódu." },
  { icon: "🎯", title: "Celý konverzní trychtýř", desc: "Od získání kontaktu, přes první prodej, až k opakovaným nákupům na jednom místě." },
  { icon: "💳", title: "Platební brána v ceně", desc: "Žádné složité integrace. Přijímej platby hned od prvního dne." },
  { icon: "🌍", title: "Vícejazyčné stránky", desc: "Snadná migrace stránek do jiných jazyků. Expanduj na nové trhy bez práce navíc." },
];

const forWho = [
  { icon: "🛍️", label: "E-commerce prodejci" },
  { icon: "📚", label: "Autoři online kurzů" },
  { icon: "💼", label: "Konzultanti a koučové" },
  { icon: "🚀", label: "Startupy a podnikatelé" },
];

const steps = [
  { num: "01", title: "Registruj se zdarma", desc: "Žádná karta, žádný závazek." },
  { num: "02", title: "Vytvoř svůj funnel", desc: "Použij šablony nebo začni od nuly." },
  { num: "03", title: "Napoj platební bránu", desc: "Během pár kliknutí." },
  { num: "04", title: "Začni prodávat", desc: "Sdílej odkaz a sleduj výsledky." },
];

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll(".reveal");
    const io = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add("visible"); }),
      { threshold: 0.15 }
    );
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);
}

export default function Landing() {
  useReveal();

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(30px); } to { opacity:1; transform:translateY(0); } }
        @keyframes float  { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-12px); } }
        @keyframes pulse  { 0%,100% { opacity:.15; transform:scale(1); } 50% { opacity:.25; transform:scale(1.08); } }
        .hero-title { animation: fadeUp .7s ease both; }
        .hero-sub   { animation: fadeUp .7s .15s ease both; }
        .hero-cta   { animation: fadeUp .7s .3s ease both; }
        .funnel-anim { animation: float 4s ease-in-out infinite; }
        .blob { animation: pulse 6s ease-in-out infinite; }
        .reveal { opacity:0; transform:translateY(24px); transition: opacity .6s ease, transform .6s ease; }
        .reveal.visible { opacity:1; transform:translateY(0); }
        .card-hover { transition: transform .2s, box-shadow .2s; }
        .card-hover:hover { transform:translateY(-4px); box-shadow:0 12px 32px rgba(124,58,237,.15); }

        /* NAV */
        .nav-links { display:flex; gap:12px; }
        .nav-btn-outline { padding:8px 18px; border-radius:8px; border:1px solid #e5e7eb; color:#1e1b4b; text-decoration:none; font-weight:500; font-size:.9rem; white-space:nowrap; }
        .nav-btn-primary { padding:8px 18px; border-radius:8px; background:#7c3aed; color:#fff; text-decoration:none; font-weight:600; font-size:.9rem; white-space:nowrap; }

        /* HERO GRID */
        .hero-grid { display:grid; grid-template-columns:1fr 1fr; gap:64px; max-width:1100px; width:100%; align-items:center; }
        .hero-funnel { display:flex; justify-content:center; }

        /* RESPONSIVE */
        @media (max-width: 768px) {
          .nav-links { gap:8px; }
          .nav-btn-outline { padding:6px 12px; font-size:.8rem; }
          .nav-btn-primary { padding:6px 12px; font-size:.8rem; }
          .hero-grid { grid-template-columns:1fr; gap:32px; text-align:center; }
          .hero-funnel { order:-1; }
          .hero-funnel svg { width:200px; height:200px; }
          .hero-cta { justify-content:center !important; }
          .section-pad { padding:60px 16px !important; }
          .features-grid { grid-template-columns:1fr !important; }
          .steps-grid { grid-template-columns:1fr 1fr !important; }
          .forwho-grid { gap:12px !important; }
          .forwho-card { padding:20px 20px !important; min-width:140px !important; }
          .cta-title { font-size:1.6rem !important; }
        }

        @media (max-width: 480px) {
          nav { padding:12px 16px !important; }
          .steps-grid { grid-template-columns:1fr !important; }
          .nav-btn-outline { display:none; }
        }
      `}</style>

      {/* NAV */}
      <nav style={{ position:"sticky", top:0, zIndex:100, display:"flex", justifyContent:"space-between", alignItems:"center", padding:"16px 48px", backdropFilter:"blur(12px)", background:"rgba(255,255,255,0.85)", borderBottom:"1px solid rgba(124,58,237,.1)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <img src={logo} alt="SellFunl" style={{ height:"28px" }} />
          <span style={{ fontSize:"1.1rem", fontWeight:700, color:"#1e1b4b" }}>SellFunl</span>
        </div>
        <div className="nav-links">
          <Link to="/login" className="nav-btn-outline">Přihlásit se</Link>
          <Link to="/register" className="nav-btn-primary">Registrace zdarma</Link>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ position:"relative", overflow:"hidden", minHeight:"85vh", display:"flex", alignItems:"center", justifyContent:"center", background:"linear-gradient(135deg,#faf5ff 0%,#eff6ff 100%)", padding:"60px 24px" }}>
        <div className="blob" style={{ position:"absolute", top:"-80px", right:"-80px", width:"500px", height:"500px", borderRadius:"50%", background:"radial-gradient(circle,#7c3aed,transparent 70%)", pointerEvents:"none" }}/>
        <div className="blob" style={{ position:"absolute", bottom:"-100px", left:"-60px", width:"400px", height:"400px", borderRadius:"50%", background:"radial-gradient(circle,#3b82f6,transparent 70%)", pointerEvents:"none", animationDelay:"3s" }}/>

        <div className="hero-grid">
          {/* text */}
          <div>
            <div className="hero-title" style={{ display:"inline-block", background:"#ede9fe", color:"#7c3aed", borderRadius:"20px", padding:"6px 16px", fontSize:".85rem", fontWeight:600, marginBottom:"20px" }}>
              Prodávej online — jednoduše a rychle
            </div>
            <h1 className="hero-title" style={{ fontSize:"clamp(1.8rem,4vw,3.2rem)", fontWeight:800, lineHeight:1.15, color:"#1e1b4b", marginBottom:"20px" }}>
              Vytvoř prodejní<br/><span style={{ color:"#7c3aed" }}>funnel za minuty</span>
            </h1>
            <p className="hero-sub" style={{ fontSize:"clamp(.95rem,2vw,1.1rem)", color:"#6b7280", lineHeight:1.75, marginBottom:"32px" }}>
              SellFunl ti umožní postavit prodejní stránku, celý konverzní trychtýř i vícejazyčný web — bez kódu, přímo napojený na platební bránu.
            </p>
            <div className="hero-cta" style={{ display:"flex", gap:"12px", flexWrap:"wrap" }}>
              <Link to="/register" style={{ padding:"13px 28px", borderRadius:"10px", background:"#7c3aed", color:"#fff", textDecoration:"none", fontWeight:700, fontSize:"1rem", boxShadow:"0 4px 20px rgba(124,58,237,.35)" }}>Začít zdarma →</Link>
              <Link to="/login" style={{ padding:"13px 28px", borderRadius:"10px", border:"1px solid #e5e7eb", color:"#1e1b4b", textDecoration:"none", fontWeight:500, fontSize:"1rem" }}>Přihlásit se</Link>
            </div>
          </div>

          {/* funnel SVG */}
          <div className="hero-funnel funnel-anim">
            <svg width="280" height="280" viewBox="0 0 280 280">
              <defs>
                <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#7c3aed"/><stop offset="100%" stopColor="#a78bfa"/>
                </linearGradient>
                <linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#6d28d9"/><stop offset="100%" stopColor="#8b5cf6"/>
                </linearGradient>
                <linearGradient id="g3" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#5b21b6"/><stop offset="100%" stopColor="#7c3aed"/>
                </linearGradient>
              </defs>
              <rect x="30" y="20" width="220" height="60" rx="12" fill="url(#g1)" opacity=".95"/>
              <text x="140" y="56" textAnchor="middle" fill="white" fontSize="14" fontWeight="600">Získání kontaktu</text>
              <polygon points="140,88 128,100 152,100" fill="#a78bfa" opacity=".6"/>
              <rect x="55" y="108" width="170" height="54" rx="12" fill="url(#g2)" opacity=".9"/>
              <text x="140" y="141" textAnchor="middle" fill="white" fontSize="14" fontWeight="600">První prodej</text>
              <polygon points="140,170 128,182 152,182" fill="#8b5cf6" opacity=".6"/>
              <rect x="80" y="190" width="120" height="50" rx="12" fill="url(#g3)" opacity=".85"/>
              <text x="140" y="221" textAnchor="middle" fill="white" fontSize="13" fontWeight="600">Opakovaný prodej</text>
              <circle cx="24" cy="50" r="6" fill="#a78bfa" opacity=".4"/>
              <circle cx="256" cy="50" r="6" fill="#a78bfa" opacity=".4"/>
              <circle cx="48" cy="135" r="5" fill="#8b5cf6" opacity=".35"/>
              <circle cx="232" cy="135" r="5" fill="#8b5cf6" opacity=".35"/>
            </svg>
          </div>
        </div>
      </section>

      {/* FUNKCE */}
      <section className="section-pad" style={{ padding:"100px 24px", background:"#fff" }}>
        <div style={{ maxWidth:"1100px", margin:"0 auto" }}>
          <h2 className="reveal" style={{ textAlign:"center", fontSize:"clamp(1.5rem,3vw,2rem)", fontWeight:800, color:"#1e1b4b", marginBottom:"12px" }}>Co SellFunl umí</h2>
          <p className="reveal" style={{ textAlign:"center", color:"#6b7280", marginBottom:"48px", fontSize:"1.05rem" }}>Vše co potřebuješ k prodeji online — na jednom místě.</p>
          <div className="features-grid" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))", gap:"20px" }}>
            {features.map((f, i) => (
              <div key={f.title} className="reveal card-hover" style={{ background:"#faf5ff", border:"1px solid #ede9fe", borderRadius:"16px", padding:"28px 22px", transitionDelay:`${i*0.1}s` }}>
                <div style={{ fontSize:"2rem", marginBottom:"14px" }}>{f.icon}</div>
                <h3 style={{ fontSize:"1rem", fontWeight:700, color:"#1e1b4b", marginBottom:"8px" }}>{f.title}</h3>
                <p style={{ fontSize:".9rem", color:"#6b7280", lineHeight:1.7 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* JAK TO FUNGUJE */}
      <section className="section-pad" style={{ padding:"100px 24px", background:"linear-gradient(135deg,#faf5ff,#eff6ff)" }}>
        <div style={{ maxWidth:"1000px", margin:"0 auto" }}>
          <h2 className="reveal" style={{ textAlign:"center", fontSize:"clamp(1.5rem,3vw,2rem)", fontWeight:800, color:"#1e1b4b", marginBottom:"12px" }}>Jak to funguje?</h2>
          <p className="reveal" style={{ textAlign:"center", color:"#6b7280", marginBottom:"48px", fontSize:"1.05rem" }}>Čtyři kroky k prvnímu prodeji.</p>
          <div className="steps-grid" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:"24px" }}>
            {steps.map((s, i) => (
              <div key={s.num} className="reveal" style={{ textAlign:"center", transitionDelay:`${i*0.12}s` }}>
                <div style={{ width:"52px", height:"52px", borderRadius:"50%", background:"#7c3aed", color:"#fff", fontSize:"1rem", fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 14px" }}>{s.num}</div>
                <h3 style={{ fontSize:"1rem", fontWeight:700, color:"#1e1b4b", marginBottom:"6px" }}>{s.title}</h3>
                <p style={{ fontSize:".875rem", color:"#6b7280" }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRO KOHO */}
      <section className="section-pad" style={{ padding:"100px 24px", background:"#fff" }}>
        <div style={{ maxWidth:"900px", margin:"0 auto", textAlign:"center" }}>
          <h2 className="reveal" style={{ fontSize:"clamp(1.5rem,3vw,2rem)", fontWeight:800, color:"#1e1b4b", marginBottom:"12px" }}>Pro koho je SellFunl?</h2>
          <p className="reveal" style={{ color:"#6b7280", marginBottom:"48px", fontSize:"1.05rem" }}>Ideální pro každého, kdo prodává produkty nebo služby online.</p>
          <div className="forwho-grid" style={{ display:"flex", justifyContent:"center", gap:"16px", flexWrap:"wrap" }}>
            {forWho.map((w, i) => (
              <div key={w.label} className="reveal card-hover forwho-card" style={{ background:"#faf5ff", border:"1px solid #ede9fe", borderRadius:"14px", padding:"24px 28px", minWidth:"160px", transitionDelay:`${i*0.1}s` }}>
                <div style={{ fontSize:"2rem", marginBottom:"10px" }}>{w.icon}</div>
                <div style={{ fontSize:".9rem", fontWeight:600, color:"#1e1b4b" }}>{w.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section-pad" style={{ textAlign:"center", padding:"100px 24px", background:"linear-gradient(135deg,#7c3aed,#4f46e5)", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:"-60px", left:"50%", transform:"translateX(-50%)", width:"600px", height:"600px", borderRadius:"50%", background:"rgba(255,255,255,.05)", pointerEvents:"none" }}/>
        <h2 className="reveal cta-title" style={{ fontSize:"clamp(1.5rem,3vw,2.2rem)", fontWeight:800, color:"#fff", marginBottom:"16px" }}>Začni prodávat ještě dnes</h2>
        <p className="reveal" style={{ color:"#ede9fe", fontSize:"1.05rem", marginBottom:"36px" }}>Registrace je zdarma. Žádná platební karta není potřeba.</p>
        <Link to="/register" className="reveal" style={{ display:"inline-block", padding:"14px 40px", borderRadius:"12px", background:"#fff", color:"#7c3aed", textDecoration:"none", fontWeight:800, fontSize:"1.05rem", boxShadow:"0 8px 32px rgba(0,0,0,.2)" }}>
          Registrace zdarma →
        </Link>
      </section>

      {/* FOOTER */}
      <footer style={{ textAlign:"center", padding:"20px 16px", borderTop:"1px solid #e5e7eb", color:"#9ca3af", fontSize:".85rem", background:"#fff" }}>
        © 2026 SellFunl — Všechna práva vyhrazena
      </footer>
    </>
  );
}