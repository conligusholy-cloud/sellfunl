import { useState, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../firebase/config";

const FORM_FIELD_OPTIONS = ["Jméno", "Email", "Telefon", "Firma", "Zpráva", "Souhlas GDPR"];

function Toggle({ on, onToggle, label }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"7px" }}>
      <span style={{ flex:1, fontSize:".9rem", color:"var(--text)" }}>{label}</span>
      <div onClick={onToggle} style={{ width:"34px", height:"18px", borderRadius:"9px", background:on?"#7c3aed":"var(--border)", cursor:"pointer", position:"relative", transition:"background .2s", flexShrink:0 }}>
        <span style={{ position:"absolute", width:"14px", height:"14px", background:"#fff", borderRadius:"50%", top:"2px", left:on?"18px":"2px", transition:"left .2s" }} />
      </div>
    </div>
  );
}

function FieldInput({ label, value, onChange, placeholder }) {
  const base = { width:"100%", padding:"9px 11px", border:"1px solid var(--border)", borderRadius:"8px", background:"var(--input-bg)", color:"var(--text)", fontSize:".9rem", outline:"none", fontFamily:"inherit" };
  return (
    <div style={{ marginBottom:"13px" }}>
      <label style={{ display:"block", fontSize:".73rem", fontWeight:600, color:"var(--text-muted)", marginBottom:"5px", textTransform:"uppercase", letterSpacing:".5px" }}>{label}</label>
      <input type="text" placeholder={placeholder} value={value||""} onChange={e=>onChange(e.target.value)} style={base} />
    </div>
  );
}

export default function PageActions({ page, update, formFields, setFormFields, userId }) {
  const S = {
    input:   { width:"100%", padding:"7px 10px", border:"1px solid var(--border)", borderRadius:"7px", background:"var(--input-bg)", color:"var(--text)", fontSize:".88rem", outline:"none", fontFamily:"inherit" },
    btnOut:  { padding:"7px 12px", fontSize:".85rem", border:"1px solid var(--border)", borderRadius:"7px", background:"transparent", color:"var(--text)", cursor:"pointer" },
    card:    { background:"var(--bg)", border:"1px solid var(--border)", borderRadius:"9px", padding:"10px 13px", marginBottom:"8px" },
    lbl:     { fontSize:".73rem", fontWeight:600, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:".5px", display:"block", marginBottom:"4px" },
    row:     { display:"flex", gap:"7px", alignItems:"center" },
    divider: { border:"none", borderTop:"1px solid var(--border)", margin:"13px 0" },
  };

  const [userDomains,    setUserDomains]    = useState([]);
  const [domainLoaded,   setDomainLoaded]   = useState(false);
  const [newFieldType,   setNewFieldType]   = useState("Telefon");
  const [positiveAction, setPositiveAction] = useState("next_page");
  const [negativeAction, setNegativeAction] = useState("downsell");
  const [dualOutput,     setDualOutput]     = useState(false);
  const [productType,    setProductType]    = useState("physical");
  const [afterPayment,   setAfterPayment]   = useState("email");
  const [intMC, setIntMC] = useState(false); const [mcKey, setMcKey] = useState(""); const [mcAud, setMcAud] = useState("");
  const [intAC, setIntAC] = useState(false); const [acUrl, setAcUrl] = useState(""); const [acKey, setAcKey] = useState("");

  useEffect(() => {
    if (!userId || domainLoaded) return;
    async function fetchDomains() {
      const snap = await getDocs(query(collection(db,"domains"), where("uid","==",userId), where("verified","==",true)));
      setUserDomains(snap.docs.map(d => ({ id:d.id, ...d.data() })));
      setDomainLoaded(true);
    }
    fetchDomains();
  }, [userId, domainLoaded]);

  return (
    <div style={{ padding:"15px" }}>

      {/* ── Vlastní doména ── */}
      <div style={{ ...S.card, marginBottom:"12px" }}>
        <span style={{ ...S.lbl, marginBottom:"8px" }}>🌐 Vlastní doména</span>
        {userDomains.length === 0 ? (
          <p style={{ fontSize:".82rem", color:"var(--text-muted)" }}>
            Nemáš žádné ověřené domény.{" "}
            <a href="/domains" style={{ color:"#7c3aed", fontWeight:600 }}>Přidat doménu →</a>
          </p>
        ) : (
          <>
            <label style={S.lbl}>Doména</label>
            <select value={page.domain||""} onChange={e=>update("domain",e.target.value)} style={{ ...S.input, marginBottom:"8px" }}>
              <option value="">— Bez vlastní domény —</option>
              {userDomains.map(d => <option key={d.id} value={d.domain}>{d.domain}</option>)}
            </select>
            {page.domain && (
              <>
                <label style={S.lbl}>Slug (cesta)</label>
                <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                  <span style={{ fontSize:".82rem", color:"var(--text-muted)", whiteSpace:"nowrap" }}>{page.domain}/</span>
                  <input value={page.slug||""} onChange={e=>update("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,"-").replace(/--+/g,"-").replace(/^-|-$/g,""))}
                    placeholder="napr-muj-kurz" style={{ ...S.input, flex:1 }} />
                </div>
                <p style={{ fontSize:".75rem", color:"var(--text-muted)", marginTop:"6px" }}>
                  Prázdný slug = homepage domény ({page.domain})
                </p>
                <div style={{ marginTop:"8px", padding:"8px 10px", borderRadius:"7px", background:"#f5f3ff", border:"1px solid #ede9fe" }}>
                  <span style={{ fontSize:".78rem", color:"#7c3aed", fontWeight:600 }}>
                    🔗 {page.domain}{page.slug ? `/${page.slug}` : ""}
                  </span>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ── Typ produktu ── */}
      <div style={{ ...S.card, marginBottom:"12px" }}>
        <span style={{ ...S.lbl, marginBottom:"8px" }}>📦 Typ produktu</span>
        <div style={{ display:"flex", gap:"7px", marginBottom:"10px" }}>
          {[{val:"physical",icon:"📦",label:"Fyzický"},{val:"online",icon:"💻",label:"Online"}].map(opt => (
            <div key={opt.val} onClick={()=>setProductType(opt.val)}
              style={{ flex:1, border:`1px solid ${productType===opt.val?"#7c3aed":"var(--border)"}`, borderRadius:"9px", padding:"9px 8px", cursor:"pointer", textAlign:"center", fontSize:".82rem", fontWeight:600, color:productType===opt.val?"#7c3aed":"var(--text-muted)", background:productType===opt.val?"#ede9fe":"transparent" }}>
              <div style={{ fontSize:"18px", marginBottom:"3px" }}>{opt.icon}</div>{opt.label}
            </div>
          ))}
        </div>
        <span style={S.lbl}>Co se stane po zaplacení?</span>
        <select value={afterPayment} onChange={e=>setAfterPayment(e.target.value)} style={S.input}>
          {productType==="physical" ? <>
            <option value="email">📧 Potvrzovací email zákazníkovi</option>
            <option value="redirect">↗ Přesměrování na potvrzovací stránku</option>
            <option value="manual">🖐 Manuální zpracování objednávky</option>
          </> : <>
            <option value="download">⬇ Okamžité stažení produktu</option>
            <option value="email">📧 Přístupové údaje emailem</option>
            <option value="redirect">↗ Přesměrování do členské sekce</option>
          </>}
        </select>
      </div>

      {/* ── Pole formuláře ── */}
      <span style={S.lbl}>Pole formuláře</span>
      <div style={{ display:"flex", flexDirection:"column", gap:"5px", marginBottom:"8px" }}>
        {formFields.map((f,i) => (
          <div key={i} style={{ ...S.card, display:"flex", alignItems:"center", gap:"7px", marginBottom:0 }}>
            <span style={{ color:"var(--text-muted)", cursor:"grab" }}>⠿</span>
            <span style={{ flex:1, fontSize:".88rem" }}>{f}</span>
            <span onClick={()=>setFormFields(ff=>ff.filter((_,idx)=>idx!==i))} style={{ cursor:"pointer", color:"var(--text-muted)" }}>✕</span>
          </div>
        ))}
      </div>
      <div style={{ ...S.row, marginBottom:"12px" }}>
        <select value={newFieldType} onChange={e=>setNewFieldType(e.target.value)} style={{ ...S.input, flex:1 }}>
          {FORM_FIELD_OPTIONS.map(o => <option key={o}>{o}</option>)}
        </select>
        <button style={S.btnOut} onClick={()=>{ if(!formFields.includes(newFieldType)) setFormFields(f=>[...f,newFieldType]); }}>+ Přidat</button>
      </div>

      <hr style={S.divider} />

      {/* ── Výstupy ── */}
      <span style={S.lbl}>Výstupy po odeslání</span>
      <p style={{ fontSize:".78rem", color:"var(--text-muted)", marginBottom:"10px" }}>Konkrétní URL nastavíš ve funnelu.</p>
      <div style={S.card}>
        <span style={{ fontSize:".8rem", fontWeight:600, color:"#059669", display:"flex", alignItems:"center", gap:"5px", marginBottom:"7px" }}>✅ Pozitivní výstup</span>
        <select value={positiveAction} onChange={e=>setPositiveAction(e.target.value)} style={S.input}>
          <option value="next_page">Pokračovat na další stránku funnelu</option>
          <option value="thank_you">Zobrazit děkovací stránku</option>
        </select>
      </div>
      <div style={{ marginTop:"8px" }}>
        <Toggle on={dualOutput} onToggle={()=>setDualOutput(v=>!v)} label="Přidat negativní výstup (nezakoupil)" />
      </div>
      {dualOutput && (
        <div style={S.card}>
          <span style={{ fontSize:".8rem", fontWeight:600, color:"#dc2626", display:"flex", alignItems:"center", gap:"5px", marginBottom:"7px" }}>❌ Negativní výstup</span>
          <select value={negativeAction} onChange={e=>setNegativeAction(e.target.value)} style={S.input}>
            <option value="downsell">Přejít na downsell / levnější variantu</option>
            <option value="exit">Zobrazit exit nabídku</option>
            <option value="nurture">Přidat do nurture sekvence</option>
          </select>
        </div>
      )}

      <hr style={S.divider} />

      {/* ── Integrace emailingu ── */}
      <span style={S.lbl}>Integrace emailingu</span>
      <Toggle on={intMC} onToggle={()=>setIntMC(v=>!v)} label="Mailchimp" />
      {intMC && <div style={{ ...S.card, marginBottom:"10px" }}>
        <label style={S.lbl}>API klíč</label><input placeholder="mc-xxxxxxxx" value={mcKey} onChange={e=>setMcKey(e.target.value)} style={{ ...S.input, marginBottom:"7px" }} />
        <label style={S.lbl}>Audience ID</label><input placeholder="abc12345" value={mcAud} onChange={e=>setMcAud(e.target.value)} style={S.input} />
      </div>}
      <Toggle on={intAC} onToggle={()=>setIntAC(v=>!v)} label="ActiveCampaign" />
      {intAC && <div style={{ ...S.card, marginBottom:"10px" }}>
        <label style={S.lbl}>API URL</label><input placeholder="https://account.api-us1.com" value={acUrl} onChange={e=>setAcUrl(e.target.value)} style={{ ...S.input, marginBottom:"7px" }} />
        <label style={S.lbl}>API klíč</label><input placeholder="xxxxxxxxxxxxxxxx" value={acKey} onChange={e=>setAcKey(e.target.value)} style={S.input} />
      </div>}

      <hr style={S.divider} />

      {/* ── CTA ── */}
      <FieldInput label="Text tlačítka"  value={page.btnText} onChange={v=>update("btnText",v)} placeholder="např. Chci produkt nyní 🔥" />
      <FieldInput label="Odkaz tlačítka" value={page.btnUrl}  onChange={v=>update("btnUrl",v)}  placeholder="https://..." />
      <FieldInput label="Cena"           value={page.price}   onChange={v=>update("price",v)}   placeholder="např. 1 990 Kč" />
    </div>
  );
}