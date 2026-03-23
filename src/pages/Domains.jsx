import { useState, useEffect } from "react";
import { collection, addDoc, getDocs, deleteDoc, doc, query, where, updateDoc } from "firebase/firestore";
import { db, app } from "../firebase/config";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useAuthState } from "../hooks/useAuthState";
import { useNavigate } from "react-router-dom";

export default function Domains() {
  const { user } = useAuthState();
  const navigate = useNavigate();
  const [domains,   setDomains]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [adding,    setAdding]    = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [error,     setError]     = useState("");
  const [nsModal,   setNsModal]   = useState(null);

  useEffect(() => {
    if (!user) return;
    async function fetchDomains() {
      const snap = await getDocs(query(collection(db, "domains"), where("uid", "==", user.uid)));
      setDomains(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }
    fetchDomains();
  }, [user]);

  async function addDomain() {
    const domain = newDomain.trim().toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "");

    if (!domain) return;
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
      setError("Zadej platnou doménu, např. mojefirma.cz"); return;
    }
    if (domains.find(d => d.domain === domain)) {
      setError("Tato doména již existuje."); return;
    }

    setAdding(true); setError("");
    try {
      const fn = httpsCallable(getFunctions(app), "addDomain");
      const result = await fn({ domain });
      const { zoneId, nameservers } = result.data;

      const ref = await addDoc(collection(db, "domains"), {
        uid: user.uid, domain, verified: false,
        zoneId, nameservers, createdAt: Date.now(),
      });
      const newDoc = { id: ref.id, uid: user.uid, domain, verified: false, zoneId, nameservers };
      setDomains(d => [...d, newDoc]);
      setNewDomain("");
      setNsModal({ domain, nameservers });
    } catch (e) {
      console.error(e);
      setError("Nepodařilo se přidat doménu: " + (e.message || "neznámá chyba"));
    }
    setAdding(false);
  }

  async function deleteDomain(id) {
    if (!confirm("Opravdu smazat doménu?")) return;
    await deleteDoc(doc(db, "domains", id));
    setDomains(d => d.filter(x => x.id !== id));
  }

  async function verifyDomain(domainDoc) {
    try {
      const res = await fetch(`https://dns.google/resolve?name=${domainDoc.domain}&type=NS`);
      const data = await res.json();
      const answers = data.Answer || [];
      const hasCloudflare = answers.some(a => a.data?.includes("cloudflare.com"));
      if (hasCloudflare) {
        await updateDoc(doc(db, "domains", domainDoc.id), { verified: true });
        setDomains(d => d.map(x => x.id === domainDoc.id ? { ...x, verified: true } : x));
        alert("✅ Doména ověřena! Nameservery správně nastaveny.");
      } else {
        alert("❌ Cloudflare nameservery nenalezeny. Zkontroluj nastavení u registrátora a zkus znovu za chvíli (propagace trvá až 48h).");
      }
    } catch { alert("Nepodařilo se ověřit doménu."); }
  }

  return (
    <div style={{ maxWidth:"720px" }}>

      {/* Nameserver modal */}
      {nsModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:"16px" }}
          onClick={() => setNsModal(null)}>
          <div style={{ background:"var(--bg-card)", borderRadius:"16px", padding:"28px", maxWidth:"480px", width:"100%", boxShadow:"0 8px 32px rgba(0,0,0,.2)" }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize:"1.1rem", fontWeight:700, color:"var(--text)", marginBottom:"8px" }}>✅ Doména přidána!</h3>
            <p style={{ fontSize:".88rem", color:"var(--text-muted)", marginBottom:"16px" }}>
              Jdi ke svému registrátorovi a nastav tyto nameservery pro <strong>{nsModal.domain}</strong>:
            </p>
            <div style={{ background:"var(--bg)", border:"1px solid var(--border)", borderRadius:"10px", padding:"14px", marginBottom:"16px" }}>
              {nsModal.nameservers.map((ns, i) => (
                <div key={i} style={{ fontFamily:"monospace", fontSize:".9rem", color:"var(--text)", padding:"4px 0", borderBottom: i < nsModal.nameservers.length-1 ? "1px solid var(--border)" : "none" }}>
                  {ns}
                </div>
              ))}
            </div>
            <p style={{ fontSize:".78rem", color:"var(--text-muted)", marginBottom:"20px" }}>
              Po nastavení nameserverů klikni na "Ověřit" — propagace DNS trvá 15 minut až 48 hodin.
            </p>
            <button onClick={() => setNsModal(null)}
              style={{ width:"100%", padding:"10px", borderRadius:"8px", border:"none", cursor:"pointer", background:"#7c3aed", color:"#fff", fontWeight:600, fontSize:".9rem" }}>
              Rozumím, zavřít
            </button>
          </div>
        </div>
      )}

      {/* Hlavička */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"24px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <button onClick={() => navigate(-1)}
            style={{ padding:"7px 12px", borderRadius:"8px", border:"1px solid var(--border)", background:"transparent", color:"var(--text)", fontSize:".88rem", cursor:"pointer" }}>
            ← Zpět
          </button>
          <h2 style={{ fontSize:"1.3rem", fontWeight:700, color:"var(--text)" }}>Domény</h2>
        </div>
      </div>

      {/* Přidat doménu */}
      <div style={{ padding:"20px", borderRadius:"12px", border:"1px solid var(--border)", background:"var(--bg-card)", marginBottom:"24px" }}>
        <h3 style={{ fontSize:".95rem", fontWeight:600, marginBottom:"6px", color:"var(--text)" }}>Přidat vlastní doménu</h3>
        <p style={{ fontSize:".82rem", color:"var(--text-muted)", marginBottom:"12px" }}>
          Po přidání dostaneš nameservery které nastavíš u registrátora. Vše ostatní se nastaví automaticky.
        </p>
        <div style={{ display:"flex", gap:"10px", flexWrap:"wrap" }}>
          <input value={newDomain} onChange={e=>{setNewDomain(e.target.value);setError("");}} onKeyDown={e=>e.key==="Enter"&&addDomain()}
            placeholder="mojefirma.cz"
            style={{ flex:1, minWidth:"200px", padding:"10px 12px", border:"1px solid var(--border)", borderRadius:"8px", background:"var(--bg)", color:"var(--text)", fontSize:".9rem", outline:"none" }} />
          <button onClick={addDomain} disabled={adding}
            style={{ padding:"10px 20px", borderRadius:"8px", border:"none", cursor:"pointer", background:"#7c3aed", color:"#fff", fontWeight:600, fontSize:".9rem", opacity:adding?0.7:1 }}>
            {adding ? "⏳ Přidávám..." : "Přidat"}
          </button>
        </div>
        {error && <p style={{ fontSize:".82rem", color:"#dc2626", marginTop:"8px" }}>{error}</p>}
      </div>

      {/* Jak to funguje */}
      <div style={{ padding:"16px 20px", borderRadius:"12px", border:"1px solid #e0e7ff", background:"#eef2ff", marginBottom:"24px" }}>
        <p style={{ fontSize:".88rem", fontWeight:600, color:"#3730a3", marginBottom:"6px" }}>Jak to funguje?</p>
        <ol style={{ fontSize:".82rem", color:"#4338ca", lineHeight:1.8, paddingLeft:"18px", margin:0 }}>
          <li>Zadáš doménu → automaticky ji přidáme do Cloudflare</li>
          <li>Dostaneš 2 nameservery → nastavíš je u registrátora (Wedos, GoDaddy…)</li>
          <li>Klikneš "Ověřit" → doména je aktivní</li>
          <li>V editoru stránky přiřadíš doménu a slug → stránka běží na tvé doméně</li>
        </ol>
      </div>

      {/* Seznam domén */}
      {loading && <p style={{ color:"var(--text-muted)" }}>Načítám...</p>}

      {!loading && domains.length === 0 && (
        <div style={{ textAlign:"center", padding:"40px", borderRadius:"12px", border:"1px dashed var(--border)", color:"var(--text-muted)" }}>
          <div style={{ fontSize:"2rem", marginBottom:"12px" }}>🌐</div>
          <p style={{ fontWeight:600, marginBottom:"4px" }}>Zatím žádné domény</p>
          <p style={{ fontSize:".85rem" }}>Přidej první vlastní doménu výše.</p>
        </div>
      )}

      {domains.map(d => (
        <div key={d.id} style={{ padding:"14px 16px", borderRadius:"10px", border:"1px solid var(--border)", background:"var(--bg-card)", marginBottom:"10px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom: d.nameservers?.length && !d.verified ? "10px" : 0 }}>
            <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:d.verified?"#16a34a":"#d97706", flexShrink:0 }} />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:600, fontSize:".9rem", color:"var(--text)" }}>{d.domain}</div>
              <div style={{ fontSize:".75rem", color:"var(--text-muted)", marginTop:"2px" }}>
                {d.verified ? "✅ Ověřeno a aktivní" : "⏳ Čeká na nastavení nameserverů"}
              </div>
            </div>
            <div style={{ display:"flex", gap:"6px", flexShrink:0 }}>
              {!d.verified && (
                <>
                  <button onClick={() => setNsModal({ domain: d.domain, nameservers: d.nameservers || [] })}
                    style={{ padding:"6px 10px", borderRadius:"7px", border:"1px solid var(--border)", background:"var(--bg)", color:"var(--text-muted)", fontSize:".78rem", cursor:"pointer" }}>
                    NS záznamy
                  </button>
                  <button onClick={() => verifyDomain(d)}
                    style={{ padding:"6px 12px", borderRadius:"7px", border:"1px solid #7c3aed", background:"#f5f3ff", color:"#7c3aed", fontSize:".78rem", fontWeight:600, cursor:"pointer" }}>
                    Ověřit
                  </button>
                </>
              )}
              {d.verified && (
                <button onClick={() => window.open(`https://${d.domain}`, "_blank")}
                  style={{ padding:"6px 12px", borderRadius:"7px", border:"1px solid var(--border)", background:"var(--bg)", color:"var(--text)", fontSize:".78rem", cursor:"pointer" }}>
                  Otevřít
                </button>
              )}
              <button onClick={() => deleteDomain(d.id)}
                style={{ padding:"6px 10px", borderRadius:"7px", border:"1px solid var(--border)", background:"var(--bg)", color:"var(--text-muted)", fontSize:".78rem", cursor:"pointer" }}>
                🗑️
              </button>
            </div>
          </div>

          {/* Nameservery pod kartou */}
          {!d.verified && d.nameservers?.length > 0 && (
            <div style={{ padding:"10px 12px", borderRadius:"8px", background:"var(--bg)", border:"1px solid var(--border)" }}>
              <p style={{ fontSize:".75rem", fontWeight:600, color:"var(--text-muted)", marginBottom:"6px" }}>NASTAV TYTO NAMESERVERY U REGISTRÁTORA:</p>
              {d.nameservers.map((ns, i) => (
                <div key={i} style={{ fontFamily:"monospace", fontSize:".82rem", color:"var(--text)", padding:"2px 0" }}>{ns}</div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}