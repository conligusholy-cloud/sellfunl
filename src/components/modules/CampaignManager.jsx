import { useState, useEffect, useCallback } from "react";
import { httpsCallable, getFunctions } from "firebase/functions";

const functions = getFunctions();
const call = (name) => httpsCallable(functions, name);

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
];

export default function CampaignManager({ fbAccount }) {
  const [adAccountId, setAdAccountId] = useState("");
  const [campaigns, setCampaigns] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [expandedCampaign, setExpandedCampaign] = useState(null);
  const [showWizard, setShowWizard] = useState(false);
  const [error, setError] = useState(null);

  // Nastav první ad account automaticky
  useEffect(() => {
    const accounts = fbAccount?.adAccounts || [];
    if (accounts.length > 0 && !adAccountId) {
      setAdAccountId(accounts[0].id);
    }
  }, [fbAccount?.adAccounts]);

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

  const adAccounts = fbAccount?.adAccounts || [];

  return (
    <div>
      {/* Výběr reklamního účtu */}
      {adAccounts.length > 1 && (
        <div style={{ marginBottom: "20px" }}>
          <label style={labelStyle}>Reklamní účet</label>
          <select value={adAccountId} onChange={e => setAdAccountId(e.target.value)} style={inputStyle}>
            {adAccounts.map(a => (
              <option key={a.id} value={a.id}>{a.name} ({a.id})</option>
            ))}
          </select>
        </div>
      )}

      {/* Akční lišta */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text)", margin: 0 }}>
            Kampaně
          </h3>
          {adAccounts.length === 1 && (
            <span style={{ fontSize: ".78rem", color: "var(--text-muted)" }}>
              ({adAccounts[0].name})
            </span>
          )}
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

      {/* Seznam kampaní */}
      {loadingCampaigns ? (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
          ⏳ Načítám kampaně...
        </div>
      ) : campaigns.length === 0 ? (
        <EmptyState onNew={() => setShowWizard(true)} />
      ) : (
        <div style={{ display: "grid", gap: "12px" }}>
          {campaigns.map(c => (
            <CampaignRow key={c.id} campaign={c}
              expanded={expandedCampaign === c.id}
              onToggle={() => setExpandedCampaign(expandedCampaign === c.id ? null : c.id)}
              onStatusChange={updateStatus}
            />
          ))}
        </div>
      )}
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
function CampaignRow({ campaign, expanded, onToggle, onStatusChange }) {
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
            {obj?.label || campaign.objective} • {budget} • {campaign.adSetCount || 0} ad setů
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
        <CampaignDetail campaign={campaign} onStatusChange={onStatusChange} />
      )}
    </div>
  );
}

// ─── Detail kampaně (ad sety, reklamy) ───────────────────────────────────────
function CampaignDetail({ campaign, onStatusChange }) {
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
      <div style={{ display: "flex", gap: "8px", padding: "12px 0" }}>
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
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Ad Set řádek ────────────────────────────────────────────────────────────
function AdSetRow({ adSet, expanded, onToggle, onStatusChange }) {
  const st = STATUS_MAP[adSet.status] || STATUS_MAP.PAUSED;
  const budget = adSet.daily_budget
    ? `${(adSet.daily_budget / 100).toFixed(0)} Kč/den`
    : adSet.lifetime_budget
    ? `${(adSet.lifetime_budget / 100).toFixed(0)} Kč celkem`
    : "—";

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

      {expanded && <AdSetDetail adSet={adSet} onStatusChange={onStatusChange} />}
    </div>
  );
}

// ─── Ad Set detail (reklamy) ─────────────────────────────────────────────────
function AdSetDetail({ adSet, onStatusChange }) {
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

  return (
    <div style={{ padding: "8px 14px 14px", borderTop: "1px solid var(--border)" }}>
      <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
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
      </div>

      <p style={{ fontSize: ".78rem", fontWeight: 600, color: "var(--text)", margin: "0 0 6px" }}>
        Reklamy ({ads.length})
      </p>

      {loading ? (
        <p style={{ fontSize: ".78rem", color: "var(--text-muted)" }}>Načítám...</p>
      ) : ads.length === 0 ? (
        <p style={{ fontSize: ".78rem", color: "var(--text-muted)", fontStyle: "italic" }}>Žádné reklamy.</p>
      ) : (
        ads.map(ad => {
          const ast = STATUS_MAP[ad.status] || STATUS_MAP.PAUSED;
          return (
            <div key={ad.id} style={{
              display: "flex", alignItems: "center", gap: "8px",
              padding: "8px 10px", borderRadius: "6px", background: "var(--bg-card)",
              marginBottom: "6px", fontSize: ".82rem",
            }}>
              {ad.creative?.thumbnail_url && (
                <img src={ad.creative.thumbnail_url} alt="" style={{
                  width: "36px", height: "36px", borderRadius: "4px", objectFit: "cover",
                }} />
              )}
              <span style={{ flex: 1, color: "var(--text)", fontWeight: 500 }}>{ad.name}</span>
              <span style={{
                padding: "2px 6px", borderRadius: "10px", fontSize: ".68rem", fontWeight: 600,
                background: ast.bg, color: ast.color,
              }}>{ast.label}</span>
              {ad.status === "PAUSED" && (
                <button onClick={() => onStatusChange(ad.id, "ACTIVE")} style={{ ...btnSmall, fontSize: ".7rem", padding: "2px 6px", color: "#16a34a", borderColor: "#16a34a" }}>▶</button>
              )}
              {ad.status === "ACTIVE" && (
                <button onClick={() => onStatusChange(ad.id, "PAUSED")} style={{ ...btnSmall, fontSize: ".7rem", padding: "2px 6px", color: "#d97706", borderColor: "#d97706" }}>⏸</button>
              )}
            </div>
          );
        })
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
  });

  // Krok 3: Reklama
  const [adForm, setAdForm] = useState({
    name: "", pageId: "", linkUrl: "", message: "", headline: "", description: "", cta: "LEARN_MORE",
  });

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
        geo_locations: {
          countries: adSetForm.countries.split(",").map(c => c.trim().toUpperCase()).filter(Boolean),
        },
      };
      if (adSetForm.genders !== "all") {
        targeting.genders = [Number(adSetForm.genders)]; // 1=male, 2=female
      }
      if (adSetForm.interests.trim()) {
        // Zájmy: uživatel zadá volně, ale FB vyžaduje ID
        // Pro zjednodušení je přeskočíme (vyžadovalo by search API)
      }

      const { data } = await call("fbCreateAdSet")({
        adAccountId,
        campaignId: createdIds.campaignId,
        name: adSetForm.name,
        optimizationGoal: adSetForm.optimizationGoal,
        targeting,
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

  async function createAd() {
    if (!adForm.name || !adForm.pageId || !adForm.linkUrl) return alert("Vyplň název, FB stránku a odkaz.");
    setSaving(true);
    try {
      await call("fbCreateAd")({
        adAccountId,
        adSetId: createdIds.adSetId,
        name: adForm.name,
        pageId: adForm.pageId,
        linkUrl: adForm.linkUrl,
        message: adForm.message,
        headline: adForm.headline,
        description: adForm.description,
        callToAction: adForm.cta,
      });
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

          <fieldset style={{ border: "1px solid var(--border)", borderRadius: "8px", padding: "16px" }}>
            <legend style={{ fontSize: ".82rem", fontWeight: 600, color: "var(--text)", padding: "0 6px" }}>
              Targeting
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
            <div style={{ marginTop: "12px" }}>
              <label style={labelStyle}>Země (kódy oddělené čárkou)</label>
              <input type="text" value={adSetForm.countries}
                onChange={e => setAdSetForm(f => ({ ...f, countries: e.target.value }))}
                placeholder="CZ, SK" style={inputStyle}
              />
            </div>
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
          <div>
            <label style={labelStyle}>Odkaz (URL) *</label>
            <input type="url" value={adForm.linkUrl}
              onChange={e => setAdForm(f => ({ ...f, linkUrl: e.target.value }))}
              placeholder="https://tvuj-web.cz" style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Primární text reklamy</label>
            <textarea value={adForm.message}
              onChange={e => setAdForm(f => ({ ...f, message: e.target.value }))}
              placeholder="Hlavní text, který uvidí uživatelé (z tab Texty reklam)" rows={2}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={labelStyle}>Nadpis</label>
              <input type="text" value={adForm.headline}
                onChange={e => setAdForm(f => ({ ...f, headline: e.target.value }))}
                placeholder="Krátký nadpis" style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Popisek</label>
              <input type="text" value={adForm.description}
                onChange={e => setAdForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Doplňující text" style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={() => setStep(2)} style={btnSecondary}>← Zpět</button>
            <button onClick={createAd} disabled={saving || !adForm.pageId} style={btnPrimary}>
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
