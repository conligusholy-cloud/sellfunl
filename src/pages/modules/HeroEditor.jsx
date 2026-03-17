import { useRef, useState } from "react";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "../../firebase/config";

// ─── Konstanty ────────────────────────────────────────────────────────────────

const BG_VARIANTS = [
  { id:"dark",   label:"① Tmavý",    css:"linear-gradient(135deg,#0f0c29,#302b63,#24243e)", accent:"#a78bfa", light:false },
  { id:"blue",   label:"② Modrý",    css:"linear-gradient(135deg,#0c4a6e,#0891b2,#06b6d4)", accent:"#67e8f9", light:false },
  { id:"green",  label:"③ Zelený",   css:"linear-gradient(135deg,#052e16,#166534,#15803d)",  accent:"#6ee7b7", light:false },
  { id:"orange", label:"④ Oranžový", css:"linear-gradient(135deg,#7c2d12,#c2410c,#ea580c)",  accent:"#fdba74", light:false },
  { id:"rose",   label:"⑤ Růžový",   css:"linear-gradient(135deg,#881337,#9d174d,#be185d)",  accent:"#fbcfe8", light:false },
  { id:"gold",   label:"⑥ Zlatý",    css:"linear-gradient(135deg,#1c1917,#292524,#44403c)",  accent:"#fbbf24", light:false },
  { id:"cyber",  label:"⑦ Cyber",    css:"#050510",                                           accent:"#00ffc8", light:false },
  { id:"light",  label:"⑧ Světlý",   css:"linear-gradient(135deg,#f8fafc,#e2e8f0)",           accent:"#7c3aed", light:true  },
];

const MEDIA_RATIOS = [
  { id:"16/9",  label:"16:9" },
  { id:"4/3",   label:"4:3" },
  { id:"1/1",   label:"1:1" },
  { id:"3/4",   label:"3:4" },
  { id:"9/16",  label:"9:16" },
  { id:"auto",  label:"Auto" },
];

const MEDIA_STYLES = [
  { id:"rounded", label:"Kulatý" },
  { id:"square",  label:"Hranatý" },
  { id:"circle",  label:"Kruh" },
  { id:"shadow",  label:"Se stínem" },
  { id:"border",  label:"S rámečkem" },
  { id:"glow",    label:"Se zábleskem" },
];

const BTN_STYLES = [
  { id:"solid",    label:"Plné" },
  { id:"outline",  label:"Outline" },
  { id:"gradient", label:"Gradient" },
  { id:"glow",     label:"Glow" },
];

const TEXT_ANIMS = [
  { id:"none",      label:"Žádná" },
  { id:"fadein",    label:"Fade in" },
  { id:"slideLeft", label:"Slide zleva" },
  { id:"slideUp",   label:"Slide zdola" },
  { id:"zoom",      label:"Zoom in" },
];

const BG_ANIMS = [
  { id:"none",      label:"Žádná" },
  { id:"pulse",     label:"Pulzování" },
  { id:"drift",     label:"Drift" },
  { id:"particles", label:"Částice" },
];

const HEIGHTS = [
  { id:"380px", label:"Kompaktní" },
  { id:"500px", label:"Střední" },
  { id:"640px", label:"Velká" },
  { id:"100vh", label:"Celá obrazovka" },
];

// ─── Výchozí nastavení ─────────────────────────────────────────────────────────

export const DEFAULT_HERO = {
  bg:          "dark",
  overlay:     30,
  layout:      "left",
  height:      "500px",
  showMedia:   true,
  mediaPos:    "right",
  mediaStyle:  "rounded",
  mediaSize:   38,
  mediaRatio:  "16/9",
  mediaUrl:    "",
  mediaType:   "image",
  showBadge:   true,
  badgeText:   "⚡ Limitovaná nabídka 2024",
  showH1:      true,
  h1Line1:     "Vybuduj",
  h1Accent:    "pasivní příjem",
  h1Line2:     "za 90 dní",
  showSub:     true,
  subText:     "Franšíza Špagetka — prověřený systém fungující 24/7 bez zaměstnanců.",
  showStats:   false,
  stats:       [{ num:"47 tis.", label:"Průměr / měsíc" },{ num:"200+", label:"Partnerů" },{ num:"98%", label:"Spokojenost" }],
  showScroll:  false,
  btn1:        true,
  btn1Text:    "Chci franšízu →",
  btn1Link:    "#",
  btn2:        true,
  btn2Text:    "▶ Přehrát video",
  btn2Link:    "#",
  btnStyle:    "solid",
  textAnim:    "none",
  bgAnim:      "none",
  videoUrl:    "",
};

// ─── Helper: sestaví HTML hero sekce ──────────────────────────────────────────

export function buildHeroHtml(hero) {
  const bg   = BG_VARIANTS.find(b => b.id === hero.bg) || BG_VARIANTS[0];
  const acc  = bg.accent;
  const textC = bg.light ? "#0f172a" : "#fff";
  const subC  = bg.light ? "rgba(0,0,0,.6)" : "rgba(255,255,255,.75)";
  const ov    = (hero.overlay||30) / 100;

  const mstyles = {
    rounded: "border-radius:14px;overflow:hidden",
    square:  "border-radius:4px;overflow:hidden",
    circle:  "border-radius:50%;overflow:hidden;aspect-ratio:1/1",
    shadow:  `border-radius:14px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.4)`,
    border:  `border-radius:14px;overflow:hidden;border:2px solid ${acc}`,
    glow:    `border-radius:14px;overflow:hidden;box-shadow:0 0 40px ${acc}55`,
  }[hero.mediaStyle] || "border-radius:14px;overflow:hidden";

  const btnPrimCss = {
    solid:    `background:${acc==="#a78bfa"?"#7c3aed":acc};color:#fff`,
    outline:  `background:transparent;border:2px solid ${acc};color:${acc}`,
    gradient: `background:linear-gradient(90deg,#7c3aed,${acc});color:#fff`,
    glow:     `background:${acc==="#a78bfa"?"#7c3aed":acc};color:#fff;box-shadow:0 0 24px ${acc}66`,
  }[hero.btnStyle] || "background:#7c3aed;color:#fff";

  const animCss = {
    none:      "",
    fadein:    "@keyframes fi{from{opacity:0}to{opacity:1}}.ha{animation:fi .8s ease both}",
    slideLeft: "@keyframes sl{from{opacity:0;transform:translateX(-40px)}to{opacity:1;transform:none}}.ha{animation:sl .7s ease both}",
    slideUp:   "@keyframes su{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:none}}.ha{animation:su .7s ease both}",
    zoom:      "@keyframes zm{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:none}}.ha{animation:zm .7s ease both}",
  }[hero.textAnim] || "";

  const bgAnimCss = {
    none:      "",
    pulse:     "@keyframes bgp{0%,100%{filter:brightness(1)}50%{filter:brightness(1.15)}}.hero-bg{animation:bgp 4s ease infinite}",
    drift:     "@keyframes bgd{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}.hero-bg{background-size:200% 200%!important;animation:bgd 8s ease infinite}",
    particles: "",
  }[hero.bgAnim] || "";

  const particles = hero.bgAnim === "particles" ? `
    <canvas id="pc" style="position:absolute;inset:0;pointer-events:none;z-index:0"></canvas>
    <script>
    const cv=document.getElementById('pc'),ctx=cv.getContext('2d');
    function rs(){cv.width=cv.offsetWidth;cv.height=cv.offsetHeight}rs();
    const pts=Array.from({length:45},()=>({x:Math.random()*cv.width,y:Math.random()*cv.height,r:Math.random()*2+.5,vx:(Math.random()-.5)*.4,vy:(Math.random()-.5)*.4}));
    function draw(){ctx.clearRect(0,0,cv.width,cv.height);pts.forEach(p=>{p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>cv.width)p.vx*=-1;if(p.y<0||p.y>cv.height)p.vy*=-1;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,.2)';ctx.fill()});requestAnimationFrame(draw)}draw();window.addEventListener('resize',rs);
    <\/script>` : "";

  const isBottom  = hero.mediaPos === "bottom";
  const isLeft    = hero.mediaPos === "left";
  const isCenter  = hero.layout === "center";
  const mw        = hero.mediaSize || 38;

  let mediaContent = "";
  if (hero.mediaUrl) {
    if (hero.mediaType === "video") {
      mediaContent = `<video src="${hero.mediaUrl}" ${hero.mediaControls?"controls":""} ${hero.mediaAutoplay?"autoplay muted":""} ${hero.mediaLoop?"loop":""} style="width:100%;height:100%;object-fit:cover;display:block"></video>`;
    } else {
      mediaContent = `<img src="${hero.mediaUrl}" alt="" style="width:100%;height:100%;object-fit:cover;display:block">`;
    }
  } else {
    mediaContent = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:rgba(255,255,255,.35);gap:8px;font-size:12px;padding:20px;text-align:center"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>Tvůj obrázek / video</div>`;
  }

  const mediaBox = hero.showMedia ? `
    <div style="flex:0 0 ${mw}%;max-width:${mw}%;${isBottom?`width:${Math.min(mw+10,70)}%;max-width:90%;margin:20px auto 0`:""};${isLeft&&!isCenter?"":""}">
      <div style="${mstyles};background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);${hero.mediaRatio === "auto" ? "" : `aspect-ratio:${hero.mediaRatio}`}">${mediaContent}</div>
    </div>` : "";

  const statsHtml = hero.showStats && hero.stats ? `
    <div style="display:flex;gap:20px;margin-bottom:22px;flex-wrap:wrap">
      ${hero.stats.map(s=>`<div><div style="font-size:22px;font-weight:800;color:${acc}">${s.num}</div><div style="font-size:11px;color:${subC}">${s.label}</div></div>`).join("")}
    </div>` : "";

  let innerStyle = "flex-direction:row";
  if (isCenter || isBottom) innerStyle = "flex-direction:column;align-items:center;text-align:center";
  else if (isLeft && hero.showMedia) innerStyle = "flex-direction:row-reverse";

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,'Inter',sans-serif;overflow:hidden}
.hero{position:relative;min-height:${hero.height||"500px"};display:flex;align-items:center;overflow:hidden}
.hero-bg{position:absolute;inset:0;z-index:0;background:${bg.css}}
.overlay{position:absolute;inset:0;z-index:0;background:rgba(0,0,0,${ov})}
.hero-inner{position:relative;z-index:1;width:100%;display:flex;align-items:center;${innerStyle};padding:48px 52px;gap:36px}
.ha{}.ha1{animation-delay:.1s}.ha2{animation-delay:.25s}.ha3{animation-delay:.4s}.ha4{animation-delay:.55s}
${animCss}${bgAnimCss}
.btn-p{padding:13px 28px;font-size:14px;font-weight:700;border:none;border-radius:9px;cursor:pointer;${btnPrimCss}}
.btn-s{padding:13px 22px;font-size:14px;font-weight:600;border-radius:9px;cursor:pointer;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.25);color:${bg.light?"#334155":"#fff"}}
.scroll-hint{position:absolute;bottom:18px;left:50%;transform:translateX(-50%);z-index:2;display:flex;flex-direction:column;align-items:center;gap:4px;font-size:10px;font-weight:600;opacity:.45;color:${textC}}
.arr{width:14px;height:14px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(45deg);animation:bnc 1.6s infinite}
@keyframes bnc{0%,100%{transform:rotate(45deg)}50%{transform:rotate(45deg) translateY(5px)}}
@media(max-width:680px){.hero-inner{flex-direction:column!important;padding:32px 24px;text-align:center!important}.hero-inner>div[style*="flex:0"]{width:90%!important;max-width:90%!important;flex:none!important;margin:0 auto!important}.hero-inner>div[style*="flex:0"] div{aspect-ratio:16/9!important;max-height:220px}}
</style></head><body>
<div class="hero">
  <div class="hero-bg">${particles}</div>
  <div class="overlay"></div>
  <div class="hero-inner">
    <div style="flex:1;min-width:0">
      ${hero.showBadge?`<div class="ha ha1" style="display:inline-flex;align-items:center;gap:5px;padding:5px 13px;border-radius:20px;font-size:11px;font-weight:700;margin-bottom:14px;background:${acc}22;border:1px solid ${acc}44;color:${acc}">${hero.badgeText||"⚡ Limitovaná nabídka"}</div><br>`:""}
      ${hero.showH1?`<div class="ha ha2" style="font-size:clamp(26px,4vw,50px);font-weight:800;line-height:1.15;color:${textC};margin-bottom:14px">${hero.h1Line1||""}<br><span style="color:${acc}">${hero.h1Accent||""}</span><br>${hero.h1Line2||""}</div>`:""}
      ${hero.showSub?`<div class="ha ha3" style="font-size:clamp(13px,1.3vw,16px);line-height:1.65;color:${subC};margin-bottom:${hero.showStats?"16px":"26px"};max-width:440px">${hero.subText||""}</div>`:""}
      ${statsHtml}
      <div class="ha ha4" style="display:flex;gap:10px;flex-wrap:wrap;${isCenter?"justify-content:center":""}">
        ${hero.btn1?`<a href="${hero.btn1Link||"#"}" class="btn-p">${hero.btn1Text||"Akce →"}</a>`:""}
        ${hero.btn2?`<a href="${hero.btn2Link||"#"}" class="btn-s">${hero.btn2Text||"Více info"}</a>`:""}
      </div>
    </div>
    ${!isBottom && hero.showMedia ? mediaBox : ""}
  </div>
  ${isBottom && hero.showMedia ? `<div style="padding:0 52px 40px;width:100%">${mediaBox}</div>` : ""}

</div>
</body></html>`;
}

// ─── Hlavní komponenta ─────────────────────────────────────────────────────────

export default function HeroEditor({ hero, onChange, userId }) {
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const mediaFileRef = useRef(null);

  function upd(key, val) { onChange({ ...hero, [key]: val }); }
  function updStat(i, key, val) {
    const s = [...(hero.stats || [])];
    s[i] = { ...s[i], [key]: val };
    upd("stats", s);
  }

  async function handleMediaUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    e.target.value = "";
    setUploading(true); setUploadPct(0);
    const isVid = file.type.startsWith("video");
    const ext   = file.name.split(".").pop();
    const path  = `uploads/${userId}/hero_${Date.now()}.${ext}`;
    const sRef  = storageRef(storage, path);
    const task  = uploadBytesResumable(sRef, file);
    task.on("state_changed",
      snap => setUploadPct(Math.round(snap.bytesTransferred/snap.totalBytes*100)),
      err  => { alert("Upload selhal: "+err.message); setUploading(false); },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        onChange({ ...hero, mediaUrl: url, mediaType: isVid ? "video" : "image" });
        setUploading(false); setUploadPct(0);
      }
    );
  }

  const S = {
    lbl:   { fontSize:"10px", fontWeight:600, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:".05em", display:"block", marginBottom:"5px" },
    sec:   { padding:"12px 14px", borderBottom:"1px solid var(--border)" },
    chip:  (on) => ({ padding:"4px 9px", fontSize:"11px", borderRadius:"6px", border:`1px solid ${on?"#7c3aed":"var(--border)"}`, background:on?"#ede9fe":"transparent", color:on?"#7c3aed":"var(--text-muted)", cursor:"pointer", whiteSpace:"nowrap" }),
    input: { width:"100%", padding:"6px 9px", fontSize:"12px", border:"1px solid var(--border)", borderRadius:"6px", background:"var(--input-bg)", color:"var(--text)", outline:"none", fontFamily:"inherit" },
    check: { display:"flex", alignItems:"center", gap:"6px", fontSize:"12px", color:"var(--text)", cursor:"pointer", marginBottom:"4px" },
  };

  function ChipGroup({ options, value, onChange: onCh }) {
    return (
      <div style={{ display:"flex", flexWrap:"wrap", gap:"4px", marginTop:"4px" }}>
        {options.map(o => (
          <button key={o.id} style={S.chip(value===o.id)} onClick={() => onCh(o.id)}>{o.label}</button>
        ))}
      </div>
    );
  }

  function Check({ id, label, checked, onChange: onCh }) {
    return (
      <label style={S.check}>
        <input type="checkbox" checked={!!checked} onChange={e=>onCh(e.target.checked)} style={{accentColor:"#7c3aed"}}/>
        {label}
      </label>
    );
  }

  // Pouze panel bez náhledu — náhled je v pravém panelu PageEditoru
  return (
    <div style={{ overflowY:"auto", background:"var(--bg-card)" }}>

      {/* Pozadí */}
      <div style={S.sec}>
        <span style={S.lbl}>🎨 Pozadí</span>
        <ChipGroup options={BG_VARIANTS} value={hero.bg} onChange={v=>upd("bg",v)}/>
        <div style={{ marginTop:"8px" }}>
          <span style={S.lbl}>Overlay průhlednost: {hero.overlay}%</span>
          <input type="range" min={0} max={80} step={5} value={hero.overlay||30}
            onChange={e=>upd("overlay",+e.target.value)} style={{ width:"100%", accentColor:"#7c3aed" }}/>
        </div>
        <span style={{ ...S.lbl, marginTop:"8px" }}>Animace pozadí</span>
        <ChipGroup options={BG_ANIMS} value={hero.bgAnim||"none"} onChange={v=>upd("bgAnim",v)}/>
      </div>

      {/* Rozložení */}
      <div style={S.sec}>
        <span style={S.lbl}>📐 Rozložení textu</span>
        <ChipGroup options={[{id:"left",label:"Vlevo"},{id:"center",label:"Střed"},{id:"right",label:"Vpravo"}]} value={hero.layout||"left"} onChange={v=>upd("layout",v)}/>
        <span style={{ ...S.lbl, marginTop:"8px" }}>Výška sekce</span>
        <ChipGroup options={HEIGHTS} value={hero.height||"500px"} onChange={v=>upd("height",v)}/>
      </div>

      {/* Media */}
      <div style={S.sec}>
        <Check id="sm" label="🖼 Media box" checked={hero.showMedia} onChange={v=>upd("showMedia",v)}/>
        {hero.showMedia && (<>
          <div style={{ marginTop:"6px" }}>
            <input ref={mediaFileRef} type="file" accept="image/*,video/*" style={{ display:"none" }} onChange={handleMediaUpload}/>
            <button onClick={()=>mediaFileRef.current?.click()} disabled={uploading}
              style={{ width:"100%", padding:"7px", fontSize:"12px", border:"1px dashed var(--border)", borderRadius:"7px", background:"var(--bg)", color:"var(--text-muted)", cursor:"pointer" }}>
              {uploading ? `⏳ Nahrávám... ${uploadPct}%` : hero.mediaUrl ? "🔄 Změnit soubor" : "⬆ Nahrát obrázek / video"}
            </button>
            {uploading && (
              <div style={{ height:"3px", background:"var(--border)", borderRadius:"2px", marginTop:"4px" }}>
                <div style={{ height:"100%", background:"#7c3aed", width:`${uploadPct}%`, borderRadius:"2px", transition:"width .2s" }}/>
              </div>
            )}
            {hero.mediaUrl && !uploading && (
              <div style={{ display:"flex", gap:"6px", marginTop:"4px" }}>
                <span style={{ flex:1, fontSize:"10px", color:"var(--text-muted)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>✓ {hero.mediaUrl.split("/").pop().slice(0,30)}</span>
                <button onClick={()=>upd("mediaUrl","")} style={{ fontSize:"10px", color:"var(--text-muted)", background:"none", border:"none", cursor:"pointer" }}>✕</button>
              </div>
            )}
          </div>
          {hero.mediaType==="video" && (<>
            <div style={{ marginTop:"6px" }}>
              <Check id="mc" label="Ovládací prvky" checked={hero.mediaControls!==false} onChange={v=>upd("mediaControls",v)}/>
              <Check id="ma" label="Autoplay (ztlumeno)" checked={!!hero.mediaAutoplay} onChange={v=>upd("mediaAutoplay",v)}/>
              <Check id="ml" label="Opakovat (loop)" checked={!!hero.mediaLoop} onChange={v=>upd("mediaLoop",v)}/>
            </div>
          </>)}
          <span style={{ ...S.lbl, marginTop:"8px" }}>Pozice</span>
          <ChipGroup options={[{id:"right",label:"Vpravo"},{id:"left",label:"Vlevo"},{id:"bottom",label:"Pod textem"}]} value={hero.mediaPos||"right"} onChange={v=>upd("mediaPos",v)}/>
          <span style={{ ...S.lbl, marginTop:"8px" }}>Styl rámečku</span>
          <ChipGroup options={MEDIA_STYLES} value={hero.mediaStyle||"rounded"} onChange={v=>upd("mediaStyle",v)}/>
          <div style={{ marginTop:"8px" }}>
            <span style={S.lbl}>Velikost: {hero.mediaSize||38}% šířky</span>
            <input type="range" min={20} max={55} step={1} value={hero.mediaSize||38}
              onChange={e=>upd("mediaSize",+e.target.value)} style={{ width:"100%", accentColor:"#7c3aed" }}/>
          </div>
          <span style={{ ...S.lbl, marginTop:"8px" }}>Poměr stran</span>
          <ChipGroup options={MEDIA_RATIOS} value={hero.mediaRatio||"16/9"} onChange={v=>upd("mediaRatio",v)}/>
        </>)}
      </div>

      {/* Badge */}
      <div style={S.sec}>
        <Check id="sb" label="Badge / štítek" checked={hero.showBadge} onChange={v=>upd("showBadge",v)}/>
        {hero.showBadge && <input value={hero.badgeText||""} onChange={e=>upd("badgeText",e.target.value)} style={{ ...S.input, marginTop:"5px" }} placeholder="Text badge"/>}
      </div>

      {/* Nadpis */}
      <div style={S.sec}>
        <Check id="sh" label="Hlavní nadpis" checked={hero.showH1} onChange={v=>upd("showH1",v)}/>
        {hero.showH1 && (<>
          <input value={hero.h1Line1||""} onChange={e=>upd("h1Line1",e.target.value)} style={{ ...S.input, marginTop:"5px" }} placeholder="Řádek 1"/>
          <input value={hero.h1Accent||""} onChange={e=>upd("h1Accent",e.target.value)} style={{ ...S.input, marginTop:"4px" }} placeholder="Zvýrazněný řádek (barevný)"/>
          <input value={hero.h1Line2||""} onChange={e=>upd("h1Line2",e.target.value)} style={{ ...S.input, marginTop:"4px" }} placeholder="Řádek 3"/>
        </>)}
      </div>

      {/* Podnadpis */}
      <div style={S.sec}>
        <Check id="ss" label="Podnadpis" checked={hero.showSub} onChange={v=>upd("showSub",v)}/>
        {hero.showSub && <textarea value={hero.subText||""} onChange={e=>upd("subText",e.target.value)} style={{ ...S.input, marginTop:"5px", minHeight:"60px", resize:"vertical" }} placeholder="Popis / podnadpis"/>}
      </div>

      {/* Statistiky */}
      <div style={S.sec}>
        <Check id="st" label="Statistiky (čísla)" checked={hero.showStats} onChange={v=>upd("showStats",v)}/>
        {hero.showStats && (hero.stats||[]).map((s,i)=>(
          <div key={i} style={{ display:"flex", gap:"5px", marginTop:"5px" }}>
            <input value={s.num} onChange={e=>updStat(i,"num",e.target.value)} style={{ ...S.input, width:"80px" }} placeholder="47 tis."/>
            <input value={s.label} onChange={e=>updStat(i,"label",e.target.value)} style={S.input} placeholder="Popisek"/>
          </div>
        ))}
      </div>

      {/* Tlačítka */}
      <div style={S.sec}>
        <span style={S.lbl}>🔘 Tlačítka</span>
        <Check id="b1" label="Primární tlačítko" checked={hero.btn1} onChange={v=>upd("btn1",v)}/>
        {hero.btn1 && (<>
          <input value={hero.btn1Text||""} onChange={e=>upd("btn1Text",e.target.value)} style={{ ...S.input, marginBottom:"4px" }} placeholder="Text tlačítka"/>
          <input value={hero.btn1Link||""} onChange={e=>upd("btn1Link",e.target.value)} style={S.input} placeholder="https://... (odkaz)"/>
        </>)}
        <div style={{ marginTop:"6px" }}>
          <Check id="b2" label="Sekundární tlačítko" checked={hero.btn2} onChange={v=>upd("btn2",v)}/>
          {hero.btn2 && (<>
            <input value={hero.btn2Text||""} onChange={e=>upd("btn2Text",e.target.value)} style={{ ...S.input, marginBottom:"4px" }} placeholder="Text tlačítka"/>
            <input value={hero.btn2Link||""} onChange={e=>upd("btn2Link",e.target.value)} style={S.input} placeholder="https://... (odkaz)"/>
          </>)}
        </div>
        <span style={{ ...S.lbl, marginTop:"8px" }}>Styl primárního</span>
        <ChipGroup options={BTN_STYLES} value={hero.btnStyle||"solid"} onChange={v=>upd("btnStyle",v)}/>
      </div>

      {/* Animace */}
      <div style={S.sec}>
        <span style={S.lbl}>✨ Animace textu</span>
        <ChipGroup options={TEXT_ANIMS} value={hero.textAnim||"none"} onChange={v=>upd("textAnim",v)}/>
      </div>

      {/* Scroll hint */}
      <div style={S.sec}>
        <Check id="sc" label="Scroll šipka dole" checked={hero.showScroll} onChange={v=>upd("showScroll",v)}/>
      </div>

    </div>
  );
}