import { useState, useRef, useEffect, useCallback } from "react";
import { httpsCallable, getFunctions } from "firebase/functions";

const functions = getFunctions();

// FB formáty reklam
const AD_FORMATS = [
  { id: "feed_square",    label: "Feed čtverec",   w: 1080, h: 1080, ratio: "1:1" },
  { id: "feed_landscape", label: "Feed landscape",  w: 1200, h: 628,  ratio: "1.91:1" },
  { id: "story",          label: "Stories / Reels",  w: 1080, h: 1920, ratio: "9:16" },
];

const STYLE_OPTIONS = [
  { value: "moderní a čistý",       label: "Moderní" },
  { value: "odvážný a barevný",      label: "Odvážný" },
  { value: "minimalistický",         label: "Minimalistický" },
  { value: "luxusní a prémiový",     label: "Prémiový" },
  { value: "hravý a energický",      label: "Hravý" },
];

/**
 * Generátor vizuálních kreativ pro FB reklamy.
 * AI navrhne koncepty (barvy, texty, layout), Canvas je vykreslí.
 */
export default function AdCreativeGenerator() {
  const [form, setForm] = useState({
    productName: "",
    productDescription: "",
    style: "moderní a čistý",
  });
  const [concepts, setConcepts] = useState(null);
  const [selectedFormat, setSelectedFormat] = useState("feed_square");
  const [loading, setLoading] = useState(false);

  async function handleGenerate(e) {
    e.preventDefault();
    if (!form.productName) return;

    setLoading(true);
    setConcepts(null);

    try {
      const generate = httpsCallable(functions, "generateAdCreative");
      const { data } = await generate({
        ...form,
        formats: AD_FORMATS.map(f => f.id),
      });

      if (data.result?.concepts) {
        setConcepts(data.result.concepts);
      }
    } catch (err) {
      console.error("Creative generation error:", err);
      alert("Nepodařilo se vygenerovat kreativy. Zkus to znovu.");
    } finally {
      setLoading(false);
    }
  }

  const format = AD_FORMATS.find(f => f.id === selectedFormat) || AD_FORMATS[0];

  return (
    <div>
      {/* Formulář */}
      <form onSubmit={handleGenerate} style={{
        padding: "24px", borderRadius: "12px",
        background: "var(--bg-card)", border: "1px solid var(--border)",
        marginBottom: "24px",
      }}>
        <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text)", marginBottom: "16px" }}>
          Zadej informace pro kreativy
        </h3>

        <div style={{ display: "grid", gap: "16px" }}>
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

          <div>
            <label style={labelStyle}>Popis produktu</label>
            <textarea
              value={form.productDescription}
              onChange={e => setForm(f => ({ ...f, productDescription: e.target.value }))}
              placeholder="Klíčové benefity, USP, cílová skupina..."
              rows={2}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>

          <div>
            <label style={labelStyle}>Vizuální styl</label>
            <select
              value={form.style}
              onChange={e => setForm(f => ({ ...f, style: e.target.value }))}
              style={inputStyle}
            >
              {STYLE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !form.productName}
          style={{
            marginTop: "20px", padding: "12px 24px", borderRadius: "8px",
            border: "none", background: loading ? "#9ca3af" : "#7c3aed",
            color: "#fff", cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 600, fontSize: ".92rem",
            display: "flex", alignItems: "center", gap: "8px",
          }}
        >
          {loading ? <>⏳ Generuji kreativy...</> : <>🎨 Vygenerovat kreativy</>}
        </button>
      </form>

      {/* Výběr formátu */}
      {concepts && (
        <div style={{ marginBottom: "20px" }}>
          <p style={{ fontSize: ".82rem", fontWeight: 500, color: "var(--text-muted)", marginBottom: "8px" }}>
            Formát:
          </p>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {AD_FORMATS.map(f => (
              <button
                key={f.id}
                onClick={() => setSelectedFormat(f.id)}
                style={{
                  padding: "8px 14px", borderRadius: "8px",
                  border: selectedFormat === f.id ? "2px solid #7c3aed" : "1px solid var(--border)",
                  background: selectedFormat === f.id ? "#ede9fe" : "var(--bg-card)",
                  color: selectedFormat === f.id ? "#7c3aed" : "var(--text)",
                  cursor: "pointer", fontSize: ".82rem", fontWeight: 500,
                }}
              >
                {f.label} ({f.ratio})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Koncepty */}
      {concepts && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
          {concepts.map((concept, i) => (
            <CreativeCard key={i} concept={concept} format={format} index={i} />
          ))}
        </div>
      )}

      {/* Regenerate */}
      {concepts && (
        <button
          onClick={handleGenerate}
          disabled={loading}
          style={{
            marginTop: "20px", padding: "10px 20px", borderRadius: "8px",
            border: "1px solid var(--border)", background: "var(--bg-card)",
            color: "var(--text)", cursor: "pointer", fontSize: ".88rem",
            fontWeight: 500, display: "flex", alignItems: "center", gap: "6px",
          }}
        >
          🔄 Vygenerovat nové koncepty
        </button>
      )}
    </div>
  );
}

// ─── Karta jednoho konceptu s Canvas renderingem ───────────────────────────
function CreativeCard({ concept, format, index }) {
  const canvasRef = useRef(null);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Preview velikost (škálované)
    const maxPreviewWidth = 320;
    const scale = maxPreviewWidth / format.w;
    const previewW = Math.round(format.w * scale);
    const previewH = Math.round(format.h * scale);

    canvas.width = previewW;
    canvas.height = previewH;
    const ctx = canvas.getContext("2d");

    // Gradient pozadí
    const [c1, c2] = concept.bgGradient || ["#667eea", "#764ba2"];
    const grad = ctx.createLinearGradient(0, 0, previewW, previewH);
    grad.addColorStop(0, c1);
    grad.addColorStop(1, c2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, previewW, previewH);

    // Dekorativní prvky
    const accent = concept.accentColor || "#ffffff33";
    ctx.fillStyle = accent + "22";
    ctx.beginPath();
    ctx.arc(previewW * 0.85, previewH * 0.15, previewW * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(previewW * 0.1, previewH * 0.85, previewW * 0.2, 0, Math.PI * 2);
    ctx.fill();

    const textColor = concept.textColor || "#ffffff";
    const layout = concept.layout || "centered";
    const padding = previewW * 0.08;

    // Layout pozice
    let textX, textY, align;
    if (layout === "left-aligned") {
      textX = padding;
      textY = previewH * 0.35;
      align = "left";
    } else if (layout === "split") {
      textX = padding;
      textY = previewH * 0.5;
      align = "left";
    } else {
      textX = previewW / 2;
      textY = previewH * 0.3;
      align = "center";
    }

    ctx.textAlign = align;

    // Emoji
    if (concept.emoji) {
      ctx.font = `${Math.round(previewW * 0.12)}px sans-serif`;
      const emojiX = align === "center" ? previewW / 2 : padding;
      ctx.fillText(concept.emoji, emojiX, textY);
      textY += previewW * 0.15;
    }

    // Headline
    ctx.fillStyle = textColor;
    const headlineSize = Math.round(previewW * 0.085);
    ctx.font = `bold ${headlineSize}px -apple-system, "Segoe UI", sans-serif`;
    wrapText(ctx, concept.headline || "", textX, textY, previewW - padding * 2, headlineSize * 1.2);
    const headlineLines = Math.ceil((concept.headline || "").length / 15);
    textY += headlineSize * 1.2 * Math.max(headlineLines, 1) + 10;

    // Subtext
    if (concept.subtext) {
      const subtextSize = Math.round(previewW * 0.045);
      ctx.font = `${subtextSize}px -apple-system, "Segoe UI", sans-serif`;
      ctx.fillStyle = textColor + "cc";
      wrapText(ctx, concept.subtext, textX, textY, previewW - padding * 2, subtextSize * 1.3);
      textY += subtextSize * 2.5;
    }

    // CTA tlačítko
    if (concept.ctaText) {
      const ctaSize = Math.round(previewW * 0.04);
      ctx.font = `bold ${ctaSize}px -apple-system, "Segoe UI", sans-serif`;
      const ctaW = ctx.measureText(concept.ctaText).width + ctaSize * 3;
      const ctaH = ctaSize * 2.8;
      const ctaX = align === "center" ? (previewW - ctaW) / 2 : padding;
      const ctaY = textY + 10;

      // Rounded rect
      const r = ctaH / 2;
      ctx.fillStyle = concept.ctaBgColor || "#ffffff";
      ctx.beginPath();
      ctx.moveTo(ctaX + r, ctaY);
      ctx.lineTo(ctaX + ctaW - r, ctaY);
      ctx.quadraticCurveTo(ctaX + ctaW, ctaY, ctaX + ctaW, ctaY + r);
      ctx.lineTo(ctaX + ctaW, ctaY + ctaH - r);
      ctx.quadraticCurveTo(ctaX + ctaW, ctaY + ctaH, ctaX + ctaW - r, ctaY + ctaH);
      ctx.lineTo(ctaX + r, ctaY + ctaH);
      ctx.quadraticCurveTo(ctaX, ctaY + ctaH, ctaX, ctaY + ctaH - r);
      ctx.lineTo(ctaX, ctaY + r);
      ctx.quadraticCurveTo(ctaX, ctaY, ctaX + r, ctaY);
      ctx.fill();

      ctx.fillStyle = concept.ctaTextColor || "#000000";
      ctx.textAlign = "center";
      ctx.fillText(concept.ctaText, ctaX + ctaW / 2, ctaY + ctaH / 2 + ctaSize * 0.35);
    }
  }, [concept, format]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  function downloadFullSize() {
    const canvas = document.createElement("canvas");
    canvas.width = format.w;
    canvas.height = format.h;
    const ctx = canvas.getContext("2d");
    const scale = format.w / (canvasRef.current?.width || 320);

    // Re-render at full size
    const [c1, c2] = concept.bgGradient || ["#667eea", "#764ba2"];
    const grad = ctx.createLinearGradient(0, 0, format.w, format.h);
    grad.addColorStop(0, c1);
    grad.addColorStop(1, c2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, format.w, format.h);

    const accent = concept.accentColor || "#ffffff33";
    ctx.fillStyle = accent + "22";
    ctx.beginPath();
    ctx.arc(format.w * 0.85, format.h * 0.15, format.w * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(format.w * 0.1, format.h * 0.85, format.w * 0.2, 0, Math.PI * 2);
    ctx.fill();

    const textColor = concept.textColor || "#ffffff";
    const layout = concept.layout || "centered";
    const padding = format.w * 0.08;

    let textX, textY, align;
    if (layout === "left-aligned") {
      textX = padding; textY = format.h * 0.35; align = "left";
    } else if (layout === "split") {
      textX = padding; textY = format.h * 0.5; align = "left";
    } else {
      textX = format.w / 2; textY = format.h * 0.3; align = "center";
    }

    ctx.textAlign = align;

    if (concept.emoji) {
      ctx.font = `${Math.round(format.w * 0.12)}px sans-serif`;
      ctx.fillText(concept.emoji, align === "center" ? format.w / 2 : padding, textY);
      textY += format.w * 0.15;
    }

    ctx.fillStyle = textColor;
    const hs = Math.round(format.w * 0.085);
    ctx.font = `bold ${hs}px -apple-system, "Segoe UI", sans-serif`;
    wrapText(ctx, concept.headline || "", textX, textY, format.w - padding * 2, hs * 1.2);
    const hLines = Math.ceil((concept.headline || "").length / 15);
    textY += hs * 1.2 * Math.max(hLines, 1) + 10 * scale;

    if (concept.subtext) {
      const ss = Math.round(format.w * 0.045);
      ctx.font = `${ss}px -apple-system, "Segoe UI", sans-serif`;
      ctx.fillStyle = textColor + "cc";
      wrapText(ctx, concept.subtext, textX, textY, format.w - padding * 2, ss * 1.3);
      textY += ss * 2.5;
    }

    if (concept.ctaText) {
      const cs = Math.round(format.w * 0.04);
      ctx.font = `bold ${cs}px -apple-system, "Segoe UI", sans-serif`;
      const cw = ctx.measureText(concept.ctaText).width + cs * 3;
      const ch = cs * 2.8;
      const cx = align === "center" ? (format.w - cw) / 2 : padding;
      const cy = textY + 10 * scale;
      const r = ch / 2;

      ctx.fillStyle = concept.ctaBgColor || "#ffffff";
      ctx.beginPath();
      ctx.moveTo(cx + r, cy);
      ctx.lineTo(cx + cw - r, cy);
      ctx.quadraticCurveTo(cx + cw, cy, cx + cw, cy + r);
      ctx.lineTo(cx + cw, cy + ch - r);
      ctx.quadraticCurveTo(cx + cw, cy + ch, cx + cw - r, cy + ch);
      ctx.lineTo(cx + r, cy + ch);
      ctx.quadraticCurveTo(cx, cy + ch, cx, cy + ch - r);
      ctx.lineTo(cx, cy + r);
      ctx.quadraticCurveTo(cx, cy, cx + r, cy);
      ctx.fill();

      ctx.fillStyle = concept.ctaTextColor || "#000000";
      ctx.textAlign = "center";
      ctx.fillText(concept.ctaText, cx + cw / 2, cy + ch / 2 + cs * 0.35);
    }

    const link = document.createElement("a");
    link.download = `kreativa-${index + 1}-${format.id}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <div style={{
      borderRadius: "12px", overflow: "hidden",
      background: "var(--bg-card)", border: "1px solid var(--border)",
    }}>
      {/* Canvas preview */}
      <div style={{
        display: "flex", justifyContent: "center", alignItems: "center",
        background: "#1a1a2e", padding: "12px",
      }}>
        <canvas
          ref={canvasRef}
          style={{ borderRadius: "8px", maxWidth: "100%", height: "auto" }}
        />
      </div>

      {/* Info + akce */}
      <div style={{ padding: "14px" }}>
        <p style={{ fontWeight: 600, fontSize: ".9rem", color: "var(--text)", margin: "0 0 4px" }}>
          {concept.name || `Koncept ${index + 1}`}
        </p>
        <p style={{ fontSize: ".78rem", color: "var(--text-muted)", margin: "0 0 12px" }}>
          {concept.mood || ""}  •  {format.w}×{format.h}px
        </p>

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={downloadFullSize}
            style={{
              flex: 1, padding: "8px", borderRadius: "8px",
              border: "none", background: "#7c3aed", color: "#fff",
              cursor: "pointer", fontSize: ".82rem", fontWeight: 500,
            }}
          >
            ⬇ Stáhnout PNG
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Pomocná funkce: text wrap pro Canvas ───────────────────────────────────
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  let currentY = y;

  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i] + " ";
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && i > 0) {
      ctx.fillText(line.trim(), x, currentY);
      line = words[i] + " ";
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), x, currentY);
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
