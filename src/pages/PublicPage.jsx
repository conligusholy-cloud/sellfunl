import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { buildHeroHtml } from "./modules/HeroEditor";

export default function PublicPage() {
  const { id } = useParams();
  const [page,    setPage]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPage() {
      const snap = await getDoc(doc(db, "pages", id));
      if (snap.exists()) setPage(snap.data());
      setLoading(false);
    }
    fetchPage();
  }, [id]);

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

  return (
    <div style={{ fontFamily:"-apple-system,'Inter',sans-serif", background:"#f8f8fc", minHeight:"100vh" }}>
      <div style={{ maxWidth:"720px", margin:"0 auto", background:"#fff", minHeight:"100vh", boxShadow:"0 0 40px rgba(0,0,0,.08)" }}>

        {/* Hero editor */}
        {page.hero && (
          <div style={{ marginBottom:"0" }}>
            <iframe
              srcDoc={buildHeroHtml(page.hero)}
              sandbox="allow-scripts"
              style={{ border:"none", width:"100%", minHeight:"400px", display:"block" }}
            />
          </div>
        )}

        {/* Hero — obrázek + nadpis */}
        <div style={{ padding:"40px 48px 28px", borderBottom:"1px solid #f0f0f0" }}>
          {page.image && (
            <img src={page.image} alt=""
              style={{ width:"100%", maxHeight:"340px", objectFit:"cover", borderRadius:"12px", marginBottom:"24px" }}
              onError={e => e.target.style.display = "none"} />
          )}
          {page.headline && (
            <h1 style={{ fontSize:"2rem", fontWeight:800, color:"#1e1b4b", lineHeight:1.2, marginBottom:"10px" }}>
              {page.headline}
            </h1>
          )}
          {page.subline && (
            <p style={{ fontSize:"1.05rem", color:"#6b7280" }}>{page.subline}</p>
          )}
        </div>

        {/* Obsah */}
        <div style={{ padding:"28px 48px", borderBottom:"1px solid #f0f0f0" }}>
          {page.text && (
            <div
              style={{ fontSize:".97rem", lineHeight:1.75, color:"#374151" }}
              dangerouslySetInnerHTML={{ __html: page.text }}
            />
          )}
          {page.video && (
            <div style={{ marginTop:"24px", borderRadius:"10px", overflow:"hidden", aspectRatio:"16/9" }}>
              <iframe
                src={page.video.replace("watch?v=", "embed/")}
                style={{ width:"100%", height:"100%", border:"none" }}
                allowFullScreen
              />
            </div>
          )}
        </div>

        {/* Akce — formulář + CTA */}
        <div style={{ padding:"28px 48px 48px" }}>
          {page.price && (
            <div style={{ fontSize:"2rem", fontWeight:800, color:"#7c3aed", marginBottom:"20px" }}>
              {page.price}
            </div>
          )}
          {page.btnText && (
            <a
              href={page.btnUrl || "#"}
              style={{ display:"block", padding:"15px", background:"#7c3aed", color:"#fff", borderRadius:"10px", textDecoration:"none", fontWeight:700, fontSize:"1.05rem", textAlign:"center" }}
            >
              {page.btnText}
            </a>
          )}
        </div>

      </div>
    </div>
  );
}