import { Link } from "react-router-dom";
import { useEffect, useRef } from "react";
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
        .step-line::after { content:''; position:absolute; top:28px; left:calc(50% + 28px); width:calc(100% - 56px); height:2px; background: linear-gradient(90deg,#7c3aed,#a78bfa); opacity:.3; }
      `}</style>

      {/* NAV */}
      <nav style={{ position:"sticky", top:0, zIndex:100, display:"flex", justifyContent:"space-between", alignItems:"center", padding:"16px 48px", backdropFilter:"blur(12px)", background:"rgba(255,255,255,0.85)", borderBottom:"1px solid rgba(124,58,237,.1)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <img src={logo} alt="SellFunl" style={{ height:"32px" }} />
          <span style={{ fontSize:"1.15rem", fontWeight:700, color:"#1e1b4b" }}>SellFunl</span>
        </div>
        <div style={{ display:"flex", gap:"12px" }}>
          <Link to="/login" style={{ padding:"8px 20px", borderRadius:"8px", border:"1px solid #e5e7eb", color:"#1e1b4b", textDecoration:"none", fontWeight:500, fontSize:".9rem" }}>Přihlásit se</Link>
          <Link to="/register" style={{ padding:"8px 20px", borderRadius:"8px", background:"#7c3aed", color:"#fff", textDecoration:"none", fontWeight:600, fontSize:".9rem" }}>Registrace zdarma</Link>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ position:"relative", overflow:"hidden", minHeight:"90vh", display:"flex", alignItems:"center", justifyContent:"center", background:"linear-gradient(135deg,#faf5ff 0%,#eff6ff 100%)", padding:"80px 24px" }}>
        {/* dekorativní blobby */}
        <div className="blob" style={{ position:"absolute", top:"-80px", right:"-80px", width:"500px", height:"500px", borderRadius:"50%", background:"radial-gradient(circle,#7c3aed,transparent 70%)", pointerEvents:"none" }}/>
        <div className="blob" style={{ position:"absolute", bottom:"-100px", left:"-60px", width:"400px", height:"400px", borderRadius:"50%", background:"radial-gradient(circle,#3b82f6,transparent 70%)", pointerEvents:"none", animationDelay:"3s" }}/>

        <div style={{ position:"relative", display:"grid", gridTemplateColumns:"1fr 1fr", gap:"64px", maxWidth:"1100px", width:"100%", alignItems:"center" }}>
          {/* text */}
          <div>
            <div className="hero-title" style={{ display:"inline-block", background:"#ede9fe", color:"#7c3aed", borderRadius:"20px", padding:"6px 16px", fontSize:".85rem", fontWeight:600, marginBottom:"24px" }}>
              Prodávej online — jednoduše a rychle
            </div>
            <h1 className="hero-title" style={{ fontSize:"clamp(2rem,4vw,3.2rem)", fontWeight:800, lineHeight:1.15, color:"#1e1b4b", marginBottom:"20px" }}>
              Vytvoř prodejní<br/><span style={{ color:"#7c3aed" }}>funnel za minuty</span>
            </h1>
            <p className="hero-sub" style={{ fontSize:"1.1rem", color:"#6b7280", lineHeight:1.75, marginBottom:"36px" }}>
              SellFunl ti umožní postavit prodejní stránku, celý konverzní trychtýř i vícejazyčný web — bez kódu, přímo napojený na platební bránu.
            </p>
            <div className="hero-cta" style={{ display:"flex", gap:"14px", flexWrap:"wrap" }}>
              <Link to="/register" style={{ padding:"14px 32px", borderRadius:"10px", background:"#7c3aed", color:"#fff", textDecoration:"none", fontWeight:700, fontSize:"1rem", boxShadow:"0 4px 20px rgba(124,58,237,.35)" }}>Začít zdarma →</Link>
              <Link to="/login" style={{ padding:"14px 32px", borderRadius:"10px", border:"1px solid #e5e7eb", color:"#1e1b4b", textDecoration:"none", fontWeight:500, fontSize:"1rem" }}>Přihlásit se</Link>
            </div>
          </div>

          {/* animovaný funnel */}
          <div className="funnel-anim" style={{ display:"flex", justifyContent:"center" }}>
            <svg width="280" height="280" viewBox="0 0 280 280">
              <defs>
                <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#7c3aed"/>
                  <stop offset="100%" stopColor="#a78bfa"/>
                </linearGradient>
                <linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#6d28d9"/>
                  <stop offset="100%" stopColor="#8b5cf6"/>
                </linearGradient>
                <linearGradient id="g3" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#5b21b6"/>
                  <stop offset="100%" stopColor="#7c3aed"/>
                </linearGradient>
              </defs>
              {/* vrstva 1 */}
              <rect x="30" y="20" width="220" height="60" rx="12" fill="url(#g1)" opacity=".95"/>
              <text x="140" y="56" textAnchor="middle" fill="white" fontSize="14" fontWeight="600">Získání kontaktu</text>
              {/* šipka */}
              <polygon points="140,88 128,100 152,100" fill="#a78bfa" opacity=".6"/>
              {/* vrstva 2 */}
              <rect x="55" y="108" width="170" height="54" rx="12" fill="url(#g2)" opacity=".9"/>
              <text x="140" y="141" textAnchor="middle" fill="white" fontSize="14" fontWeight="600">První prodej</text>
              {/* šipka */}
              <polygon points="140,170 128,182 152,182" fill="#8b5cf6" opacity=".6"/>
              {/* vrstva 3 */}
              <rect x="80" y="190" width="120" height="50" rx="12" fill="url(#g3)" opacity=".85"/>
              <text x="140" y="221" textAnchor="middle" fill="white" fontSize="13" fontWeight="600">Opakovaný prodej</text>
              {/* dekorativní tečky */}
              <circle cx="24" cy="50" r="6" fill="#a78bfa" opacity=".4"/>
              <circle cx="256" cy="50" r="6" fill="#a78bfa" opacity=".4"/>
              <circle cx="48" cy="135" r="5" fill="#8b5cf6" opacity=".35"/>
              <circle cx="232" cy="135" r="5" fill="#8b5cf6" opacity=".35"/>
            </svg>
          </div>
        </div>
      </section>

      {/* FUNKCE */}
      <section style={{ padding:"100px 24px", background:"#fff" }}>
        <div style={{ maxWidth:"1100px", margin:"0 auto" }}>
          <h2 className="reveal" style={{ textAlign:"center", fontSize:"2rem", fontWeight:800, color:"#1e1b4b", marginBottom:"12px" }}>Co SellFunl umí</h2>
          <p className="reveal" style={{ textAlign:"center", color:"#6b7280", marginBottom:"64px", fontSize:"1.05rem" }}>Vše co potřebuješ k prodeji online — na jednom místě.</p>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))", gap:"24px" }}>
            {features.map((f, i) => (
              <div key={f.title} className="reveal card-hover" style={{ background:"#faf5ff", border:"1px solid #ede9fe", borderRadius:"16px", padding:"32px 24px", transitionDelay:`${i*0.1}s` }}>
                <div style={{ fontSize:"2.2rem", marginBottom:"16px" }}>{f.icon}</div>
                <h3 style={{ fontSize:"1rem", fontWeight:700, color:"#1e1b4b", marginBottom:"10px" }}>{f.title}</h3>
                <p style={{ fontSize:".9rem", color:"#6b7280", lineHeight:1.7 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* JAK TO FUNGUJE */}
      <section style={{ padding:"100px 24px", background:"linear-gradient(135deg,#faf5ff,#eff6ff)" }}>
        <div style={{ maxWidth:"1000px", margin:"0 auto" }}>
          <h2 className="reveal" style={{ textAlign:"center", fontSize:"2rem", fontWeight:800, color:"#1e1b4b", marginBottom:"12px" }}>Jak to funguje?</h2>
          <p className="reveal" style={{ textAlign:"center", color:"#6b7280", marginBottom:"64px", fontSize:"1.05rem" }}>Čtyři kroky k prvnímu prodeji.</p>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:"24px" }}>
            {steps.map((s, i) => (
              <div key={s.num} className="reveal" style={{ textAlign:"center", transitionDelay:`${i*0.12}s` }}>
                <div style={{ width:"56px", height:"56px", borderRadius:"50%", background:"#7c3aed", color:"#fff", fontSize:"1rem", fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>{s.num}</div>
                <h3 style={{ fontSize:"1rem", fontWeight:700, color:"#1e1b4b", marginBottom:"8px" }}>{s.title}</h3>
                <p style={{ fontSize:".875rem", color:"#6b7280" }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRO KOHO */}
      <section style={{ padding:"100px 24px", background:"#fff" }}>
        <div style={{ maxWidth:"900px", margin:"0 auto", textAlign:"center" }}>
          <h2 className="reveal" style={{ fontSize:"2rem", fontWeight:800, color:"#1e1b4b", marginBottom:"12px" }}>Pro koho je SellFunl?</h2>
          <p className="reveal" style={{ color:"#6b7280", marginBottom:"56px", fontSize:"1.05rem" }}>Ideální pro každého, kdo prodává produkty nebo služby online.</p>
          <div style={{ display:"flex", justifyContent:"center", gap:"20px", flexWrap:"wrap" }}>
            {forWho.map((w, i) => (
              <div key={w.label} className="reveal card-hover" style={{ background:"#faf5ff", border:"1px solid #ede9fe", borderRadius:"14px", padding:"28px 36px", minWidth:"170px", transitionDelay:`${i*0.1}s` }}>
                <div style={{ fontSize:"2.2rem", marginBottom:"10px" }}>{w.icon}</div>
                <div style={{ fontSize:".95rem", fontWeight:600, color:"#1e1b4b" }}>{w.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ textAlign:"center", padding:"100px 24px", background:"linear-gradient(135deg,#7c3aed,#4f46e5)", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:"-60px", left:"50%", transform:"translateX(-50%)", width:"600px", height:"600px", borderRadius:"50%", background:"rgba(255,255,255,.05)", pointerEvents:"none" }}/>
        <h2 className="reveal" style={{ fontSize:"2.2rem", fontWeight:800, color:"#fff", marginBottom:"16px" }}>Začni prodávat ještě dnes</h2>
        <p className="reveal" style={{ color:"#ede9fe", fontSize:"1.05rem", marginBottom:"40px" }}>Registrace je zdarma. Žádná platební karta není potřeba.</p>
        <Link to="/register" className="reveal" style={{ display:"inline-block", padding:"16px 48px", borderRadius:"12px", background:"#fff", color:"#7c3aed", textDecoration:"none", fontWeight:800, fontSize:"1.1rem", boxShadow:"0 8px 32px rgba(0,0,0,.2)" }}>
          Registrace zdarma →
        </Link>
      </section>

      {/* FOOTER */}
      <footer style={{ textAlign:"center", padding:"24px", borderTop:"1px solid #e5e7eb", color:"#9ca3af", fontSize:".85rem", background:"#fff" }}>
        © 2026 SellFunl — Všechna práva vyhrazena
      </footer>
    </>
  );
}