import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { doc, getDoc, addDoc, collection } from "firebase/firestore";
import { db } from "../firebase/config";
import { buildHeroHtml } from "./modules/HeroEditor";

export default function PublicPage() {
  const { id } = useParams();
  const [page,    setPage]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({});

  useEffect(() => {
    async function fetchPage() {
      const snap = await getDoc(doc(db, "pages", id));
      if (snap.exists()) {
        setPage(snap.data());
        // Zaznamenej návštěvu
        try {
          await addDoc(collection(db, "visits"), { pageId: id, ts: Date.now() });
        } catch {}
      }
      setLoading(false);
    }
    fetchPage();
  }, [id]);

  async function handleSubmit() {
    try {
      await addDoc(collection(db, "conversions"), { pageId: id, data: formData, ts: Date.now() });
      setSubmitted(true);
    } catch {}
  }

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", fontFamily:"Inter,sans-serif", color:"#6b7280" }}>
      Načítám stránku...
    </div>
  );

  if (!page) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", fontFamily:"Inter,sans-serif", color:"#6b7280" }}>
      Stránka nenalezena.
    </div>
  );

  if (!page.published) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", fontFamily:"Inter,sans-serif", color:"#6b7280" }}>
      Tato stránka zatím není zveřejněna.
    </div>
  );

  const formFields = page.formFields || [];

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        .pub-container { max-width:720px; margin:0 auto; background:#fff; min-height:100vh; box-shadow:0 0 40px rgba(0,0,0,.08); }
        .pub-hero-text { padding:36px 48px 24px; border-bottom:1px solid #f0f0f0; }
        .pub-body      { padding:24px 48px; border-bottom:1px solid #f0f0f0; }
        .pub-cta       { padding:24px 48px 48px; }
        .pub-input     { width:100%; padding:11px 14px; border:1px solid #e5e7eb; border-radius:8px; font-size:.95rem; background:#f9fafb; outline:none; font-family:inherit; margin-bottom:10px; }
        .pub-textarea  { width:100%; padding:11px 14px; border:1px solid #e5e7eb; border-radius:8px; font-size:.95rem; background:#f9fafb; outline:none; font-family:inherit; margin-bottom:10px; min-height:80px; resize:vertical; }
        .pub-btn       { display:block; width:100%; padding:15px; background:#7c3aed; color:#fff; border:none; border-radius:10px; text-decoration:none; font-weight:700; font-size:1.05rem; text-align:center; cursor:pointer; transition:opacity .2s; }
        .pub-btn:hover { opacity:.9; }
        .pub-content h2 { font-size:1.35rem; font-weight:700; color:#1e1b4b; margin:20px 0 8px; }
        .pub-content h3 { font-size:1.1rem; font-weight:600; color:#1e1b4b; margin:16px 0 6px; }
        .pub-content ul { padding-left:20px; margin:8px 0; }
        .pub-content li { margin-bottom:5px; }
        .pub-content p  { margin:0 0 12px; }
        .pub-content blockquote { border-left:3px solid #7c3aed; padding:8px 16px; margin:16px 0; background:#faf5ff; border-radius:0 8px 8px 0; color:#6b7280; font-style:italic; }
        .pub-content strong { font-weight:700; }
        .pub-content em { font-style:italic; }
        .pub-content img { max-width:100% !important; height:auto !important; border-radius:8px; }
        .pub-content video { max-width:100% !important; border-radius:8px; }

        @media (max-width: 600px) {
          .pub-hero-text { padding:24px 20px 20px; }
          .pub-body      { padding:20px 20px; }
          .pub-cta       { padding:20px 20px 36px; }
          .pub-hero-text h1 { font-size:1.5rem !important; }
          .pub-hero-text p  { font-size:.95rem !important; }
          .pub-content       { font-size:.9rem !important; }
          .pub-price         { font-size:1.6rem !important; }
        }
      `}</style>

      <div style={{ fontFamily:"-apple-system,'Inter',sans-serif", background:"#f8f8fc", minHeight:"100vh" }}>
        <div className="pub-container">

          {/* Hero sekce */}
          {page.hero && (
            <iframe
              srcDoc={buildHeroHtml(page.hero)}
              sandbox="allow-scripts"
              scrolling="no"
              onLoad={e => {
                try {
                  const d = e.target.contentDocument;
                  const h = d?.documentElement?.scrollHeight || d?.body?.scrollHeight;
                  if (h) e.target.style.height = h + "px";
                } catch {}
              }}
              style={{ border:"none", width:"100%", minHeight:"300px", display:"block" }}
            />
          )}

          {/* Nadpis + podnadpis */}
          {(page.headline || page.subline || page.image) && (
            <div className="pub-hero-text">
              {page.image && (
                <img src={page.image} alt=""
                  style={{ width:"100%", maxHeight:"300px", objectFit:"cover", borderRadius:"10px", marginBottom:"20px" }}
                  onError={e => e.target.style.display = "none"} />
              )}
              {page.headline && (
                <h1 style={{ fontSize:"2rem", fontWeight:800, color:"#1e1b4b", lineHeight:1.2, marginBottom:"10px" }}>
                  {page.headline}
                </h1>
              )}
              {page.subline && (
                <p style={{ fontSize:"1.05rem", color:"#6b7280", lineHeight:1.6 }}>{page.subline}</p>
              )}
            </div>
          )}

          {/* Obsah */}
          {(page.text || page.video) && (
            <div className="pub-body">
              {page.text && (
                <div className="pub-content"
                  style={{ fontSize:".97rem", lineHeight:1.75, color:"#374151" }}
                  dangerouslySetInnerHTML={{ __html: page.text }}
                />
              )}
              {page.video && (
                <div style={{ marginTop:"20px", borderRadius:"10px", overflow:"hidden", aspectRatio:"16/9" }}>
                  <iframe
                    src={page.video.replace("watch?v=", "embed/")}
                    style={{ width:"100%", height:"100%", border:"none" }}
                    allowFullScreen
                  />
                </div>
              )}
            </div>
          )}

          {/* Formulář + CTA */}
          <div className="pub-cta">
            {submitted ? (
              <div style={{ textAlign:"center", padding:"32px 0" }}>
                <div style={{ fontSize:"3rem", marginBottom:"12px" }}>✅</div>
                <h3 style={{ fontSize:"1.2rem", fontWeight:700, color:"#1e1b4b", marginBottom:"8px" }}>Odesláno!</h3>
                <p style={{ color:"#6b7280" }}>Děkujeme, brzy se ozveme.</p>
              </div>
            ) : (
              <>
                {/* Formulářová pole */}
                {formFields.length > 0 && (
                  <div style={{ marginBottom:"16px" }}>
                    {formFields.map((f, i) => {
                      if (f === "Zpráva" || f === "Message" || f === "Nachricht") {
                        return (
                          <textarea key={i} className="pub-textarea" placeholder={f}
                            onChange={e => setFormData(d => ({ ...d, [f]: e.target.value }))} />
                        );
                      }
                      if (f === "Souhlas GDPR" || f === "GDPR") {
                        return (
                          <label key={i} style={{ display:"flex", gap:"8px", alignItems:"flex-start", fontSize:".82rem", color:"#6b7280", marginBottom:"10px", cursor:"pointer" }}>
                            <input type="checkbox" style={{ marginTop:"2px", accentColor:"#7c3aed" }}
                              onChange={e => setFormData(d => ({ ...d, [f]: e.target.checked }))} />
                            Souhlasím se zpracováním osobních údajů
                          </label>
                        );
                      }
                      return (
                        <input key={i} className="pub-input" placeholder={f}
                          type={f.toLowerCase().includes("email") || f.toLowerCase().includes("e-mail") ? "email" : "text"}
                          onChange={e => setFormData(d => ({ ...d, [f]: e.target.value }))} />
                      );
                    })}
                  </div>
                )}

                {/* Cena */}
                {page.price && (
                  <div className="pub-price" style={{ fontSize:"2rem", fontWeight:800, color:"#7c3aed", marginBottom:"16px" }}>
                    {page.price}
                  </div>
                )}

                {/* CTA tlačítko */}
                {page.btnText && (
                  formFields.length > 0 ? (
                    <button className="pub-btn" onClick={handleSubmit}>
                      {page.btnText}
                    </button>
                  ) : (
                    <a href={page.btnUrl || "#"} className="pub-btn">
                      {page.btnText}
                    </a>
                  )
                )}
              </>
            )}
          </div>

        </div>
      </div>
    </>
  );
}