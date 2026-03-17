import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection, addDoc, getDocs, deleteDoc, updateDoc,
  doc, query, where
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db, app } from "../../firebase/config";
import { useAuthState } from "../../hooks/useAuthState";

const COLORS = ["#7c3aed","#2563eb","#16a34a","#dc2626","#d97706","#0891b2","#db2777","#64748b"];

const LANGUAGES = [
  { code:"cs", flag:"🇨🇿", name:"Čeština" },
  { code:"sk", flag:"🇸🇰", name:"Slovenština" },
  { code:"en", flag:"🇬🇧", name:"Angličtina" },
  { code:"de", flag:"🇩🇪", name:"Němčina" },
  { code:"fr", flag:"🇫🇷", name:"Francouzština" },
  { code:"pl", flag:"🇵🇱", name:"Polština" },
  { code:"hu", flag:"🇭🇺", name:"Maďarština" },
  { code:"ro", flag:"🇷🇴", name:"Rumunština" },
  { code:"es", flag:"🇪🇸", name:"Španělština" },
  { code:"it", flag:"🇮🇹", name:"Italština" },
  { code:"pt", flag:"🇵🇹", name:"Portugalština" },
  { code:"nl", flag:"🇳🇱", name:"Nizozemština" },
  { code:"sv", flag:"🇸🇪", name:"Švédština" },
  { code:"da", flag:"🇩🇰", name:"Dánština" },
  { code:"fi", flag:"🇫🇮", name:"Finština" },
  { code:"nb", flag:"🇳🇴", name:"Norština" },
  { code:"el", flag:"🇬🇷", name:"Řečtina" },
  { code:"bg", flag:"🇧🇬", name:"Bulharština" },
  { code:"hr", flag:"🇭🇷", name:"Chorvatština" },
  { code:"uk", flag:"🇺🇦", name:"Ukrajinština" },
];

const LANG_FLAGS = Object.fromEntries(LANGUAGES.map(l => [l.code, l.flag]));
const TRANSLATE_FIELDS = ["name","headline","subline","text","btnText","price"];

// ─── Cloud AI volání ──────────────────────────────────────────────────────────
async function callCloudAI(prompt) {
  const fn = httpsCallable(getFunctions(app), "translate");
  const result = await fn({ prompt, max_tokens: 4000 });
  const raw = result.data.result || "";

  // Bezpečný JSON parse — ořízne případný neúplný konec
  const clean = raw.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(clean);
  } catch {
    // Pokud JSON není kompletní, zkus najít poslední platnou hodnotu
    const fixed = clean.replace(/,\s*"[^"]*":\s*"[^"]*$/, "").replace(/,?\s*$/, "") + "}";
    try { return JSON.parse(fixed); }
    catch { throw new Error(`AI vrátila neplatný JSON. Zkus kratší text stránky.`); }
  }
}

// ─── Překlad jedné stránky ────────────────────────────────────────────────────
async function translatePage(page, targetLang, user) {
  const lang = LANGUAGES.find(l => l.code === targetLang);
  const fields = TRANSLATE_FIELDS
    .filter(f => page[f])
    .map(f => `${f}: ${page[f]}`)
    .join("\n");

  const translated = await callCloudAI(
    `Přelož pole prodejní stránky do jazyka: ${lang.name}.
Vrať POUZE JSON se stejnými klíči, zachovej HTML tagy v poli text, URL a ceny nechej beze změny.
${fields}
Formát: {"name":"...","headline":"...","subline":"...","text":"...","btnText":"...","price":"..."}`
  );

  const newPage = {
    ...page,
    ...translated,
    lang: targetLang,
    name: translated.name || `${page.name} (${lang.flag} ${lang.name})`,
    uid: user.uid,
    createdAt: Date.now(),
    published: false,
  };
  delete newPage.id;
  return newPage;
}

// ─── Hlavní komponenta ────────────────────────────────────────────────────────
export default function Pages() {
  const { user }  = useAuthState();
  const navigate  = useNavigate();
  const [pages,   setPages]   = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openFolders, setOpenFolders] = useState({});
  const [dragOver,    setDragOver]    = useState(null);
  const [modal, setModal] = useState(null);

  // stav překladu složky: { folderId, progress: {done, total, current}, error }
  const [translateState, setTranslateState] = useState(null);

  const dragPageId = useRef(null);

  useEffect(() => {
    if (!user) return;
    async function fetchAll() {
      const [pSnap, fSnap] = await Promise.all([
        getDocs(query(collection(db, "pages"),   where("uid", "==", user.uid))),
        getDocs(query(collection(db, "folders"), where("uid", "==", user.uid))),
      ]);
      const pageList   = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const folderList = fSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const withStats  = await Promise.all(pageList.map(async p => {
        if (!p.id) return { ...p, visits: 0, conversions: 0 };
        try {
          const [vSnap, cSnap] = await Promise.all([
            getDocs(query(collection(db, "visits"),      where("pageId", "==", p.id))),
            getDocs(query(collection(db, "conversions"), where("pageId", "==", p.id))),
          ]);
          return { ...p, visits: vSnap.size, conversions: cSnap.size };
        } catch {
          return { ...p, visits: 0, conversions: 0 };
        }
      }));
      setPages(withStats);
      setFolders(folderList);
      setLoading(false);
    }
    fetchAll();
  }, [user]);

  // ── SLOŽKY ──────────────────────────────────────────────────────────────────
  async function createFolder(name, color) {
    const ref = await addDoc(collection(db, "folders"), { uid: user.uid, name, color, createdAt: Date.now() });
    setFolders(f => [...f, { id: ref.id, uid: user.uid, name, color }]);
    setOpenFolders(o => ({ ...o, [ref.id]: true }));
  }
  async function updateFolder(id, name, color) {
    await updateDoc(doc(db, "folders", id), { name, color });
    setFolders(f => f.map(x => x.id === id ? { ...x, name, color } : x));
  }
  async function deleteFolder(id) {
    if (!confirm("Smazat složku? Stránky uvnitř zůstanou bez složky.")) return;
    await deleteDoc(doc(db, "folders", id));
    await Promise.all(pages.filter(p => p.folderId === id).map(p => updateDoc(doc(db, "pages", p.id), { folderId: null })));
    setFolders(f => f.filter(x => x.id !== id));
    setPages(p => p.map(x => x.folderId === id ? { ...x, folderId: null } : x));
  }

  // ── AI PŘEKLAD CELÉ SLOŽKY ───────────────────────────────────────────────────
  // Otevře výběr jazyka, pak přeloží všechny stránky jednu po druhé
  function openFolderTranslate(folder) {
    setModal({ type: "translateFolder", folder });
  }

  async function runFolderTranslate(folder, targetLangCode) {
    setModal(null);
    const folderPages = pages.filter(p => p.folderId === folder.id);
    if (folderPages.length === 0) return;

    const lang = LANGUAGES.find(l => l.code === targetLangCode);

    // 1. Vytvoř novou složku pro přeloženou verzi
    const newFolderRef = await addDoc(collection(db, "folders"), {
      uid: user.uid,
      name: `${folder.name} (${lang.flag} ${lang.name})`,
      color: folder.color,
      createdAt: Date.now(),
    });
    const newFolder = { id: newFolderRef.id, uid: user.uid, name: `${folder.name} (${lang.flag} ${lang.name})`, color: folder.color };
    setFolders(f => [...f, newFolder]);
    setOpenFolders(o => ({ ...o, [newFolderRef.id]: true }));

    // 2. Překládej stránky jednu po druhé (ne paralelně — šetří API limity)
    const newPages = [];
    for (let i = 0; i < folderPages.length; i++) {
      const page = folderPages[i];
      setTranslateState({
        folderId: newFolderRef.id,
        progress: { done: i, total: folderPages.length, current: page.name || "Stránka" }
      });
      try {
        const translated = await translatePage(page, targetLangCode, user);
        translated.folderId = newFolderRef.id;
        const ref = await addDoc(collection(db, "pages"), translated);
        const newPage = { id: ref.id, ...translated, visits: 0, conversions: 0 };
        newPages.push(newPage);
        // Průběžně přidávej přeložené stránky do UI
        setPages(p => [...p, newPage]);
      } catch (err) {
        console.error(`Chyba překladu stránky ${page.name}:`, err);
        setTranslateState(s => ({ ...s, error: `Chyba u stránky "${page.name}"` }));
      }
    }

    setTranslateState({
      folderId: newFolderRef.id,
      progress: { done: folderPages.length, total: folderPages.length, current: null },
      done: true,
    });
    setTimeout(() => setTranslateState(null), 3000);
  }

  // ── STRÁNKY ──────────────────────────────────────────────────────────────────
  async function createPage(folderId = null) {
    const ref = await addDoc(collection(db, "pages"), {
      uid: user.uid, folderId, name: "Nová stránka", headline: "",
      subline: "", text: "", image: "", video: "", btnText: "", btnUrl: "",
      price: "", createdAt: Date.now(),
    });
    navigate(`/editor/${ref.id}`);
  }
  async function deletePage(id) {
    if (!confirm("Opravdu smazat tuto stránku?")) return;
    await deleteDoc(doc(db, "pages", id));
    setPages(p => p.filter(x => x.id !== id));
  }
  async function movePage(pageId, folderId) {
    await updateDoc(doc(db, "pages", pageId), { folderId: folderId || null });
    setPages(p => p.map(x => x.id === pageId ? { ...x, folderId: folderId || null } : x));
    setModal(null);
  }

  // ── DRAG & DROP ──────────────────────────────────────────────────────────────
  function onDragStart(pageId) { dragPageId.current = pageId; }
  function onDragOver(e, folderId) {
    e.preventDefault(); setDragOver(folderId);
    if (folderId) setOpenFolders(o => ({ ...o, [folderId]: true }));
  }
  function onDrop(e, folderId) {
    e.preventDefault();
    if (dragPageId.current) movePage(dragPageId.current, folderId);
    dragPageId.current = null; setDragOver(null);
  }
  function onDragEnd() { dragPageId.current = null; setDragOver(null); }

  // ── HELPERS ──────────────────────────────────────────────────────────────────
  function folderStats(folderId) {
    const fp = pages.filter(p => p.folderId === folderId);
    const visits = fp.reduce((s, p) => s + (p.visits || 0), 0);
    const convs  = fp.reduce((s, p) => s + (p.conversions || 0), 0);
    const rate   = visits > 0 ? Math.round((convs / visits) * 100) : 0;
    return { count: fp.length, visits, convs, rate };
  }

  const unfoldered = pages.filter(p => !p.folderId);

  return (
    <div style={{ fontFamily:"var(--font-sans,'Inter',sans-serif)", color:"var(--text)" }}>

      {/* Hlavička */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"24px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
          <button className="btn btn-outline" onClick={() => navigate("/dashboard")}>← Dashboard</button>
          <h1 style={{ fontSize:"1.4rem", fontWeight:700 }}>Moje stránky</h1>
        </div>
        <div style={{ display:"flex", gap:"10px" }}>
          <button className="btn btn-outline" onClick={() => setModal({ type:"newFolder", data:{ name:"", color: COLORS[0] } })}>
            📁 Nová složka
          </button>
          <button className="btn btn-primary" onClick={() => createPage(null)}>+ Nová stránka</button>
        </div>
      </div>

      {loading && <p style={{ color:"var(--text-muted)" }}>Načítám...</p>}

      {/* SLOŽKY */}
      {folders.map(folder => {
        const stats  = folderStats(folder.id);
        const isOpen = openFolders[folder.id];
        const fps    = pages.filter(p => p.folderId === folder.id);
        const isDragTarget = dragOver === folder.id;
        const ts = translateState?.folderId === folder.id ? translateState : null;

        return (
          <div key={folder.id} className="card"
            style={{ marginBottom:"12px", padding:0, overflow:"hidden", transition:"box-shadow .15s", boxShadow: isDragTarget ? `0 0 0 2px ${folder.color}` : undefined }}
            onDragOver={e => onDragOver(e, folder.id)}
            onDrop={e => onDrop(e, folder.id)}
            onDragLeave={() => setDragOver(null)}
          >
            {/* záhlaví složky */}
            <div
              onClick={() => setOpenFolders(o => ({ ...o, [folder.id]: !o[folder.id] }))}
              style={{ display:"flex", alignItems:"center", gap:"12px", padding:"14px 16px", cursor:"pointer", borderLeft:`4px solid ${folder.color}`, background: isDragTarget ? folder.color + "18" : undefined, transition:"background .15s" }}
            >
              <span style={{ fontSize:"1.2rem" }}>{isOpen ? "📂" : "📁"}</span>
              <span style={{ fontWeight:700, flex:1 }}>{folder.name}</span>
              <div style={{ display:"flex", gap:"16px", fontSize:".82rem", color:"var(--text-muted)" }}>
                <span>📄 {stats.count}</span>
                <span>👁️ {stats.visits}</span>
                <span>✅ {stats.convs}</span>
                <span style={{ color: stats.rate > 10 ? "#16a34a" : stats.rate > 5 ? "#d97706" : "var(--text-muted)", fontWeight:600 }}>{stats.rate} %</span>
              </div>
              <div style={{ display:"flex", gap:"6px" }} onClick={e => e.stopPropagation()}>
                {/* 🌍 AI překlad složky */}
                <button
                  className="btn btn-outline"
                  style={{ padding:"4px 10px", fontSize:".78rem", color:"#7c3aed", borderColor:"#7c3aed", background:"#f5f3ff", display:"flex", alignItems:"center", gap:"4px" }}
                  title="Přeložit celou složku do jiného jazyka"
                  onClick={() => openFolderTranslate(folder)}
                >
                  🌍 Přeložit
                </button>
                <button className="btn btn-outline" style={{ padding:"4px 10px", fontSize:".78rem" }}
                  onClick={() => setModal({ type:"editFolder", data:{ id: folder.id, name: folder.name, color: folder.color } })}>✏️</button>
                <button className="btn btn-outline" style={{ padding:"4px 10px", fontSize:".78rem" }}
                  onClick={() => createPage(folder.id)}>+</button>
                <button className="btn btn-outline" style={{ padding:"4px 10px", fontSize:".78rem" }}
                  onClick={() => deleteFolder(folder.id)}>🗑️</button>
              </div>
            </div>

            {/* Progress bar překladu */}
            {ts && (
              <div style={{ padding:"10px 16px", background:"#f5f3ff", borderTop:"1px solid #ede9fe" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"6px" }}>
                  <span style={{ fontSize:".82rem", fontWeight:600, color:"#7c3aed" }}>
                    {ts.done ? "✅ Překlad dokončen!" : `🌍 Překládám… ${ts.progress.done}/${ts.progress.total}`}
                  </span>
                  {!ts.done && ts.progress.current && (
                    <span style={{ fontSize:".78rem", color:"#9ca3af" }}>„{ts.progress.current}"</span>
                  )}
                </div>
                <div style={{ height:"6px", background:"#ede9fe", borderRadius:"3px", overflow:"hidden" }}>
                  <div style={{ height:"100%", background:"#7c3aed", borderRadius:"3px", width:`${(ts.progress.done / ts.progress.total) * 100}%`, transition:"width .4s" }} />
                </div>
                {ts.error && <p style={{ fontSize:".78rem", color:"#dc2626", marginTop:"4px" }}>{ts.error}</p>}
              </div>
            )}

            {/* stránky ve složce */}
            {isOpen && (
              <div style={{ borderTop:"1px solid var(--border)" }}>
                {fps.length === 0 && (
                  <p style={{ padding:"16px", color:"var(--text-muted)", fontSize:".9rem" }}>
                    {isDragTarget ? "⬇️ Pusť sem pro přesunutí" : "Složka je prázdná — přetáhni sem stránku nebo klikni +"}
                  </p>
                )}
                {fps.map(page => (
                  <PageRow key={page.id} page={page} navigate={navigate}
                    onDelete={deletePage}
                    onDragStart={() => onDragStart(page.id)}
                    onDragEnd={onDragEnd}
                  />
                ))}
              </div>
            )}

            {!isOpen && isDragTarget && (
              <div style={{ padding:"12px 16px", color: folder.color, fontSize:".85rem", fontWeight:600, borderTop:`1px solid ${folder.color}40` }}>
                ⬇️ Pusť pro přesunutí do složky
              </div>
            )}
          </div>
        );
      })}

      {/* STRÁNKY BEZ SLOŽKY */}
      {unfoldered.length > 0 && (
        <div className="card"
          style={{ padding:0, overflow:"hidden", boxShadow: dragOver === "none" ? "0 0 0 2px #64748b" : undefined }}
          onDragOver={e => onDragOver(e, "none")}
          onDrop={e => onDrop(e, null)}
          onDragLeave={() => setDragOver(null)}
        >
          <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--border)", fontWeight:600, color:"var(--text-muted)", fontSize:".85rem", background: dragOver === "none" ? "rgba(100,116,139,.1)" : undefined }}>
            BEZ SLOŽKY {dragOver === "none" && "⬇️ Pusť sem"}
          </div>
          {unfoldered.map(page => (
            <PageRow key={page.id} page={page} navigate={navigate}
              onDelete={deletePage}
              onDragStart={() => onDragStart(page.id)}
              onDragEnd={onDragEnd}
            />
          ))}
        </div>
      )}

      {/* Prázdný stav */}
      {!loading && pages.length === 0 && folders.length === 0 && (
        <div className="card" style={{ textAlign:"center", padding:"64px 24px" }}>
          <div style={{ fontSize:"3rem", marginBottom:"16px" }}>📄</div>
          <h3 style={{ marginBottom:"8px" }}>Zatím nemáš žádné stránky</h3>
          <p style={{ color:"var(--text-muted)", marginBottom:"24px" }}>Vytvoř složku nebo rovnou první stránku.</p>
          <button className="btn btn-primary" onClick={() => createPage(null)}>+ Vytvořit první stránku</button>
        </div>
      )}

      {/* MODALY */}
      {modal?.type === "newFolder" && (
        <FolderModal title="Nová složka" data={modal.data} colors={COLORS}
          onSave={async (name, color) => { await createFolder(name, color); setModal(null); }}
          onClose={() => setModal(null)} />
      )}
      {modal?.type === "editFolder" && (
        <FolderModal title="Upravit složku" data={modal.data} colors={COLORS}
          onSave={async (name, color) => { await updateFolder(modal.data.id, name, color); setModal(null); }}
          onClose={() => setModal(null)} />
      )}
      {modal?.type === "translateFolder" && (
        <TranslateFolderModal
          folder={modal.folder}
          pageCount={pages.filter(p => p.folderId === modal.folder.id).length}
          onTranslate={(langCode) => runFolderTranslate(modal.folder, langCode)}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

// ─── Modal: výběr jazyka pro překlad složky ───────────────────────────────────
function TranslateFolderModal({ folder, pageCount, onTranslate, onClose }) {
  const [selected, setSelected] = useState(null);

  return (
    <ModalWrap onClose={onClose}>
      <h3 style={{ marginBottom:"6px", fontWeight:700 }}>🌍 Přeložit složku</h3>
      <p style={{ fontSize:".88rem", color:"var(--text-muted)", marginBottom:"16px" }}>
        AI zkopíruje složku <strong>„{folder.name}"</strong> ({pageCount} {pageCount === 1 ? "stránka" : pageCount < 5 ? "stránky" : "stránek"}) a přeloží všechny stránky do zvoleného jazyka.
      </p>

      <label style={{ fontSize:".78rem", fontWeight:600, color:"var(--text-muted)", display:"block", marginBottom:"8px" }}>CÍLOVÝ JAZYK</label>
      <div style={{ display:"flex", flexWrap:"wrap", gap:"6px", marginBottom:"20px", maxHeight:"200px", overflowY:"auto" }}>
        {LANGUAGES.map(lang => (
          <button key={lang.code}
            onClick={() => setSelected(lang.code)}
            style={{
              padding:"6px 12px", borderRadius:"8px", fontSize:".85rem", cursor:"pointer",
              border: selected === lang.code ? "2px solid #7c3aed" : "1px solid var(--border)",
              background: selected === lang.code ? "#f5f3ff" : "var(--bg-card)",
              color: selected === lang.code ? "#7c3aed" : "var(--text)",
              fontWeight: selected === lang.code ? 600 : 400,
            }}
          >
            {lang.flag} {lang.name}
          </button>
        ))}
      </div>

      {selected && (
        <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:"8px", padding:"10px 14px", marginBottom:"16px", fontSize:".82rem", color:"#166534" }}>
          ✅ Vytvoří se nová složka <strong>„{folder.name} ({LANGUAGES.find(l=>l.code===selected)?.flag} {LANGUAGES.find(l=>l.code===selected)?.name})"</strong> se {pageCount} přeloženými stránkami. Originál zůstane nedotčen.
        </div>
      )}

      <div style={{ display:"flex", gap:"10px", justifyContent:"flex-end" }}>
        <button className="btn btn-outline" onClick={onClose}>Zrušit</button>
        <button
          className="btn btn-primary"
          disabled={!selected}
          onClick={() => selected && onTranslate(selected)}
          style={{ opacity: selected ? 1 : 0.5, cursor: selected ? "pointer" : "not-allowed" }}
        >
          🌍 Spustit překlad
        </button>
      </div>
    </ModalWrap>
  );
}

// ─── PageRow ──────────────────────────────────────────────────────────────────
function PageRow({ page, navigate, onDelete, onDragStart, onDragEnd }) {
  const rate = page.visits > 0 ? Math.round((page.conversions / page.visits) * 100) : 0;
  return (
    <div
      draggable onDragStart={onDragStart} onDragEnd={onDragEnd}
      style={{ display:"flex", alignItems:"center", gap:"12px", padding:"12px 16px", borderBottom:"1px solid var(--border)", cursor:"grab", transition:"background .15s" }}
      onMouseEnter={e => e.currentTarget.style.background = "var(--bg)"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      <span style={{ fontSize:".9rem", color:"var(--text-muted)", cursor:"grab" }}>⠿</span>
      <span style={{ fontSize:"1rem" }}>📄</span>
      {page.lang && <span style={{ fontSize:"1.1rem" }} title={page.lang}>{LANG_FLAGS[page.lang] || "🌐"}</span>}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{page.name || "Bez názvu"}</div>
        <div style={{ fontSize:".8rem", color:"var(--text-muted)" }}>{page.headline || "—"}</div>
      </div>
      <div style={{ display:"flex", gap:"20px", fontSize:".85rem", color:"var(--text-muted)" }}>
        <span>👁️ {page.visits || 0}</span>
        <span>✅ {page.conversions || 0}</span>
        <span style={{ color: rate > 10 ? "#16a34a" : rate > 5 ? "#d97706" : "var(--text-muted)", fontWeight:600 }}>{rate} %</span>
      </div>
      <div style={{ display:"flex", gap:"6px" }}>
        <button className="btn btn-primary" style={{ padding:"5px 12px", fontSize:".8rem" }} onClick={() => navigate(`/editor/${page.id}`)}>Editovat</button>
        <button className="btn btn-outline" style={{ padding:"5px 10px", fontSize:".8rem" }} onClick={() => window.open(`/p/${page.id}`, "_blank")}>👁️</button>
        <button className="btn btn-outline" style={{ padding:"5px 10px", fontSize:".8rem" }} onClick={() => onDelete(page.id)}>🗑️</button>
      </div>
    </div>
  );
}

// ─── FolderModal ──────────────────────────────────────────────────────────────
function FolderModal({ title, data, colors, onSave, onClose }) {
  const [name,  setName]  = useState(data.name  || "");
  const [color, setColor] = useState(data.color || colors[0]);
  return (
    <ModalWrap onClose={onClose}>
      <h3 style={{ marginBottom:"20px", fontWeight:700 }}>{title}</h3>
      <label style={{ fontSize:".8rem", fontWeight:600, color:"var(--text-muted)", display:"block", marginBottom:"6px" }}>NÁZEV</label>
      <input value={name} onChange={e => setName(e.target.value)} placeholder="název složky"
        style={{ width:"100%", padding:"10px 12px", border:"1px solid var(--border)", borderRadius:"8px", background:"var(--input-bg)", color:"var(--text)", fontSize:".95rem", marginBottom:"16px", outline:"none" }} />
      <label style={{ fontSize:".8rem", fontWeight:600, color:"var(--text-muted)", display:"block", marginBottom:"8px" }}>BARVA</label>
      <div style={{ display:"flex", gap:"8px", marginBottom:"24px" }}>
        {colors.map(c => (
          <div key={c} onClick={() => setColor(c)}
            style={{ width:"28px", height:"28px", borderRadius:"50%", background:c, cursor:"pointer", border: color === c ? "3px solid var(--text)" : "3px solid transparent", transition:"border .15s" }} />
        ))}
      </div>
      <div style={{ display:"flex", gap:"10px", justifyContent:"flex-end" }}>
        <button className="btn btn-outline" onClick={onClose}>Zrušit</button>
        <button className="btn btn-primary" onClick={() => name.trim() && onSave(name.trim(), color)}>Uložit</button>
      </div>
    </ModalWrap>
  );
}

// ─── ModalWrap ────────────────────────────────────────────────────────────────
function ModalWrap({ children, onClose }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.4)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000 }} onClick={onClose}>
      <div style={{ background:"var(--bg-card)", borderRadius:"16px", padding:"28px", minWidth:"400px", maxWidth:"520px", boxShadow:"0 8px 32px rgba(0,0,0,.2)" }} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}