import { useState, useEffect, useRef } from "react";
import { httpsCallable, getFunctions } from "firebase/functions";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const functions = getFunctions();
const call = (name) => httpsCallable(functions, name);
const db = getFirestore();

const LANGUAGES = [
  { value: "cs", label: "Čeština", flag: "🇨🇿" },
  { value: "sk", label: "Slovenština", flag: "🇸🇰" },
  { value: "en", label: "Angličtina", flag: "🇬🇧" },
  { value: "de", label: "Němčina", flag: "🇩🇪" },
  { value: "pl", label: "Polština", flag: "🇵🇱" },
  { value: "fr", label: "Francouzština", flag: "🇫🇷" },
  { value: "es", label: "Španělština", flag: "🇪🇸" },
  { value: "it", label: "Italština", flag: "🇮🇹" },
  { value: "pt", label: "Portugalština", flag: "🇵🇹" },
  { value: "hu", label: "Maďarština", flag: "🇭🇺" },
  { value: "nl", label: "Holandština", flag: "🇳🇱" },
  { value: "ro", label: "Rumunština", flag: "🇷🇴" },
];

const COUNTRIES = [
  { value: "CZ", label: "Česko" }, { value: "SK", label: "Slovensko" },
  { value: "DE", label: "Německo" }, { value: "AT", label: "Rakousko" },
  { value: "PL", label: "Polsko" }, { value: "HU", label: "Maďarsko" },
  { value: "GB", label: "Británie" }, { value: "US", label: "USA" },
  { value: "FR", label: "Francie" }, { value: "ES", label: "Španělsko" },
  { value: "IT", label: "Itálie" }, { value: "PT", label: "Portugalsko" },
  { value: "NL", label: "Nizozemsko" }, { value: "BE", label: "Belgie" },
  { value: "CH", label: "Švýcarsko" }, { value: "RO", label: "Rumunsko" },
];

function emptyRow() {
  return { id: Date.now(), lang: "cs", country: "CZ", url: "", urlMode: "page", status: null, error: null };
}

// ─── Dropdown pro výběr stránky / URL ────────────────────────────────────────
function UrlDropdown({ url, urlMode, pages, folders, openFolders, setOpenFolders, onSelectUrl, onChangeMode, onManualUrl, disabled }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selectedPage = pages.find(p => {
    const pUrl = p.url || `https://${window.location.host}/p/${p.id}`;
    return pUrl === url;
  });
  const displayText = url
    ? (selectedPage ? selectedPage.name : (url.length > 40 ? url.slice(0, 37) + "…" : url))
    : "Vybrat odkaz…";

  return (
    <div ref={ref} style={{ position: "relative", flex: 1.5, minWidth: 0 }}>
      <button onClick={() => !disabled && setOpen(!open)}
        style={{
          width: "100%", padding: "6px 24px 6px 8px", borderRadius: "6px",
          border: "1px solid var(--border)", background: "var(--bg)",
          color: url ? "var(--text)" : "var(--text-muted)",
          fontSize: ".78rem", textAlign: "left", cursor: disabled ? "not-allowed" : "pointer",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          position: "relative",
        }}>
        🔗 {displayText}
        <span style={{ position: "absolute", right: "6px", top: "50%", transform: "translateY(-50%)", fontSize: ".6rem", color: "var(--text-muted)" }}>
          {open ? "▲" : "▼"}
        </span>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, zIndex: 50,
          marginTop: "2px", padding: "8px", borderRadius: "8px", minWidth: "320px",
          background: "var(--bg-card)", border: "1px solid var(--border)",
          boxShadow: "0 4px 16px rgba(0,0,0,.12)", maxHeight: "280px", overflowY: "auto",
        }}>
          {/* Přepínač režimu */}
          <div style={{ display: "flex", gap: "4px", marginBottom: "8px" }}>
            <button onClick={() => onChangeMode("page")}
              style={{
                padding: "4px 10px", borderRadius: "14px", fontSize: ".72rem", fontWeight: urlMode === "page" ? 600 : 400,
                border: urlMode === "page" ? "1.5px solid #7c3aed" : "1px solid var(--border)",
                background: urlMode === "page" ? "#f5f3ff" : "transparent",
                color: urlMode === "page" ? "#7c3aed" : "var(--text)", cursor: "pointer",
              }}>Moje stránky</button>
            <button onClick={() => onChangeMode("manual")}
              style={{
                padding: "4px 10px", borderRadius: "14px", fontSize: ".72rem", fontWeight: urlMode === "manual" ? 600 : 400,
                border: urlMode === "manual" ? "1.5px solid #7c3aed" : "1px solid var(--border)",
                background: urlMode === "manual" ? "#f5f3ff" : "transparent",
                color: urlMode === "manual" ? "#7c3aed" : "var(--text)", cursor: "pointer",
              }}>Zadat ručně</button>
          </div>

          {urlMode === "manual" ? (
            <input value={url} onChange={e => onManualUrl(e.target.value)}
              placeholder="https://example.com/landing-page"
              autoFocus
              style={{
                width: "100%", padding: "7px 8px", borderRadius: "6px",
                border: "1px solid var(--border)", background: "var(--bg)",
                color: "var(--text)", fontSize: ".78rem", outline: "none", boxSizing: "border-box",
              }}
            />
          ) : (
            <div>
              {/* Složky */}
              {folders.filter(f => pages.some(p => p.folderId === f.id)).map(folder => {
                const folderPages = pages.filter(p => p.folderId === folder.id);
                return (
                  <div key={folder.id}>
                    <button onClick={() => setOpenFolders(prev => ({ ...prev, [folder.id]: !prev[folder.id] }))}
                      style={{
                        width: "100%", padding: "5px 8px", borderRadius: "6px", fontSize: ".75rem",
                        textAlign: "left", cursor: "pointer", border: "none",
                        background: openFolders[folder.id] ? "#e0f2fe" : "transparent",
                        color: "var(--text)", fontWeight: 600, display: "flex", alignItems: "center", gap: "5px",
                      }}>
                      <span style={{ fontSize: ".65rem", transition: "transform .15s", transform: openFolders[folder.id] ? "rotate(90deg)" : "rotate(0)" }}>▶</span>
                      <span style={{ color: folder.color || "#7c3aed" }}>📁</span>
                      {folder.name}
                      <span style={{ fontSize: ".65rem", color: "var(--text-muted)", marginLeft: "auto" }}>{folderPages.length}</span>
                    </button>
                    {openFolders[folder.id] && (
                      <div style={{ paddingLeft: "16px", display: "flex", flexDirection: "column", gap: "2px", marginTop: "2px" }}>
                        {folderPages.map(p => {
                          const pUrl = p.url; // Jen veřejné URL (s doménou/btnUrl)
                          const isActive = pUrl && url === pUrl;
                          const canSelect = !!pUrl;
                          return (
                            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                              <button onClick={() => { if (canSelect) { onSelectUrl(pUrl); setOpen(false); } }}
                                style={{
                                  flex: 1, padding: "5px 8px", borderRadius: "6px", fontSize: ".75rem",
                                  textAlign: "left", cursor: canSelect ? "pointer" : "not-allowed",
                                  border: isActive ? "1.5px solid #7c3aed" : "1px solid transparent",
                                  background: isActive ? "#f5f3ff" : "transparent",
                                  color: !canSelect ? "#aaa" : isActive ? "#7c3aed" : "var(--text)",
                                  fontWeight: isActive ? 600 : 400, opacity: canSelect ? 1 : 0.6,
                                }}>
                                <div>{p.name}{!canSelect && <span style={{ fontSize: ".6rem", color: "#d97706", marginLeft: "6px" }}>bez domény</span>}</div>
                                {pUrl && <div style={{ fontSize: ".65rem", color: "var(--text-muted)", marginTop: "1px" }}>{pUrl}</div>}
                              </button>
                              <a href={p.previewUrl} target="_blank" rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "22px", height: "22px", borderRadius: "4px", background: "#f5f3ff", border: "1px solid #ddd6fe", color: "#7c3aed", textDecoration: "none", fontSize: ".7rem", flexShrink: 0 }}
                                title="Náhled">👁</a>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              {/* Stránky bez složky */}
              {pages.filter(p => !p.folderId).length > 0 && folders.length > 0 && (
                <div style={{ fontSize: ".68rem", color: "var(--text-muted)", fontWeight: 600, padding: "4px 0 2px", marginTop: "4px" }}>Bez složky</div>
              )}
              {pages.filter(p => !p.folderId).map(p => {
                const pUrl = p.url;
                const isActive = pUrl && url === pUrl;
                const canSelect = !!pUrl;
                return (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <button onClick={() => { if (canSelect) { onSelectUrl(pUrl); setOpen(false); } }}
                      style={{
                        flex: 1, padding: "5px 8px", borderRadius: "6px", fontSize: ".75rem",
                        textAlign: "left", cursor: canSelect ? "pointer" : "not-allowed",
                        border: isActive ? "1.5px solid #7c3aed" : "1px solid transparent",
                        background: isActive ? "#f5f3ff" : "transparent",
                        color: !canSelect ? "#aaa" : isActive ? "#7c3aed" : "var(--text)",
                        fontWeight: isActive ? 600 : 400, opacity: canSelect ? 1 : 0.6,
                      }}>
                      <div>{p.name}{!canSelect && <span style={{ fontSize: ".6rem", color: "#d97706", marginLeft: "6px" }}>bez domény</span>}</div>
                      {pUrl && <div style={{ fontSize: ".65rem", color: "var(--text-muted)", marginTop: "1px" }}>{pUrl}</div>}
                    </button>
                    <a href={p.previewUrl} target="_blank" rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "22px", height: "22px", borderRadius: "4px", background: "#f5f3ff", border: "1px solid #ddd6fe", color: "#7c3aed", textDecoration: "none", fontSize: ".7rem", flexShrink: 0 }}
                      title="Náhled">👁</a>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Hlavní komponenta ───────────────────────────────────────────────────────
export default function BulkGenerator({ fbAccount, onNavigate }) {
  const [adAccountId, setAdAccountId] = useState(() => {
    try { return localStorage.getItem("sellfunl_default_ad_account") || ""; } catch { return ""; }
  });
  const [adAccounts, setAdAccounts] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [rows, setRows] = useState([emptyRow()]);
  const [generating, setGenerating] = useState(false);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  const [userPages, setUserPages] = useState([]);
  const [userFolders, setUserFolders] = useState([]);
  const [openFolders, setOpenFolders] = useState({});

  // Načti ad účty
  useEffect(() => {
    if (!fbAccount) return;
    call("fbListAdAccounts")({}).then(r => {
      const accs = r.data?.accounts || [];
      setAdAccounts(accs);
      if (!adAccountId && accs.length > 0) setAdAccountId(accs[0].id);
    }).catch(() => {});
  }, [fbAccount]);

  // Načti kampaně
  useEffect(() => {
    if (!adAccountId) return;
    setLoadingCampaigns(true);
    call("fbListCampaigns")({ adAccountId }).then(r => {
      setCampaigns(r.data?.campaigns || []);
    }).catch(() => {}).finally(() => setLoadingCampaigns(false));
  }, [adAccountId]);

  // Načti stránky a složky
  useEffect(() => {
    const uid = getAuth()?.currentUser?.uid;
    if (!uid) return;
    Promise.all([
      getDocs(query(collection(db, "pages"), where("uid", "==", uid))),
      getDocs(query(collection(db, "folders"), where("uid", "==", uid))),
    ]).then(([pSnap, fSnap]) => {
      setUserPages(pSnap.docs.map(d => {
        const p = { id: d.id, ...d.data() };
        let url = "";
        if (p.domain) url = `https://${p.domain}${p.slug ? "/" + p.slug : ""}`;
        // btnUrl jako alternativa pro stránky bez domény
        if (!url && p.btnUrl) url = p.btnUrl;
        const previewUrl = p.domain ? url : `/p/${p.id}`;
        return { id: p.id, name: p.name || "Bez názvu", url, previewUrl, folderId: p.folderId || null, hasDomain: !!p.domain };
      }));
      setUserFolders(fSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    }).catch(() => {});
  }, []);

  function updateRow(id, field, value) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  }

  function addRow() {
    setRows(prev => [...prev, emptyRow()]);
  }

  function removeRow(id) {
    setRows(prev => prev.length > 1 ? prev.filter(r => r.id !== id) : prev);
  }

  async function generate() {
    if (!selectedCampaign || !adAccountId) return;
    setGenerating(true);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      updateRow(row.id, "status", "generating");
      updateRow(row.id, "error", null);

      try {
        const params = {
          type: "campaign",
          sourceId: selectedCampaign,
          adAccountId,
          targetLanguage: row.lang || null,
          newTargeting: row.country ? { geo_locations: { countries: [row.country] } } : null,
        };
        if (row.url?.trim()) params.newUrl = row.url.trim();

        const result = await call("fbDuplicate")(params);
        const res = result.data || result;

        const errors = [];
        if (res.adErrors) errors.push(...res.adErrors);
        if (res.adSetErrors) errors.push(...res.adSetErrors);
        if (res.adSets) {
          for (const as of res.adSets) {
            if (as.adErrors) errors.push(...as.adErrors);
          }
        }

        if (errors.length > 0) {
          updateRow(row.id, "status", "warning");
          updateRow(row.id, "error", errors.join("; "));
        } else {
          updateRow(row.id, "status", "done");
        }
      } catch (err) {
        updateRow(row.id, "status", "error");
        updateRow(row.id, "error", err.message || "Chyba");
      }
    }

    setGenerating(false);
  }

  const allDone = rows.every(r => r.status === "done" || r.status === "warning");
  const campaignName = campaigns.find(c => c.id === selectedCampaign)?.name || "";

  return (
    <div>
      <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text)", marginBottom: "4px" }}>
        Hromadné generování kampaní
      </h3>
      <p style={{ fontSize: ".82rem", color: "var(--text-muted)", marginBottom: "20px" }}>
        Vyber zdrojovou kampaň a přidej kopie s různými jazyky, zeměmi a odkazy.
      </p>

      {/* Reklamní účet */}
      {adAccounts.length > 1 && (
        <div style={{ marginBottom: "16px" }}>
          <label style={lbl}>Reklamní účet</label>
          <select value={adAccountId} onChange={e => setAdAccountId(e.target.value)} style={sel}>
            {adAccounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.id})</option>)}
          </select>
        </div>
      )}

      {/* Zdrojová kampaň */}
      <div style={{ marginBottom: "20px" }}>
        <label style={lbl}>Zdrojová kampaň</label>
        {loadingCampaigns ? (
          <p style={{ fontSize: ".82rem", color: "var(--text-muted)" }}>Načítám kampaně...</p>
        ) : (
          <select value={selectedCampaign} onChange={e => setSelectedCampaign(e.target.value)} style={sel}>
            <option value="">— Vyber kampaň —</option>
            {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      {selectedCampaign && (
        <>
          {/* Info */}
          <div style={{
            padding: "10px 14px", borderRadius: "8px", background: "#f0f9ff",
            border: "1px solid #bae6fd", marginBottom: "16px", fontSize: ".82rem",
          }}>
            <span style={{ color: "#0369a1", fontWeight: 600 }}>Zdroj:</span>{" "}
            <span style={{ color: "#0c4a6e" }}>{campaignName}</span>
          </div>

          {/* Hlavička řádků */}
          <div style={{
            display: "flex", alignItems: "center", gap: "8px",
            padding: "0 8px 6px", fontSize: ".68rem", fontWeight: 600, color: "var(--text-muted)",
          }}>
            <span style={{ width: "54px" }}>#</span>
            <span style={{ width: "130px" }}>Jazyk</span>
            <span style={{ flex: 1 }}>Země</span>
            <span style={{ flex: 1.5 }}>Odkaz</span>
            <span style={{ width: "28px" }}></span>
          </div>

          {/* Řádky kopií */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "16px" }}>
            {rows.map((row, idx) => (
              <div key={row.id}>
                <div style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  padding: "8px", borderRadius: "8px",
                  border: row.status === "done" ? "2px solid #16a34a"
                    : row.status === "error" ? "2px solid #ef4444"
                    : row.status === "warning" ? "2px solid #d97706"
                    : row.status === "generating" ? "2px solid #3b82f6"
                    : "1px solid var(--border)",
                  background: row.status === "generating" ? "#eff6ff" : "var(--bg-card)",
                }}>
                  {/* Číslo + status */}
                  <span style={{ width: "54px", fontWeight: 700, fontSize: ".78rem", color: "var(--text)", flexShrink: 0, textAlign: "center" }}>
                    {row.status === "done" ? "✅" : row.status === "warning" ? "⚠️" : row.status === "error" ? "❌" : row.status === "generating" ? "⏳" : `${idx + 1}.`}
                  </span>

                  {/* Jazyk — native select */}
                  <select value={row.lang} onChange={e => updateRow(row.id, "lang", e.target.value)}
                    disabled={generating}
                    style={{
                      width: "130px", flexShrink: 0, padding: "6px 8px", borderRadius: "6px",
                      border: "1px solid var(--border)", background: "var(--bg)",
                      color: "var(--text)", fontSize: ".78rem", outline: "none",
                    }}>
                    {LANGUAGES.map(l => (
                      <option key={l.value} value={l.value}>{l.flag} {l.label}</option>
                    ))}
                  </select>

                  {/* Země — single select */}
                  <select value={row.country} onChange={e => updateRow(row.id, "country", e.target.value)}
                    disabled={generating}
                    style={{
                      flex: 1, minWidth: 0, padding: "6px 8px", borderRadius: "6px",
                      border: "1px solid var(--border)", background: "var(--bg)",
                      color: "var(--text)", fontSize: ".78rem", outline: "none",
                    }}>
                    {COUNTRIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>

                  {/* URL — custom dropdown */}
                  <UrlDropdown
                    url={row.url}
                    urlMode={row.urlMode || "page"}
                    pages={userPages}
                    folders={userFolders}
                    openFolders={openFolders}
                    setOpenFolders={setOpenFolders}
                    onSelectUrl={u => updateRow(row.id, "url", u)}
                    onChangeMode={m => updateRow(row.id, "urlMode", m)}
                    onManualUrl={u => updateRow(row.id, "url", u)}
                    disabled={generating}
                  />

                  {/* Smazat */}
                  {rows.length > 1 && !generating ? (
                    <button onClick={() => removeRow(row.id)} style={{
                      width: "28px", height: "28px", flexShrink: 0, border: "none",
                      background: "transparent", color: "#ef4444",
                      cursor: "pointer", fontSize: ".85rem", padding: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      borderRadius: "4px",
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = "#fef2f2"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >✕</button>
                  ) : <span style={{ width: "28px", flexShrink: 0 }} />}
                </div>

                {/* Error pod řádkem */}
                {row.error && (
                  <p style={{ fontSize: ".7rem", color: row.status === "warning" ? "#d97706" : "#ef4444", margin: "4px 8px 0 62px", whiteSpace: "pre-wrap" }}>
                    {row.error}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Přidat řádek */}
          {!generating && (
            <button onClick={addRow} style={{
              width: "100%", padding: "10px", borderRadius: "8px",
              border: "2px dashed var(--border)", background: "transparent",
              color: "var(--text-muted)", cursor: "pointer", fontSize: ".85rem",
              fontWeight: 500, marginBottom: "16px", transition: "all .15s",
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#7c3aed"; e.currentTarget.style.color = "#7c3aed"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-muted)"; }}
            >
              + Přidat kopii
            </button>
          )}

          {/* Shrnutí */}
          <div style={{
            padding: "12px 14px", borderRadius: "8px", background: "#f8fafc",
            border: "1px solid var(--border)", marginBottom: "16px", fontSize: ".82rem",
          }}>
            <strong style={{ color: "var(--text)" }}>Shrnutí:</strong>
            <span style={{ color: "var(--text-muted)", marginLeft: "8px" }}>
              {rows.length} {rows.length === 1 ? "kopie" : rows.length < 5 ? "kopie" : "kopií"} z kampaně „{campaignName}"
            </span>
          </div>

          {/* Tlačítka */}
          {allDone ? (
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => onNavigate?.("campaigns")}
                style={{
                  flex: 1, padding: "12px 28px", borderRadius: "8px", border: "none",
                  background: "#16a34a", color: "#fff", cursor: "pointer",
                  fontWeight: 700, fontSize: ".95rem",
                }}>
                ✅ Hotovo — Zobrazit kampaně
              </button>
              <button onClick={generate}
                style={{
                  padding: "12px 20px", borderRadius: "8px", border: "1px solid var(--border)",
                  background: "var(--bg)", color: "var(--text)", cursor: "pointer",
                  fontWeight: 500, fontSize: ".85rem",
                }}>
                🔄 Znovu
              </button>
            </div>
          ) : (
            <button onClick={generate} disabled={generating || rows.length === 0}
              style={{
                padding: "12px 28px", borderRadius: "8px", border: "none",
                background: generating ? "#93c5fd" : "#0ea5e9",
                color: "#fff", cursor: generating ? "not-allowed" : "pointer",
                fontWeight: 700, fontSize: ".95rem", width: "100%",
              }}>
              {generating ? "⏳ Generuji..." : `🚀 Generovat ${rows.length} ${rows.length === 1 ? "kopii" : rows.length < 5 ? "kopie" : "kopií"}`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ─── Sdílené styly ──────────────────────────────────────────────────────────
const lbl = { display: "block", fontSize: ".78rem", fontWeight: 500, color: "var(--text-muted)", marginBottom: "4px" };
const sel = {
  width: "100%", padding: "10px 12px", borderRadius: "8px",
  border: "1px solid var(--border)", background: "var(--bg)",
  color: "var(--text)", fontSize: ".85rem", outline: "none",
};
