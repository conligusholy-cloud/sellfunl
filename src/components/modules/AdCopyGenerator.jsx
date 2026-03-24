import { useState } from "react";
import { httpsCallable, getFunctions } from "firebase/functions";

const functions = getFunctions();

/**
 * Komponenta pro AI generování textů Facebook reklam.
 * Generuje: primární texty, nadpisy, popisky ve více variantách.
 */
export default function AdCopyGenerator() {
  const [form, setForm] = useState({
    productName: "",
    productDescription: "",
    targetAudience: "",
    tone: "profesionální",
    language: "cs",
  });
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(null); // "primaryTexts-0" etc.

  const toneOptions = [
    { value: "profesionální", label: "Profesionální" },
    { value: "přátelský a neformální", label: "Přátelský" },
    { value: "urgentní a naléhavý", label: "Urgentní" },
    { value: "luxusní a prémiový", label: "Prémiový" },
    { value: "vtipný a hravý", label: "Hravý" },
  ];

  async function handleGenerate(e) {
    e.preventDefault();
    if (!form.productName || !form.productDescription) return;

    setLoading(true);
    setResults(null);

    try {
      const generate = httpsCallable(functions, "generateAdCopy");
      const { data } = await generate(form);

      if (data.result) {
        setResults(data.result);
      }
    } catch (err) {
      console.error("Ad copy generation error:", err);
      alert("Nepodařilo se vygenerovat texty. Zkus to znovu.");
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard(text, key) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  // CTA label překlad
  const ctaLabels = {
    SHOP_NOW: "Nakupte",
    LEARN_MORE: "Zjistit více",
    SIGN_UP: "Registrace",
    GET_OFFER: "Získat nabídku",
    BOOK_TRAVEL: "Rezervovat",
    CONTACT_US: "Kontaktujte nás",
    DOWNLOAD: "Stáhnout",
    SUBSCRIBE: "Odebírat",
    WATCH_MORE: "Sledovat",
    APPLY_NOW: "Přihlásit se",
  };

  return (
    <div>
      {/* Formulář */}
      <form onSubmit={handleGenerate} style={{
        padding: "24px", borderRadius: "12px",
        background: "var(--bg-card)", border: "1px solid var(--border)",
        marginBottom: "24px",
      }}>
        <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text)", marginBottom: "16px" }}>
          Zadej informace o produktu
        </h3>

        <div style={{ display: "grid", gap: "16px" }}>
          {/* Název produktu */}
          <div>
            <label style={labelStyle}>Název produktu / služby *</label>
            <input
              type="text"
              value={form.productName}
              onChange={e => setForm(f => ({ ...f, productName: e.target.value }))}
              placeholder="např. SellFunl — tvorba landing pages"
              style={inputStyle}
              required
            />
          </div>

          {/* Popis */}
          <div>
            <label style={labelStyle}>Popis produktu *</label>
            <textarea
              value={form.productDescription}
              onChange={e => setForm(f => ({ ...f, productDescription: e.target.value }))}
              placeholder="Co produkt dělá, jaké problémy řeší, klíčové benefity..."
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
              required
            />
          </div>

          {/* Cílovka */}
          <div>
            <label style={labelStyle}>Cílová skupina</label>
            <input
              type="text"
              value={form.targetAudience}
              onChange={e => setForm(f => ({ ...f, targetAudience: e.target.value }))}
              placeholder="např. podnikatelé 25-45 let, e-shopy, freelanceri"
              style={inputStyle}
            />
          </div>

          {/* Tón + Jazyk */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={labelStyle}>Tón komunikace</label>
              <select
                value={form.tone}
                onChange={e => setForm(f => ({ ...f, tone: e.target.value }))}
                style={inputStyle}
              >
                {toneOptions.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Jazyk</label>
              <select
                value={form.language}
                onChange={e => setForm(f => ({ ...f, language: e.target.value }))}
                style={inputStyle}
              >
                <option value="cs">Čeština</option>
                <option value="sk">Slovenština</option>
                <option value="en">Angličtina</option>
                <option value="de">Němčina</option>
                <option value="fr">Francouzština</option>
                <option value="es">Španělština</option>
                <option value="it">Italština</option>
                <option value="pt">Portugalština</option>
                <option value="nl">Holandština</option>
                <option value="pl">Polština</option>
                <option value="hu">Maďarština</option>
                <option value="ro">Rumunština</option>
                <option value="bg">Bulharština</option>
                <option value="hr">Chorvatština</option>
                <option value="sr">Srbština</option>
                <option value="sl">Slovinština</option>
                <option value="bs">Bosenština</option>
                <option value="mk">Makedonština</option>
                <option value="sq">Albánština</option>
                <option value="el">Řečtina</option>
                <option value="tr">Turečtina</option>
                <option value="uk">Ukrajinština</option>
                <option value="ru">Ruština</option>
                <option value="be">Běloruština</option>
                <option value="sv">Švédština</option>
                <option value="no">Norština</option>
                <option value="da">Dánština</option>
                <option value="fi">Finština</option>
                <option value="is">Islandština</option>
                <option value="et">Estonština</option>
                <option value="lv">Lotyšština</option>
                <option value="lt">Litevština</option>
                <option value="ga">Irština</option>
                <option value="cy">Velština</option>
                <option value="mt">Maltština</option>
                <option value="ka">Gruzínština</option>
              </select>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !form.productName || !form.productDescription}
          style={{
            marginTop: "20px", padding: "12px 24px", borderRadius: "8px",
            border: "none", background: loading ? "#9ca3af" : "#7c3aed",
            color: "#fff", cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 600, fontSize: ".92rem", display: "flex",
            alignItems: "center", gap: "8px",
          }}
        >
          {loading ? (
            <>⏳ Generuji texty...</>
          ) : (
            <>✨ Vygenerovat texty reklam</>
          )}
        </button>
      </form>

      {/* Výsledky */}
      {results && !results.raw && (
        <div style={{ display: "grid", gap: "20px" }}>

          {/* Primární texty */}
          {results.primaryTexts?.length > 0 && (
            <ResultSection
              title="Primární texty"
              subtitle="Hlavní text reklamy (zobrazuje se nad obrázkem)"
              icon="📝"
              items={results.primaryTexts}
              groupKey="primaryTexts"
              copied={copied}
              onCopy={copyToClipboard}
            />
          )}

          {/* Nadpisy */}
          {results.headlines?.length > 0 && (
            <ResultSection
              title="Nadpisy"
              subtitle="Headline pod obrázkem (max 40 znaků)"
              icon="🔤"
              items={results.headlines}
              groupKey="headlines"
              copied={copied}
              onCopy={copyToClipboard}
            />
          )}

          {/* Popisky */}
          {results.descriptions?.length > 0 && (
            <ResultSection
              title="Popisky"
              subtitle="Description pod nadpisem (max 30 znaků)"
              icon="💬"
              items={results.descriptions}
              groupKey="descriptions"
              copied={copied}
              onCopy={copyToClipboard}
            />
          )}

          {/* CTA */}
          {results.callToActions?.length > 0 && (
            <div style={{
              padding: "20px", borderRadius: "12px",
              background: "var(--bg-card)", border: "1px solid var(--border)",
            }}>
              <h4 style={{ fontSize: ".92rem", fontWeight: 600, color: "var(--text)", marginBottom: "12px" }}>
                🎯 Doporučená CTA tlačítka
              </h4>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {results.callToActions.map((cta, i) => (
                  <span key={i} style={{
                    padding: "6px 14px", borderRadius: "20px",
                    background: "#ede9fe", color: "#7c3aed",
                    fontSize: ".82rem", fontWeight: 500,
                  }}>
                    {ctaLabels[cta] || cta}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Regenerate */}
          <button
            onClick={handleGenerate}
            disabled={loading}
            style={{
              padding: "10px 20px", borderRadius: "8px",
              border: "1px solid var(--border)", background: "var(--bg-card)",
              color: "var(--text)", cursor: "pointer", fontSize: ".88rem",
              fontWeight: 500, display: "flex", alignItems: "center",
              gap: "6px", width: "fit-content",
            }}
          >
            🔄 Vygenerovat nové varianty
          </button>
        </div>
      )}

      {/* Fallback pro raw text */}
      {results?.raw && (
        <div style={{
          padding: "20px", borderRadius: "12px",
          background: "var(--bg-card)", border: "1px solid var(--border)",
          whiteSpace: "pre-wrap", fontSize: ".88rem", color: "var(--text)",
        }}>
          {results.raw}
        </div>
      )}
    </div>
  );
}

// ─── Sub-komponenta: sekce výsledků ────────────────────────────────────────
function ResultSection({ title, subtitle, icon, items, groupKey, copied, onCopy }) {
  return (
    <div style={{
      padding: "20px", borderRadius: "12px",
      background: "var(--bg-card)", border: "1px solid var(--border)",
    }}>
      <div style={{ marginBottom: "14px" }}>
        <h4 style={{ fontSize: ".92rem", fontWeight: 600, color: "var(--text)", margin: "0 0 2px" }}>
          {icon} {title}
        </h4>
        <p style={{ fontSize: ".78rem", color: "var(--text-muted)", margin: 0 }}>{subtitle}</p>
      </div>

      <div style={{ display: "grid", gap: "8px" }}>
        {items.map((text, i) => {
          const key = `${groupKey}-${i}`;
          const isCopied = copied === key;
          return (
            <div
              key={i}
              style={{
                display: "flex", alignItems: "center", gap: "10px",
                padding: "12px 14px", borderRadius: "8px",
                background: "var(--bg)", border: "1px solid var(--border)",
                transition: "all .15s",
              }}
            >
              <span style={{
                width: "24px", height: "24px", borderRadius: "50%",
                background: "#ede9fe", color: "#7c3aed", fontSize: ".75rem",
                fontWeight: 700, display: "flex", alignItems: "center",
                justifyContent: "center", flexShrink: 0,
              }}>
                {i + 1}
              </span>
              <span style={{ flex: 1, fontSize: ".88rem", color: "var(--text)", lineHeight: 1.4 }}>
                {text}
              </span>
              <button
                onClick={() => onCopy(text, key)}
                title="Kopírovat"
                style={{
                  padding: "4px 10px", borderRadius: "6px", border: "1px solid var(--border)",
                  background: isCopied ? "#dcfce7" : "transparent",
                  color: isCopied ? "#16a34a" : "var(--text-muted)",
                  cursor: "pointer", fontSize: ".78rem", flexShrink: 0,
                  transition: "all .15s",
                }}
              >
                {isCopied ? "✓" : "📋"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Styly ─────────────────────────────────────────────────────────────────
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
