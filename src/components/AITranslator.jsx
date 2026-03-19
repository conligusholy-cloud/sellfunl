import { useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { addDoc, collection } from "firebase/firestore";
import { app, db } from "../firebase/config";

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

function buildTranslatePrompt(langName, page, hero, formFields) {
  return `Jsi profesionální překladatel. Přelož VEŠKERÝ text do jazyka: ${langName}.

DŮLEŽITÉ PRAVIDLA:
- Zachovej veškeré HTML tagy v poli "text" beze změny
- Přelož POUZE textový obsah, ne HTML atributy
- Vrať POUZE čistý JSON bez markdown backticks
- Emoji ponechej beze změny
- Pole formFields přelož jako pole stringů

Přelož tato pole:
{
  "name": ${JSON.stringify(page.name || "")},
  "headline": ${JSON.stringify(page.headline || "")},
  "subline": ${JSON.stringify(page.subline || "")},
  "text": ${JSON.stringify(page.text || "")},
  "btnText": ${JSON.stringify(page.btnText || "")},
  "price": ${JSON.stringify(page.price || "")},
  "formFields": ${JSON.stringify(formFields || ["Jméno", "Email"])},
  "hero": {
    "badgeText": ${JSON.stringify(hero.badgeText || "")},
    "h1Line1": ${JSON.stringify(hero.h1Line1 || "")},
    "h1Accent": ${JSON.stringify(hero.h1Accent || "")},
    "h1Line2": ${JSON.stringify(hero.h1Line2 || "")},
    "subText": ${JSON.stringify(hero.subText || "")},
    "btn1Text": ${JSON.stringify(hero.btn1Text || "")},
    "btn2Text": ${JSON.stringify(hero.btn2Text || "")}
  }
}

Vrať přesně stejnou strukturu JSON s přeloženými hodnotami.`;
}

// ─── Hlavní komponenta ────────────────────────────────────────────────────────
// Props:
//   page       — aktuální data stránky
//   hero       — aktuální hero data
//   currentLang — kód aktuálního jazyka
//   userId     — uid uživatele
//   onClose    — zavření
//   onNavigate — callback pro přesměrování na novou stránku (id)

export default function AITranslator({ page, hero, currentLang, userId, formFields, onFormFieldsChange, onClose, onNavigate }) {
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [progress, setProgress] = useState("");

  const available = LANGUAGES.filter(l => l.code !== currentLang);

  async function handleTranslate(targetLang) {
    setLoading(true);
    setError("");
    setProgress(`Překládám do ${targetLang.name}...`);

    try {
      const fn  = httpsCallable(getFunctions(app), "translate");
      const res = await fn({
        prompt: buildTranslatePrompt(targetLang.name, page, hero, formFields),
        max_tokens: 4000,
      });

      const raw = (res.data.result || "").trim();
      console.log("AITranslator — raw:", raw);

      // Bezpečné parsování
      let parsed;
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("AI nevrátila JSON.");
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        const fixed = jsonMatch[0].replace(/,\s*"[^"]*":\s*"[^"]*$/, "").replace(/,?\s*$/, "") + "}}";
        parsed = JSON.parse(fixed);
      }

      console.log("AITranslator — parsed:", parsed);

      // Ulož přeložené formFields do stavu
      if (parsed.formFields && Array.isArray(parsed.formFields)) {
        onFormFieldsChange?.(parsed.formFields);
      }

      // Sestav novou stránku
      const currentLangObj = LANGUAGES.find(l => l.code === currentLang);
      const newPage = {
        ...page,
        name:     parsed.name     || page.name,
        headline: parsed.headline || page.headline,
        subline:  parsed.subline  || page.subline,
        text:     parsed.text     || page.text,
        btnText:  parsed.btnText  || page.btnText,
        price:    parsed.price    || page.price,
        formFields: parsed.formFields || formFields,
        uid:      userId,
        createdAt: Date.now(),
        published: false,
        // Přidej přeloženou Hero sekci
        hero: parsed.hero ? {
          ...hero,
          badgeText: parsed.hero.badgeText || hero.badgeText,
          h1Line1:   parsed.hero.h1Line1   || hero.h1Line1,
          h1Accent:  parsed.hero.h1Accent  || hero.h1Accent,
          h1Line2:   parsed.hero.h1Line2   || hero.h1Line2,
          subText:   parsed.hero.subText   || hero.subText,
          btn1Text:  parsed.hero.btn1Text  || hero.btn1Text,
          btn2Text:  parsed.hero.btn2Text  || hero.btn2Text,
        } : hero,
        heroes: parsed.hero ? {
          full: {
            ...hero,
            badgeText: parsed.hero.badgeText || hero.badgeText,
            h1Line1:   parsed.hero.h1Line1   || hero.h1Line1,
            h1Accent:  parsed.hero.h1Accent  || hero.h1Accent,
            h1Line2:   parsed.hero.h1Line2   || hero.h1Line2,
            subText:   parsed.hero.subText   || hero.subText,
            btn1Text:  parsed.hero.btn1Text  || hero.btn1Text,
            btn2Text:  parsed.hero.btn2Text  || hero.btn2Text,
          }
        } : { full: hero },
      };

      // Odstraň id před uložením
      delete newPage.id;

      setProgress("Ukládám přeloženou stránku...");
      const ref = await addDoc(collection(db, "pages"), newPage);

      console.log("AITranslator — nová stránka:", ref.id);
      onNavigate(ref.id);

    } catch (err) {
      console.error("AITranslator — chyba:", err);
      setError("Překlad selhal: " + (err.message || "Neznámá chyba."));
    } finally {
      setLoading(false);
      setProgress("");
    }
  }

  return (
    <div style={{ marginTop:"9px" }}>

      {/* Loading stav */}
      {loading && (
        <div style={{ padding:"12px", background:"#ede9fe", border:"1px solid #c4b5fd", borderRadius:"9px", marginBottom:"8px" }}>
          <div style={{ fontSize:".8rem", fontWeight:600, color:"#7c3aed", marginBottom:"6px" }}>
            🌍 {progress}
          </div>
          <div style={{ height:"3px", background:"#ddd6fe", borderRadius:"2px", overflow:"hidden" }}>
            <div style={{ height:"100%", background:"#7c3aed", borderRadius:"2px", animation:"trProg 1.5s ease-in-out infinite alternate" }}/>
            <style>{`@keyframes trProg{from{width:10%;margin-left:0}to{width:65%;margin-left:35%}}`}</style>
          </div>
          <div style={{ fontSize:".72rem", color:"#a78bfa", marginTop:"6px" }}>
            Překládám: název, nadpisy, obsah, Hero sekci, tlačítka...
          </div>
        </div>
      )}

      {/* Chyba */}
      {error && (
        <div style={{ padding:"7px 10px", background:"#fee2e2", border:"1px solid #fca5a5", borderRadius:"7px", fontSize:".8rem", color:"#b91c1c", marginBottom:"8px" }}>
          ⚠️ {error}
        </div>
      )}

      {/* Jazyky */}
      {!loading && (
        <>
          <p style={{ fontSize:".75rem", color:"var(--text-muted)", marginBottom:"7px" }}>
            Vyber cílový jazyk — přeloží celou stránku včetně Hero sekce:
          </p>
          <div style={{ display:"flex", flexWrap:"wrap", gap:"5px" }}>
            {available.map(lang => (
              <button
                key={lang.code}
                onClick={() => handleTranslate(lang)}
                style={{
                  padding:"5px 10px", borderRadius:"7px",
                  border:"1px solid var(--border)",
                  background:"var(--bg-card)",
                  cursor:"pointer", fontSize:".82rem",
                  transition:"all .15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#7c3aed"; e.currentTarget.style.background = "#ede9fe"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--bg-card)"; }}
              >
                {lang.flag} {lang.name}
              </button>
            ))}
          </div>
          <button
            onClick={onClose}
            style={{ marginTop:"8px", fontSize:".78rem", color:"var(--text-muted)", background:"none", border:"none", cursor:"pointer" }}>
            Zrušit
          </button>
        </>
      )}
    </div>
  );
}