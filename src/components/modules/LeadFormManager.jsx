import { useState, useEffect, useCallback } from "react";
import { httpsCallable, getFunctions } from "firebase/functions";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db, auth } from "../../firebase/config";

const functions = getFunctions();
const call = (name) => httpsCallable(functions, name);

const QUESTION_TYPES = [
  { value: "FULL_NAME", label: "Celé jméno" },
  { value: "FIRST_NAME", label: "Křestní jméno" },
  { value: "LAST_NAME", label: "Příjmení" },
  { value: "EMAIL", label: "E-mail" },
  { value: "PHONE", label: "Telefon" },
  { value: "CITY", label: "Město" },
  { value: "ZIP", label: "PSČ" },
  { value: "COMPANY_NAME", label: "Firma" },
  { value: "JOB_TITLE", label: "Pozice" },
];

export default function LeadFormManager({ fbAccount }) {
  const [pages, setPages] = useState([]);
  const [selectedPage, setSelectedPage] = useState("");
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [defaultFormId, setDefaultFormId] = useState(null);
  const [savingDefault, setSavingDefault] = useState(false);

  // Nový formulář
  const [formData, setFormData] = useState({
    name: "",
    privacyPolicyUrl: "",
    thankYouTitle: "Děkujeme!",
    thankYouBody: "Vaše údaje byly odeslány. Brzy se vám ozveme.",
    thankYouButtonText: "Navštívit web",
    thankYouUrl: "",
    questions: [{ type: "EMAIL", key: "email" }],
  });

  // Načti FB stránky
  useEffect(() => {
    async function load() {
      try {
        const { data } = await call("fbListPages")({});
        setPages(data.pages || []);
        if (data.pages?.length > 0) {
          setSelectedPage(data.pages[0].id);
        }
      } catch (err) {
        console.error("Load pages error:", err);
      }
    }
    load();
  }, []);

  // Načti formuláře
  const loadForms = useCallback(async () => {
    if (!selectedPage) return;
    setLoading(true);
    setError(null);
    try {
      const { data } = await call("fbListLeadForms")({ pageId: selectedPage });
      setForms(data.forms || []);
    } catch (err) {
      console.error("Load forms error:", err);
      setError(err.message || "Nepodařilo se načíst formuláře.");
    } finally {
      setLoading(false);
    }
  }, [selectedPage]);

  useEffect(() => { loadForms(); }, [loadForms]);

  // Načti výchozí formulář pro vybranou stránku
  useEffect(() => {
    async function loadDefault() {
      if (!selectedPage || !auth.currentUser) return;
      try {
        const ref = doc(db, "fbDefaultLeadForms", `${auth.currentUser.uid}_${selectedPage}`);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setDefaultFormId(snap.data().formId);
        } else {
          setDefaultFormId(null);
        }
      } catch (err) {
        console.error("Load default form error:", err);
      }
    }
    loadDefault();
  }, [selectedPage]);

  // Nastav výchozí formulář
  async function setDefaultForm(formId) {
    if (!selectedPage || !auth.currentUser) return;
    setSavingDefault(true);
    try {
      const ref = doc(db, "fbDefaultLeadForms", `${auth.currentUser.uid}_${selectedPage}`);
      await setDoc(ref, {
        formId,
        pageId: selectedPage,
        userId: auth.currentUser.uid,
        updatedAt: new Date().toISOString(),
      });
      setDefaultFormId(formId);
    } catch (err) {
      console.error("Set default form error:", err);
      alert("Nepodařilo se nastavit výchozí formulář.");
    } finally {
      setSavingDefault(false);
    }
  }

  function addQuestion() {
    if (formData.questions.length >= 10) return;
    setFormData(f => ({
      ...f,
      questions: [...f.questions, { type: "FULL_NAME", key: `q_${Date.now()}` }],
    }));
  }

  function removeQuestion(idx) {
    setFormData(f => ({
      ...f,
      questions: f.questions.filter((_, i) => i !== idx),
    }));
  }

  function updateQuestion(idx, type) {
    setFormData(f => {
      const updated = [...f.questions];
      updated[idx] = { ...updated[idx], type };
      return { ...f, questions: updated };
    });
  }

  async function createForm() {
    if (!formData.name.trim()) return alert("Vyplň název formuláře.");
    if (!formData.privacyPolicyUrl.trim()) return alert("Vyplň URL zásad ochrany osobních údajů.");
    if (formData.questions.length === 0) return alert("Přidej alespoň jednu otázku.");

    setSaving(true);
    try {
      const questions = formData.questions.map(q => ({ type: q.type }));

      await call("fbCreateLeadForm")({
        pageId: selectedPage,
        name: formData.name.trim(),
        questions,
        privacyPolicyUrl: formData.privacyPolicyUrl.trim(),
        thankYouTitle: formData.thankYouTitle,
        thankYouBody: formData.thankYouBody,
        thankYouButtonText: formData.thankYouButtonText,
        thankYouUrl: formData.thankYouUrl || formData.privacyPolicyUrl,
      });

      setShowCreate(false);
      setFormData({
        name: "",
        privacyPolicyUrl: "",
        thankYouTitle: "Děkujeme!",
        thankYouBody: "Vaše údaje byly odeslány. Brzy se vám ozveme.",
        thankYouButtonText: "Navštívit web",
        thankYouUrl: "",
        questions: [{ type: "EMAIL", key: "email" }],
      });
      loadForms();
    } catch (err) {
      alert(`Chyba: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function deleteForm(formId, formName) {
    if (!window.confirm(`Smazat formulář "${formName}"?`)) return;
    try {
      await call("fbDeleteLeadForm")({ formId });
      loadForms();
    } catch (err) {
      alert(`Chyba: ${err.message}`);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text)", margin: 0 }}>
          📋 Lead gen formuláře
        </h3>
        <button onClick={() => setShowCreate(!showCreate)} style={btnPrimary}>
          {showCreate ? "✕ Zavřít" : "+ Nový formulář"}
        </button>
      </div>

      {/* Výběr FB stránky */}
      {pages.length > 1 && (
        <div style={{ marginBottom: "16px" }}>
          <label style={labelStyle}>Facebook stránka</label>
          <select value={selectedPage} onChange={e => setSelectedPage(e.target.value)} style={inputStyle}>
            {pages.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Formulář pro tvorbu */}
      {showCreate && (
        <div style={{
          padding: "20px", borderRadius: "12px", marginBottom: "20px",
          background: "var(--bg-card)", border: "2px solid #7c3aed",
        }}>
          <h4 style={{ fontSize: ".92rem", fontWeight: 600, color: "var(--text)", margin: "0 0 16px" }}>
            Vytvořit nový formulář
          </h4>

          <div style={{ display: "grid", gap: "14px" }}>
            <div>
              <label style={labelStyle}>Název formuláře *</label>
              <input type="text" value={formData.name}
                onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                placeholder="např. Registrace na webinář" style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>URL zásad ochrany osobních údajů *</label>
              <input type="url" value={formData.privacyPolicyUrl}
                onChange={e => setFormData(f => ({ ...f, privacyPolicyUrl: e.target.value }))}
                placeholder="https://tvuj-web.cz/gdpr" style={inputStyle}
              />
            </div>

            {/* Otázky */}
            <div>
              <label style={labelStyle}>
                Pole formuláře
                <span style={{ fontWeight: 400, color: "var(--text-muted)", fontSize: ".75rem", marginLeft: "6px" }}>
                  ({formData.questions.length}/10)
                </span>
              </label>
              {formData.questions.map((q, idx) => (
                <div key={q.key || idx} style={{ display: "flex", gap: "8px", marginBottom: "8px", alignItems: "center" }}>
                  <span style={{ fontSize: ".78rem", color: "var(--text-muted)", minWidth: "24px" }}>{idx + 1}.</span>
                  <select value={q.type} onChange={e => updateQuestion(idx, e.target.value)}
                    style={{ ...inputStyle, flex: 1 }}
                  >
                    {QUESTION_TYPES.map(qt => (
                      <option key={qt.value} value={qt.value}>{qt.label}</option>
                    ))}
                  </select>
                  {formData.questions.length > 1 && (
                    <button onClick={() => removeQuestion(idx)} style={{
                      background: "none", border: "none", color: "#ef4444",
                      cursor: "pointer", fontSize: "1.1rem", padding: "0 4px",
                    }}>✕</button>
                  )}
                </div>
              ))}
              {formData.questions.length < 10 && (
                <button onClick={addQuestion}
                  style={{ ...btnSecondary, fontSize: ".78rem", padding: "4px 10px" }}>
                  + Přidat pole
                </button>
              )}
            </div>

            {/* Děkovací stránka */}
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: "14px" }}>
              <label style={{ ...labelStyle, fontWeight: 600, marginBottom: "12px" }}>
                Děkovací stránka (po odeslání)
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={labelStyle}>Nadpis</label>
                  <input type="text" value={formData.thankYouTitle}
                    onChange={e => setFormData(f => ({ ...f, thankYouTitle: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Text tlačítka</label>
                  <input type="text" value={formData.thankYouButtonText}
                    onChange={e => setFormData(f => ({ ...f, thankYouButtonText: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
              </div>
              <div style={{ marginTop: "10px" }}>
                <label style={labelStyle}>Zpráva</label>
                <textarea value={formData.thankYouBody}
                  onChange={e => setFormData(f => ({ ...f, thankYouBody: e.target.value }))}
                  rows={2} style={{ ...inputStyle, resize: "vertical" }}
                />
              </div>
              <div style={{ marginTop: "10px" }}>
                <label style={labelStyle}>URL po kliknutí na tlačítko</label>
                <input type="url" value={formData.thankYouUrl}
                  onChange={e => setFormData(f => ({ ...f, thankYouUrl: e.target.value }))}
                  placeholder="https://tvuj-web.cz" style={inputStyle}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={createForm} disabled={saving} style={btnPrimary}>
                {saving ? "⏳ Vytvářím..." : "Vytvořit formulář"}
              </button>
              <button onClick={() => setShowCreate(false)} style={btnSecondary}>
                Zrušit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Seznam formulářů */}
      {error && (
        <div style={{
          padding: "12px 16px", borderRadius: "8px", marginBottom: "16px",
          background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626",
          fontSize: ".85rem",
        }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
          Načítám formuláře...
        </div>
      ) : forms.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "40px",
          background: "var(--bg-card)", borderRadius: "12px", border: "1px solid var(--border)",
        }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>📋</div>
          <p style={{ color: "var(--text-muted)", fontSize: ".88rem", margin: 0 }}>
            Zatím nemáš žádné lead gen formuláře. Vytvoř první formulář a začni sbírat kontakty.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "12px" }}>
          {forms.map(form => (
            <div key={form.id} style={{
              padding: "16px", borderRadius: "10px",
              background: "var(--bg-card)", border: "1px solid var(--border)",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div
                  onClick={() => !savingDefault && setDefaultForm(form.id)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: "22px", height: "22px", minWidth: "22px",
                    borderRadius: "50%", cursor: savingDefault ? "wait" : "pointer",
                    border: defaultFormId === form.id ? "2px solid #7c3aed" : "2px solid var(--border)",
                    background: defaultFormId === form.id ? "#7c3aed" : "transparent",
                    marginRight: "12px", transition: "all 0.2s",
                  }}
                  title={defaultFormId === form.id ? "Výchozí formulář" : "Nastavit jako výchozí"}
                >
                  {defaultFormId === form.id && (
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#fff" }} />
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <span style={{ fontWeight: 600, fontSize: ".92rem", color: "var(--text)" }}>
                      {form.name}
                    </span>
                    {defaultFormId === form.id && (
                      <span style={{
                        padding: "2px 8px", borderRadius: "12px", fontSize: ".7rem", fontWeight: 600,
                        background: "#ede9fe", color: "#7c3aed",
                      }}>
                        Výchozí
                      </span>
                    )}
                    <span style={{
                      padding: "2px 8px", borderRadius: "12px", fontSize: ".7rem", fontWeight: 600,
                      background: form.status === "ACTIVE" ? "#dcfce7" : "#f3f4f6",
                      color: form.status === "ACTIVE" ? "#16a34a" : "#6b7280",
                    }}>
                      {form.status === "ACTIVE" ? "Aktivní" : form.status}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "16px", fontSize: ".78rem", color: "var(--text-muted)" }}>
                    <span>ID: {form.id}</span>
                    {form.leads_count != null && <span>Leady: {form.leads_count}</span>}
                    {form.created_time && (
                      <span>Vytvořeno: {new Date(form.created_time).toLocaleDateString("cs-CZ")}</span>
                    )}
                  </div>
                  {form.questions && (
                    <div style={{ marginTop: "6px", fontSize: ".78rem", color: "var(--text-muted)" }}>
                      Pole: {form.questions.map(q => {
                        const qt = QUESTION_TYPES.find(t => t.value === q.type);
                        return qt ? qt.label : q.type;
                      }).join(", ")}
                    </div>
                  )}
                </div>
                <button onClick={() => deleteForm(form.id, form.name)} style={{
                  background: "none", border: "none", color: "#ef4444",
                  cursor: "pointer", fontSize: ".82rem", padding: "4px 8px",
                }}>
                  🗑 Smazat
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
