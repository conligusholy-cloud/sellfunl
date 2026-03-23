import { useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../firebase/config";

const LANGUAGES = [
  { code:"cs", name:"Čeština" }, { code:"sk", name:"Slovenština" },
  { code:"en", name:"Angličtina" }, { code:"de", name:"Němčina" },
  { code:"pl", name:"Polština" }, { code:"fr", name:"Francouzština" },
  { code:"hu", name:"Maďarština" }, { code:"es", name:"Španělština" },
  { code:"it", name:"Italština" },
];

function buildPrompt(input, langName) {
  return `Jsi expert copywriter. Vytvoř kompletní prodejní stránku v jazyce ${langName} pro: "${input}".

DŮLEŽITÉ: Vrať POUZE čistý JSON bez jakýchkoliv markdown znaků, bez backticks, bez \`\`\`json.
Přesně tento formát:
{
  "name": "název stránky 3-5 slov",
  "headline": "silný nadpis max 8 slov",
  "subline": "podnadpis max 15 slov",
  "text": "<h2>Nadpis sekce</h2><p>Text odstavce s <strong>důrazem</strong> a emoji 🔥</p><ul><li>benefit 1</li><li>benefit 2</li><li>benefit 3</li></ul><h2>Proč zvolit nás?</h2><p>Další text...</p><blockquote>Citát zákazníka - Jan N.</blockquote>",
  "btnText": "CTA text max 5 slov 🔥",
  "hero": {
    "badgeText": "⚡ badge text max 4 slova",
    "h1Line1": "jedno až dvě slova",
    "h1Accent": "dva tři slova barevně",
    "h1Line2": "dva čtyři slova",
    "subText": "podnadpis hero max 15 slov bez zaměstnanců",
    "btn1Text": "primární tlačítko →",
    "btn2Text": "▶ sekundární tlačítko"
  }
}`;
}

export default function AIPageGenerator({ lang = "cs", onGenerated, onClose }) {
  const [topic,   setTopic]   = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [done,    setDone]    = useState(false);

  const langName = LANGUAGES.find(l => l.code === lang)?.name || "Čeština";

  async function handleGenerate() {
    if (!topic.trim()) { setError("Zadej popis produktu nebo tématu."); return; }
    setError("");
    setLoading(true);
    setDone(false);

    try {
      const fn  = httpsCallable(getFunctions(app), "translate");
      const res = await fn({ prompt: buildPrompt(topic, langName), max_tokens: 4000 });
      const raw = (res.data.result || "").trim();

      console.log("AIPageGenerator — raw odpověď:", raw);

      let parsed;
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("AI nevrátila JSON.");

      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        const fixed = jsonMatch[0]
          .replace(/,\s*"[^"]*":\s*"[^"]*$/, "")
          .replace(/,?\s*$/, "") + "}}";
        parsed = JSON.parse(fixed);
      }

      const pageData = {
        name:    parsed.name     || "",
        headline:parsed.headline || "",
        subline: parsed.subline  || "",
        text:    parsed.text     || "",
        btnText: parsed.btnText  || "",
      };

      let heroData = null;
      if (parsed.hero && typeof parsed.hero === "object") {
        const h = parsed.hero;
        heroData = {
          showBadge: true,
          badgeText: h.badgeText || "⚡ Speciální nabídka",
          showH1:    true,
          h1Line1:   h.h1Line1  || parsed.headline?.split(" ").slice(0,2).join(" ") || "",
          h1Accent:  h.h1Accent || parsed.headline?.split(" ").slice(2,4).join(" ") || "",
          h1Line2:   h.h1Line2  || parsed.headline?.split(" ").slice(4).join(" ")   || "",
          showSub:   true,
          subText:   h.subText  || parsed.subline || "",
          btn1:      true,
          btn1Text:  h.btn1Text || parsed.btnText || "Chci produkt →",
          btn2:      true,
          btn2Text:  h.btn2Text || "▶ Zjistit více",
        };
      } else {
        const words = (parsed.headline || "").split(" ");
        const third = Math.ceil(words.length / 3);
        heroData = {
          showBadge: true,
          badgeText: "⚡ Speciální nabídka",
          showH1:    true,
          h1Line1:   words.slice(0, third).join(" "),
          h1Accent:  words.slice(third, third * 2).join(" "),
          h1Line2:   words.slice(third * 2).join(" "),
          showSub:   true,
          subText:   parsed.subline || "",
          btn1:      true,
          btn1Text:  parsed.btnText || "Chci produkt →",
          btn2:      true,
          btn2Text:  "▶ Zjistit více",
        };
      }

      setDone(true);
      onGenerated({ page: pageData, hero: heroData });

    } catch (err) {
      console.error("AIPageGenerator — chyba:", err);
      setError("Generování selhalo: " + (err.message || "Neznámá chyba."));
    } finally {
      setLoading(false);
    }
  }

  const S = {
    input: { width:"100%", padding:"8px 11px", border:"1px solid #c4b5fd", borderRadius:"8px", background:"#faf8ff", color:"#1e1b4b", fontSize:".88rem", outline:"none", fontFamily:"inherit", boxSizing:"border-box" },
    btnPrim: { padding:"9px 18px", fontSize:".85rem", fontWeight:700, border:"none", borderRadius:"8px", cursor:"pointer", background:"linear-gradient(90deg,#7c3aed,#a78bfa)", color:"#fff", opacity: loading ? .7 : 1 },
    btnOut:  { padding:"9px 14px", fontSize:".85rem", fontWeight:600, border:"1px solid #7c3aed", borderRadius:"8px", cursor:"pointer", background:"transparent", color:"#7c3aed" },
  };

  return (
    <div style={{ background:"linear-gradient(135deg,#f5f3ff,#ede9fe)", border:"1px solid #c4b5fd", borderRadius:"12px", padding:"16px", marginBottom:"12px" }}>

      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"12px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"7px" }}>
          <span style={{ fontSize:"18px" }}>✨</span>
          <div>
            <div style={{ fontSize:".85rem", fontWeight:700, color:"#7c3aed" }}>AI generátor celé stránky</div>
            <div style={{ fontSize:".72rem", color:"#a78bfa" }}>Hero sekce + obsah + CTA najednou</div>
          </div>
        </div>
        <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"#a78bfa", fontSize:"18px", lineHeight:1 }}>✕</button>
      </div>

      <div style={{ fontSize:".72rem", color:"#7c3aed", marginBottom:"8px", fontWeight:600 }}>
        Generuje v jazyce: <strong>{langName}</strong>
      </div>

      <textarea
        value={topic}
        onChange={e => { setTopic(e.target.value); setError(""); setDone(false); }}
        placeholder="Popiš produkt nebo téma..."
        rows={3}
        style={{ ...S.input, resize:"vertical", minHeight:"72px", marginBottom:"8px" }}
      />

      {error && (
        <div style={{ padding:"7px 10px", background:"#fee2e2", border:"1px solid #fca5a5", borderRadius:"7px", fontSize:".8rem", color:"#b91c1c", marginBottom:"8px" }}>
          ⚠️ {error}
        </div>
      )}

      {done && !error && (
        <div style={{ padding:"7px 10px", background:"#d1fae5", border:"1px solid #6ee7b7", borderRadius:"7px", fontSize:".8rem", color:"#065f46", marginBottom:"8px" }}>
          ✅ Stránka vygenerována — Hero sekce, obsah i CTA jsou nastaveny!
        </div>
      )}

      {loading && (
        <>
          <div style={{ height:"3px", background:"#ddd6fe", borderRadius:"2px", marginBottom:"8px", overflow:"hidden" }}>
            <div style={{ height:"100%", background:"#7c3aed", borderRadius:"2px", animation:"aiProg 1.5s ease-in-out infinite alternate" }}/>
            <style>{`@keyframes aiProg{from{width:10%;margin-left:0}to{width:60%;margin-left:40%}}`}</style>
          </div>
          <div style={{ display:"flex", gap:"5px", flexWrap:"wrap", marginBottom:"8px" }}>
            {["🏠 Hero sekce","📝 Nadpisy","📄 Obsah","🔘 CTA tlačítka"].map((s,i) => (
              <span key={i} style={{ fontSize:".7rem", padding:"2px 8px", borderRadius:"10px", background:"#ede9fe", color:"#7c3aed", fontWeight:600 }}>{s}</span>
            ))}
          </div>
        </>
      )}

      <div style={{ display:"flex", gap:"8px", justifyContent:"flex-end" }}>
        <button style={S.btnOut} onClick={onClose} disabled={loading}>Zrušit</button>
        <button style={S.btnPrim} onClick={handleGenerate} disabled={loading || !topic.trim()}>
          {loading ? "⏳ Generuji..." : done ? "🔄 Generovat znovu" : "✨ Vygenerovat stránku"}
        </button>
      </div>
    </div>
  );
}