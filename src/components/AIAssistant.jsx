import { useState, useRef, useEffect } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "../firebase/config";

const SYSTEM_PROMPT = `Jsi AI asistent pro platformu Sellfunl — nástroj pro tvorbu prodejních stránek a funnel marketingu.

Pomáháš uživatelům s:
- Tvorbou a editací stránek (Hero sekce, obsah, CTA tlačítka)
- Nastavením platební brány Stripe
- Publikováním stránek a vlastní doménou
- AI generátorem stránek a překladem
- Nastavením formulářů, emailingových integrací (Mailchimp, ActiveCampaign)
- Obecnými dotazy o funnel marketingu a copywritingu

Pravidla:
- Odpovídej vždy v češtině, stručně a přátelsky
- Používej emoji pro lepší přehlednost
- NIKDY nevyzrazuj technické detaily jako: API klíče, strukturu databáze, názvy Firebase kolekcí, kód aplikace, interní URL endpointy
- Pokud se tě někdo ptá na interní technické detaily systému, řekni že tyto informace nejsou veřejné
- Maximální délka odpovědi je 150 slov
- Buď konkrétní a praktický — dávej přesné kroky`;

const SUGGESTED_QUESTIONS = [
  "Jak vytvořím novou stránku?",
  "Jak napojím Stripe platby?",
  "Jak publikuji stránku?",
  "Co je Hero sekce?",
  "Jak přidám vlastní doménu?",
  "Jak použít AI generátor?",
  "Jak nastavím formulář?",
  "Jak přeložím stránku?",
];

export default function AIAssistant() {
  const [open,     setOpen]     = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Ahoj! 👋 Jsem tvůj AI asistent pro Sellfunl. Jak ti mohu pomoci?" }
  ]);
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [pulse,    setPulse]    = useState(true);
  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);

  useEffect(() => { if (open) setPulse(false); }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200);
  }, [open]);

  async function sendMessage(text) {
    if (!text.trim() || loading) return;
    const userMsg = text.trim();
    setInput("");
    setMessages(m => [...m, { role: "user", text: userMsg }]);
    setLoading(true);

    try {
      const history = messages.map(m => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.text,
      }));

      const fn = httpsCallable(getFunctions(app), "translate");
      const fullPrompt = `${SYSTEM_PROMPT}\n\n---\nHistorie konverzace:\n${history.map(m => `${m.role === "assistant" ? "Asistent" : "Uživatel"}: ${m.content}`).join("\n")}\n\nUživatel: ${userMsg}\n\nAsistent:`;

      const res = await fn({ prompt: fullPrompt, max_tokens: 400 });
      const reply = res.data.result?.trim() || "Omlouvám se, nepodařilo se mi odpovědět. Zkus to znovu.";
      setMessages(m => [...m, { role: "assistant", text: reply }]);
    } catch {
      setMessages(m => [...m, { role: "assistant", text: "⚠️ Něco se pokazilo. Zkus to prosím znovu." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
        @keyframes sfPulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(251,191,36,.6), 0 4px 20px rgba(0,0,0,.3); }
          50%      { box-shadow: 0 0 0 12px rgba(251,191,36,.0), 0 4px 20px rgba(0,0,0,.3); }
        }
        @keyframes sfFadeIn {
          from { opacity:0; transform: scale(.95) translateY(10px); }
          to   { opacity:1; transform: scale(1) translateY(0); }
        }
        @keyframes sfBounce {
          0%,80%,100% { transform: scale(0); }
          40%          { transform: scale(1); }
        }
        .sf-dot { width:7px; height:7px; border-radius:50%; background:#a78bfa; display:inline-block; animation: sfBounce 1.2s infinite ease-in-out; }
        .sf-dot:nth-child(1) { animation-delay: -0.32s; }
        .sf-dot:nth-child(2) { animation-delay: -0.16s; }
        .sf-msg-user { background: linear-gradient(135deg,#7c3aed,#a78bfa); color:#fff; border-radius:16px 16px 4px 16px; padding:9px 13px; max-width:82%; font-size:.85rem; line-height:1.5; align-self:flex-end; word-break:break-word; }
        .sf-msg-ai   { background: var(--bg,#fff); border:1px solid var(--border,#e5e7eb); color:var(--text,#1e1b4b); border-radius:16px 16px 16px 4px; padding:9px 13px; max-width:88%; font-size:.85rem; line-height:1.5; align-self:flex-start; word-break:break-word; }
      `}</style>

      {/* ── Animovaný panáček ── */}
      <style>{`
        @keyframes sfWave {
          0%,100% { transform: rotate(0deg); }
          20%      { transform: rotate(-25deg); }
          40%      { transform: rotate(15deg); }
          60%      { transform: rotate(-20deg); }
          80%      { transform: rotate(10deg); }
        }
        @keyframes sfFloat {
          0%,100% { transform: translateY(0px); }
          50%      { transform: translateY(-6px); }
        }
        @keyframes sfQBounce {
          0%,100% { transform: scale(1) rotate(-5deg); }
          50%      { transform: scale(1.15) rotate(5deg); }
        }
        .sf-arm { transform-origin: 10px 4px; animation: sfWave 2s ease-in-out infinite; }
        .sf-body-wrap { animation: sfFloat 3s ease-in-out infinite; }
        .sf-qmark { animation: sfQBounce 1.5s ease-in-out infinite; }
      `}</style>
      <div
        onClick={() => setOpen(v => !v)}
        style={{
          position: "fixed", top: "16px", right: "16px", zIndex: 9998,
          cursor: "pointer", userSelect: "none",
          display: "flex", flexDirection: "column", alignItems: "center",
          filter: "drop-shadow(0 4px 12px rgba(0,0,0,.25))",
        }}
        onMouseEnter={e => e.currentTarget.style.filter = "drop-shadow(0 6px 16px rgba(124,58,237,.4))"}
        onMouseLeave={e => e.currentTarget.style.filter = "drop-shadow(0 4px 12px rgba(0,0,0,.25))"}
        title="AI asistent — klikni pro pomoc"
      >
        <svg width="72" height="90" viewBox="0 0 72 90" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g className="sf-body-wrap">
            {/* Hlava */}
            <ellipse cx="36" cy="16" rx="13" ry="14" fill="#FDDBB4" />
            {/* Vlasy */}
            <ellipse cx="36" cy="5" rx="13" ry="6" fill="#1a1a2e" />
            <rect x="23" y="5" width="4" height="8" rx="2" fill="#1a1a2e" />
            <rect x="45" y="5" width="4" height="8" rx="2" fill="#1a1a2e" />
            {/* Obličej — oči */}
            <ellipse cx="30" cy="15" rx="2" ry="2.5" fill="#1a1a2e" />
            <ellipse cx="42" cy="15" rx="2" ry="2.5" fill="#1a1a2e" />
            {/* Lesk v očích */}
            <circle cx="31" cy="14" r="0.8" fill="#fff" />
            <circle cx="43" cy="14" r="0.8" fill="#fff" />
            {/* Úsměv */}
            <path d="M30 22 Q36 27 42 22" stroke="#c97b4b" strokeWidth="1.5" strokeLinecap="round" fill="none" />
            {/* Oblek — tělo */}
            <rect x="22" y="29" width="28" height="30" rx="5" fill="#1e1b4b" />
            {/* Košile bílá */}
            <rect x="33" y="29" width="6" height="30" fill="#fff" />
            {/* Knoflíky */}
            <circle cx="36" cy="34" r="1" fill="#c4b5fd" />
            <circle cx="36" cy="39" r="1" fill="#c4b5fd" />
            <circle cx="36" cy="44" r="1" fill="#c4b5fd" />
            {/* Motýlek */}
            <path d="M31 31 L33 33 L31 35 Z" fill="#f59e0b" />
            <path d="M41 31 L39 33 L41 35 Z" fill="#f59e0b" />
            <circle cx="36" cy="33" r="1.5" fill="#fbbf24" />
            {/* Límec */}
            <path d="M29 29 L36 34 L43 29" fill="#fff" />
            {/* Levá ruka — mávající */}
            <g className="sf-arm" style={{ transformOrigin: "22px 32px" }}>
              <rect x="8" y="30" width="14" height="6" rx="3" fill="#1e1b4b" />
              {/* Rukavička / ruka */}
              <ellipse cx="9" cy="33" rx="5" ry="5" fill="#FDDBB4" />
              {/* Otazník v ruce */}
              <g className="sf-qmark">
                <circle cx="9" cy="33" r="8" fill="#f59e0b" opacity="0.9" />
                <text x="9" y="37" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#1a1a2e">?</text>
              </g>
            </g>
            {/* Pravá ruka */}
            <rect x="50" y="30" width="14" height="6" rx="3" fill="#1e1b4b" />
            <ellipse cx="63" cy="33" rx="5" ry="5" fill="#FDDBB4" />
            {/* Nohavice */}
            <rect x="22" y="57" width="12" height="20" rx="4" fill="#1e1b4b" />
            <rect x="38" y="57" width="12" height="20" rx="4" fill="#1e1b4b" />
            {/* Boty */}
            <ellipse cx="28" cy="77" rx="9" ry="5" fill="#111" />
            <ellipse cx="44" cy="77" rx="9" ry="5" fill="#111" />
            {/* Lesk bot */}
            <ellipse cx="25" cy="75" rx="3" ry="1.5" fill="#444" />
            <ellipse cx="41" cy="75" rx="3" ry="1.5" fill="#444" />
          </g>
        </svg>
        {/* Popisek */}
        {!open && (
          <div style={{
            background: "linear-gradient(135deg,#7c3aed,#a78bfa)",
            color: "#fff", fontSize: ".7rem", fontWeight: 700,
            padding: "3px 10px", borderRadius: "20px", marginTop: "-4px",
            boxShadow: "0 2px 8px rgba(124,58,237,.4)",
            whiteSpace: "nowrap",
          }}>
            Potřebuješ pomoc?
          </div>
        )}
      </div>

      {/* ── Chat okno ── */}
      {open && (
        <div style={{
          position: "fixed", top: "110px", right: "16px", zIndex: 9997,
          width: "340px", maxWidth: "calc(100vw - 48px)",
          background: "var(--bg-card, #fff)",
          border: "1px solid var(--border, #e5e7eb)",
          borderRadius: "20px",
          boxShadow: "0 20px 60px rgba(0,0,0,.18), 0 4px 20px rgba(0,0,0,.1)",
          display: "flex", flexDirection: "column", overflow: "hidden",
          animation: "sfFadeIn .2s ease",
          maxHeight: "520px",
        }}>

          {/* Header */}
          <div style={{
            padding: "14px 16px",
            background: "linear-gradient(135deg, #f59e0b, #fbbf24, #f97316)",
            display: "flex", alignItems: "center", gap: "10px",
          }}>
            <div style={{
              width: "36px", height: "36px", borderRadius: "50%",
              background: "rgba(255,255,255,.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "18px", flexShrink: 0,
            }}>✨</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: ".9rem", fontWeight: 700, color: "#fff" }}>Sellfunl Asistent</div>
              <div style={{ fontSize: ".72rem", color: "rgba(255,255,255,.8)", display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#4ade80", display: "inline-block" }} />
                Online — připraven pomoci
              </div>
            </div>
            <button onClick={() => setOpen(false)}
              style={{ background: "rgba(255,255,255,.2)", border: "none", borderRadius: "50%", width: "28px", height: "28px", cursor: "pointer", color: "#fff", fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              ✕
            </button>
          </div>

          {/* Zprávy */}
          <div style={{
            flex: 1, overflowY: "auto", padding: "14px 12px",
            display: "flex", flexDirection: "column", gap: "8px",
            minHeight: "200px",
          }}>
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "sf-msg-user" : "sf-msg-ai"}>
                {m.text}
              </div>
            ))}
            {loading && (
              <div className="sf-msg-ai" style={{ display: "flex", gap: "4px", alignItems: "center", padding: "12px 14px" }}>
                <span className="sf-dot" /><span className="sf-dot" /><span className="sf-dot" />
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Návrhy otázek */}
          {messages.length <= 2 && !loading && (
            <div style={{ padding: "0 12px 8px", display: "flex", flexWrap: "wrap", gap: "5px" }}>
              {SUGGESTED_QUESTIONS.slice(0, 4).map((q, i) => (
                <button key={i} onClick={() => sendMessage(q)}
                  style={{
                    padding: "4px 10px", fontSize: ".75rem", border: "1px solid #fbbf24",
                    borderRadius: "20px", background: "#fffbeb", color: "#92400e",
                    cursor: "pointer", fontWeight: 500, transition: "background .15s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "#fef3c7"}
                  onMouseLeave={e => e.currentTarget.style.background = "#fffbeb"}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{
            padding: "10px 12px",
            borderTop: "1px solid var(--border, #e5e7eb)",
            display: "flex", gap: "7px", alignItems: "center",
            background: "var(--bg, #fff)",
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
              placeholder="Napiš dotaz..."
              style={{
                flex: 1, padding: "8px 12px",
                border: "1px solid var(--border, #e5e7eb)",
                borderRadius: "20px", fontSize: ".85rem",
                background: "var(--input-bg, #f9fafb)",
                color: "var(--text, #1e1b4b)",
                outline: "none", fontFamily: "inherit",
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              style={{
                width: "36px", height: "36px", borderRadius: "50%", border: "none",
                background: input.trim() && !loading ? "linear-gradient(135deg,#f59e0b,#f97316)" : "var(--border,#e5e7eb)",
                color: input.trim() && !loading ? "#fff" : "var(--text-muted,#9ca3af)",
                cursor: input.trim() && !loading ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "16px", flexShrink: 0, transition: "all .15s",
              }}
            >→</button>
          </div>
        </div>
      )}
    </>
  );
}