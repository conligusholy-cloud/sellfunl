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

function useIsMobile() {
  const [m, setM] = useState(window.innerWidth < 640);
  useEffect(() => {
    const h = () => setM(window.innerWidth < 640);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return m;
}

// ─── Cloud AI volání ──────────────────────────────────────────────────────────
async function callCloudAI(prompt) {
  const fn = httpsCallable(getFunctions(app), "translate");
  const result = await fn({ prompt, max_tokens: 4000 });
  const raw = (result.data.result || "").trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("AI nevrátila JSON.");
  try { return JSON.parse(jsonMatch[0]); }
  catch {
    const fixed = jsonMatch[0].replace(/,\s*"[^"]*":\s*"[^"]*$/, "").replace(/,?\s*$/, "") + "}}";
    try { return JSON.parse(fixed); }
    catch { throw new Error("AI vrátila neplatný JSON."); }
  }
}

// ─── Překlad jedné stránky ────────────────────────────────────────────────────
async function translatePage(page, targetLangCode, user) {
  const lang = LANGUAGES.find(l => l.code === targetLangCode);
  const hero = page.hero || page.heroes?.full || {};
  const formFields = page.formFields || ["Jméno", "Email"];

  const prompt = `Jsi profesionální překladatel. Přelož VEŠKERÝ text do jazyka: ${lang.name}.
PRAVIDLA: Zachovej HTML tagy, vrať POUZE čistý JSON bez backticks, emoji ponechej.
{
  "name": ${JSON.stringify(page.name || "")},
  "headline": ${JSON.stringify(page.headline || "")},
  "subline": ${JSON.stringify(page.subline || "")},
  "text": ${JSON.stringify(page.text || "")},
  "btnText": ${JSON.stringify(page.btnText || "")},
  "price": ${JSON.stringify(page.price || "")},
  "formFields": ${JSON.stringify(formFields)},
  "hero": {
    "badgeText": ${JSON.stringify(hero.badgeText || "")},
    "h1Line1": ${JSON.stringify(hero.h1Line1 || "")},
    "h1Accent": ${JSON.stringify(hero.h1Accent || "")},
    "h1Line2": ${JSON.stringify(hero.h1Line2 || "")},
    "subText": ${JSON.stringify(hero.subText || "")},
    "btn1Text": ${JSON.stringify(hero.btn1Text || "")},
    "btn2Text": ${JSON.stringify(hero.btn2Text || "")}
  }
}`;

  const parsed = await callCloudAI(prompt);
  const translatedHero = parsed.hero ? { ...hero, ...parsed.hero } : hero;
  const newPage = {
    ...page,
    name: parsed.name || page.name,
    headline: parsed.headline || page.headline,
    subline: parsed.subline || page.subline,
    text: parsed.text || page.text,
    btnText: parsed.btnText || page.btnText,
    price: parsed.price || page.price,
    formFields: parsed.formFields || formFields,
    hero: translatedHero,
    heroes: { full: translatedHero },
    lang: targetLangCode,
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
  const isMobile  = useIsMobile();
  const [pages,   setPages]   = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openFolders, setOpenFolders] = useState({});
  const [dragOver,    setDragOver]    = useState(null);
  const [modal, setModal] = useState(null);
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
        try {
          const [vSnap, cSnap] = await Promise.all([
            getDocs(query(collection(db, "visits"),      where("pageId", "==", p.id))),
            getDocs(query(collection(db, "conversions"), where("pageId", "==", p.id))),
          ]);
          return { ...p, visits: vSnap.size, conversions: cSnap.size };
        } catch { return { ...p, visits: 0, conversions: 0 }; }
      }));
      setPages(withStats);
      setFolders(folderList);
      setLoading(false);
    }
    fetchAll();
  }, [user]);

  async function createFolder(name, color) {
    const ref = await addDoc(collection(db, "folders"), { uid: user.uid, name, color, createdAt: Date.now() });
    setFolders(f => [...f, { id: ref.id, uid: user.uid, name, color }]);
    setOpenFolders(o => ({ ...o, [ref.id]: true }));
  }
  async function updateFolder(id, name, color) {
    await updateDoc(doc(db, "folders", id), { name, color });
    setFolders(f => f.map(x => x.id === id ? { ...x, name, color } : x));
  }
  async function deleteFolder(id, del) {
    await deleteDoc(doc(db, "folders", id));
    if (del) {
      await Promise.all(pages.filter(p => p.folderId === id).map(p => deleteDoc(doc(db, "pages", p.id))));
      setPages(p => p.filter(x => x.folderId !== id));
    } else {
      await Promise.all(pages.filter(p => p.folderId === id).map(p => updateDoc(doc(db, "pages", p.id), { folderId: null })));
      setPages(p => p.map(x => x.folderId === id ? { ...x, folderId: null } : x));
    }
    setFolders(f => f.filter(x => x.id !== id));
    setModal(null);
  }

  function openFolderTranslate(folder) { setModal({ type:"translateFolder", folder }); }

  async function runFolderTranslate(folder, targetLangCode) {
    setModal(null);
    const folderPages = pages.filter(p => p.folderId === folder.id);
    if (!folderPages.length) return;
    const lang = LANGUAGES.find(l => l.code === targetLangCode);
    const newFolderRef = await addDoc(collection(db, "folders"), {
      uid: user.uid, name: `${folder.name} (${lang.flag} ${lang.name})`, color: folder.color, createdAt: Date.now(),
    });
    setFolders(f => [...f, { id: newFolderRef.id, uid: user.uid, name: `${folder.name} (${lang.flag} ${lang.name})`, color: folder.color }]);
    setOpenFolders(o => ({ ...o, [newFolderRef.id]: true }));

    for (let i = 0; i < folderPages.length; i++) {
      const page = folderPages[i];
      setTranslateState({ folderId: newFolderRef.id, progress: { done: i, total: folderPages.length, current: page.name || "Stránka" } });
      try {
        const translated = await translatePage(page, targetLangCode, user);
        translated.folderId = newFolderRef.id;
        const ref = await addDoc(collection(db, "pages"), translated);
        setPages(p => [...p, { id: ref.id, ...translated, visits: 0, conversions: 0 }]);
      } catch (err) {
        setTranslateState(s => ({ ...s, error: `Chyba u „${page.name}"` }));
      }
    }
    setTranslateState({ folderId: newFolderRef.id, progress: { done: folderPages.length, total: folderPages.length }, done: true });
    setTimeout(() => setTranslateState(null), 3000);
  }

  async function createPage(folderId = null) {
    const ref = await addDoc(collection(db, "pages"), {
      uid: user.uid, folderId, name: "Nová stránka", headline: "", subline: "", text: "",
      image: "", video: "", btnText: "", btnUrl: "", price: "", createdAt: Date.now(),
    });
    navigate(`/editor/${ref.id}`);
  }
  async function deletePage(id) {
    if (!confirm("Opravdu smazat?")) return;
    await deleteDoc(doc(db, "pages", id));
    setPages(p => p.filter(x => x.id !== id));
  }
  async function publishPage(id) {
    await updateDoc(doc(db, "pages", id), { published: true, publishedAt: Date.now() });
    setPages(p => p.map(x => x.id === id ? { ...x, published: true, publishedAt: Date.now() } : x));
  }
  async function publishFolder(folderId) {
    const now = Date.now();
    await Promise.all(pages.filter(p => p.folderId === folderId).map(p => updateDoc(doc(db, "pages", p.id), { published: true, publishedAt: now })));
    setPages(p => p.map(x => x.folderId === folderId ? { ...x, published: true, publishedAt: now } : x));
  }
  async function movePage(pageId, folderId) {
    await updateDoc(doc(db, "pages", pageId), { folderId: folderId || null });
    setPages(p => p.map(x => x.id === pageId ? { ...x, folderId: folderId || null } : x));
  }

  function onDragStart(pageId) { dragPageId.current = pageId; }
  function onDragOver(e, folderId) { e.preventDefault(); setDragOver(folderId); if (folderId) setOpenFolders(o => ({ ...o, [folderId]: true })); }
  function onDrop(e, folderId) { e.preventDefault(); if (dragPageId.current) movePage(dragPageId.current, folderId); dragPageId.current = null; setDragOver(null); }
  function onDragEnd() { dragPageId.current = null; setDragOver(null); }

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
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px", gap:"10px", flexWrap:"wrap" }}>
        <h1 style={{ fontSize: isMobile ? "1.2rem" : "1.4rem", fontWeight:700 }}>Moje stránky</h1>
        <div style={{ display:"flex", gap:"8px" }}>
          <button className="btn btn-outline" onClick={() => setModal({ type:"newFolder", data:{ name:"", color: COLORS[0] } })}>
            {isMobile ? "📁" : "📁 Nová složka"}
          </button>
          <button className="btn btn-primary" onClick={() => createPage(null)}>
            {isMobile ? "+ Stránka" : "+ Nová stránka"}
          </button>
        </div>
      </div>

      {loading && <p style={{ color:"var(--text-muted)" }}>Načítám...</p>}

      {/* SLOŽKY */}
      {folders.map(folder => {
        const stats = folderStats(folder.id);
        const isOpen = openFolders[folder.id];
        const fps = pages.filter(p => p.folderId === folder.id);
        const isDragTarget = dragOver === folder.id;
        const ts = translateState?.folderId === folder.id ? translateState : null;

        return (
          <div key={folder.id} className="card"
            style={{ marginBottom:"10px", padding:0, overflow:"hidden", borderLeft:`4px solid ${folder.color}`, boxShadow: isDragTarget ? `0 0 0 2px ${folder.color}` : undefined }}
            onDragOver={e => onDragOver(e, folder.id)} onDrop={e => onDrop(e, folder.id)} onDragLeave={() => setDragOver(null)}
          >
            {/* Záhlaví složky */}
            <div onClick={() => setOpenFolders(o => ({ ...o, [folder.id]: !o[folder.id] }))}
              style={{ display:"flex", alignItems:"center", gap:"10px", padding:"12px 14px", cursor:"pointer", background: isDragTarget ? folder.color+"30" : folder.color+"0d" }}
            >
              <div style={{ width:"12px", height:"12px", borderRadius:"3px", background:folder.color, flexShrink:0 }}/>
              <span style={{ fontWeight:700, flex:1, fontSize: isMobile ? ".9rem" : "1rem", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{folder.name}</span>

              {/* Statistiky — skryté na malém mobilu */}
              {!isMobile && (
                <div style={{ display:"flex", gap:"14px", fontSize:".8rem", color:"var(--text-muted)" }}>
                  <span>📄 {stats.count}</span>
                  <span>👁️ {stats.visits}</span>
                  <span>✅ {stats.convs}</span>
                  <span style={{ color: stats.rate > 10 ? "#16a34a" : stats.rate > 5 ? "#d97706" : "var(--text-muted)", fontWeight:600 }}>{stats.rate}%</span>
                </div>
              )}
              {isMobile && <span style={{ fontSize:".75rem", color:"var(--text-muted)" }}>📄{stats.count}</span>}

              {/* Akce */}
              <div style={{ display:"flex", gap:"4px" }} onClick={e => e.stopPropagation()}>
                {!isMobile && (
                  <button className="btn btn-outline"
                    style={{ padding:"3px 8px", fontSize:".75rem", color:"#059669", borderColor:"#059669", background:"#f0fdf4" }}
                    onClick={() => publishFolder(folder.id)}>🚀</button>
                )}
                <button className="btn btn-outline"
                  style={{ padding:"3px 8px", fontSize:".75rem", color:"#7c3aed", borderColor:"#7c3aed", background:"#f5f3ff" }}
                  onClick={() => openFolderTranslate(folder)}>🌍</button>
                <button className="btn btn-outline" style={{ padding:"3px 8px", fontSize:".75rem" }}
                  onClick={() => setModal({ type:"editFolder", data:{ id:folder.id, name:folder.name, color:folder.color } })}>✏️</button>
                <button className="btn btn-outline" style={{ padding:"3px 8px", fontSize:".75rem" }}
                  onClick={() => createPage(folder.id)}>+</button>
                <button className="btn btn-outline" style={{ padding:"3px 8px", fontSize:".75rem" }}
                  onClick={() => setModal({ type:"deleteFolder", folder })}>🗑️</button>
              </div>
            </div>

            {/* Progress překladu */}
            {ts && (
              <div style={{ padding:"8px 14px", background:"#f5f3ff", borderTop:"1px solid #ede9fe" }}>
                <div style={{ fontSize:".8rem", fontWeight:600, color:"#7c3aed", marginBottom:"5px" }}>
                  {ts.done ? "✅ Překlad dokončen!" : `🌍 Překládám… ${ts.progress.done}/${ts.progress.total}`}
                  {!ts.done && ts.progress.current && <span style={{ fontWeight:400, color:"#9ca3af", marginLeft:"6px" }}>„{ts.progress.current}"</span>}
                </div>
                <div style={{ height:"5px", background:"#ede9fe", borderRadius:"3px", overflow:"hidden" }}>
                  <div style={{ height:"100%", background:"#7c3aed", width:`${(ts.progress.done/ts.progress.total)*100}%`, transition:"width .4s" }}/>
                </div>
                {ts.error && <p style={{ fontSize:".75rem", color:"#dc2626", marginTop:"4px" }}>{ts.error}</p>}
              </div>
            )}

            {/* Stránky */}
            {isOpen && (
              <div style={{ borderTop:"1px solid var(--border)" }}>
                {fps.length === 0 && (
                  <p style={{ padding:"14px", color:"var(--text-muted)", fontSize:".85rem" }}>
                    {isDragTarget ? "⬇️ Pusť sem" : "Složka je prázdná — přetáhni stránku nebo klikni +"}
                  </p>
                )}
                {fps.map(page => (
                  <PageRow key={page.id} page={page} navigate={navigate} isMobile={isMobile}
                    onDelete={deletePage} onPublish={publishPage}
                    onDragStart={() => onDragStart(page.id)} onDragEnd={onDragEnd}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* BEZ SLOŽKY */}
      {unfoldered.length > 0 && (
        <div className="card" style={{ padding:0, overflow:"hidden", boxShadow: dragOver==="none" ? "0 0 0 2px #64748b" : undefined }}
          onDragOver={e => onDragOver(e, "none")} onDrop={e => onDrop(e, null)} onDragLeave={() => setDragOver(null)}>
          <div style={{ padding:"10px 14px", borderBottom:"1px solid var(--border)", fontWeight:600, color:"var(--text-muted)", fontSize:".82rem" }}>
            BEZ SLOŽKY {dragOver==="none" && "⬇️"}
          </div>
          {unfoldered.map(page => (
            <PageRow key={page.id} page={page} navigate={navigate} isMobile={isMobile}
              onDelete={deletePage} onPublish={publishPage}
              onDragStart={() => onDragStart(page.id)} onDragEnd={onDragEnd}
            />
          ))}
        </div>
      )}

      {/* Prázdný stav */}
      {!loading && pages.length === 0 && folders.length === 0 && (
        <div className="card" style={{ textAlign:"center", padding:"48px 24px" }}>
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
      {modal?.type === "deleteFolder" && (
        <DeleteFolderModal folder={modal.folder}
          pageCount={pages.filter(p => p.folderId === modal.folder.id).length}
          onConfirm={del => deleteFolder(modal.folder.id, del)}
          onClose={() => setModal(null)} />
      )}
      {modal?.type === "translateFolder" && (
        <TranslateFolderModal folder={modal.folder}
          pageCount={pages.filter(p => p.folderId === modal.folder.id).length}
          onTranslate={langCode => runFolderTranslate(modal.folder, langCode)}
          onClose={() => setModal(null)} />
      )}
    </div>
  );
}

// ─── PageRow ──────────────────────────────────────────────────────────────────
function PageRow({ page, navigate, onDelete, onDragStart, onDragEnd, onPublish, isMobile }) {
  const rate = page.visits > 0 ? Math.round((page.conversions / page.visits) * 100) : 0;
  const isPublished = !!page.published;
  const hasChanges  = page.updatedAt && page.publishedAt && page.updatedAt > page.publishedAt;

  return (
    <div draggable onDragStart={onDragStart} onDragEnd={onDragEnd}
      style={{ display:"flex", alignItems:"center", gap:"8px", padding:"10px 14px", borderBottom:"1px solid var(--border)", cursor:"grab" }}
      onMouseEnter={e => e.currentTarget.style.background = "var(--bg)"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    >
      {!isMobile && <span style={{ fontSize:".85rem", color:"var(--text-muted)" }}>⠿</span>}
      {page.lang && <span style={{ fontSize:"1rem" }}>{LANG_FLAGS[page.lang] || "🌐"}</span>}

      {/* Název */}
      <div style={{ flex:1, minWidth:0, cursor:"pointer" }} onClick={() => navigate(`/editor/${page.id}`)}>
        <div style={{ fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontSize: isMobile ? ".85rem" : ".9rem" }}
          onMouseEnter={e => e.currentTarget.style.color = "#7c3aed"}
          onMouseLeave={e => e.currentTarget.style.color = "var(--text)"}>
          {page.name || "Bez názvu"}
          {!isPublished && <span style={{ marginLeft:"5px", fontSize:"9px", fontWeight:700, padding:"1px 5px", borderRadius:"6px", background:"#fef9c3", color:"#854d0e" }}>Nepublikováno</span>}
          {isPublished && hasChanges && <span style={{ marginLeft:"5px", fontSize:"9px", fontWeight:700, padding:"1px 5px", borderRadius:"6px", background:"#fff7ed", color:"#c2410c" }}>Změny</span>}
        </div>
        {!isMobile && <div style={{ fontSize:".75rem", color:"var(--text-muted)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{page.headline || "—"}</div>}
      </div>

      {/* Statistiky — jen desktop */}
      {!isMobile && (
        <div style={{ display:"flex", gap:"14px", fontSize:".8rem", color:"var(--text-muted)" }}>
          <span>👁️ {page.visits || 0}</span>
          <span>✅ {page.conversions || 0}</span>
          <span style={{ color: rate > 10 ? "#16a34a" : rate > 5 ? "#d97706" : "var(--text-muted)", fontWeight:600 }}>{rate}%</span>
        </div>
      )}

      {/* Akce */}
      <div style={{ display:"flex", gap:"5px", flexShrink:0 }}>
        {isPublished && !hasChanges ? (
          <button className="btn btn-outline" style={{ padding:"4px 10px", fontSize:".78rem" }}
            onClick={() => window.open(`/p/${page.id}`, "_blank")}>
            {isMobile ? "👁️" : "👁️ Náhled"}
          </button>
        ) : (
          <button style={{ padding:"4px 10px", fontSize:".78rem", fontWeight:700, border:"none", borderRadius:"7px", cursor:"pointer", background: isPublished ? "#f97316" : "#7c3aed", color:"#fff" }}
            onClick={() => onPublish(page.id)}>
            {isMobile ? "🚀" : isPublished ? "🚀 Zveřejnit" : "🚀 Publikovat"}
          </button>
        )}
        <button className="btn btn-outline" style={{ padding:"4px 8px", fontSize:".78rem" }}
          onClick={() => onDelete(page.id)}>🗑️</button>
      </div>
    </div>
  );
}

// ─── DeleteFolderModal ────────────────────────────────────────────────────────
function DeleteFolderModal({ folder, pageCount, onConfirm, onClose }) {
  return (
    <ModalWrap onClose={onClose}>
      <h3 style={{ marginBottom:"8px", fontWeight:700 }}>🗑️ Smazat složku</h3>
      <p style={{ fontSize:".88rem", color:"var(--text-muted)", marginBottom:"20px" }}>
        Složka <strong>„{folder.name}"</strong> obsahuje <strong>{pageCount}</strong> {pageCount === 1 ? "stránku" : pageCount < 5 ? "stránky" : "stránek"}. Co chceš udělat se stránkami?
      </p>
      <div style={{ display:"flex", flexDirection:"column", gap:"10px", marginBottom:"20px" }}>
        <button onClick={() => onConfirm(false)}
          style={{ padding:"12px 16px", borderRadius:"10px", border:"1px solid var(--border)", background:"var(--bg-card)", cursor:"pointer", textAlign:"left", fontSize:".88rem" }}
          onMouseEnter={e => e.currentTarget.style.borderColor = "#7c3aed"}
          onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}>
          <div style={{ fontWeight:600, marginBottom:"3px" }}>📁 Smazat pouze složku</div>
          <div style={{ fontSize:".8rem", color:"var(--text-muted)" }}>Stránky přesunou se do „Bez složky"</div>
        </button>
        <button onClick={() => onConfirm(true)}
          style={{ padding:"12px 16px", borderRadius:"10px", border:"1px solid #fca5a5", background:"#fff1f2", cursor:"pointer", textAlign:"left", fontSize:".88rem" }}
          onMouseEnter={e => e.currentTarget.style.background = "#fee2e2"}
          onMouseLeave={e => e.currentTarget.style.background = "#fff1f2"}>
          <div style={{ fontWeight:600, color:"#dc2626", marginBottom:"3px" }}>🗑️ Smazat vše</div>
          <div style={{ fontSize:".8rem", color:"#ef4444" }}>Nevratná akce — smaže {pageCount} {pageCount === 1 ? "stránku" : "stránek"}</div>
        </button>
      </div>
      <div style={{ display:"flex", justifyContent:"flex-end" }}>
        <button className="btn btn-outline" onClick={onClose}>Zrušit</button>
      </div>
    </ModalWrap>
  );
}

// ─── TranslateFolderModal ─────────────────────────────────────────────────────
function TranslateFolderModal({ folder, pageCount, onTranslate, onClose }) {
  const [selected, setSelected] = useState(null);
  return (
    <ModalWrap onClose={onClose}>
      <h3 style={{ marginBottom:"6px", fontWeight:700 }}>🌍 Přeložit složku</h3>
      <p style={{ fontSize:".85rem", color:"var(--text-muted)", marginBottom:"6px" }}>
        Přeloží <strong>{pageCount}</strong> stránek včetně Hero sekce, formuláře i tlačítek.
      </p>
      <div style={{ display:"flex", flexWrap:"wrap", gap:"6px", marginBottom:"16px", maxHeight:"200px", overflowY:"auto" }}>
        {LANGUAGES.map(lang => (
          <button key={lang.code} onClick={() => setSelected(lang.code)}
            style={{ padding:"6px 12px", borderRadius:"8px", fontSize:".85rem", cursor:"pointer",
              border: selected===lang.code ? "2px solid #7c3aed" : "1px solid var(--border)",
              background: selected===lang.code ? "#f5f3ff" : "var(--bg-card)",
              color: selected===lang.code ? "#7c3aed" : "var(--text)",
              fontWeight: selected===lang.code ? 600 : 400 }}>
            {lang.flag} {lang.name}
          </button>
        ))}
      </div>
      <div style={{ display:"flex", gap:"10px", justifyContent:"flex-end" }}>
        <button className="btn btn-outline" onClick={onClose}>Zrušit</button>
        <button className="btn btn-primary" disabled={!selected}
          onClick={() => selected && onTranslate(selected)}
          style={{ opacity: selected ? 1 : 0.5 }}>
          🌍 Přeložit
        </button>
      </div>
    </ModalWrap>
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
      <div style={{ display:"flex", gap:"8px", flexWrap:"wrap", marginBottom:"24px" }}>
        {colors.map(c => (
          <div key={c} onClick={() => setColor(c)}
            style={{ width:"28px", height:"28px", borderRadius:"50%", background:c, cursor:"pointer", border: color===c ? "3px solid var(--text)" : "3px solid transparent" }} />
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
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.4)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:"16px" }} onClick={onClose}>
      <div style={{ background:"var(--bg-card)", borderRadius:"16px", padding:"24px", width:"100%", maxWidth:"480px", boxShadow:"0 8px 32px rgba(0,0,0,.2)" }} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}