import { useState, useEffect, useCallback } from "react";
import { httpsCallable, getFunctions } from "firebase/functions";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, deleteDoc, query, where, updateDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const functions = getFunctions();
const call = (name) => httpsCallable(functions, name);
const db = getFirestore();

const OBJECTIVES = [
  { value: "OUTCOME_TRAFFIC",     label: "Návštěvnost webu",     icon: "🌐", desc: "Přiveď lidi na web" },
  { value: "OUTCOME_ENGAGEMENT",  label: "Zapojení",             icon: "💬", desc: "Lajky, komentáře, sdílení" },
  { value: "OUTCOME_LEADS",       label: "Generování leadů",     icon: "📋", desc: "Sbírej kontakty" },
  { value: "OUTCOME_SALES",       label: "Prodeje / konverze",   icon: "🛒", desc: "Nákupy a konverze" },
  { value: "OUTCOME_AWARENESS",   label: "Povědomí o značce",    icon: "📢", desc: "Oslovení co nejvíce lidí" },
];

const STATUS_MAP = {
  ACTIVE:   { label: "Aktivní",     color: "#16a34a", bg: "#dcfce7" },
  PAUSED:   { label: "Pozastaveno", color: "#d97706", bg: "#fef3c7" },
  ARCHIVED: { label: "Archivováno", color: "#6b7280", bg: "#f3f4f6" },
  DELETED:  { label: "Smazáno",     color: "#ef4444", bg: "#fef2f2" },
};

const OPTIMIZATION_GOALS = [
  { value: "LINK_CLICKS",    label: "Kliknutí na odkaz" },
  { value: "LANDING_PAGE_VIEWS", label: "Zobrazení landing page" },
  { value: "IMPRESSIONS",    label: "Imprese" },
  { value: "REACH",          label: "Dosah" },
  { value: "LEAD_GENERATION", label: "Generování leadů" },
];

const CTA_OPTIONS = [
  { value: "LEARN_MORE",   label: "Zjistit více" },
  { value: "SHOP_NOW",     label: "Nakoupit" },
  { value: "SIGN_UP",      label: "Registrovat se" },
  { value: "GET_OFFER",    label: "Získat nabídku" },
  { value: "CONTACT_US",   label: "Kontaktovat" },
  { value: "BOOK_TRAVEL",  label: "Rezervovat" },
  { value: "DOWNLOAD",     label: "Stáhnout" },
  { value: "SUBSCRIBE",    label: "Odebírat" },
  { value: "APPLY_NOW",    label: "Přihlásit se" },
  { value: "GET_QUOTE",    label: "Získat cenovou nabídku" },
];

const LANGUAGES = [
  { value: "",   label: "Bez překladu (kopie v originále)" },
  { value: "cs", label: "Čeština" },
  { value: "en", label: "Angličtina" },
  { value: "de", label: "Němčina" },
  { value: "sk", label: "Slovenština" },
  { value: "pl", label: "Polština" },
  { value: "fr", label: "Francouzština" },
  { value: "es", label: "Španělština" },
  { value: "it", label: "Italština" },
  { value: "pt", label: "Portugalština" },
  { value: "hu", label: "Maďarština" },
  { value: "nl", label: "Holandština" },
  { value: "ro", label: "Rumunština" },
];

const COUNTRIES = [
  { value: "CZ", label: "Česko" },
  { value: "SK", label: "Slovensko" },
  { value: "DE", label: "Německo" },
  { value: "AT", label: "Rakousko" },
  { value: "PL", label: "Polsko" },
  { value: "HU", label: "Maďarsko" },
  { value: "GB", label: "Velká Británie" },
  { value: "US", label: "USA" },
  { value: "FR", label: "Francie" },
  { value: "ES", label: "Španělsko" },
  { value: "IT", label: "Itálie" },
  { value: "PT", label: "Portugalsko" },
  { value: "NL", label: "Nizozemsko" },
  { value: "BE", label: "Belgie" },
  { value: "CH", label: "Švýcarsko" },
  { value: "RO", label: "Rumunsko" },
];

export default function CampaignManager({ fbAccount }) {
  const [adAccountId, setAdAccountId] = useState(() => {
    try { return localStorage.getItem("sellfunl_default_ad_account") || ""; } catch { return ""; }
  });
  const [campaigns, setCampaigns] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [expandedCampaign, setExpandedCampaign] = useState(null);
  const [showWizard, setShowWizard] = useState(false);
  const [error, setError] = useState(null);

  // ─── Duplikace ────────────────────────────────────────────────────────────
  const [duplicateTarget, setDuplicateTarget] = useState(null); // { level, id, name, adAccountId }

  // Složky
  const [folders, setFolders] = useState([]); // [{ id, name, campaignIds }]
  const [activeFolder, setActiveFolder] = useState(null); // null = "Všechny"
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [editingFolder, setEditingFolder] = useState(null);
  const [movingCampaign, setMovingCampaign] = useState(null); // campaign ID being moved
  const [isDefault, setIsDefault] = useState(() => {
    try {
      const saved = localStorage.getItem("sellfunl_default_ad_account") || "";
      return saved !== "";
    } catch { return false; }
  });

  // Nastav uložený nebo první ad account
  useEffect(() => {
    const accounts = fbAccount?.adAccounts || [];
    if (accounts.length === 0) return;

    // Přečti uloženou hodnotu přímo z localStorage (ne ze state, ten může být prázdný)
    let saved = "";
    try { saved = localStorage.getItem("sellfunl_default_ad_account") || ""; } catch {}

    const exists = saved && accounts.some(a => a.id === saved);
    if (exists) {
      // Uložený účet stále existuje → nastav ho
      setAdAccountId(saved);
    } else {
      // Neexistuje → nastav první a ulož
      selectAdAccount(accounts[0].id);
    }
  }, [fbAccount?.adAccounts]);

  function selectAdAccount(id) {
    setAdAccountId(id);
    // Pokud je aktuálně zaškrtnutý výchozí, ulož nový výběr taky
    if (isDefault) {
      try { localStorage.setItem("sellfunl_default_ad_account", id); } catch {}
    }
  }

  function toggleDefault() {
    if (isDefault) {
      // Odznačit výchozí
      try { localStorage.removeItem("sellfunl_default_ad_account"); } catch {}
      setIsDefault(false);
    } else {
      // Zaškrtnout jako výchozí
      try { localStorage.setItem("sellfunl_default_ad_account", adAccountId); } catch {}
      setIsDefault(true);
    }
  }

  // ─── Složky: CRUD ───────────────────────────────────────────────────────
  const uid = getAuth().currentUser?.uid;

  const loadFolders = useCallback(async () => {
    if (!uid || !adAccountId) return;
    try {
      const q = query(
        collection(db, "campaignFolders"),
        where("uid", "==", uid),
        where("adAccountId", "==", adAccountId)
      );
      const snap = await getDocs(q);
      setFolders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Load folders error:", err);
    }
  }, [uid, adAccountId]);

  useEffect(() => { loadFolders(); }, [loadFolders]);

  async function createFolder() {
    if (!newFolderName.trim() || !uid) return;
    const id = `${uid}_${adAccountId}_${Date.now()}`;
    await setDoc(doc(db, "campaignFolders", id), {
      uid,
      adAccountId,
      name: newFolderName.trim(),
      campaignIds: [],
      createdAt: new Date().toISOString(),
    });
    setNewFolderName("");
    setShowNewFolder(false);
    loadFolders();
  }

  async function renameFolder(folderId, newName) {
    if (!newName.trim()) return;
    await updateDoc(doc(db, "campaignFolders", folderId), { name: newName.trim() });
    setEditingFolder(null);
    loadFolders();
  }

  async function removeFolder(folderId) {
    if (!window.confirm("Smazat složku? Kampaně zůstanou, jen se přesunou do 'Všechny'.")) return;
    await deleteDoc(doc(db, "campaignFolders", folderId));
    if (activeFolder === folderId) setActiveFolder(null);
    loadFolders();
  }

  async function moveCampaignToFolder(campaignId, folderId) {
    // Odeber ze všech složek
    for (const f of folders) {
      if (f.campaignIds?.includes(campaignId)) {
        await updateDoc(doc(db, "campaignFolders", f.id), {
          campaignIds: f.campaignIds.filter(id => id !== campaignId),
        });
      }
    }
    // Přidej do cílové složky (pokud není null = "Všechny")
    if (folderId) {
      const folder = folders.find(f => f.id === folderId);
      if (folder) {
        await updateDoc(doc(db, "campaignFolders", folderId), {
          campaignIds: [...(folder.campaignIds || []), campaignId],
        });
      }
    }
    setMovingCampaign(null);
    loadFolders();
  }

  // Filtrované kampaně podle aktivní složky
  const filteredCampaigns = activeFolder
    ? campaigns.filter(c => {
        const folder = folders.find(f => f.id === activeFolder);
        return folder?.campaignIds?.includes(c.id);
      })
    : campaigns;

  // Kampaně bez složky
  const unfoldered = campaigns.filter(c => !folders.some(f => f.campaignIds?.includes(c.id)));

  const loadCampaigns = useCallback(async () => {
    if (!adAccountId) return;
    setLoadingCampaigns(true);
    setError(null);
    try {
      const { data } = await call("fbListCampaigns")({ adAccountId });
      setCampaigns(data.campaigns || []);
    } catch (err) {
      console.error("Load campaigns error:", err);
      setError(err.message || "Nepodařilo se načíst kampaně.");
    } finally {
      setLoadingCampaigns(false);
    }
  }, [adAccountId]);

  useEffect(() => { if (adAccountId) loadCampaigns(); }, [adAccountId, loadCampaigns]);

  async function updateStatus(objectId, newStatus) {
    try {
      await call("fbUpdateStatus")({ objectId, status: newStatus });
      loadCampaigns();
    } catch (err) {
      alert(`Chyba: ${err.message}`);
    }
  }

  async function deleteObject(objectId) {
    try {
      await call("fbDeleteObject")({ objectId });
      loadCampaigns();
    } catch (err) {
      alert(`Chyba při mazání: ${err.message}`);
    }
  }

  const adAccounts = fbAccount?.adAccounts || [];

  return (
    <div>
      {/* Výběr reklamního účtu */}
      <div style={{ marginBottom: "20px" }}>
        <label style={labelStyle}>Reklamní účet</label>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <select value={adAccountId} onChange={e => selectAdAccount(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
            {adAccounts.map(a => (
              <option key={a.id} value={a.id}>{a.name} ({a.id})</option>
            ))}
          </select>
        </div>
        <label
          onClick={toggleDefault}
          style={{
            display: "inline-flex", alignItems: "center", gap: "8px",
            marginTop: "8px", cursor: "pointer", fontSize: ".85rem",
            color: isDefault ? "#7c3aed" : "var(--text-muted)",
            userSelect: "none",
          }}
        >
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: "20px", height: "20px", borderRadius: "4px",
            border: isDefault ? "2px solid #7c3aed" : "2px solid #d1d5db",
            background: isDefault ? "#7c3aed" : "transparent",
            transition: "all .15s ease",
          }}>
            {isDefault && <span style={{ color: "#fff", fontSize: "14px", lineHeight: 1 }}>✓</span>}
          </span>
          {isDefault ? "Výchozí účet nastaven" : "Nastavit jako výchozí účet"}
        </label>
      </div>

      {/* Akční lišta */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text)", margin: 0 }}>
            Kampaně
          </h3>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={loadCampaigns} disabled={loadingCampaigns} style={btnSecondary}>
            🔄 Obnovit
          </button>
          <button onClick={() => setShowWizard(true)} style={btnPrimary}>
            ＋ Nová kampaň
          </button>
        </div>
      </div>

      {/* ═══ SLOŽKY ═══ */}
      <div style={{ marginBottom: "16px" }}>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
          {/* Tab: Všechny */}
          <button onClick={() => setActiveFolder(null)} style={{
            padding: "6px 14px", borderRadius: "20px", fontSize: ".8rem", fontWeight: 500,
            border: activeFolder === null ? "2px solid #7c3aed" : "1px solid var(--border)",
            background: activeFolder === null ? "#f5f3ff" : "var(--bg-card)",
            color: activeFolder === null ? "#7c3aed" : "var(--text)",
            cursor: "pointer",
          }}>
            📁 Všechny ({campaigns.length})
          </button>

          {/* Tab: Bez složky */}
          {folders.length > 0 && (
            <button onClick={() => setActiveFolder("__unfoldered__")} style={{
              padding: "6px 14px", borderRadius: "20px", fontSize: ".8rem", fontWeight: 500,
              border: activeFolder === "__unfoldered__" ? "2px solid #7c3aed" : "1px solid var(--border)",
              background: activeFolder === "__unfoldered__" ? "#f5f3ff" : "var(--bg-card)",
              color: activeFolder === "__unfoldered__" ? "#7c3aed" : "var(--text-muted)",
              cursor: "pointer",
            }}>
              Nezařazené ({unfoldered.length})
            </button>
          )}

          {/* Složky */}
          {folders.map(f => {
            const count = campaigns.filter(c => f.campaignIds?.includes(c.id)).length;
            const active = activeFolder === f.id;
            return (
              <div key={f.id} style={{ display: "inline-flex", alignItems: "center", gap: "0", position: "relative" }}>
                {editingFolder === f.id ? (
                  <input
                    autoFocus
                    defaultValue={f.name}
                    onBlur={e => renameFolder(f.id, e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") renameFolder(f.id, e.target.value); if (e.key === "Escape") setEditingFolder(null); }}
                    style={{ ...inputStyle, padding: "4px 10px", fontSize: ".8rem", width: "120px", borderRadius: "20px" }}
                  />
                ) : (
                  <button onClick={() => setActiveFolder(f.id)} style={{
                    padding: "6px 14px", borderRadius: "20px 0 0 20px", fontSize: ".8rem", fontWeight: 500,
                    border: active ? "2px solid #7c3aed" : "1px solid var(--border)",
                    borderRight: "none",
                    background: active ? "#f5f3ff" : "var(--bg-card)",
                    color: active ? "#7c3aed" : "var(--text)",
                    cursor: "pointer",
                  }}>
                    📂 {f.name} ({count})
                  </button>
                )}
                {editingFolder !== f.id && (
                  <div style={{ display: "inline-flex" }}>
                    <button onClick={() => setEditingFolder(f.id)} title="Přejmenovat" style={{
                      padding: "6px 6px", fontSize: ".7rem", cursor: "pointer",
                      border: active ? "2px solid #7c3aed" : "1px solid var(--border)",
                      borderLeft: "none", borderRight: "none",
                      background: active ? "#f5f3ff" : "var(--bg-card)",
                      color: "var(--text-muted)",
                    }}>✏️</button>
                    <button onClick={() => removeFolder(f.id)} title="Smazat složku" style={{
                      padding: "6px 8px", borderRadius: "0 20px 20px 0", fontSize: ".7rem", cursor: "pointer",
                      border: active ? "2px solid #7c3aed" : "1px solid var(--border)",
                      borderLeft: "none",
                      background: active ? "#f5f3ff" : "var(--bg-card)",
                      color: "#ef4444",
                    }}>✕</button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Nová složka */}
          {showNewFolder ? (
            <div style={{ display: "inline-flex", gap: "4px", alignItems: "center" }}>
              <input
                autoFocus
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") createFolder(); if (e.key === "Escape") setShowNewFolder(false); }}
                placeholder="Název složky"
                style={{ ...inputStyle, padding: "4px 10px", fontSize: ".8rem", width: "130px", borderRadius: "20px" }}
              />
              <button onClick={createFolder} style={{
                padding: "4px 10px", borderRadius: "20px", fontSize: ".78rem",
                border: "1px solid #16a34a", background: "#dcfce7", color: "#16a34a",
                cursor: "pointer", fontWeight: 600,
              }}>✓</button>
              <button onClick={() => { setShowNewFolder(false); setNewFolderName(""); }} style={{
                padding: "4px 8px", borderRadius: "20px", fontSize: ".78rem",
                border: "1px solid var(--border)", background: "var(--bg-card)", color: "var(--text-muted)",
                cursor: "pointer",
              }}>✕</button>
            </div>
          ) : (
            <button onClick={() => setShowNewFolder(true)} style={{
              padding: "6px 12px", borderRadius: "20px", fontSize: ".78rem",
              border: "1px dashed var(--border)", background: "transparent",
              color: "var(--text-muted)", cursor: "pointer",
            }}>
              + Složka
            </button>
          )}
        </div>
      </div>

      {/* Move to folder modal */}
      {movingCampaign && (
        <div style={{
          padding: "12px 16px", borderRadius: "8px", marginBottom: "12px",
          background: "#f5f3ff", border: "1px solid #c4b5fd", fontSize: ".85rem",
        }}>
          <span style={{ fontWeight: 600, color: "#7c3aed" }}>Přesunout kampaň do složky:</span>
          <div style={{ display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap" }}>
            <button onClick={() => moveCampaignToFolder(movingCampaign, null)} style={{
              ...btnSmall, color: "var(--text)", borderColor: "var(--border)",
            }}>Nezařazené</button>
            {folders.map(f => (
              <button key={f.id} onClick={() => moveCampaignToFolder(movingCampaign, f.id)} style={{
                ...btnSmall, color: "#7c3aed", borderColor: "#7c3aed",
              }}>📂 {f.name}</button>
            ))}
            <button onClick={() => setMovingCampaign(null)} style={{
              ...btnSmall, color: "#ef4444", borderColor: "#ef4444", marginLeft: "auto",
            }}>✕ Zrušit</button>
          </div>
        </div>
      )}

      {error && (
        <div style={{
          padding: "12px 16px", borderRadius: "8px", marginBottom: "16px",
          background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: ".85rem",
        }}>
          {error}
        </div>
      )}

      {/* Wizard */}
      {showWizard && (
        <CampaignWizard
          adAccountId={adAccountId}
          onClose={() => setShowWizard(false)}
          onCreated={() => { setShowWizard(false); loadCampaigns(); }}
        />
      )}

      {/* Duplikace modal */}
      {duplicateTarget && (
        <DuplicateModal
          target={duplicateTarget}
          onClose={() => setDuplicateTarget(null)}
          onDone={() => { setDuplicateTarget(null); loadCampaigns(); }}
        />
      )}

      {/* Seznam kampaní */}
      {loadingCampaigns ? (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
          ⏳ Načítám kampaně...
        </div>
      ) : campaigns.length === 0 ? (
        <EmptyState onNew={() => setShowWizard(true)} />
      ) : (() => {
        const displayed = activeFolder === "__unfoldered__"
          ? unfoldered
          : activeFolder
          ? campaigns.filter(c => folders.find(f => f.id === activeFolder)?.campaignIds?.includes(c.id))
          : campaigns;

        return displayed.length === 0 ? (
          <div style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)", fontSize: ".88rem" }}>
            {activeFolder === "__unfoldered__" ? "Všechny kampaně jsou zařazeny ve složkách." : "V této složce nejsou žádné kampaně."}
          </div>
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {displayed.map(c => (
              <CampaignRow key={c.id} campaign={c}
                expanded={expandedCampaign === c.id}
                onToggle={() => setExpandedCampaign(expandedCampaign === c.id ? null : c.id)}
                onStatusChange={updateStatus}
                onDelete={deleteObject}
                onMove={folders.length > 0 ? () => setMovingCampaign(c.id) : null}
                onDuplicate={(level, id, name, campaignId) => setDuplicateTarget({ level, id, name, adAccountId, campaignId })}
              />
            ))}
          </div>
        );
      })()}
    </div>
  );
}

// ─── Prázdný stav ────────────────────────────────────────────────────────────
function EmptyState({ onNew }) {
  return (
    <div style={{
      padding: "60px 24px", borderRadius: "12px", textAlign: "center",
      background: "var(--bg-card)", border: "1px dashed var(--border)",
    }}>
      <div style={{ fontSize: "3rem", marginBottom: "16px" }}>📊</div>
      <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--text)", margin: "0 0 8px" }}>
        Zatím nemáš žádné kampaně
      </h3>
      <p style={{ fontSize: ".88rem", color: "var(--text-muted)", margin: "0 0 24px" }}>
        Vytvoř svou první Facebook reklamní kampaň přímo ze SellFunl.
      </p>
      <button onClick={onNew} style={btnPrimary}>
        ＋ Vytvořit první kampaň
      </button>
    </div>
  );
}

// ─── Řádek kampaně ───────────────────────────────────────────────────────────
function CampaignRow({ campaign, expanded, onToggle, onStatusChange, onDelete, onMove, onDuplicate }) {
  const st = STATUS_MAP[campaign.status] || STATUS_MAP.PAUSED;
  const obj = OBJECTIVES.find(o => o.value === campaign.objective);
  const budget = campaign.daily_budget
    ? `${(campaign.daily_budget / 100).toFixed(0)} Kč/den`
    : campaign.lifetime_budget
    ? `${(campaign.lifetime_budget / 100).toFixed(0)} Kč celkem`
    : "—";

  return (
    <div style={{
      borderRadius: "12px", overflow: "hidden",
      background: "var(--bg-card)", border: "1px solid var(--border)",
    }}>
      {/* Header */}
      <div onClick={onToggle} style={{
        display: "flex", alignItems: "center", gap: "12px",
        padding: "16px 20px", cursor: "pointer",
        transition: "background .15s",
      }}
        onMouseEnter={e => e.currentTarget.style.background = "var(--bg)"}
        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
      >
        <span style={{ fontSize: "1.2rem" }}>{obj?.icon || "📊"}</span>
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 600, fontSize: ".92rem", color: "var(--text)", margin: "0 0 2px" }}>
            {campaign.name}
          </p>
          <p style={{ fontSize: ".78rem", color: "var(--text-muted)", margin: 0 }}>
            {obj?.label || campaign.objective} • {budget}
          </p>
        </div>
        <span style={{
          padding: "4px 10px", borderRadius: "20px", fontSize: ".75rem", fontWeight: 600,
          background: st.bg, color: st.color,
        }}>
          {st.label}
        </span>
        <span style={{ fontSize: ".8rem", color: "var(--text-muted)", transition: "transform .2s", transform: expanded ? "rotate(180deg)" : "none" }}>
          ▼
        </span>
      </div>

      {/* Detail */}
      {expanded && (
        <CampaignDetail campaign={campaign} onStatusChange={onStatusChange} onDelete={onDelete} onMove={onMove} onDuplicate={onDuplicate} />
      )}
    </div>
  );
}

// ─── Detail kampaně (ad sety, reklamy) ───────────────────────────────────────
function CampaignDetail({ campaign, onStatusChange, onDelete, onMove, onDuplicate }) {
  const [adSets, setAdSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedAdSet, setExpandedAdSet] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await call("fbListAdSets")({ campaignId: campaign.id });
        setAdSets(data.adSets || []);
      } catch (err) {
        console.error("Load ad sets error:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [campaign.id]);

  const isActive = campaign.status === "ACTIVE";
  const isPaused = campaign.status === "PAUSED";

  return (
    <div style={{ padding: "0 20px 16px", borderTop: "1px solid var(--border)" }}>
      {/* Akce kampaně */}
      <div style={{ display: "flex", gap: "8px", padding: "12px 0", flexWrap: "wrap" }}>
        {isPaused && (
          <button onClick={() => onStatusChange(campaign.id, "ACTIVE")} style={{ ...btnSmall, color: "#16a34a", borderColor: "#16a34a" }}>
            ▶ Aktivovat
          </button>
        )}
        {isActive && (
          <button onClick={() => onStatusChange(campaign.id, "PAUSED")} style={{ ...btnSmall, color: "#d97706", borderColor: "#d97706" }}>
            ⏸ Pozastavit
          </button>
        )}
        <button onClick={() => {
          if (window.confirm("Archivovat kampaň? Tuto akci nelze vrátit.")) {
            onStatusChange(campaign.id, "ARCHIVED");
          }
        }} style={{ ...btnSmall, color: "#6b7280", borderColor: "#6b7280" }}>
          📦 Archivovat
        </button>
        {onMove && (
          <button onClick={onMove} style={{ ...btnSmall, color: "#7c3aed", borderColor: "#7c3aed" }}>
            📂 Do složky
          </button>
        )}
        <button onClick={() => onDuplicate("campaign", campaign.id, campaign.name)} style={{ ...btnSmall, color: "#0ea5e9", borderColor: "#0ea5e9" }}>
          📋 Kopírovat kampaň
        </button>
        <button onClick={() => {
          if (window.confirm(`Opravdu smazat kampaň "${campaign.name}"? Smaže se i vše pod ní (ad sety, reklamy). Tuto akci nelze vrátit!`)) {
            onDelete(campaign.id);
          }
        }} style={{ ...btnSmall, color: "#ef4444", borderColor: "#ef4444", marginLeft: "auto" }}>
          🗑 Smazat
        </button>
      </div>

      {/* Ad sety */}
      <p style={{ fontSize: ".82rem", fontWeight: 600, color: "var(--text)", margin: "8px 0 8px" }}>
        Ad sety ({adSets.length})
      </p>

      {loading ? (
        <p style={{ fontSize: ".82rem", color: "var(--text-muted)" }}>Načítám...</p>
      ) : adSets.length === 0 ? (
        <p style={{ fontSize: ".82rem", color: "var(--text-muted)", fontStyle: "italic" }}>
          Žádné ad sety — přidej je v průvodci tvorbou kampaně.
        </p>
      ) : (
        <div style={{ display: "grid", gap: "8px" }}>
          {adSets.map(as => (
            <AdSetRow key={as.id} adSet={as}
              expanded={expandedAdSet === as.id}
              onToggle={() => setExpandedAdSet(expandedAdSet === as.id ? null : as.id)}
              onStatusChange={onStatusChange}
              onDelete={onDelete}
              onDuplicate={(level, id, name) => onDuplicate(level, id, name, campaign.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Ad Set řádek ────────────────────────────────────────────────────────────
function AdSetRow({ adSet, expanded, onToggle, onStatusChange, onDelete, onDuplicate }) {
  const st = STATUS_MAP[adSet.status] || STATUS_MAP.PAUSED;
  const budget = adSet.daily_budget
    ? `${(adSet.daily_budget / 100).toFixed(0)} Kč/den`
    : adSet.lifetime_budget
    ? `${(adSet.lifetime_budget / 100).toFixed(0)} Kč celkem`
    : "CBO";

  return (
    <div style={{
      borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)",
    }}>
      <div onClick={onToggle} style={{
        display: "flex", alignItems: "center", gap: "10px",
        padding: "10px 14px", cursor: "pointer", fontSize: ".85rem",
      }}>
        <span style={{ flex: 1, fontWeight: 500, color: "var(--text)" }}>{adSet.name}</span>
        <span style={{ fontSize: ".78rem", color: "var(--text-muted)" }}>{budget}</span>
        <span style={{
          padding: "2px 8px", borderRadius: "12px", fontSize: ".7rem", fontWeight: 600,
          background: st.bg, color: st.color,
        }}>{st.label}</span>
        <span style={{ fontSize: ".7rem", color: "var(--text-muted)" }}>{expanded ? "▲" : "▼"}</span>
      </div>

      {expanded && <AdSetDetail adSet={adSet} onStatusChange={onStatusChange} onDelete={onDelete} onDuplicate={onDuplicate} />}
    </div>
  );
}

// ─── Ad Set detail (reklamy) ─────────────────────────────────────────────────
function AdSetDetail({ adSet, onStatusChange, onDelete, onDuplicate }) {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await call("fbListAds")({ adSetId: adSet.id });
        setAds(data.ads || []);
      } catch (err) {
        console.error("Load ads error:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [adSet.id]);

  // Targeting info
  const tgt = adSet.targeting || {};
  const ageRange = tgt.age_min && tgt.age_max ? `${tgt.age_min}–${tgt.age_max} let` : "";
  const countries = tgt.geo_locations?.countries?.join(", ") || "";
  const optGoal = OPTIMIZATION_GOALS.find(g => g.value === adSet.optimization_goal);

  return (
    <div style={{ padding: "8px 14px 14px", borderTop: "1px solid var(--border)" }}>
      {/* Targeting info */}
      {(ageRange || countries || optGoal) && (
        <div style={{
          padding: "8px 12px", borderRadius: "6px", background: "#f8fafc",
          marginBottom: "10px", fontSize: ".78rem", color: "var(--text-muted)",
          display: "flex", gap: "16px", flexWrap: "wrap",
        }}>
          {countries && <span>🌍 {countries}</span>}
          {ageRange && <span>👤 {ageRange}</span>}
          {optGoal && <span>🎯 {optGoal.label}</span>}
        </div>
      )}

      <div style={{ display: "flex", gap: "6px", marginBottom: "10px", flexWrap: "wrap" }}>
        {adSet.status === "PAUSED" && (
          <button onClick={() => onStatusChange(adSet.id, "ACTIVE")} style={{ ...btnSmall, fontSize: ".75rem", color: "#16a34a", borderColor: "#16a34a" }}>
            ▶ Aktivovat
          </button>
        )}
        {adSet.status === "ACTIVE" && (
          <button onClick={() => onStatusChange(adSet.id, "PAUSED")} style={{ ...btnSmall, fontSize: ".75rem", color: "#d97706", borderColor: "#d97706" }}>
            ⏸ Pozastavit
          </button>
        )}
        <button onClick={() => onDuplicate("adset", adSet.id, adSet.name)} style={{ ...btnSmall, fontSize: ".75rem", color: "#0ea5e9", borderColor: "#0ea5e9" }}>
          📋 Kopírovat set
        </button>
        <button onClick={() => {
          if (window.confirm(`Smazat ad set "${adSet.name}"?`)) onDelete(adSet.id);
        }} style={{ ...btnSmall, fontSize: ".75rem", color: "#ef4444", borderColor: "#ef4444", marginLeft: "auto" }}>
          🗑 Smazat
        </button>
      </div>

      <p style={{ fontSize: ".78rem", fontWeight: 600, color: "var(--text)", margin: "0 0 6px" }}>
        Reklamy ({ads.length})
      </p>

      {loading ? (
        <p style={{ fontSize: ".78rem", color: "var(--text-muted)" }}>Načítám...</p>
      ) : ads.length === 0 ? (
        <p style={{ fontSize: ".78rem", color: "var(--text-muted)", fontStyle: "italic" }}>Žádné reklamy.</p>
      ) : (
        ads.map(ad => <AdRow key={ad.id} ad={ad} onStatusChange={onStatusChange} onDelete={onDelete} onDuplicate={onDuplicate} />)
      )}
    </div>
  );
}

// ─── Řádek reklamy s náhledem ────────────────────────────────────────────────
function AdRow({ ad, onStatusChange, onDelete, onDuplicate }) {
  const ast = STATUS_MAP[ad.status] || STATUS_MAP.PAUSED;
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewFormat, setPreviewFormat] = useState("DESKTOP_FEED_STANDARD");

  const creative = ad.creative || {};
  const storySpec = creative.object_story_spec?.link_data || {};
  const assetSpec = creative.asset_feed_spec || null;

  // Texts from creative
  const primaryText = storySpec.message || (assetSpec?.bodies?.[0]?.text) || "";
  const headlineText = storySpec.name || (assetSpec?.titles?.[0]?.text) || creative.title || "";
  const descText = storySpec.description || (assetSpec?.descriptions?.[0]?.text) || "";
  const imageUrl = creative.image_url || creative.thumbnail_url || storySpec.picture || "";

  async function loadPreview(format) {
    setLoadingPreview(true);
    setPreviewFormat(format);
    try {
      const { data } = await call("fbGetAdPreview")({ adId: ad.id, format });
      if (data.previews?.length > 0) {
        setPreviewHtml(data.previews[0].body);
      } else {
        setPreviewHtml("<p style='padding:20px;color:#888;'>Náhled není k dispozici.</p>");
      }
    } catch (err) {
      setPreviewHtml(`<p style='padding:20px;color:#ef4444;'>Chyba: ${err.message}</p>`);
    } finally {
      setLoadingPreview(false);
    }
  }

  const PREVIEW_FORMATS = [
    { value: "DESKTOP_FEED_STANDARD", label: "Feed (desktop)" },
    { value: "MOBILE_FEED_STANDARD", label: "Feed (mobil)" },
    { value: "INSTAGRAM_STANDARD", label: "Instagram" },
    { value: "INSTAGRAM_STORY", label: "Story" },
  ];

  return (
    <div style={{
      borderRadius: "8px", background: "var(--bg-card)", border: "1px solid var(--border)",
      marginBottom: "8px", overflow: "hidden",
    }}>
      {/* Ad header */}
      <div style={{
        display: "flex", alignItems: "center", gap: "10px",
        padding: "10px 12px", fontSize: ".82rem",
      }}>
        {imageUrl && (
          <img src={imageUrl} alt="" style={{
            width: "48px", height: "48px", borderRadius: "6px", objectFit: "cover",
            border: "1px solid var(--border)",
          }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 600, color: "var(--text)", margin: "0 0 2px", fontSize: ".85rem" }}>{ad.name}</p>
          {headlineText && (
            <p style={{ fontSize: ".75rem", color: "var(--text-muted)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {headlineText}
            </p>
          )}
        </div>
        <span style={{
          padding: "2px 8px", borderRadius: "10px", fontSize: ".68rem", fontWeight: 600,
          background: ast.bg, color: ast.color,
        }}>{ast.label}</span>

        {/* Akce */}
        {ad.status === "PAUSED" && (
          <button onClick={() => onStatusChange(ad.id, "ACTIVE")} style={{ ...btnSmall, fontSize: ".7rem", padding: "2px 6px", color: "#16a34a", borderColor: "#16a34a" }} title="Aktivovat">▶</button>
        )}
        {ad.status === "ACTIVE" && (
          <button onClick={() => onStatusChange(ad.id, "PAUSED")} style={{ ...btnSmall, fontSize: ".7rem", padding: "2px 6px", color: "#d97706", borderColor: "#d97706" }} title="Pozastavit">⏸</button>
        )}
        <button onClick={() => onDuplicate("ad", ad.id, ad.name)}
          style={{ ...btnSmall, fontSize: ".7rem", padding: "2px 6px", color: "#0ea5e9", borderColor: "#0ea5e9" }} title="Kopírovat">
          📋
        </button>
        <button onClick={() => {
          if (!showPreview) loadPreview(previewFormat);
          setShowPreview(!showPreview);
        }} style={{ ...btnSmall, fontSize: ".7rem", padding: "2px 6px", color: "#7c3aed", borderColor: "#7c3aed" }} title="Náhled">
          👁
        </button>
        <button onClick={() => {
          if (window.confirm(`Smazat reklamu "${ad.name}"?`)) onDelete(ad.id);
        }} style={{ ...btnSmall, fontSize: ".7rem", padding: "2px 6px", color: "#ef4444", borderColor: "#ef4444" }} title="Smazat">
          🗑
        </button>
      </div>

      {/* Rozbalený náhled */}
      {showPreview && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "12px" }}>
          {/* Vizualizace z dat kreativy */}
          <div style={{
            display: "grid", gridTemplateColumns: imageUrl ? "120px 1fr" : "1fr", gap: "12px",
            padding: "12px", borderRadius: "8px", background: "#f8fafc", marginBottom: "12px",
            border: "1px solid #e5e7eb",
          }}>
            {imageUrl && (
              <img src={imageUrl} alt="" style={{ width: "100%", borderRadius: "6px", objectFit: "cover" }} />
            )}
            <div>
              {primaryText && <p style={{ fontSize: ".82rem", color: "var(--text)", margin: "0 0 6px" }}>{primaryText}</p>}
              {headlineText && <p style={{ fontSize: ".9rem", fontWeight: 700, color: "var(--text)", margin: "0 0 4px" }}>{headlineText}</p>}
              {descText && <p style={{ fontSize: ".78rem", color: "var(--text-muted)", margin: 0 }}>{descText}</p>}
              {storySpec.link && (
                <p style={{ fontSize: ".72rem", color: "#7c3aed", margin: "6px 0 0" }}>{storySpec.link}</p>
              )}
            </div>
          </div>

          {/* FB Preview iframe */}
          <div style={{ marginBottom: "8px" }}>
            <div style={{ display: "flex", gap: "6px", marginBottom: "8px", flexWrap: "wrap" }}>
              {PREVIEW_FORMATS.map(f => (
                <button key={f.value} onClick={() => loadPreview(f.value)}
                  style={{
                    ...btnSmall, fontSize: ".72rem", padding: "3px 8px",
                    color: previewFormat === f.value ? "#fff" : "#7c3aed",
                    background: previewFormat === f.value ? "#7c3aed" : "transparent",
                    borderColor: "#7c3aed",
                  }}>
                  {f.label}
                </button>
              ))}
            </div>
            {loadingPreview ? (
              <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: ".82rem" }}>
                ⏳ Načítám náhled z Facebooku...
              </div>
            ) : previewHtml ? (
              <div
                dangerouslySetInnerHTML={{ __html: previewHtml }}
                style={{ borderRadius: "8px", overflow: "hidden", border: "1px solid #e5e7eb" }}
              />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Wizard: nová kampaň ─────────────────────────────────────────────────────
function CampaignWizard({ adAccountId, onClose, onCreated }) {
  const [step, setStep] = useState(1); // 1=kampaň, 2=ad set, 3=reklama, 4=hotovo
  const [saving, setSaving] = useState(false);
  const [createdIds, setCreatedIds] = useState({}); // { campaignId, adSetId }
  const [pages, setPages] = useState([]);

  // Krok 1: Kampaň
  const [campForm, setCampForm] = useState({ name: "", objective: "OUTCOME_TRAFFIC", dailyBudget: "" });

  // Krok 2: Ad Set
  const [adSetForm, setAdSetForm] = useState({
    name: "", dailyBudget: "", optimizationGoal: "LINK_CLICKS",
    ageMin: "18", ageMax: "65", genders: "all",
    countries: "CZ", interests: "",
    // Geo targeting rozšířené
    geoMode: "countries", // "countries" | "cities" | "radius"
    cities: "",           // "Praha, Brno"
    radiusLat: "",
    radiusLng: "",
    radiusKm: "25",
    radiusName: "",       // popisek místa
    // Placements
    placementMode: "automatic", // "automatic" | "manual"
    placements: {
      facebook_feed: true,
      facebook_stories: true,
      facebook_reels: true,
      facebook_right_column: true,
      instagram_feed: true,
      instagram_stories: true,
      instagram_reels: true,
      instagram_explore: true,
      audience_network: false,
      messenger: false,
    },
  });

  // Krok 3: Reklama
  const [adForm, setAdForm] = useState({
    name: "", pageId: "", linkUrl: "", cta: "LEARN_MORE",
    messages: [""],        // max 3
    headlines: [""],       // max 5
    descriptions: [""],    // max 3
    adMode: "url",         // "url" | "form"
    leadFormId: "",
  });
  const [leadForms, setLeadForms] = useState([]);
  const [loadingForms, setLoadingForms] = useState(false);
  const [mediaSlots, setMediaSlots] = useState([
    { label: "Čtverec (1:1)", ratio: "1:1", file: null, preview: null, hash: null, uploading: false },
    { label: "Story (9:16)", ratio: "9:16", file: null, preview: null, hash: null, uploading: false },
    { label: "Landscape (1.91:1)", ratio: "1.91:1", file: null, preview: null, hash: null, uploading: false },
  ]);

  // Načti FB stránky
  useEffect(() => {
    async function load() {
      try {
        const { data } = await call("fbListPages")({});
        setPages(data.pages || []);
        if (data.pages?.length > 0) {
          setAdForm(f => ({ ...f, pageId: data.pages[0].id }));
        }
      } catch (err) {
        console.error("Load pages error:", err);
      }
    }
    load();
  }, []);

  // Načti lead gen formuláře pro vybranou stránku
  async function loadLeadForms(pageId) {
    if (!pageId) return;
    setLoadingForms(true);
    try {
      const { data } = await call("fbListLeadForms")({ pageId });
      const loadedForms = data.forms || [];
      setLeadForms(loadedForms);

      // Předvyplň výchozí formulář pokud existuje
      const user = getAuth().currentUser;
      if (user && loadedForms.length > 0) {
        try {
          const defRef = doc(db, "fbDefaultLeadForms", `${user.uid}_${pageId}`);
          const defSnap = await getDoc(defRef);
          if (defSnap.exists()) {
            const defFormId = defSnap.data().formId;
            // Ověř, že formulář stále existuje v seznamu
            if (loadedForms.some(f => f.id === defFormId)) {
              setAdForm(f => ({ ...f, leadFormId: defFormId }));
            }
          }
        } catch (err) {
          console.error("Load default lead form error:", err);
        }
      }
    } catch (err) {
      console.error("Load lead forms error:", err);
      setLeadForms([]);
    } finally {
      setLoadingForms(false);
    }
  }

  async function createCampaign() {
    if (!campForm.name || !campForm.objective) return alert("Vyplň název a cíl kampaně.");
    if (!campForm.dailyBudget || Number(campForm.dailyBudget) < 1) return alert("Vyplň denní rozpočet (min. 1 Kč).");
    setSaving(true);
    try {
      const { data } = await call("fbCreateCampaign")({
        adAccountId,
        name: campForm.name,
        objective: campForm.objective,
        dailyBudget: Number(campForm.dailyBudget),
      });
      setCreatedIds(ids => ({ ...ids, campaignId: data.campaignId }));
      setAdSetForm(f => ({ ...f, name: `${campForm.name} - Ad Set` }));
      setStep(2);
    } catch (err) {
      alert(`Chyba: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function createAdSet() {
    if (!adSetForm.name) return alert("Vyplň název ad setu.");
    setSaving(true);
    try {
      // Sestav targeting objekt
      const targeting = {
        age_min: Number(adSetForm.ageMin) || 18,
        age_max: Number(adSetForm.ageMax) || 65,
        geo_locations: {},
      };

      // Geo targeting podle režimu
      if (adSetForm.geoMode === "countries") {
        targeting.geo_locations.countries = adSetForm.countries.split(",").map(c => c.trim().toUpperCase()).filter(Boolean);
      } else if (adSetForm.geoMode === "cities") {
        // FB API: cities vyžaduje pole objektů s "key" (city ID). Pro zjednodušení použijeme city name search přes API.
        // Ale FB API umožňuje i search by name, takže pošleme to backendu
        targeting.geo_locations.cities = adSetForm.cities.split(",").map(c => c.trim()).filter(Boolean).map(name => ({ name }));
        // Potřebujeme alespoň zemi pro kontext
        if (adSetForm.countries.trim()) {
          targeting.geo_locations.countries = adSetForm.countries.split(",").map(c => c.trim().toUpperCase()).filter(Boolean);
        }
      } else if (adSetForm.geoMode === "radius") {
        const lat = parseFloat(adSetForm.radiusLat);
        const lng = parseFloat(adSetForm.radiusLng);
        const km = parseInt(adSetForm.radiusKm) || 25;
        if (isNaN(lat) || isNaN(lng)) return alert("Zadej platné souřadnice (lat, lng).");
        targeting.geo_locations.custom_locations = [{
          latitude: lat,
          longitude: lng,
          radius: km,
          distance_unit: "kilometer",
        }];
      }

      if (adSetForm.genders !== "all") {
        targeting.genders = [Number(adSetForm.genders)];
      }

      // Placements
      let publisherPlatforms, facebookPositions, instagramPositions;
      if (adSetForm.placementMode === "manual") {
        const p = adSetForm.placements;
        publisherPlatforms = [];
        facebookPositions = [];
        instagramPositions = [];

        if (p.facebook_feed || p.facebook_stories || p.facebook_reels || p.facebook_right_column) {
          publisherPlatforms.push("facebook");
          if (p.facebook_feed) facebookPositions.push("feed");
          if (p.facebook_stories) facebookPositions.push("story");
          if (p.facebook_reels) facebookPositions.push("facebook_reels");
          if (p.facebook_right_column) facebookPositions.push("right_hand_column");
        }
        if (p.instagram_feed || p.instagram_stories || p.instagram_reels || p.instagram_explore) {
          publisherPlatforms.push("instagram");
          if (p.instagram_feed) instagramPositions.push("stream");
          if (p.instagram_stories) instagramPositions.push("story");
          if (p.instagram_reels) instagramPositions.push("reels");
          if (p.instagram_explore) instagramPositions.push("explore");
        }
        if (p.audience_network) publisherPlatforms.push("audience_network");
        if (p.messenger) publisherPlatforms.push("messenger");

        if (publisherPlatforms.length === 0) return alert("Vyber alespoň jeden placement.");
        targeting.publisher_platforms = publisherPlatforms;
        if (facebookPositions.length > 0) targeting.facebook_positions = facebookPositions;
        if (instagramPositions.length > 0) targeting.instagram_positions = instagramPositions;
      }

      const { data } = await call("fbCreateAdSet")({
        adAccountId,
        campaignId: createdIds.campaignId,
        name: adSetForm.name,
        optimizationGoal: adSetForm.optimizationGoal,
        targeting,
        isDynamicCreative: true,
      });
      setCreatedIds(ids => ({ ...ids, adSetId: data.adSetId }));
      setAdForm(f => ({ ...f, name: `${campForm.name} - Ad` }));
      setStep(3);
    } catch (err) {
      alert(`Chyba: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function uploadMedia(slotIndex) {
    const slot = mediaSlots[slotIndex];
    if (!slot.file) return;
    const updated = [...mediaSlots];
    updated[slotIndex] = { ...slot, uploading: true };
    setMediaSlots(updated);

    try {
      // Convert file to base64
      const reader = new FileReader();
      const base64 = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(slot.file);
      });

      const { data } = await call("fbUploadAdImage")({
        adAccountId,
        imageBase64: base64,
        filename: slot.file.name,
      });

      const final = [...mediaSlots];
      final[slotIndex] = { ...final[slotIndex], hash: data.hash, uploading: false };
      setMediaSlots(final);
    } catch (err) {
      alert(`Upload selhал: ${err.message}`);
      const final = [...mediaSlots];
      final[slotIndex] = { ...final[slotIndex], uploading: false };
      setMediaSlots(final);
    }
  }

  function handleMediaFile(slotIndex, file) {
    if (!file) return;
    const preview = URL.createObjectURL(file);
    const updated = [...mediaSlots];
    updated[slotIndex] = { ...updated[slotIndex], file, preview, hash: null };
    setMediaSlots(updated);
  }

  async function createAd() {
    if (!adForm.name || !adForm.pageId) return alert("Vyplň název a FB stránku.");
    if (adForm.adMode === "url" && !adForm.linkUrl) return alert("Vyplň odkaz (URL).");
    if (adForm.adMode === "form" && !adForm.leadFormId) return alert("Vyber lead gen formulář.");

    // Upload media that hasn't been uploaded yet
    const pendingUploads = mediaSlots
      .map((s, i) => (s.file && !s.hash ? i : null))
      .filter(i => i !== null);

    if (pendingUploads.length > 0) {
      setSaving(true);
      try {
        for (const idx of pendingUploads) {
          await uploadMedia(idx);
        }
      } catch (err) {
        setSaving(false);
        return;
      }
    }

    setSaving(true);
    try {
      const imageHashes = mediaSlots.filter(s => s.hash).map(s => s.hash);

      const adPayload = {
        adAccountId,
        adSetId: createdIds.adSetId,
        name: adForm.name,
        pageId: adForm.pageId,
        messages: adForm.messages.filter(Boolean),
        headlines: adForm.headlines.filter(Boolean),
        descriptions: adForm.descriptions.filter(Boolean),
        callToAction: adForm.cta,
        imageHashes,
      };
      if (adForm.adMode === "form" && adForm.leadFormId) {
        adPayload.leadFormId = adForm.leadFormId;
        adPayload.linkUrl = adForm.linkUrl || "";
      } else {
        adPayload.linkUrl = adForm.linkUrl;
      }
      await call("fbCreateAd")(adPayload);
      setStep(4);
    } catch (err) {
      alert(`Chyba: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      padding: "24px", borderRadius: "12px", marginBottom: "24px",
      background: "var(--bg-card)", border: "2px solid #7c3aed",
    }}>
      {/* Kroky */}
      <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "20px" }}>
        {["Kampaň", "Ad Set", "Reklama", "Hotovo"].map((label, i) => {
          const num = i + 1;
          const active = step === num;
          const done = step > num;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <div style={{
                width: "28px", height: "28px", borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: ".78rem", fontWeight: 700,
                background: done ? "#16a34a" : active ? "#7c3aed" : "var(--bg)",
                color: done || active ? "#fff" : "var(--text-muted)",
                border: active ? "none" : "1px solid var(--border)",
              }}>
                {done ? "✓" : num}
              </div>
              <span style={{
                fontSize: ".78rem", fontWeight: active ? 600 : 400,
                color: active ? "#7c3aed" : done ? "#16a34a" : "var(--text-muted)",
              }}>
                {label}
              </span>
              {i < 3 && <span style={{ color: "var(--border)", margin: "0 8px" }}>—</span>}
            </div>
          );
        })}
        <div style={{ flex: 1 }} />
        <button onClick={onClose} style={{
          border: "none", background: "transparent", color: "var(--text-muted)",
          cursor: "pointer", fontSize: "1.1rem",
        }}>✕</button>
      </div>

      {/* Krok 1: Kampaň */}
      {step === 1 && (
        <div style={{ display: "grid", gap: "16px" }}>
          <div>
            <label style={labelStyle}>Název kampaně *</label>
            <input type="text" value={campForm.name}
              onChange={e => setCampForm(f => ({ ...f, name: e.target.value }))}
              placeholder="např. Jarní promo SellFunl" style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Cíl kampaně *</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              {OBJECTIVES.map(o => (
                <button key={o.value}
                  onClick={() => setCampForm(f => ({ ...f, objective: o.value }))}
                  style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    padding: "12px 14px", borderRadius: "8px", textAlign: "left",
                    border: campForm.objective === o.value ? "2px solid #7c3aed" : "1px solid var(--border)",
                    background: campForm.objective === o.value ? "#f5f3ff" : "var(--bg)",
                    cursor: "pointer",
                  }}
                >
                  <span style={{ fontSize: "1.3rem" }}>{o.icon}</span>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: ".85rem", color: "var(--text)", margin: 0 }}>{o.label}</p>
                    <p style={{ fontSize: ".75rem", color: "var(--text-muted)", margin: 0 }}>{o.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={labelStyle}>Denní rozpočet (Kč) *</label>
            <input type="number" value={campForm.dailyBudget}
              onChange={e => setCampForm(f => ({ ...f, dailyBudget: e.target.value }))}
              placeholder="např. 500" style={inputStyle} min="1"
            />
            <p style={{ fontSize: ".75rem", color: "var(--text-muted)", marginTop: "4px" }}>
              Facebook automaticky rozdělí rozpočet mezi ad sety.
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={onClose} style={btnSecondary}>Zrušit</button>
            <button onClick={createCampaign} disabled={saving} style={btnPrimary}>
              {saving ? "⏳ Vytvářím..." : "Vytvořit kampaň →"}
            </button>
          </div>
        </div>
      )}

      {/* Krok 2: Ad Set */}
      {step === 2 && (
        <div style={{ display: "grid", gap: "16px" }}>
          <div>
            <label style={labelStyle}>Název ad setu *</label>
            <input type="text" value={adSetForm.name}
              onChange={e => setAdSetForm(f => ({ ...f, name: e.target.value }))}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Optimalizace</label>
            <select value={adSetForm.optimizationGoal}
              onChange={e => setAdSetForm(f => ({ ...f, optimizationGoal: e.target.value }))}
              style={inputStyle}
            >
              {OPTIMIZATION_GOALS.map(g => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          </div>

          {/* ═══ TARGETING ═══ */}
          <fieldset style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "16px" }}>
            <legend style={{ fontSize: ".82rem", fontWeight: 600, color: "var(--text)", padding: "0 6px" }}>
              👤 Cílové publikum
            </legend>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
              <div>
                <label style={labelStyle}>Věk od</label>
                <input type="number" value={adSetForm.ageMin}
                  onChange={e => setAdSetForm(f => ({ ...f, ageMin: e.target.value }))}
                  style={inputStyle} min="13" max="65"
                />
              </div>
              <div>
                <label style={labelStyle}>Věk do</label>
                <input type="number" value={adSetForm.ageMax}
                  onChange={e => setAdSetForm(f => ({ ...f, ageMax: e.target.value }))}
                  style={inputStyle} min="13" max="65"
                />
              </div>
              <div>
                <label style={labelStyle}>Pohlaví</label>
                <select value={adSetForm.genders}
                  onChange={e => setAdSetForm(f => ({ ...f, genders: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="all">Všechna</option>
                  <option value="1">Muži</option>
                  <option value="2">Ženy</option>
                </select>
              </div>
            </div>
          </fieldset>

          {/* ═══ GEO TARGETING ═══ */}
          <fieldset style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "16px" }}>
            <legend style={{ fontSize: ".82rem", fontWeight: 600, color: "var(--text)", padding: "0 6px" }}>
              🌍 Geografické cílení
            </legend>

            {/* Režim */}
            <div style={{ display: "flex", gap: "6px", marginBottom: "12px" }}>
              {[
                { value: "countries", label: "Podle zemí", icon: "🏳" },
                { value: "cities", label: "Podle měst", icon: "🏙" },
                { value: "radius", label: "Radius od bodu", icon: "📍" },
              ].map(mode => (
                <button key={mode.value}
                  onClick={() => setAdSetForm(f => ({ ...f, geoMode: mode.value }))}
                  style={{
                    padding: "8px 14px", borderRadius: "6px", fontSize: ".8rem",
                    border: adSetForm.geoMode === mode.value ? "2px solid #7c3aed" : "1px solid var(--border)",
                    background: adSetForm.geoMode === mode.value ? "#f5f3ff" : "var(--bg)",
                    color: adSetForm.geoMode === mode.value ? "#7c3aed" : "var(--text)",
                    cursor: "pointer", fontWeight: adSetForm.geoMode === mode.value ? 600 : 400,
                  }}
                >
                  {mode.icon} {mode.label}
                </button>
              ))}
            </div>

            {/* Podle zemí */}
            {adSetForm.geoMode === "countries" && (
              <div>
                <label style={labelStyle}>Země (ISO kódy oddělené čárkou)</label>
                <input type="text" value={adSetForm.countries}
                  onChange={e => setAdSetForm(f => ({ ...f, countries: e.target.value }))}
                  placeholder="CZ, SK, DE, AT" style={inputStyle}
                />
                <p style={{ fontSize: ".72rem", color: "var(--text-muted)", marginTop: "4px" }}>
                  Příklady: CZ (Česko), SK (Slovensko), DE (Německo), PT (Portugalsko), IT (Itálie), ES (Španělsko)
                </p>
              </div>
            )}

            {/* Podle měst */}
            {adSetForm.geoMode === "cities" && (
              <div style={{ display: "grid", gap: "10px" }}>
                <div>
                  <label style={labelStyle}>Města (oddělená čárkou)</label>
                  <input type="text" value={adSetForm.cities}
                    onChange={e => setAdSetForm(f => ({ ...f, cities: e.target.value }))}
                    placeholder="Praha, Brno, Ostrava" style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Země (volitelné, upřesní vyhledávání)</label>
                  <input type="text" value={adSetForm.countries}
                    onChange={e => setAdSetForm(f => ({ ...f, countries: e.target.value }))}
                    placeholder="CZ" style={inputStyle}
                  />
                </div>
              </div>
            )}

            {/* Radius od souřadnic */}
            {adSetForm.geoMode === "radius" && (
              <div style={{ display: "grid", gap: "10px" }}>
                <div>
                  <label style={labelStyle}>Název místa (volitelný popisek)</label>
                  <input type="text" value={adSetForm.radiusName}
                    onChange={e => setAdSetForm(f => ({ ...f, radiusName: e.target.value }))}
                    placeholder="např. Obchodní centrum Chodov" style={inputStyle}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={labelStyle}>Zeměpisná šířka (lat)</label>
                    <input type="text" value={adSetForm.radiusLat}
                      onChange={e => setAdSetForm(f => ({ ...f, radiusLat: e.target.value }))}
                      placeholder="50.0755" style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Zeměpisná délka (lng)</label>
                    <input type="text" value={adSetForm.radiusLng}
                      onChange={e => setAdSetForm(f => ({ ...f, radiusLng: e.target.value }))}
                      placeholder="14.4378" style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Radius (km)</label>
                    <input type="number" value={adSetForm.radiusKm}
                      onChange={e => setAdSetForm(f => ({ ...f, radiusKm: e.target.value }))}
                      placeholder="25" style={inputStyle} min="1" max="80"
                    />
                  </div>
                </div>
                <p style={{ fontSize: ".72rem", color: "var(--text-muted)" }}>
                  Souřadnice najdeš na Google Maps — klikni pravým tlačítkem → "Co je tady?"
                </p>
              </div>
            )}
          </fieldset>

          {/* ═══ PLACEMENTS ═══ */}
          <fieldset style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "16px" }}>
            <legend style={{ fontSize: ".82rem", fontWeight: 600, color: "var(--text)", padding: "0 6px" }}>
              📱 Umístění reklamy (placements)
            </legend>

            <div style={{ display: "flex", gap: "6px", marginBottom: "12px" }}>
              <button
                onClick={() => setAdSetForm(f => ({ ...f, placementMode: "automatic" }))}
                style={{
                  padding: "8px 14px", borderRadius: "6px", fontSize: ".8rem",
                  border: adSetForm.placementMode === "automatic" ? "2px solid #7c3aed" : "1px solid var(--border)",
                  background: adSetForm.placementMode === "automatic" ? "#f5f3ff" : "var(--bg)",
                  color: adSetForm.placementMode === "automatic" ? "#7c3aed" : "var(--text)",
                  cursor: "pointer", fontWeight: adSetForm.placementMode === "automatic" ? 600 : 400,
                }}
              >
                🤖 Automatické (doporučeno)
              </button>
              <button
                onClick={() => setAdSetForm(f => ({ ...f, placementMode: "manual" }))}
                style={{
                  padding: "8px 14px", borderRadius: "6px", fontSize: ".8rem",
                  border: adSetForm.placementMode === "manual" ? "2px solid #7c3aed" : "1px solid var(--border)",
                  background: adSetForm.placementMode === "manual" ? "#f5f3ff" : "var(--bg)",
                  color: adSetForm.placementMode === "manual" ? "#7c3aed" : "var(--text)",
                  cursor: "pointer", fontWeight: adSetForm.placementMode === "manual" ? 600 : 400,
                }}
              >
                ✋ Manuální
              </button>
            </div>

            {adSetForm.placementMode === "automatic" && (
              <p style={{ fontSize: ".78rem", color: "var(--text-muted)", margin: 0 }}>
                Facebook automaticky zobrazí reklamu tam, kde bude mít nejlepší výkon.
              </p>
            )}

            {adSetForm.placementMode === "manual" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                {/* Facebook */}
                <div>
                  <p style={{ fontSize: ".78rem", fontWeight: 600, color: "var(--text)", margin: "0 0 8px" }}>
                    📘 Facebook
                  </p>
                  {[
                    { key: "facebook_feed", label: "Feed" },
                    { key: "facebook_stories", label: "Stories" },
                    { key: "facebook_reels", label: "Reels" },
                    { key: "facebook_right_column", label: "Pravý sloupec" },
                  ].map(item => (
                    <label key={item.key} style={{
                      display: "flex", alignItems: "center", gap: "8px",
                      marginBottom: "6px", fontSize: ".8rem", cursor: "pointer",
                      color: "var(--text)",
                    }}>
                      <input type="checkbox"
                        checked={adSetForm.placements[item.key]}
                        onChange={e => setAdSetForm(f => ({
                          ...f,
                          placements: { ...f.placements, [item.key]: e.target.checked },
                        }))}
                        style={{ accentColor: "#7c3aed" }}
                      />
                      {item.label}
                    </label>
                  ))}
                </div>

                {/* Instagram */}
                <div>
                  <p style={{ fontSize: ".78rem", fontWeight: 600, color: "var(--text)", margin: "0 0 8px" }}>
                    📷 Instagram
                  </p>
                  {[
                    { key: "instagram_feed", label: "Feed" },
                    { key: "instagram_stories", label: "Stories" },
                    { key: "instagram_reels", label: "Reels" },
                    { key: "instagram_explore", label: "Explore" },
                  ].map(item => (
                    <label key={item.key} style={{
                      display: "flex", alignItems: "center", gap: "8px",
                      marginBottom: "6px", fontSize: ".8rem", cursor: "pointer",
                      color: "var(--text)",
                    }}>
                      <input type="checkbox"
                        checked={adSetForm.placements[item.key]}
                        onChange={e => setAdSetForm(f => ({
                          ...f,
                          placements: { ...f.placements, [item.key]: e.target.checked },
                        }))}
                        style={{ accentColor: "#7c3aed" }}
                      />
                      {item.label}
                    </label>
                  ))}
                </div>

                {/* Ostatní */}
                <div style={{ gridColumn: "1 / -1" }}>
                  <p style={{ fontSize: ".78rem", fontWeight: 600, color: "var(--text)", margin: "0 0 8px" }}>
                    🌐 Ostatní
                  </p>
                  <div style={{ display: "flex", gap: "20px" }}>
                    {[
                      { key: "audience_network", label: "Audience Network" },
                      { key: "messenger", label: "Messenger" },
                    ].map(item => (
                      <label key={item.key} style={{
                        display: "flex", alignItems: "center", gap: "8px",
                        fontSize: ".8rem", cursor: "pointer", color: "var(--text)",
                      }}>
                        <input type="checkbox"
                          checked={adSetForm.placements[item.key]}
                          onChange={e => setAdSetForm(f => ({
                            ...f,
                            placements: { ...f.placements, [item.key]: e.target.checked },
                          }))}
                          style={{ accentColor: "#7c3aed" }}
                        />
                        {item.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </fieldset>

          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={() => setStep(1)} style={btnSecondary}>← Zpět</button>
            <button onClick={createAdSet} disabled={saving} style={btnPrimary}>
              {saving ? "⏳ Vytvářím..." : "Vytvořit ad set →"}
            </button>
            <button onClick={() => { setStep(4); }} style={{ ...btnSecondary, marginLeft: "auto", fontSize: ".78rem" }}>
              Přeskočit zbytek
            </button>
          </div>
        </div>
      )}

      {/* Krok 3: Reklama */}
      {step === 3 && (
        <div style={{ display: "grid", gap: "16px" }}>
          <div>
            <label style={labelStyle}>Název reklamy *</label>
            <input type="text" value={adForm.name}
              onChange={e => setAdForm(f => ({ ...f, name: e.target.value }))}
              style={inputStyle}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={labelStyle}>Facebook stránka *</label>
              {pages.length > 0 ? (
                <select value={adForm.pageId}
                  onChange={e => setAdForm(f => ({ ...f, pageId: e.target.value }))}
                  style={inputStyle}
                >
                  {pages.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              ) : (
                <p style={{ fontSize: ".82rem", color: "#ef4444" }}>
                  Nemáš žádnou FB stránku. Vytvoř ji na Facebooku.
                </p>
              )}
            </div>
            <div>
              <label style={labelStyle}>CTA tlačítko</label>
              <select value={adForm.cta}
                onChange={e => setAdForm(f => ({ ...f, cta: e.target.value }))}
                style={inputStyle}
              >
                {CTA_OPTIONS.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
          {/* Přepínač URL / Formulář */}
          <div>
            <label style={labelStyle}>Cíl reklamy</label>
            <div style={{ display: "flex", gap: "4px", marginBottom: "10px" }}>
              {[
                { value: "url", label: "🌐 Odkaz (URL)", desc: "Pošli lidi na web" },
                { value: "form", label: "📋 Formulář", desc: "Sbírej kontakty" },
              ].map(mode => (
                <button key={mode.value}
                  onClick={() => {
                    setAdForm(f => ({ ...f, adMode: mode.value }));
                    if (mode.value === "form" && leadForms.length === 0 && adForm.pageId) {
                      loadLeadForms(adForm.pageId);
                    }
                  }}
                  style={{
                    flex: 1, padding: "10px", borderRadius: "8px", cursor: "pointer",
                    border: adForm.adMode === mode.value ? "2px solid #7c3aed" : "1px solid var(--border)",
                    background: adForm.adMode === mode.value ? "#f5f3ff" : "var(--bg-card)",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: ".88rem", fontWeight: 600, color: adForm.adMode === mode.value ? "#7c3aed" : "var(--text)" }}>
                    {mode.label}
                  </div>
                  <div style={{ fontSize: ".72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                    {mode.desc}
                  </div>
                </button>
              ))}
            </div>

            {adForm.adMode === "url" && (
              <div>
                <label style={labelStyle}>Odkaz (URL) *</label>
                <input type="url" value={adForm.linkUrl}
                  onChange={e => setAdForm(f => ({ ...f, linkUrl: e.target.value }))}
                  placeholder="https://tvuj-web.cz" style={inputStyle}
                />
              </div>
            )}

            {adForm.adMode === "form" && (
              <div>
                <label style={labelStyle}>Lead gen formulář *</label>
                {loadingForms ? (
                  <p style={{ fontSize: ".82rem", color: "var(--text-muted)" }}>Načítám formuláře...</p>
                ) : leadForms.length > 0 ? (
                  <select value={adForm.leadFormId}
                    onChange={e => setAdForm(f => ({ ...f, leadFormId: e.target.value }))}
                    style={inputStyle}
                  >
                    <option value="">— Vyber formulář —</option>
                    {leadForms.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.name} {f.leads_count != null ? `(${f.leads_count} leadů)` : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div style={{
                    padding: "12px", borderRadius: "8px", background: "#fef3c7",
                    border: "1px solid #fde68a", fontSize: ".82rem", color: "#92400e",
                  }}>
                    Nemáš žádné formuláře. Vytvoř je v záložce <strong>Formuláře</strong>.
                  </div>
                )}
                <div style={{ marginTop: "10px" }}>
                  <label style={labelStyle}>Odkaz po vyplnění (volitelné)</label>
                  <input type="url" value={adForm.linkUrl}
                    onChange={e => setAdForm(f => ({ ...f, linkUrl: e.target.value }))}
                    placeholder="https://tvuj-web.cz (po odeslání formuláře)" style={inputStyle}
                  />
                </div>
              </div>
            )}
          </div>

          {/* === MÉDIA (3 formáty) === */}
          <div>
            <label style={labelStyle}>Média (obrázky / kreativy)</label>
            <p style={{ fontSize: ".75rem", color: "var(--text-muted)", marginBottom: "8px" }}>
              Nahraj kreativy ve 3 formátech. Facebook si vybere nejlepší pro daný placement.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
              {mediaSlots.map((slot, idx) => (
                <div key={idx} style={{
                  border: "2px dashed #d1d5db", borderRadius: "8px", padding: "12px",
                  textAlign: "center", position: "relative",
                  background: slot.preview ? "#f9fafb" : "transparent",
                }}>
                  <div style={{ fontSize: ".75rem", fontWeight: 600, color: "#6b7280", marginBottom: "6px" }}>
                    {slot.label}
                  </div>
                  {slot.preview ? (
                    <div style={{ position: "relative" }}>
                      <img src={slot.preview} alt={slot.label}
                        style={{ maxWidth: "100%", maxHeight: "120px", borderRadius: "4px", objectFit: "contain" }}
                      />
                      {slot.hash && (
                        <div style={{
                          position: "absolute", top: 4, right: 4,
                          background: "#16a34a", color: "#fff", borderRadius: "50%",
                          width: 20, height: 20, fontSize: "12px",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>✓</div>
                      )}
                      {slot.uploading && (
                        <div style={{
                          position: "absolute", inset: 0, background: "rgba(255,255,255,.7)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          borderRadius: "4px", fontSize: ".8rem",
                        }}>⏳ Nahrávám...</div>
                      )}
                      <button onClick={() => {
                        const updated = [...mediaSlots];
                        updated[idx] = { ...slot, file: null, preview: null, hash: null };
                        setMediaSlots(updated);
                      }} style={{
                        position: "absolute", top: 4, left: 4,
                        background: "#ef4444", color: "#fff", border: "none", borderRadius: "50%",
                        width: 20, height: 20, fontSize: "12px", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>✕</button>
                    </div>
                  ) : (
                    <label style={{
                      display: "block", padding: "16px 8px", cursor: "pointer",
                      fontSize: ".78rem", color: "#7c3aed",
                    }}>
                      📁 Nahrát
                      <input type="file" accept="image/*" style={{ display: "none" }}
                        onChange={e => handleMediaFile(idx, e.target.files[0])}
                      />
                    </label>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* === PRIMÁRNÍ TEXTY (max 3) === */}
          <div>
            <label style={labelStyle}>
              Primární texty reklamy
              <span style={{ fontWeight: 400, color: "var(--text-muted)", fontSize: ".75rem", marginLeft: "6px" }}>
                ({adForm.messages.length}/3)
              </span>
            </label>
            {adForm.messages.map((msg, idx) => (
              <div key={idx} style={{ display: "flex", gap: "6px", marginBottom: "6px" }}>
                <textarea value={msg}
                  onChange={e => {
                    const updated = [...adForm.messages];
                    updated[idx] = e.target.value;
                    setAdForm(f => ({ ...f, messages: updated }));
                  }}
                  placeholder={`Primární text ${idx + 1}`} rows={2}
                  style={{ ...inputStyle, resize: "vertical", flex: 1 }}
                />
                {adForm.messages.length > 1 && (
                  <button onClick={() => {
                    setAdForm(f => ({ ...f, messages: f.messages.filter((_, i) => i !== idx) }));
                  }} style={{
                    background: "none", border: "none", color: "#ef4444",
                    cursor: "pointer", fontSize: "1.1rem", padding: "0 4px",
                  }}>✕</button>
                )}
              </div>
            ))}
            {adForm.messages.length < 3 && (
              <button onClick={() => setAdForm(f => ({ ...f, messages: [...f.messages, ""] }))}
                style={{ ...btnSecondary, fontSize: ".78rem", padding: "4px 10px" }}>
                + Přidat text
              </button>
            )}
          </div>

          {/* === NADPISY (max 5) === */}
          <div>
            <label style={labelStyle}>
              Nadpisy
              <span style={{ fontWeight: 400, color: "var(--text-muted)", fontSize: ".75rem", marginLeft: "6px" }}>
                ({adForm.headlines.length}/5)
              </span>
            </label>
            {adForm.headlines.map((h, idx) => (
              <div key={idx} style={{ display: "flex", gap: "6px", marginBottom: "6px" }}>
                <input type="text" value={h}
                  onChange={e => {
                    const updated = [...adForm.headlines];
                    updated[idx] = e.target.value;
                    setAdForm(f => ({ ...f, headlines: updated }));
                  }}
                  placeholder={`Nadpis ${idx + 1}`} style={{ ...inputStyle, flex: 1 }}
                />
                {adForm.headlines.length > 1 && (
                  <button onClick={() => {
                    setAdForm(f => ({ ...f, headlines: f.headlines.filter((_, i) => i !== idx) }));
                  }} style={{
                    background: "none", border: "none", color: "#ef4444",
                    cursor: "pointer", fontSize: "1.1rem", padding: "0 4px",
                  }}>✕</button>
                )}
              </div>
            ))}
            {adForm.headlines.length < 5 && (
              <button onClick={() => setAdForm(f => ({ ...f, headlines: [...f.headlines, ""] }))}
                style={{ ...btnSecondary, fontSize: ".78rem", padding: "4px 10px" }}>
                + Přidat nadpis
              </button>
            )}
          </div>

          {/* === POPISKY (max 3) === */}
          <div>
            <label style={labelStyle}>
              Popisky
              <span style={{ fontWeight: 400, color: "var(--text-muted)", fontSize: ".75rem", marginLeft: "6px" }}>
                ({adForm.descriptions.length}/3)
              </span>
            </label>
            {adForm.descriptions.map((d, idx) => (
              <div key={idx} style={{ display: "flex", gap: "6px", marginBottom: "6px" }}>
                <input type="text" value={d}
                  onChange={e => {
                    const updated = [...adForm.descriptions];
                    updated[idx] = e.target.value;
                    setAdForm(f => ({ ...f, descriptions: updated }));
                  }}
                  placeholder={`Popisek ${idx + 1}`} style={{ ...inputStyle, flex: 1 }}
                />
                {adForm.descriptions.length > 1 && (
                  <button onClick={() => {
                    setAdForm(f => ({ ...f, descriptions: f.descriptions.filter((_, i) => i !== idx) }));
                  }} style={{
                    background: "none", border: "none", color: "#ef4444",
                    cursor: "pointer", fontSize: "1.1rem", padding: "0 4px",
                  }}>✕</button>
                )}
              </div>
            ))}
            {adForm.descriptions.length < 3 && (
              <button onClick={() => setAdForm(f => ({ ...f, descriptions: [...f.descriptions, ""] }))}
                style={{ ...btnSecondary, fontSize: ".78rem", padding: "4px 10px" }}>
                + Přidat popisek
              </button>
            )}
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={() => setStep(2)} style={btnSecondary}>← Zpět</button>
            <button onClick={createAd} disabled={saving || !adForm.pageId || (adForm.adMode === "url" && !adForm.linkUrl) || (adForm.adMode === "form" && !adForm.leadFormId)} style={btnPrimary}>
              {saving ? "⏳ Vytvářím..." : "Vytvořit reklamu →"}
            </button>
            <button onClick={() => setStep(4)} style={{ ...btnSecondary, marginLeft: "auto", fontSize: ".78rem" }}>
              Přeskočit
            </button>
          </div>
        </div>
      )}

      {/* Krok 4: Hotovo */}
      {step === 4 && (
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ fontSize: "3rem", marginBottom: "12px" }}>🎉</div>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--text)", margin: "0 0 8px" }}>
            Kampaň vytvořena!
          </h3>
          <p style={{ fontSize: ".88rem", color: "var(--text-muted)", margin: "0 0 20px" }}>
            Kampaň je vytvořena jako <strong>pozastavená</strong>. Až budeš připraven, aktivuj ji.
          </p>
          <button onClick={onCreated} style={btnPrimary}>
            Zobrazit kampaně
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Duplikace modal ────────────────────────────────────────────────────────
function DuplicateModal({ target, onClose, onDone }) {
  const [translateLang, setTranslateLang] = useState("");
  const [changeTargeting, setChangeTargeting] = useState(false);
  const [newCountries, setNewCountries] = useState(["CZ"]);
  const [changeUrl, setChangeUrl] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [urlMode, setUrlMode] = useState("page"); // "page" | "manual"
  const [userPages, setUserPages] = useState([]);
  const [userFolders, setUserFolders] = useState([]);
  const [openFolders, setOpenFolders] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState("");

  // Načti stránky a složky uživatele
  useEffect(() => {
    const uid = getAuth()?.currentUser?.uid;
    if (!uid) return;
    Promise.all([
      getDocs(query(collection(db, "pages"), where("uid", "==", uid))),
      getDocs(query(collection(db, "folders"), where("uid", "==", uid))),
    ]).then(([pagesSnap, foldersSnap]) => {
      const pages = pagesSnap.docs.map(d => ({ id: d.id, ...d.data() })).map(p => {
        // URL pro Facebook reklamu (veřejný odkaz)
        let url = "";
        if (p.domain) url = `https://${p.domain}${p.slug ? "/" + p.slug : ""}`;
        // Náhled stránky (vždy dostupný přes /p/id)
        const previewUrl = p.domain
          ? `https://${p.domain}${p.slug ? "/" + p.slug : ""}`
          : `/p/${p.id}`;
        return { id: p.id, name: p.name || "Bez názvu", url, previewUrl, folderId: p.folderId || null };
      });
      const folders = foldersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setUserPages(pages);
      setUserFolders(folders);
    }).catch(err => console.error("Chyba načtení stránek:", err));
  }, []);

  function toggleFolder(fId) {
    setOpenFolders(prev => ({ ...prev, [fId]: !prev[fId] }));
  }

  const levelLabels = { campaign: "kampaň", adset: "ad set", ad: "reklamu" };

  async function handleDuplicate() {
    setSaving(true);
    setError(null);
    setProgress("Vytvářím kopii...");
    try {
      const params = {
        type: target.level,
        sourceId: target.id,
        adAccountId: target.adAccountId,
      };
      if (target.campaignId) {
        params.campaignId = target.campaignId;
      }
      if (translateLang) {
        params.targetLanguage = translateLang;
      }
      if (changeTargeting && newCountries.length > 0) {
        params.newTargeting = { geo_locations: { countries: newCountries } };
      }
      if (changeUrl && newUrl.trim()) {
        params.newUrl = newUrl.trim();
      }
      if (translateLang) {
        setProgress("Překládám texty pomocí AI a vytvářím kopii...");
      }
      const result = await call("fbDuplicate")(params);
      const res = result.data || result;
      // Sbírej chyby a varování z výsledku
      const allAdErrors = [];
      const allWarnings = [];
      if (res.adErrors) allAdErrors.push(...res.adErrors);
      if (res.adSets) {
        for (const as of res.adSets) {
          if (as.adErrors) allAdErrors.push(...as.adErrors);
          if (as.ads) {
            for (const ad of as.ads) {
              if (ad.warning) allWarnings.push(ad.warning);
            }
          }
        }
      }
      if (res.adSetErrors) allAdErrors.push(...res.adSetErrors);
      if (res.warning) allWarnings.push(res.warning);

      if (allAdErrors.length > 0) {
        setError("Kopie vytvořena, ale některé reklamy se nepodařilo zkopírovat:\n" + allAdErrors.join("\n"));
        setProgress("");
      } else if (allWarnings.length > 0) {
        setError("Kopie vytvořena, ale překlad některých reklam selhal (použity originální texty):\n" + allWarnings.join("\n"));
        setProgress("");
      } else {
        setProgress("Hotovo!");
        setTimeout(() => onDone(), 600);
      }
    } catch (err) {
      console.error("Duplicate error:", err);
      setError(err.message || "Chyba při kopírování.");
    } finally {
      setSaving(false);
    }
  }

  function toggleCountry(code) {
    setNewCountries(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 9999,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "var(--bg-card, #fff)", borderRadius: "16px",
        padding: "28px", width: "100%", maxWidth: "480px",
        maxHeight: "85vh", overflowY: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,.25)",
      }}>
        {/* Hlavička */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text)", margin: 0 }}>
            📋 Kopírovat {levelLabels[target.level] || "objekt"}
          </h3>
          <button onClick={onClose} style={{
            border: "none", background: "transparent", fontSize: "1.2rem",
            cursor: "pointer", color: "var(--text-muted)", padding: "4px",
          }}>✕</button>
        </div>

        {/* Název zdroje */}
        <div style={{
          padding: "10px 14px", borderRadius: "8px", background: "#f0f9ff",
          border: "1px solid #bae6fd", marginBottom: "20px", fontSize: ".85rem",
        }}>
          <span style={{ color: "#0369a1", fontWeight: 600 }}>Zdroj:</span>{" "}
          <span style={{ color: "#0c4a6e" }}>{target.name}</span>
        </div>

        {/* Překlad */}
        <div style={{ marginBottom: "18px" }}>
          <label style={{ display: "block", fontSize: ".82rem", fontWeight: 600, color: "var(--text)", marginBottom: "8px" }}>
            🌍 Překlad textů
          </label>
          <select value={translateLang} onChange={e => setTranslateLang(e.target.value)}
            style={{
              width: "100%", padding: "10px 12px", borderRadius: "8px",
              border: "1px solid var(--border)", background: "var(--bg)",
              color: "var(--text)", fontSize: ".88rem", outline: "none",
            }}>
            {LANGUAGES.map(l => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
          {translateLang && (
            <p style={{ fontSize: ".75rem", color: "#7c3aed", margin: "6px 0 0" }}>
              Texty reklam budou automaticky přeloženy pomocí AI.
            </p>
          )}
        </div>

        {/* Zacílení */}
        {target.level !== "ad" && (
          <div style={{ marginBottom: "18px" }}>
            <label
              onClick={() => setChangeTargeting(!changeTargeting)}
              style={{
                display: "flex", alignItems: "center", gap: "10px",
                cursor: "pointer", fontSize: ".82rem", fontWeight: 600,
                color: "var(--text)", marginBottom: changeTargeting ? "10px" : 0,
                userSelect: "none",
              }}
            >
              <span style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: "20px", height: "20px", borderRadius: "4px",
                border: changeTargeting ? "2px solid #7c3aed" : "2px solid #d1d5db",
                background: changeTargeting ? "#7c3aed" : "transparent",
                transition: "all .15s ease",
              }}>
                {changeTargeting && <span style={{ color: "#fff", fontSize: "14px", lineHeight: 1 }}>✓</span>}
              </span>
              🎯 Změnit zacílení (jiná země)
            </label>

            {changeTargeting && (
              <div style={{
                padding: "12px", borderRadius: "8px", background: "#f8fafc",
                border: "1px solid var(--border)",
              }}>
                <p style={{ fontSize: ".78rem", color: "var(--text-muted)", margin: "0 0 8px" }}>
                  Vyber země pro novou kopii:
                </p>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {COUNTRIES.map(c => {
                    const selected = newCountries.includes(c.value);
                    return (
                      <button key={c.value} onClick={() => toggleCountry(c.value)}
                        style={{
                          padding: "5px 12px", borderRadius: "20px", fontSize: ".78rem",
                          fontWeight: selected ? 600 : 400,
                          border: selected ? "2px solid #7c3aed" : "1px solid var(--border)",
                          background: selected ? "#f5f3ff" : "transparent",
                          color: selected ? "#7c3aed" : "var(--text)",
                          cursor: "pointer", transition: "all .15s",
                        }}>
                        {c.label}
                      </button>
                    );
                  })}
                </div>
                {newCountries.length === 0 && (
                  <p style={{ fontSize: ".75rem", color: "#ef4444", margin: "8px 0 0" }}>
                    Vyber alespoň jednu zemi.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Změna URL */}
        <div style={{ marginBottom: "18px" }}>
          <label
            onClick={() => setChangeUrl(!changeUrl)}
            style={{
              display: "flex", alignItems: "center", gap: "10px",
              cursor: "pointer", fontSize: ".82rem", fontWeight: 600,
              color: "var(--text)", marginBottom: changeUrl ? "10px" : 0,
              userSelect: "none",
            }}
          >
            <span style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: "20px", height: "20px", borderRadius: "4px",
              border: changeUrl ? "2px solid #7c3aed" : "2px solid #d1d5db",
              background: changeUrl ? "#7c3aed" : "transparent",
              transition: "all .15s ease",
            }}>
              {changeUrl && <span style={{ color: "#fff", fontSize: "14px", lineHeight: 1 }}>✓</span>}
            </span>
            🔗 Změnit odkaz (URL)
          </label>

          {changeUrl && (
            <div style={{
              padding: "12px", borderRadius: "8px", background: "#f8fafc",
              border: "1px solid var(--border)",
            }}>
              {/* Přepínač stránky / ruční */}
              <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
                <button onClick={() => { setUrlMode("page"); setNewUrl(""); }} style={{
                  padding: "5px 14px", borderRadius: "20px", fontSize: ".78rem", fontWeight: urlMode === "page" ? 600 : 400,
                  border: urlMode === "page" ? "2px solid #7c3aed" : "1px solid var(--border)",
                  background: urlMode === "page" ? "#f5f3ff" : "transparent",
                  color: urlMode === "page" ? "#7c3aed" : "var(--text)", cursor: "pointer",
                }}>Moje stránky</button>
                <button onClick={() => { setUrlMode("manual"); setNewUrl(""); }} style={{
                  padding: "5px 14px", borderRadius: "20px", fontSize: ".78rem", fontWeight: urlMode === "manual" ? 600 : 400,
                  border: urlMode === "manual" ? "2px solid #7c3aed" : "1px solid var(--border)",
                  background: urlMode === "manual" ? "#f5f3ff" : "transparent",
                  color: urlMode === "manual" ? "#7c3aed" : "var(--text)", cursor: "pointer",
                }}>Zadat ručně</button>
              </div>

              {urlMode === "page" ? (
                userPages.length > 0 ? (() => {
                  const pagesInFolders = {};
                  const pagesNoFolder = [];
                  userPages.forEach(p => {
                    if (p.folderId) {
                      if (!pagesInFolders[p.folderId]) pagesInFolders[p.folderId] = [];
                      pagesInFolders[p.folderId].push(p);
                    } else {
                      pagesNoFolder.push(p);
                    }
                  });
                  const PageButton = ({ p }) => {
                    const selectUrl = p.url; // Jen veřejné URL, ne localhost
                    const canSelect = !!selectUrl;
                    const isSelected = canSelect && newUrl === selectUrl;
                    return (
                      <div style={{ display: "flex", alignItems: "center", gap: "4px", width: "100%" }}>
                        <button onClick={() => canSelect && setNewUrl(selectUrl)} style={{
                          flex: 1, padding: "6px 10px", borderRadius: "6px", fontSize: ".78rem",
                          textAlign: "left", cursor: canSelect ? "pointer" : "not-allowed", transition: "all .15s",
                          border: isSelected ? "2px solid #7c3aed" : "1px solid var(--border)",
                          background: isSelected ? "#f5f3ff" : "transparent",
                          color: !canSelect ? "#aaa" : isSelected ? "#7c3aed" : "var(--text)",
                          opacity: canSelect ? 1 : 0.6,
                        }}>
                          <div style={{ fontWeight: 600 }}>{p.name}{!canSelect && <span style={{ fontSize: ".6rem", color: "#d97706", marginLeft: "6px" }}>bez domény</span>}</div>
                          <div style={{ fontSize: ".68rem", color: "var(--text-muted)", marginTop: "1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {selectUrl || "Nastavte doménu v nastavení stránky"}
                          </div>
                        </button>
                        <a href={p.previewUrl} target="_blank" rel="noopener noreferrer"
                          title="Náhled stránky" onClick={e => e.stopPropagation()}
                          style={{
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                            width: "28px", height: "28px", borderRadius: "6px", flexShrink: 0,
                            background: "#f5f3ff", border: "1px solid #ddd6fe",
                            color: "#7c3aed", textDecoration: "none", fontSize: ".85rem",
                            cursor: "pointer",
                          }}
                        >👁</a>
                      </div>
                    );
                  };
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "220px", overflowY: "auto" }}>
                      {/* Složky */}
                      {userFolders.filter(f => pagesInFolders[f.id]?.length > 0).map(folder => (
                        <div key={folder.id}>
                          <button onClick={() => toggleFolder(folder.id)} style={{
                            width: "100%", padding: "7px 10px", borderRadius: "6px", fontSize: ".8rem",
                            textAlign: "left", cursor: "pointer", border: "1px solid var(--border)",
                            background: openFolders[folder.id] ? "#f0f9ff" : "#f8fafc",
                            color: "var(--text)", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px",
                          }}>
                            <span style={{ fontSize: ".7rem", transition: "transform .15s", transform: openFolders[folder.id] ? "rotate(90deg)" : "rotate(0)" }}>▶</span>
                            <span style={{ color: folder.color || "#7c3aed" }}>📁</span>
                            {folder.name}
                            <span style={{ fontSize: ".7rem", color: "var(--text-muted)", marginLeft: "auto" }}>
                              {pagesInFolders[folder.id].length} stránek
                            </span>
                          </button>
                          {openFolders[folder.id] && (
                            <div style={{ paddingLeft: "16px", display: "flex", flexDirection: "column", gap: "3px", marginTop: "3px" }}>
                              {pagesInFolders[folder.id].map(p => <PageButton key={p.id} p={p} />)}
                            </div>
                          )}
                        </div>
                      ))}
                      {/* Stránky bez složky */}
                      {pagesNoFolder.length > 0 && userFolders.length > 0 && (
                        <div style={{ fontSize: ".72rem", color: "var(--text-muted)", fontWeight: 600, padding: "4px 0 2px", marginTop: "4px" }}>
                          Bez složky
                        </div>
                      )}
                      {pagesNoFolder.map(p => <PageButton key={p.id} p={p} />)}
                    </div>
                  );
                })() : (
                  <p style={{ fontSize: ".8rem", color: "var(--text-muted)", margin: 0 }}>
                    Nemáte žádné vytvořené stránky. Použijte ruční zadání.
                  </p>
                )
              ) : (
                <input
                  type="url"
                  value={newUrl}
                  onChange={e => setNewUrl(e.target.value)}
                  placeholder="https://example.com/landing-page"
                  style={{
                    width: "100%", padding: "10px 12px", borderRadius: "8px",
                    border: "1px solid var(--border)", background: "var(--bg)",
                    color: "var(--text)", fontSize: ".85rem", outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              )}

              {newUrl && urlMode === "manual" && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", margin: "8px 0 0" }}>
                  {newUrl.startsWith("http") && (
                    <a href={newUrl} target="_blank" rel="noopener noreferrer"
                      title="Náhled stránky"
                      style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: "28px", height: "28px", borderRadius: "6px",
                        background: "#f5f3ff", border: "1px solid #7c3aed",
                        color: "#7c3aed", textDecoration: "none", fontSize: "1rem",
                        cursor: "pointer", flexShrink: 0,
                      }}
                    >👁</a>
                  )}
                  <span style={{ fontSize: ".75rem", color: "#7c3aed", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {newUrl}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Chyba */}
        {error && (
          <div style={{
            padding: "10px 14px", borderRadius: "8px", marginBottom: "14px",
            background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: ".82rem",
            whiteSpace: "pre-wrap",
          }}>
            {error}
          </div>
        )}

        {/* Progress */}
        {saving && progress && (
          <div style={{
            padding: "10px 14px", borderRadius: "8px", marginBottom: "14px",
            background: "#f0f9ff", border: "1px solid #bae6fd", color: "#0369a1",
            fontSize: ".82rem", display: "flex", alignItems: "center", gap: "8px",
          }}>
            <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span>
            {progress}
          </div>
        )}

        {/* Shrnutí */}
        <div style={{
          padding: "12px 14px", borderRadius: "8px", background: "#f8fafc",
          border: "1px solid var(--border)", marginBottom: "18px", fontSize: ".82rem",
          color: "var(--text-muted)",
        }}>
          <strong style={{ color: "var(--text)" }}>Shrnutí kopie:</strong>
          <ul style={{ margin: "6px 0 0", paddingLeft: "18px" }}>
            <li>Kopíruji: <strong>{levelLabels[target.level]}</strong></li>
            {translateLang ? (
              <li>Překlad do: <strong>{LANGUAGES.find(l => l.value === translateLang)?.label}</strong></li>
            ) : (
              <li>Bez překladu (originální texty)</li>
            )}
            {changeTargeting && newCountries.length > 0 ? (
              <li>Nové země: <strong>{newCountries.join(", ")}</strong></li>
            ) : target.level !== "ad" ? (
              <li>Stejné zacílení jako originál</li>
            ) : null}
            {changeUrl && newUrl ? (
              <li>Nový odkaz: <strong style={{ wordBreak: "break-all" }}>{newUrl}</strong></li>
            ) : (
              <li>Stejný odkaz jako originál</li>
            )}
          </ul>
        </div>

        {/* Tlačítka */}
        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button onClick={onClose} disabled={saving} style={{
            padding: "10px 20px", borderRadius: "8px",
            border: "1px solid var(--border)", background: "var(--bg-card)",
            color: "var(--text)", cursor: "pointer", fontSize: ".88rem", fontWeight: 500,
          }}>
            Zrušit
          </button>
          <button onClick={handleDuplicate} disabled={saving || (changeTargeting && newCountries.length === 0)} style={{
            padding: "10px 20px", borderRadius: "8px", border: "none",
            background: saving ? "#93c5fd" : "#0ea5e9", color: "#fff",
            cursor: saving ? "not-allowed" : "pointer",
            fontWeight: 600, fontSize: ".88rem",
          }}>
            {saving ? "⏳ Kopíruji..." : "📋 Vytvořit kopii"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Styly ───────────────────────────────────────────────────────────────────
const labelStyle = {
  display: "block", fontSize: ".82rem", fontWeight: 500,
  color: "var(--text-muted)", marginBottom: "6px",
};
const inputStyle = {
  width: "100%", padding: "10px 12px", borderRadius: "8px",
  border: "1px solid var(--border)", background: "var(--bg)",
  color: "var(--text)", fontSize: ".88rem",
  outline: "none", boxSizing: "border-box",
};
const btnPrimary = {
  padding: "10px 20px", borderRadius: "8px", border: "none",
  background: "#7c3aed", color: "#fff", cursor: "pointer",
  fontWeight: 600, fontSize: ".88rem",
};
const btnSecondary = {
  padding: "10px 20px", borderRadius: "8px",
  border: "1px solid var(--border)", background: "var(--bg-card)",
  color: "var(--text)", cursor: "pointer", fontSize: ".88rem", fontWeight: 500,
};
const btnSmall = {
  padding: "4px 10px", borderRadius: "6px", fontSize: ".78rem", fontWeight: 500,
  border: "1px solid", background: "transparent", cursor: "pointer",
};
