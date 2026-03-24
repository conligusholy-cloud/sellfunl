import { useState, useRef, useEffect, useCallback } from "react";
import { httpsCallable, getFunctions } from "firebase/functions";

const functions = getFunctions();

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

export default function AdCreativeGenerator() {
  const [form, setForm] = useState({
    productName: "",
    productDescription: "",
    style: "moderní a čistý",
  });
  const [concepts, setConcepts] = useState(null);
  const [selectedFormat, setSelectedFormat] = useState("feed_square");
  const [loading, setLoading] = useState(false);
  const [userImage, setUserImage] = useState(null); // { src: string, file: File }

  function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setUserImage({ src: reader.result, file });
    reader.readAsDataURL(file);
  }

  function removeImage() {
    setUserImage(null);
  }

  async function handleGenerate(e) {
    e.preventDefault();
    if (!form.productName) return;
    setLoading(true);
    setConcepts(null);
    try {
      const generate = httpsCallable(functions, "generateAdCreative");
      const { data } = await generate({ ...form, formats: AD_FORMATS.map(f => f.id) });
      if (data.result?.concepts) setConcepts(data.result.concepts);
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
              type="text" value={form.productName}
              onChange={e => setForm(f => ({ ...f, productName: e.target.value }))}
              placeholder="např. SellFunl — tvorba landing pages"
              style={inputStyle} required
            />
          </div>
          <div>
            <label style={labelStyle}>Popis produktu</label>
            <textarea
              value={form.productDescription}
              onChange={e => setForm(f => ({ ...f, productDescription: e.target.value }))}
              placeholder="Klíčové benefity, USP, cílová skupina..."
              rows={2} style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={labelStyle}>Vizuální styl</label>
              <select value={form.style}
                onChange={e => setForm(f => ({ ...f, style: e.target.value }))}
                style={inputStyle}
              >
                {STYLE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Vlastní obrázek (volitelné)</label>
              {!userImage ? (
                <label style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  gap: "6px", padding: "10px 12px", borderRadius: "8px",
                  border: "1px dashed var(--border)", background: "var(--bg)",
                  color: "var(--text-muted)", fontSize: ".85rem", cursor: "pointer",
                }}>
                  📷 Nahrát obrázek
                  <input type="file" accept="image/*" onChange={handleImageUpload}
                    style={{ display: "none" }}
                  />
                </label>
              ) : (
                <div style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  padding: "6px 12px", borderRadius: "8px",
                  border: "1px solid var(--border)", background: "var(--bg)",
                }}>
                  <img src={userImage.src} alt="" style={{
                    width: "32px", height: "32px", borderRadius: "4px", objectFit: "cover",
                  }} />
                  <span style={{ flex: 1, fontSize: ".82rem", color: "var(--text)" }}>
                    {userImage.file.name}
                  </span>
                  <button type="button" onClick={removeImage} style={{
                    border: "none", background: "transparent", color: "#ef4444",
                    cursor: "pointer", fontSize: ".9rem",
                  }}>✕</button>
                </div>
              )}
            </div>
          </div>
        </div>

        <button type="submit" disabled={loading || !form.productName}
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
              <button key={f.id} onClick={() => setSelectedFormat(f.id)}
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
            <CreativeCard key={`${i}-${selectedFormat}`} concept={concept}
              format={format} index={i} userImage={userImage}
            />
          ))}
        </div>
      )}

      {concepts && (
        <button onClick={handleGenerate} disabled={loading}
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

// ─── Render kreativy na Canvas ─────────────────────────────────────────────
function renderCreative(ctx, concept, w, h, userImg) {
  // Gradient pozadí
  const [c1, c2] = concept.bgGradient || ["#667eea", "#764ba2"];
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, c1);
  grad.addColorStop(1, c2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Dekorativní kruhy
  const accent = concept.accentColor || "#ffffff";
  ctx.fillStyle = accent + "18";
  ctx.beginPath();
  ctx.arc(w * 0.85, h * 0.12, w * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(w * 0.08, h * 0.88, w * 0.18, 0, Math.PI * 2);
  ctx.fill();

  const textColor = concept.textColor || "#ffffff";
  const layout = concept.layout || "centered";
  const padding = w * 0.08;
  const isLandscape = w / h > 1.5;
  const isStory = h / w > 1.5;

  // User image
  const hasImage = !!userImg;
  let textAreaX = padding;
  let textAreaW = w - padding * 2;
  let textStartY;

  if (hasImage && layout === "split") {
    // Split: obrázek vlevo/nahoře, text vpravo/dole
    if (isLandscape) {
      // Landscape: obrázek vlevo
      const imgW = w * 0.4;
      ctx.drawImage(userImg, 0, 0, imgW, h);
      textAreaX = imgW + padding * 0.5;
      textAreaW = w - imgW - padding * 1.5;
      textStartY = h * 0.2;
    } else if (isStory) {
      // Story: obrázek nahoře
      const imgH = h * 0.4;
      ctx.drawImage(userImg, 0, 0, w, imgH);
      textStartY = imgH + padding;
    } else {
      // Square: obrázek nahoře
      const imgH = h * 0.45;
      ctx.drawImage(userImg, 0, 0, w, imgH);
      textStartY = imgH + padding * 0.5;
    }
  } else if (hasImage) {
    // Centered/left: obrázek jako overlay s opacity
    ctx.globalAlpha = 0.2;
    // Cover-fit obrázek
    const imgRatio = userImg.width / userImg.height;
    const canvasRatio = w / h;
    let sw, sh, sx, sy;
    if (imgRatio > canvasRatio) {
      sh = h; sw = h * imgRatio;
      sx = (w - sw) / 2; sy = 0;
    } else {
      sw = w; sh = w / imgRatio;
      sx = 0; sy = (h - sh) / 2;
    }
    ctx.drawImage(userImg, sx, sy, sw, sh);
    ctx.globalAlpha = 1.0;

    // Tmavý overlay pro čitelnost
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, 0, w, h);
  }

  // Pozice textu podle formátu
  if (!textStartY) {
    if (isLandscape) textStartY = h * 0.15;
    else if (isStory) textStartY = h * 0.28;
    else textStartY = h * 0.2;
  }

  const align = (layout === "left-aligned" || layout === "split") ? "left" : "center";
  const textX = align === "center" ? textAreaX + textAreaW / 2 : textAreaX;
  ctx.textAlign = align;

  let curY = textStartY;

  // Emoji
  if (concept.emoji) {
    const emojiSize = Math.round(w * 0.09);
    ctx.font = `${emojiSize}px sans-serif`;
    ctx.fillStyle = textColor;
    ctx.fillText(concept.emoji, textX, curY);
    curY += emojiSize * 1.4;
  }

  // Headline — dynamická velikost
  const headlineMaxSize = isLandscape ? w * 0.06 : w * 0.08;
  const headlineSize = Math.round(Math.min(headlineMaxSize, textAreaW * 0.12));
  ctx.fillStyle = textColor;
  ctx.font = `bold ${headlineSize}px -apple-system, "Segoe UI", sans-serif`;

  // Stín pro čitelnost
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;

  curY = wrapText(ctx, concept.headline || "", textX, curY, textAreaW, headlineSize * 1.25);
  curY += headlineSize * 0.5;

  // Reset stínu
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;

  // Subtext
  if (concept.subtext) {
    const subSize = Math.round(headlineSize * 0.5);
    ctx.font = `${subSize}px -apple-system, "Segoe UI", sans-serif`;
    ctx.fillStyle = textColor + "dd";
    ctx.shadowColor = "rgba(0,0,0,0.3)";
    ctx.shadowBlur = 4;
    curY = wrapText(ctx, concept.subtext, textX, curY, textAreaW, subSize * 1.4);
    curY += subSize * 1.5;
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
  }

  // CTA tlačítko
  if (concept.ctaText) {
    const ctaSize = Math.round(headlineSize * 0.38);
    ctx.font = `bold ${ctaSize}px -apple-system, "Segoe UI", sans-serif`;
    const ctaPadX = ctaSize * 1.5;
    const ctaPadY = ctaSize * 0.8;
    const ctaTextW = ctx.measureText(concept.ctaText).width;
    const ctaW = ctaTextW + ctaPadX * 2;
    const ctaH = ctaSize + ctaPadY * 2;
    const ctaX = align === "center" ? textX - ctaW / 2 : textAreaX;
    const ctaY = curY;
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
}

// ─── Karta konceptu ────────────────────────────────────────────────────────
function CreativeCard({ concept, format, index, userImage }) {
  const canvasRef = useRef(null);
  const [loadedImg, setLoadedImg] = useState(null);

  // Načti user image do Image objektu
  useEffect(() => {
    if (!userImage?.src) { setLoadedImg(null); return; }
    const img = new Image();
    img.onload = () => setLoadedImg(img);
    img.src = userImage.src;
  }, [userImage?.src]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const maxW = 320;
    const scale = maxW / format.w;
    canvas.width = Math.round(format.w * scale);
    canvas.height = Math.round(format.h * scale);
    const ctx = canvas.getContext("2d");

    renderCreative(ctx, concept, canvas.width, canvas.height, loadedImg);
  }, [concept, format, loadedImg]);

  useEffect(() => { render(); }, [render]);

  function downloadFullSize() {
    const canvas = document.createElement("canvas");
    canvas.width = format.w;
    canvas.height = format.h;
    const ctx = canvas.getContext("2d");
    renderCreative(ctx, concept, format.w, format.h, loadedImg);

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
      <div style={{
        display: "flex", justifyContent: "center",
        background: "#1a1a2e", padding: "12px",
      }}>
        <canvas ref={canvasRef}
          style={{ borderRadius: "8px", maxWidth: "100%", height: "auto" }}
        />
      </div>
      <div style={{ padding: "14px" }}>
        <p style={{ fontWeight: 600, fontSize: ".9rem", color: "var(--text)", margin: "0 0 4px" }}>
          {concept.name || `Koncept ${index + 1}`}
        </p>
        <p style={{ fontSize: ".78rem", color: "var(--text-muted)", margin: "0 0 12px" }}>
          {concept.mood || ""} • {format.w}×{format.h}px
        </p>
        <button onClick={downloadFullSize}
          style={{
            width: "100%", padding: "8px", borderRadius: "8px",
            border: "none", background: "#7c3aed", color: "#fff",
            cursor: "pointer", fontSize: ".82rem", fontWeight: 500,
          }}
        >
          ⬇ Stáhnout PNG
        </button>
      </div>
    </div>
  );
}

// ─── Text wrap — vrací Y pozici po posledním řádku ─────────────────────────
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  let curY = y;

  for (let i = 0; i < words.length; i++) {
    const test = line + words[i] + " ";
    if (ctx.measureText(test).width > maxWidth && i > 0) {
      ctx.fillText(line.trim(), x, curY);
      line = words[i] + " ";
      curY += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line.trim(), x, curY);
  return curY + lineHeight;
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
