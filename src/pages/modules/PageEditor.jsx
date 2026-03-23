import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db, app, storage } from "../../firebase/config";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useAuthState } from "../../hooks/useAuthState";
import HeroEditor, { DEFAULT_HERO, buildHeroHtml } from "./HeroEditor";
import AIPageGenerator from "../../components/AIPageGenerator";
import AITranslator from "../../components/AITranslator";
import PageActions from "./PageActions";

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

const EMOJIS = ["😀","😂","😍","🔥","💪","✅","❤️","🎉","🚀","⭐","💡","🎯","📦","💰","🛒","✨","🙌","👍","💎","🏆","🎁","📣","💬","🔑","🌟","⚡","🎨","🔮","💥","🎪"];
const PUBLIC_BASE_URL = `${window.location.origin}/p/`;

const DEVICES = [
  { key:"mockup-mobile", label:"📱 Mockup mobil",  mockup:true },
  { key:"mockup-tablet", label:"🖥 Mockup tablet", mockup:true },
  { key:"mockup-laptop", label:"💻 Mockup laptop", mockup:true },
];

// ─── Inline styly sdílené ─────────────────────────────────────────────────────
const INLINE_STYLES = `
  .inline-section { position: relative; }
  .inline-section:hover { outline: 1px dashed #c4b5fd44; }
  .inline-section-label {
    display: none; position: absolute; top: 4px; left: 4px;
    font-size: 10px; font-weight: 700; color: #7c3aed;
    background: #ede9fe; padding: 2px 7px; border-radius: 4px;
    letter-spacing: .4px; text-transform: uppercase;
    pointer-events: none; z-index: 10;
  }
  .inline-section:hover .inline-section-label { display: block; }
  .inline-editable { border-radius: 4px; transition: background .15s; cursor: text; }
  .inline-editable:hover { background: #f5f3ff55; }
  .inline-editable:focus { outline: 2px solid #7c3aed44 !important; border-radius: 4px; background: #faf8ff !important; }
  .inline-editable:empty:before { content: attr(data-placeholder); color: #9ca3af; font-style: italic; }
  .page-content img, .page-content video, .page-content audio { max-width: 100% !important; height: auto !important; }
  .inline-field { position: relative; }
  .inline-field:hover::after { content: '✏️'; position: absolute; top: 4px; right: 6px; font-size: 12px; opacity: .5; pointer-events: none; }
  .wysiwyg-editor img, .wysiwyg-editor video { cursor: pointer; }
  .wysiwyg-editor img:hover, .wysiwyg-editor video:hover { outline: 2px solid #7c3aed44; }
`;

// ─── HTML Editor ──────────────────────────────────────────────────────────────
function HtmlEditorModal({ initialHtml, pageName, pageData, onSave, onClose }) {
  const [code, setCode] = useState(initialHtml || "");
  const [split, setSplit] = useState(50);
  const iframeRef = useRef(null);
  const textareaRef = useRef(null);
  const dragging = useRef(false);

  function buildFullPage(html) {
    const h = pageData;
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
      *{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,'Inter',sans-serif;background:#f8f8fc}
      .page{max-width:720px;margin:0 auto;background:#fff;min-height:100vh}
      .sec-hero{padding:40px 48px 28px;border-bottom:1px solid #f0f0f0}
      h1.headline{font-size:2rem;font-weight:800;color:#1e1b4b;line-height:1.2;margin-bottom:10px}
      p.subline{font-size:1.05rem;color:#6b7280}
      .sec-body{padding:28px 48px;border-bottom:1px solid #f0f0f0;line-height:1.75;font-size:.97rem;color:#374151}
      .sec-body h2{font-size:1.35rem;font-weight:700;color:#1e1b4b;margin:20px 0 8px}
      .sec-body h3{font-size:1.1rem;font-weight:600;color:#1e1b4b;margin:16px 0 6px}
      .sec-body ul{padding-left:20px;margin:8px 0}.sec-body li{margin-bottom:5px}
      .sec-body strong{font-weight:700}.sec-body em{font-style:italic}
      .sec-action{padding:28px 48px 40px}
      .sec-action input,.sec-action textarea{width:100%;padding:10px 14px;border:1px solid #e5e7eb;border-radius:8px;font-size:.95rem;background:#f9fafb;margin-bottom:8px;font-family:inherit;outline:none}
      .price{font-size:2rem;font-weight:800;color:#7c3aed;margin:10px 0}
      .cta-btn{display:block;width:100%;padding:14px;background:#7c3aed;color:#fff;border:none;border-radius:10px;font-size:1.05rem;font-weight:700;cursor:pointer;text-align:center;text-decoration:none;margin-top:4px}
    </style></head><body><div class="page">
      <div class="sec-hero">${h.headline?`<h1 class="headline">${h.headline}</h1>`:""}${h.subline?`<p class="subline">${h.subline}</p>`:""}</div>
      <div class="sec-body">${html}</div>
      <div class="sec-action">
        ${(h.formFields||["Jméno","Email"]).map(f=>f==="Zpráva"?`<textarea placeholder="Zpráva"></textarea>`:`<input placeholder="${f}">`).join("")}
        ${h.price?`<div class="price">${h.price}</div>`:""}
        ${h.btnText?`<a href="${h.btnUrl||"#"}" class="cta-btn">${h.btnText}</a>`:""}
      </div>
    </div></body></html>`;
  }

  useEffect(() => {
    const iframe = iframeRef.current; if (!iframe) return;
    const d = iframe.contentDocument || iframe.contentWindow.document;
    d.open(); d.write(buildFullPage(code)); d.close();
  }, [code, pageData]);

  useEffect(() => {
    const onMove = e => { if (!dragging.current) return; setSplit(Math.min(80,Math.max(20,(e.clientX/window.innerWidth)*100))); };
    const onUp = () => { dragging.current = false; };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  function handleKeyDown(e) {
    if (e.key==="Tab") {
      e.preventDefault();
      const ta = textareaRef.current;
      const s = ta.selectionStart;
      setCode(code.substring(0,s)+"  "+code.substring(ta.selectionEnd));
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = s+2; });
    }
  }

  return (
    <div style={{ position:"fixed", inset:0, zIndex:9999, display:"flex", flexDirection:"column", background:"#1e1e2e" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"10px", padding:"10px 16px", background:"#16162a", borderBottom:"1px solid #2e2e4e", flexShrink:0 }}>
        <span style={{ fontSize:"13px", fontWeight:600, color:"#a78bfa" }}>⟨/⟩ HTML editor</span>
        <span style={{ fontSize:"12px", color:"#6b7280", flex:1 }}>{pageName}</span>
        <button onClick={() => { onSave(code); onClose(); }} style={{ padding:"6px 16px", background:"#7c3aed", color:"#fff", border:"none", borderRadius:"7px", fontSize:"13px", fontWeight:600, cursor:"pointer" }}>✓ Uložit a zavřít</button>
        <button onClick={onClose} style={{ padding:"6px 12px", background:"transparent", color:"#9ca3af", border:"1px solid #374151", borderRadius:"7px", fontSize:"13px", cursor:"pointer" }}>Zrušit</button>
      </div>
      <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
        <div style={{ width:`${split}%`, display:"flex", flexDirection:"column", overflow:"hidden" }}>
          <div style={{ padding:"5px 12px", background:"#12121e", borderBottom:"1px solid #2e2e4e", fontSize:"11px", color:"#6b7280" }}>
            <span style={{ color:"#a78bfa", fontWeight:600 }}>HTML</span><span style={{ marginLeft:"12px" }}>Pouze obsah těla stránky</span>
          </div>
          <textarea ref={textareaRef} value={code} onChange={e=>setCode(e.target.value)} onKeyDown={handleKeyDown} spellCheck={false}
            style={{ flex:1, width:"100%", padding:"16px", background:"#1a1a2e", color:"#e2e8f0", border:"none", outline:"none", fontFamily:"'Fira Code','Consolas',monospace", fontSize:"13px", lineHeight:1.7, resize:"none" }} />
          <div style={{ padding:"5px 12px", background:"#12121e", fontSize:"11px", color:"#4b5563" }}>{code.split("\n").length} řádků · {code.length} znaků</div>
        </div>
        <div onMouseDown={e=>{e.preventDefault();dragging.current=true;}} style={{ width:"5px", background:"#2e2e4e", cursor:"col-resize", flexShrink:0 }}
          onMouseEnter={e=>e.target.style.background="#7c3aed"} onMouseLeave={e=>e.target.style.background="#2e2e4e"} />
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
          <div style={{ padding:"5px 12px", background:"#12121e", borderBottom:"1px solid #2e2e4e", fontSize:"11px", color:"#6b7280" }}>
            <span style={{ color:"#34d399", fontWeight:600 }}>● Živý náhled</span>
          </div>
          <iframe ref={iframeRef} title="preview" sandbox="allow-scripts allow-same-origin" style={{ flex:1, border:"none" }} />
        </div>
      </div>
    </div>
  );
}

// ─── Media Uploader ───────────────────────────────────────────────────────────
function MediaUploader({ userId, onInsert }) {
  const [uploading, setUploading] = useState(false);
  const [progress,  setProgress]  = useState(0);
  const [showUrl,   setShowUrl]   = useState(false);
  const [urlValue,  setUrlValue]  = useState("");
  const [urlType,   setUrlType]   = useState("img");
  const imgRef = useRef(null); const videoRef = useRef(null); const audioRef = useRef(null);

  async function uploadFile(file, type) {
    setUploading(true); setProgress(0);
    const ext = file.name.split(".").pop();
    const path = `uploads/${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const task = uploadBytesResumable(storageRef(storage, path), file);
    task.on("state_changed",
      snap => setProgress(Math.round((snap.bytesTransferred/snap.totalBytes)*100)),
      err  => { setUploading(false); alert("Upload selhal: "+err.message); },
      async () => { onInsert({ type, url: await getDownloadURL(task.snapshot.ref) }); setUploading(false); setProgress(0); }
    );
  }

  const btn = { display:"flex", alignItems:"center", gap:"4px", padding:"5px 10px", fontSize:".8rem", border:"1px solid var(--border)", borderRadius:"6px", background:"transparent", color:"var(--text-muted)", cursor:"pointer" };
  return (
    <div style={{ marginTop:"11px" }}>
      <input ref={imgRef}   type="file" accept="image/*"           style={{ display:"none" }} onChange={e=>{uploadFile(e.target.files[0],"img");e.target.value="";}} />
      <input ref={videoRef} type="file" accept="video/*"           style={{ display:"none" }} onChange={e=>{uploadFile(e.target.files[0],"video");e.target.value="";}} />
      <input ref={audioRef} type="file" accept="audio/*,.mp3,.wav" style={{ display:"none" }} onChange={e=>{uploadFile(e.target.files[0],"audio");e.target.value="";}} />
      <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
        <button style={btn} onClick={()=>imgRef.current?.click()}   disabled={uploading}>🖼 Obrázek z PC</button>
        <button style={btn} onClick={()=>videoRef.current?.click()} disabled={uploading}>▶ Video z PC</button>
        <button style={btn} onClick={()=>audioRef.current?.click()} disabled={uploading}>🔊 Audio z PC</button>
        <button style={{ ...btn, borderStyle:"dashed" }} onClick={()=>setShowUrl(v=>!v)}>🔗 URL</button>
      </div>
      {uploading && <div style={{ marginTop:"8px" }}><div style={{ fontSize:".78rem", color:"var(--text-muted)", marginBottom:"4px" }}>⏳ {progress}%</div><div style={{ height:"4px", background:"var(--border)", borderRadius:"2px" }}><div style={{ height:"100%", background:"#7c3aed", width:`${progress}%`, transition:"width .2s", borderRadius:"2px" }} /></div></div>}
      {showUrl && !uploading && (
        <div style={{ display:"flex", gap:"6px", marginTop:"8px", alignItems:"center" }}>
          <select value={urlType} onChange={e=>setUrlType(e.target.value)} style={{ padding:"6px 8px", fontSize:".8rem", border:"1px solid var(--border)", borderRadius:"6px", background:"var(--input-bg)", color:"var(--text)", outline:"none" }}>
            <option value="img">🖼 Obrázek</option><option value="video">▶ Video</option><option value="audio">🔊 Audio</option>
          </select>
          <input placeholder="https://..." value={urlValue} onChange={e=>setUrlValue(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){onInsert({type:urlType,url:urlValue.trim()});setUrlValue("");setShowUrl(false);}}}
            style={{ flex:1, padding:"6px 10px", fontSize:".8rem", border:"1px solid var(--border)", borderRadius:"6px", background:"var(--input-bg)", color:"var(--text)", outline:"none" }} />
          <button onClick={()=>{onInsert({type:urlType,url:urlValue.trim()});setUrlValue("");setShowUrl(false);}} style={{ padding:"6px 12px", fontSize:".8rem", border:"none", borderRadius:"6px", background:"#7c3aed", color:"#fff", cursor:"pointer" }}>Vložit</button>
          <button onClick={()=>setShowUrl(false)} style={{ padding:"6px 10px", fontSize:".8rem", border:"1px solid var(--border)", borderRadius:"6px", background:"transparent", color:"var(--text)", cursor:"pointer" }}>✕</button>
        </div>
      )}
    </div>
  );
}

// ─── WYSIWYG Editor ───────────────────────────────────────────────────────────
function WysiwygEditor({ initialHtml, onSave, onOpenHtml, userId }) {
  const ref = useRef(null);
  const savedRange = useRef(null);
  const imgRef2 = useRef(null); const videoRef2 = useRef(null); const audioRef2 = useRef(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadType, setUploadType] = useState(null);
  const [selectedEl, setSelectedEl] = useState(null);
  const [toolbar, setToolbar] = useState(null);

  useEffect(() => { if (ref.current) ref.current.innerHTML = initialHtml || ""; }, [initialHtml]);

  function handleEditorClick(e) {
    const el = e.target;
    const isMedia = el.tagName==="IMG"||el.tagName==="VIDEO"||el.tagName==="AUDIO";
    if (isMedia) {
      e.preventDefault(); setSelectedEl(el);
      const r = el.getBoundingClientRect(), er = ref.current.getBoundingClientRect();
      setToolbar({ top:r.top-er.top-42, left:Math.max(0,r.left-er.left) });
    } else { setSelectedEl(null); setToolbar(null); }
  }

  function applyToSelected(fn) {
    if (!selectedEl) return; fn(selectedEl); onSave(ref.current?.innerHTML||"");
    const r = selectedEl.getBoundingClientRect(), er = ref.current.getBoundingClientRect();
    setToolbar({ top:r.top-er.top-42, left:Math.max(0,r.left-er.left) });
  }

  function exec(cmd, val) { document.execCommand(cmd,false,val||null); ref.current?.focus(); }
  function blk(tag) { document.execCommand("formatBlock",false,tag); ref.current?.focus(); }
  function handlePaste(e) { e.preventDefault(); document.execCommand("insertText",false,e.clipboardData.getData("text/plain")); }
  function saveRange() { const s=window.getSelection(); if(s&&s.rangeCount>0) savedRange.current=s.getRangeAt(0).cloneRange(); }

  function insertHtmlAtCursor(html) {
    const s = window.getSelection();
    if (savedRange.current) { s.removeAllRanges(); s.addRange(savedRange.current); }
    document.execCommand("insertHTML",false,html); onSave(ref.current?.innerHTML||"");
  }

  async function handleInlineUpload(e, type) {
    const file = e.target.files?.[0]; if (!file||!userId) return; e.target.value="";
    setUploading(true); setUploadType(type);
    try {
      const path = `uploads/${userId}/${Date.now()}.${file.name.split(".").pop()}`;
      const task = uploadBytesResumable(storageRef(storage,path), file);
      task.on("state_changed", null, err=>{alert("Upload selhal: "+err.message);setUploading(false);},
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          let html = "";
          if (type==="img")   html=`<img src="${url}" style="max-width:100%;height:auto;border-radius:8px;display:block;margin:8px auto" alt="">`;
          if (type==="video") html=`<video src="${url}" controls style="max-width:100%;border-radius:8px;display:block;margin:8px auto"></video>`;
          if (type==="audio") html=`<audio src="${url}" controls style="width:100%;margin:8px 0"></audio>`;
          insertHtmlAtCursor(html); setUploading(false); setUploadType(null);
        }
      );
    } catch { setUploading(false); }
  }

  const mediaToolbarBtns = selectedEl ? [
    { icon:"⇤", action: el=>{el.style.display="block";el.style.float="none";el.style.margin="8px 0";} },
    { icon:"⇔", action: el=>{el.style.display="block";el.style.float="none";el.style.margin="8px auto";} },
    { icon:"⇥", action: el=>{el.style.display="block";el.style.float="none";el.style.margin="8px 0 8px auto";} },
    { icon:"↔", action: el=>{el.style.display="block";el.style.float="none";el.style.width="100%";el.style.margin="8px 0";} },
    { sep:true },
    { icon:"◧", action: el=>{el.style.float="left";el.style.margin="4px 12px 4px 0";} },
    { icon:"◨", action: el=>{el.style.float="right";el.style.margin="4px 0 4px 12px";} },
    { sep:true },
    { icon:"25%",  action: el=>{el.style.width="25%";el.style.height="auto";} },
    { icon:"50%",  action: el=>{el.style.width="50%";el.style.height="auto";} },
    { icon:"75%",  action: el=>{el.style.width="75%";el.style.height="auto";} },
    { icon:"100%", action: el=>{el.style.width="100%";el.style.height="auto";} },
    { sep:true },
    { icon:"🗑", action: el=>{el.remove();setSelectedEl(null);setToolbar(null);}, danger:true },
  ] : [];

  const TB = [
    { cmd:"bold", label:<b>B</b> }, { cmd:"italic", label:<i>I</i> }, { cmd:"underline", label:<u>U</u> },
    { sep:true },
    { blk:"h2", label:<span style={{fontSize:"10px",fontWeight:700}}>H2</span> },
    { blk:"h3", label:<span style={{fontSize:"10px",fontWeight:700}}>H3</span> },
    { blk:"p",  label:<span style={{fontSize:"11px"}}>¶</span> },
    { sep:true },
    { cmd:"insertUnorderedList", label:<span style={{fontSize:"12px"}}>•≡</span> },
    { cmd:"insertOrderedList",   label:<span style={{fontSize:"10px"}}>1.</span> },
    { sep:true },
    { cmd:"justifyLeft",   label:<span style={{fontSize:"10px"}}>⇤</span> },
    { cmd:"justifyCenter", label:<span style={{fontSize:"10px"}}>⇔</span> },
    { cmd:"justifyRight",  label:<span style={{fontSize:"10px"}}>⇥</span> },
    { sep:true }, { emoji:true }, { sep:true }, { inlineMedia:true },
    { cmd:"removeFormat", label:<span style={{fontSize:"10px"}}>Ax</span> },
  ];

  return (
    <div>
      <input ref={imgRef2}   type="file" accept="image/*"           style={{display:"none"}} onChange={e=>handleInlineUpload(e,"img")} />
      <input ref={videoRef2} type="file" accept="video/*"           style={{display:"none"}} onChange={e=>handleInlineUpload(e,"video")} />
      <input ref={audioRef2} type="file" accept="audio/*,.mp3,.wav" style={{display:"none"}} onChange={e=>handleInlineUpload(e,"audio")} />
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"5px" }}>
        <span style={{ fontSize:".73rem", fontWeight:600, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:".5px" }}>Text stránky</span>
        <button onClick={onOpenHtml} style={{ display:"flex", alignItems:"center", gap:"5px", padding:"4px 10px", fontSize:".78rem", fontWeight:600, border:"1px solid #7c3aed", borderRadius:"6px", background:"#ede9fe", color:"#7c3aed", cursor:"pointer" }}>⟨/⟩ HTML editor</button>
      </div>
      <div style={{ display:"flex", gap:"2px", padding:"5px 6px", background:"var(--bg)", border:"1px solid var(--border)", borderRadius:"7px 7px 0 0", flexWrap:"wrap", alignItems:"center" }}>
        {TB.map((item,i) => {
          if (item.sep) return <span key={i} style={{ width:"1px", height:"15px", background:"var(--border)", margin:"0 2px" }} />;
          if (item.emoji) return <button key="em" onClick={()=>setShowEmoji(v=>!v)} style={{ border:"none", background:"transparent", cursor:"pointer", padding:"3px 5px", borderRadius:"4px", fontSize:"14px", lineHeight:1 }}>😊</button>;
          if (item.inlineMedia) return (
            <span key="im" style={{ display:"flex", gap:"2px", alignItems:"center" }}>
              {uploading ? <span style={{ fontSize:"10px", color:"#7c3aed", padding:"2px 6px" }}>⏳ {uploadType}…</span> : <>
                <button onClick={()=>{saveRange();imgRef2.current?.click();}}   style={{ border:"1px solid var(--border)", background:"transparent", cursor:"pointer", padding:"2px 5px", borderRadius:"4px", fontSize:"12px", color:"var(--text-muted)" }}>🖼</button>
                <button onClick={()=>{saveRange();videoRef2.current?.click();}} style={{ border:"1px solid var(--border)", background:"transparent", cursor:"pointer", padding:"2px 5px", borderRadius:"4px", fontSize:"12px", color:"var(--text-muted)" }}>▶</button>
                <button onClick={()=>{saveRange();audioRef2.current?.click();}} style={{ border:"1px solid var(--border)", background:"transparent", cursor:"pointer", padding:"2px 5px", borderRadius:"4px", fontSize:"12px", color:"var(--text-muted)" }}>🔊</button>
              </>}
            </span>
          );
          return <button key={i} onClick={()=>item.blk?blk(item.blk):exec(item.cmd)} style={{ border:"none", background:"transparent", cursor:"pointer", padding:"3px 6px", borderRadius:"4px", lineHeight:1, color:"var(--text)" }}>{item.label}</button>;
        })}
      </div>
      {showEmoji && (
        <div style={{ display:"flex", flexWrap:"wrap", gap:"2px", padding:"7px", background:"var(--bg)", border:"1px solid var(--border)", borderTop:"none" }}>
          {EMOJIS.map(e => <span key={e} onClick={()=>{exec("insertText",e);setShowEmoji(false);}} style={{ fontSize:"18px", cursor:"pointer", padding:"2px 3px", borderRadius:"4px", lineHeight:1 }} onMouseEnter={ev=>ev.target.style.background="var(--border)"} onMouseLeave={ev=>ev.target.style.background="transparent"}>{e}</span>)}
        </div>
      )}
      <div style={{ position:"relative" }}>
        {toolbar && selectedEl && (
          <div style={{ position:"absolute", top:`${toolbar.top}px`, left:toolbar.left, zIndex:100, background:"#1e1b4b", borderRadius:"8px", padding:"4px 6px", display:"flex", gap:"2px", alignItems:"center", flexWrap:"wrap", boxShadow:"0 4px 16px rgba(0,0,0,.3)", maxWidth:"300px" }}>
            {mediaToolbarBtns.map((btn,i) => {
              if (btn.sep) return <span key={i} style={{ width:"1px", height:"14px", background:"rgba(255,255,255,.2)", margin:"0 2px" }} />;
              return <button key={i} onClick={()=>applyToSelected(btn.action)} style={{ border:"none", background:"transparent", cursor:"pointer", padding:"3px 5px", borderRadius:"4px", fontSize:"11px", color:btn.danger?"#f87171":"#e2e8f0", fontWeight:500, lineHeight:1 }} onMouseEnter={ev=>ev.target.style.background=btn.danger?"rgba(248,113,113,.2)":"rgba(255,255,255,.15)"} onMouseLeave={ev=>ev.target.style.background="transparent"}>{btn.icon}</button>;
            })}
          </div>
        )}
        <div ref={ref} contentEditable suppressContentEditableWarning className="wysiwyg-editor"
          onInput={()=>onSave(ref.current?.innerHTML||"")} onBlur={()=>onSave(ref.current?.innerHTML||"")}
          onPaste={handlePaste} onClick={handleEditorClick}
          style={{ minHeight:"160px", border:"1px solid var(--border)", borderTop:"none", borderRadius:"0 0 7px 7px", padding:"10px", fontSize:".9rem", background:"var(--input-bg)", color:"var(--text)", outline:"none", lineHeight:1.65, fontFamily:"inherit", overflowY:"auto", maxHeight:"400px" }} />
      </div>
    </div>
  );
}

// ─── Pomocné komponenty ───────────────────────────────────────────────────────
function FieldInput({ label, value, onChange, placeholder }) {
  return (
    <div style={{ marginBottom:"13px" }}>
      <label style={{ display:"block", fontSize:".73rem", fontWeight:600, color:"var(--text-muted)", marginBottom:"5px", textTransform:"uppercase", letterSpacing:".5px" }}>{label}</label>
      <input type="text" placeholder={placeholder} value={value||""} onChange={e=>onChange(e.target.value)}
        style={{ width:"100%", padding:"9px 11px", border:"1px solid var(--border)", borderRadius:"8px", background:"var(--input-bg)", color:"var(--text)", fontSize:".9rem", outline:"none", fontFamily:"inherit" }} />
    </div>
  );
}

function Toast({ msg }) {
  if (!msg) return null;
  return <div style={{ position:"fixed", bottom:"20px", right:"20px", background:"#1e1b4b", color:"#fff", padding:"10px 18px", borderRadius:"10px", fontSize:".88rem", fontWeight:500, zIndex:10000, boxShadow:"0 4px 20px rgba(0,0,0,.3)" }}>{msg}</div>;
}

// ─── EditablePageContent — funguje ve všech mockupech i desktop náhledu ───────
function EditablePageContent({ hero, page, formFields, onUpdate, renderMediaBlock, mediaBlocks, onHeroClick, heroKey }) {
  return (
    <div>
      <style>{INLINE_STYLES}</style>

      {/* Hero iframe s klikatelnými zónami */}
      <div style={{ position:"relative" }}>
        <iframe
          key={heroKey || hero?.height}
          srcDoc={buildHeroHtml(hero)}
          sandbox="allow-scripts"
          scrolling="no"
          onLoad={e => {
            try {
              const d = e.target.contentDocument;
              const h = d?.documentElement?.scrollHeight || d?.body?.scrollHeight;
              if (h) e.target.style.height = h + "px";
            } catch {}
          }}
          style={{
            border:"none", width:"100%",
            minHeight: hero?.height === "100vh" ? "100vh" : (hero?.height || "400px"),
            display:"block", overflow:"hidden",
            pointerEvents:"none",
          }}
        />
        <style>{`
          .hz{position:absolute;cursor:pointer;border:2px solid transparent;border-radius:6px;transition:border-color .15s,background .15s;box-sizing:border-box;}
          .hz:hover{border-color:#7c3aed99;background:rgba(124,58,237,0.07);}
          .hz:hover .hz-tip{display:flex;}
          .hz-tip{display:none;position:absolute;top:-26px;left:0;background:#7c3aed;color:#fff;font-size:10px;font-weight:700;padding:3px 8px;border-radius:4px;white-space:nowrap;z-index:20;align-items:center;gap:4px;pointer-events:none;box-shadow:0 2px 8px rgba(124,58,237,.35);}
        `}</style>
        {hero?.showBadge && (
          <div className="hz" style={{top:"14%",left:"4%",width:"30%",height:"7%"}} onClick={()=>onHeroClick("badgeText")}>
            <span className="hz-tip">✏️ Badge text</span>
          </div>
        )}
        {hero?.showH1 && (
          <div className="hz" style={{top:"22%",left:"3%",width:"55%",height:"28%"}} onClick={()=>onHeroClick("h1Line1")}>
            <span className="hz-tip">✏️ Hlavní nadpis</span>
          </div>
        )}
        {hero?.showSub && (
          <div className="hz" style={{top:"51%",left:"3%",width:"50%",height:"10%"}} onClick={()=>onHeroClick("subText")}>
            <span className="hz-tip">✏️ Podnadpis</span>
          </div>
        )}
        <div className="hz" style={{top:"68%",left:"3%",width:"45%",height:"14%"}} onClick={()=>onHeroClick("btn1Text")}>
          <span className="hz-tip">✏️ Tlačítka</span>
        </div>
        {hero?.showMedia && (
          <div className="hz" style={{top:"8%",right:"2%",width:"38%",height:"80%"}} onClick={()=>onHeroClick("mediaUpload")}>
            <span className="hz-tip">🖼 Media</span>
          </div>
        )}
      </div>

      {/* ── Headline & Subline ── */}
      <div className="inline-section" style={{ padding:"20px 24px", borderBottom:"1px solid #f0f0f0", position:"relative" }}>
        <span className="inline-section-label">✏️ Hero text</span>

        {page.image && (
          <img src={page.image} alt=""
            style={{ width:"100%", maxHeight:"220px", objectFit:"cover", borderRadius:"10px", marginBottom:"14px" }}
            onError={e => (e.target.style.display = "none")} />
        )}

        <div className="inline-field">
          <h1
            className="inline-editable"
            contentEditable suppressContentEditableWarning
            data-placeholder="Klikni a napiš nadpis..."
            onBlur={e => onUpdate("headline", e.currentTarget.innerText)}
            style={{ fontSize:"1.4rem", fontWeight:800, color:"#1e1b4b", marginBottom:"8px", lineHeight:1.2, outline:"none" }}
            dangerouslySetInnerHTML={{ __html: page.headline || "" }}
          />
        </div>

        <div className="inline-field">
          <p
            className="inline-editable"
            contentEditable suppressContentEditableWarning
            data-placeholder="Klikni a napiš podnadpis..."
            onBlur={e => onUpdate("subline", e.currentTarget.innerText)}
            style={{ fontSize:".9rem", color:"#6b7280", outline:"none" }}
            dangerouslySetInnerHTML={{ __html: page.subline || "" }}
          />
        </div>
      </div>

      {/* ── Tělo stránky ── */}
      <div className="inline-section" style={{ padding:"16px 24px", borderBottom:"1px solid #f0f0f0", position:"relative" }}>
        <span className="inline-section-label">✏️ Tělo stránky</span>

        {(mediaBlocks || []).filter(m => (m.position || "below") === "above").map((m, i) => renderMediaBlock(m, i))}

        <div
          className="inline-editable page-content"
          contentEditable suppressContentEditableWarning
          data-placeholder="Klikni a začni psát obsah stránky..."
          onBlur={e => onUpdate("text", e.currentTarget.innerHTML)}
          style={{ fontSize:".9rem", color:"#374151", lineHeight:1.75, outline:"none", minHeight:"50px" }}
          dangerouslySetInnerHTML={{ __html: page.text || "" }}
        />

        {(mediaBlocks || []).filter(m => (m.position || "below") === "below").map((m, i) => renderMediaBlock(m, i))}

        <div style={{ clear:"both" }} />

        {page.video && (
          <div style={{ marginTop:"14px", borderRadius:"10px", overflow:"hidden", aspectRatio:"16/9" }}>
            <iframe src={page.video.replace("watch?v=","embed/")} style={{ width:"100%", height:"100%", border:"none" }} allowFullScreen />
          </div>
        )}
      </div>

      {/* ── CTA & Formulář ── */}
      <div className="inline-section" style={{ padding:"16px 24px 28px", position:"relative" }}>
        <span className="inline-section-label">✏️ CTA & Formulář</span>

        <div style={{ display:"flex", flexDirection:"column", gap:"7px" }}>
          {formFields.map((f, i) => {
            if (f === "Zpráva") return (
              <textarea key={i} placeholder="Zpráva"
                style={{ width:"100%", border:"1px solid #e5e7eb", borderRadius:"7px", padding:"7px 10px", fontSize:".82rem", minHeight:"50px", resize:"none", fontFamily:"inherit", background:"#f9fafb", outline:"none", boxSizing:"border-box" }} />
            );
            if (f === "Souhlas GDPR") return (
              <label key={i} style={{ display:"flex", gap:"6px", alignItems:"flex-start", fontSize:".75rem", color:"#6b7280" }}>
                <input type="checkbox" style={{ marginTop:"2px" }} /> Souhlasím se zpracováním osobních údajů
              </label>
            );
            return (
              <input key={i} placeholder={f}
                style={{ width:"100%", border:"1px solid #e5e7eb", borderRadius:"7px", padding:"7px 10px", fontSize:".82rem", background:"#f9fafb", outline:"none", boxSizing:"border-box" }} />
            );
          })}

          {/* Cena — inline editovatelná */}
          <div
            className="inline-editable"
            contentEditable suppressContentEditableWarning
            data-placeholder="Klikni a napiš cenu..."
            onBlur={e => onUpdate("price", e.currentTarget.innerText)}
            style={{ fontSize:"1.6rem", fontWeight:800, color:"#7c3aed", outline:"none", minHeight:"1em" }}
            dangerouslySetInnerHTML={{ __html: page.price || "" }}
          />

          {/* CTA tlačítko — inline editovatelné */}
          <div
            className="inline-editable"
            contentEditable suppressContentEditableWarning
            data-placeholder="Text tlačítka..."
            onBlur={e => onUpdate("btnText", e.currentTarget.innerText)}
            style={{ display:"block", padding:"11px", background:"#7c3aed", color:"#fff", borderRadius:"9px", fontWeight:700, fontSize:".95rem", textAlign:"center", outline:"none", cursor:"text" }}
            dangerouslySetInnerHTML={{ __html: page.btnText || "" }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Hlavní komponenta ────────────────────────────────────────────────────────
export default function PageEditor() {
  const { id }   = useParams();
  const { user } = useAuthState();
  const navigate = useNavigate();

  const [page,    setPage]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast,   setToast]   = useState("");
  const [activeTab, setActiveTab] = useState(0);
  const [devMode,   setDevMode]   = useState("mockup-laptop");
  const [htmlEditorOpen, setHtmlEditorOpen] = useState(false);
  const [heroes, setHeroes] = useState({ full: DEFAULT_HERO });
  const heroOverlayRef = useRef(null);
  const panelRef = useRef(null);
  const nameInputRef = useRef(null);

  const [editorKey,         setEditorKey]         = useState(0);
  const [editorInitialHtml, setEditorInitialHtml] = useState("");
  const [showTranslatePicker, setShowTranslatePicker] = useState(false);
  const [editingName,    setEditingName]    = useState(false);
  const [showAIGen,      setShowAIGen]      = useState(false);
  const [showPageFields, setShowPageFields] = useState(false);
  const [aiEditInput,   setAiEditInput]   = useState("");
  const [aiEditLoading, setAiEditLoading] = useState(false);
  const [mediaBlocks,   setMediaBlocks]   = useState([]);
  const [expandedMedia, setExpandedMedia] = useState(null);
  const [formFields,    setFormFields]    = useState(["Jméno","Email"]);
  const [publishing,    setPublishing]    = useState(false);
  const [mobileView,    setMobileView]    = useState("editor");

  // Textová pole která jsou SDÍLENÁ mezi všemi mockupy
  const SHARED_HERO_KEYS = [
    "showBadge","badgeText",
    "showH1","h1Line1","h1Accent","h1Line2",
    "showSub","subText",
    "showStats","stats",
    "showScroll",
    "btn1","btn1Text","btn1Link",
    "btn2","btn2Text","btn2Link",
    "btnStyle",
    "textAnim",
    "mediaUrl","mediaType","mediaControls","mediaAutoplay","mediaLoop",
  ];

  // Vizuální pole která jsou PER-MOCKUP
  // (bg, bgCustom, bgCustom2, accentCustom, overlay, layout, height,
  //  showMedia, mediaPos, mediaStyle, mediaSize, mediaRatio, bgAnim)

  // Klíč pro force-refresh hero iframe při změně textu
  const heroKey = `${devMode}-${currentHero?.height}-${currentHero?.badgeText}-${currentHero?.h1Line1}-${currentHero?.h1Accent}-${currentHero?.h1Line2}-${currentHero?.subText}-${currentHero?.btn1Text}-${currentHero?.btn2Text}`;
  const isMobile = window.innerWidth < 768;
  const isMockup = devMode.startsWith("mockup");
  const publicUrl = `${PUBLIC_BASE_URL}${id}`;
  const hasUnpublishedChanges = page?.updatedAt && page?.publishedAt && page.updatedAt > page.publishedAt;

  function setCurrentHero(h) {
    setHeroes(prev => {
      const updated = { ...prev, [devMode]: h };

      // Synchronizuj sdílené klíče do VŠECH ostatních mockupů
      const sharedChanges = {};
      SHARED_HERO_KEYS.forEach(k => {
        if (h[k] !== (prev[devMode] || {})[k]) sharedChanges[k] = h[k];
      });

      if (Object.keys(sharedChanges).length > 0) {
        Object.keys(updated).forEach(key => {
          if (key !== devMode) {
            updated[key] = { ...updated[key], ...sharedChanges };
          }
        });
      }

      return updated;
    });
  }

  function switchDevice(key) {
    setDevMode(key);
    setHeroes(h => {
      if (!h[key]) {
        // Nový mockup zdědí sdílené texty z aktuálního + vizuální z DEFAULT
        const base = h[devMode] || h["full"] || DEFAULT_HERO;
        const newHero = { ...DEFAULT_HERO };
        SHARED_HERO_KEYS.forEach(k => { newHero[k] = base[k]; });
        return { ...h, [key]: newHero };
      }
      return h;
    });
  }

  useEffect(() => {
    async function fetchPage() {
      const snap = await getDoc(doc(db,"pages",id));
      if (snap.exists()) {
        const data = { id:snap.id, ...snap.data() };
        setPage(data);
        setEditorInitialHtml(data.text||"");
        if (data.formFields) setFormFields(data.formFields);
        if (data.heroes) setHeroes(data.heroes);
        else if (data.hero) setHeroes({ full:data.hero });
      }
      setLoading(false);
    }
    fetchPage();
  }, [id]);

  function showToast(msg) { setToast(msg); setTimeout(()=>setToast(""),3000); }
  function update(field, value) { setPage(p => ({ ...p, [field]:value })); }
  function updateMedia(i, changes) { setMediaBlocks(b => b.map((m,idx) => idx===i?{...m,...changes}:m)); }

  async function handleSave() {
    const { id:_id, ...data } = page;
    await updateDoc(doc(db,"pages",id), { ...data, heroes, hero:heroes["full"]||DEFAULT_HERO, formFields, updatedAt:Date.now() });
    showToast("✓ Uloženo");
  }

  async function handlePublish() {
    setPublishing(true);
    try {
      const { id:_id, ...data } = page;
      await updateDoc(doc(db,"pages",id), { ...data, heroes, hero:heroes["full"]||DEFAULT_HERO, formFields, published:true, publishedAt:Date.now(), updatedAt:Date.now() });
      setPage(p => ({ ...p, published:true }));
      await navigator.clipboard.writeText(publicUrl);
      showToast("🚀 Publikováno! URL zkopírována.");
      window.open(publicUrl,"_blank");
    } catch { showToast("Publikování selhalo."); }
    finally { setPublishing(false); }
  }

  async function callCloudAI(prompt) {
    const fn = httpsCallable(getFunctions(app),"translate");
    const result = await fn({ prompt, max_tokens:4000 });
    const raw = result.data.result||"";
    const clean = raw.replace(/```json|```/g,"").trim();
    try { return JSON.parse(clean); }
    catch { const fixed=clean.replace(/,\s*"[^"]*":\s*"[^"]*$/,"").replace(/,?\s*$/,"")+"}"; return JSON.parse(fixed); }
  }

  async function handleAIEdit() {
    if (!aiEditInput.trim()) return;
    setAiEditLoading(true);
    try {
      const parsed = await callCloudAI(`Uprav tento HTML obsah dle instrukce: "${aiEditInput}". Zachovej HTML formátování. Vrať POUZE raw JSON: {"text":"..."}\nOriginál: ${page.text||""}`);
      if (parsed.text) { update("text",parsed.text); setEditorInitialHtml(parsed.text); setEditorKey(k=>k+1); }
      setAiEditInput(""); showToast("✨ Text upraven!");
    } catch { showToast("AI asistent selhal."); }
    finally { setAiEditLoading(false); }
  }

  function renderMediaBlock(m, i) {
    const w=m.width||100, aln=m.align||"full", flt=m.float||"none", wrap=flt!=="none";
    const outer={ marginTop:"12px", width:wrap?`${w}%`:"100%", float:wrap?flt:"none", marginLeft:wrap&&flt==="right"?"8px":aln==="center"&&!wrap?"auto":0, marginRight:wrap&&flt==="left"?"8px":aln==="center"&&!wrap?"auto":0 };
    const inner={ width:wrap?"100%":`${w}%`, margin:!wrap?(aln==="center"?"0 auto":aln==="right"?"0 0 0 auto":"0"):undefined, display:"block", borderRadius:"8px", overflow:"hidden" };
    if (m.type==="img") return <div key={i} style={outer}><img src={m.url} alt="" style={{...inner,objectFit:"cover"}} onError={e=>e.target.style.display="none"} /></div>;
    if (m.type==="video") return <div key={i} style={outer}><div style={inner}>{m.url.includes("youtube")||m.url.includes("youtu.be")?<div style={{aspectRatio:"16/9"}}><iframe src={m.url.replace("watch?v=","embed/")} style={{width:"100%",height:"100%",border:"none"}} allowFullScreen /></div>:<video src={m.url} style={{width:"100%"}} controls={m.controls!==false} autoPlay={!!m.autoplay} loop={!!m.loop} muted={!!m.muted} />}</div></div>;
    if (m.type==="audio") return <div key={i} style={outer}><audio src={m.url} style={{width:"100%"}} controls={m.controls!==false} autoPlay={!!m.autoplay} loop={!!m.loop} muted={!!m.muted} /></div>;
    return null;
  }

  const S = {
    input:   { width:"100%", padding:"7px 10px", border:"1px solid var(--border)", borderRadius:"7px", background:"var(--input-bg)", color:"var(--text)", fontSize:".88rem", outline:"none", fontFamily:"inherit" },
    btnPrim: { padding:"7px 14px", fontSize:".85rem", border:"none", borderRadius:"7px", background:"#7c3aed", color:"#fff", cursor:"pointer", fontWeight:600 },
    btnOut:  { padding:"7px 12px", fontSize:".85rem", border:"1px solid var(--border)", borderRadius:"7px", background:"transparent", color:"var(--text)", cursor:"pointer" },
    btnSm:   { padding:"5px 10px", fontSize:".8rem", border:"1px solid var(--border)", borderRadius:"6px", background:"transparent", color:"var(--text-muted)", cursor:"pointer", display:"flex", alignItems:"center", gap:"4px" },
    card:    { background:"var(--bg)", border:"1px solid var(--border)", borderRadius:"9px", padding:"10px 13px", marginBottom:"8px" },
    lbl:     { fontSize:".73rem", fontWeight:600, color:"var(--text-muted)", textTransform:"uppercase", letterSpacing:".5px", display:"block", marginBottom:"4px" },
    row:     { display:"flex", gap:"7px", alignItems:"center" },
    divider: { border:"none", borderTop:"1px solid var(--border)", margin:"13px 0" },
  };

  // Sdílené props pro EditablePageContent
  function highlightField(el) {
    if (!el) return;
    el.scrollIntoView({ behavior:"smooth", block:"center" });
    el.focus();
    el.style.transition = "background .2s";
    el.style.background = "#fef08a";
    el.style.borderColor = "#eab308";
    setTimeout(() => {
      el.style.background = "";
      el.style.borderColor = "";
    }, 1800);
  }

  function handleHeroClick(field) {
    setActiveTab(0);
    setTimeout(() => {
      const el = panelRef.current?.querySelector(`[data-hero-field="${field}"]`);
      highlightField(el);
    }, 120);
  }

  const editableProps = {
    hero: currentHero,
    page,
    formFields,
    onUpdate: update,
    renderMediaBlock,
    mediaBlocks,
    onHeroClick: handleHeroClick,
    heroKey,
  };

  if (loading) return <div className="loading">Načítám editor...</div>;
  if (!page)   return <div className="loading">Stránka nenalezena.</div>;

  return (
    <>
      <Toast msg={toast} />
      {htmlEditorOpen && (
        <HtmlEditorModal initialHtml={page.text||""} pageName={page.name||"Stránka"} pageData={{...page,formFields}}
          onSave={html=>{update("text",html);setEditorInitialHtml(html);setEditorKey(k=>k+1);showToast("✓ HTML uloženo");}}
          onClose={()=>setHtmlEditorOpen(false)} />
      )}

      <div style={{ display:"flex", height:"100vh", overflow:"hidden", fontFamily:"var(--font-sans,'Inter',sans-serif)", flexDirection:isMobile?"column":"row" }}>

        {isMobile && (
          <div style={{ display:"flex", background:"var(--bg-card)", borderBottom:"1px solid var(--border)", flexShrink:0 }}>
            <button onClick={()=>setMobileView("editor")} style={{ flex:1, padding:"10px", fontSize:".85rem", fontWeight:600, border:"none", background:mobileView==="editor"?"#7c3aed":"transparent", color:mobileView==="editor"?"#fff":"var(--text-muted)", cursor:"pointer" }}>✏️ Editor</button>
            <button onClick={()=>setMobileView("preview")} style={{ flex:1, padding:"10px", fontSize:".85rem", fontWeight:600, border:"none", background:mobileView==="preview"?"#7c3aed":"transparent", color:mobileView==="preview"?"#fff":"var(--text-muted)", cursor:"pointer" }}>👁️ Náhled</button>
          </div>
        )}

        {/* ══ LEVÝ PANEL ══ */}
        <div ref={panelRef} style={{ width:isMobile?"100%":"380px", minWidth:isMobile?"unset":"360px", background:"var(--bg-card)", borderRight:"1px solid var(--border)", display:isMobile&&mobileView!=="editor"?"none":"flex", flexDirection:"column", overflow:"hidden", flex:isMobile?1:"unset" }}>

          {/* Topbar */}
          <div style={{ padding:"10px 14px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", gap:"7px", flexShrink:0 }}>
            <button style={S.btnOut} onClick={()=>navigate("/pages")}>← Zpět</button>
            {editingName ? (
              <input ref={nameInputRef} value={page.name||""} onChange={e=>update("name",e.target.value)} onBlur={()=>setEditingName(false)} onKeyDown={e=>e.key==="Enter"&&setEditingName(false)} autoFocus
                style={{ fontWeight:700, flex:1, fontSize:".92rem", border:"none", borderBottom:"2px solid #7c3aed", outline:"none", background:"transparent", color:"var(--text)", padding:"2px 4px" }} />
            ) : (
              <span onClick={()=>setEditingName(true)} style={{ fontWeight:700, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontSize:".92rem", cursor:"text", borderBottom:"2px solid transparent", padding:"2px 4px" }}
                onMouseEnter={e=>e.currentTarget.style.borderBottomColor="#c4b5fd"} onMouseLeave={e=>e.currentTarget.style.borderBottomColor="transparent"}>
                {page.name||"Editor"}
              </span>
            )}
            <button style={S.btnOut} onClick={handleSave}>Uložit</button>
            <button onClick={handlePublish} disabled={publishing}
              style={{ ...S.btnPrim, background:page.published&&!hasUnpublishedChanges?"#059669":"#7c3aed", display:"flex", alignItems:"center", gap:"5px", position:"relative" }}>
              {publishing?"⏳":page.published&&!hasUnpublishedChanges?"✓ Publikováno":"🚀 Publikovat"}
              {hasUnpublishedChanges && <span style={{ position:"absolute", top:"-4px", right:"-4px", width:"10px", height:"10px", background:"#f97316", borderRadius:"50%", border:"2px solid white" }}/>}
            </button>
          </div>

          {/* Publish URL */}
          {page.published && (
            <div style={{ padding:"7px 14px", background:"#f0fdf4", borderBottom:"1px solid #bbf7d0", display:"flex", alignItems:"center", gap:"7px", flexShrink:0 }}>
              <span style={{ fontSize:".75rem", color:"#059669", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>🌐 {publicUrl}</span>
              <button style={{ ...S.btnSm, color:"#059669", border:"1px solid #059669" }} onClick={()=>{navigator.clipboard.writeText(publicUrl);showToast("URL zkopírována!");}}>Kopírovat</button>
              <button style={{ ...S.btnSm, color:"#059669", border:"1px solid #059669" }} onClick={()=>window.open(publicUrl,"_blank")}>Otevřít</button>
            </div>
          )}

          {/* Jazyk */}
          <div style={{ padding:"7px 14px", borderBottom:"1px solid var(--border)", background:"var(--bg)", flexShrink:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
              <span style={{ fontSize:".72rem", fontWeight:600, color:"var(--text-muted)" }}>JAZYK:</span>
              <select value={page.lang||"cs"} onChange={e=>update("lang",e.target.value)} style={{ ...S.input, width:"auto", padding:"3px 6px", fontSize:".8rem" }}>
                {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.flag} {l.name}</option>)}
              </select>
            </div>
          </div>

          {/* Záložky */}
          <div style={{ display:"flex", borderBottom:"1px solid var(--border)", flexShrink:0 }}>
            {[{label:"🏠 Hero",color:"#7c3aed"},{label:"📝 Obsah",color:"#0891b2"},{label:"⚙️ Akce",color:"#16a34a"}].map((tab,i) => (
              <button key={i} onClick={()=>setActiveTab(i)}
                style={{ flex:1, padding:"8px 2px 7px", fontSize:".72rem", fontWeight:600, border:"none", background:activeTab===i?tab.color+"15":"transparent", cursor:"pointer", color:activeTab===i?tab.color:"var(--text-muted)", borderBottom:activeTab===i?`2px solid ${tab.color}`:"2px solid transparent" }}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* ZÁLOŽKA 0: Hero */}
          {activeTab===0 && (
            <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column" }}>
              <div style={{ padding:"10px 12px", borderBottom:"1px solid var(--border)" }}>
                <div onClick={()=>setShowPageFields(v=>!v)} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer", marginBottom:showPageFields?"8px":0 }}>
                  <span style={{ fontSize:".78rem", fontWeight:600, color:"var(--text-muted)" }}>📄 {page.name||"Název stránky"}</span>
                  <span style={{ fontSize:"11px", color:"var(--text-muted)" }}>{showPageFields?"▲":"▼"}</span>
                </div>
                {showPageFields && (
                  <div style={{ display:"flex", flexDirection:"column", gap:"4px", marginBottom:"8px" }}>
                    <input value={page.name||""} onChange={e=>update("name",e.target.value)} style={{ ...S.input, fontSize:".82rem" }} placeholder="Název stránky"/>
                    <input value={page.headline||""} onChange={e=>update("headline",e.target.value)} style={{ ...S.input, fontSize:".82rem" }} placeholder="Nadpis (headline)"/>
                    <input value={page.subline||""} onChange={e=>update("subline",e.target.value)} style={{ ...S.input, fontSize:".82rem" }} placeholder="Podnadpis"/>
                  </div>
                )}
                <div style={{ display:"flex", gap:"6px" }}>
                  <button onClick={()=>setShowTranslatePicker(v=>!v)}
                    style={{ flex:1, padding:"6px 8px", fontSize:".8rem", fontWeight:600, border:"1px solid #7c3aed", borderRadius:"7px", background:showTranslatePicker?"#7c3aed":"#ede9fe", color:showTranslatePicker?"#fff":"#7c3aed", cursor:"pointer" }}>
                    🌍 Přeložit
                  </button>
                  <button onClick={()=>setShowAIGen(v=>!v)}
                    style={{ flex:2, padding:"6px 8px", fontSize:".8rem", fontWeight:700, border:"none", borderRadius:"7px", background:"linear-gradient(90deg,#7c3aed,#a78bfa)", color:"#fff", cursor:"pointer" }}>
                    ✨ AI generátor stránky
                  </button>
                </div>
                {showTranslatePicker && (
                  <div style={{ marginTop:"8px" }}>
                    <AITranslator page={page} hero={currentHero} currentLang={page?.lang||"cs"} userId={user?.uid}
                      onClose={()=>setShowTranslatePicker(false)} onNavigate={id=>navigate(`/editor/${id}`)}/>
                  </div>
                )}
                {showAIGen && (
                  <div style={{ marginTop:"8px" }}>
                    <AIPageGenerator lang={page?.lang||"cs"}
                      onGenerated={({page:p,hero:h})=>{
                        setPage(prev=>({...prev,...p})); setEditorInitialHtml(p.text||""); setEditorKey(k=>k+1);
                        if(h){const nh={...DEFAULT_HERO,...h,showBadge:true,showH1:true,showSub:true,btn1:true,btn2:true};setHeroes(prev=>({...prev,[devMode]:nh}));}
                        setShowAIGen(false); showToast("✨ Celá stránka vygenerována!");
                      }}
                      onClose={()=>setShowAIGen(false)}/>
                  </div>
                )}
              </div>
              <HeroEditor hero={currentHero} onChange={setCurrentHero} userId={user?.uid} />
            </div>
          )}

          {activeTab!==0 && (
            <div style={{ flex:1, overflowY:"auto" }}>

              {/* ZÁLOŽKA 1: Obsah */}
              {activeTab===1 && (
                <div style={{ padding:"15px" }}>
                  <FieldInput label="Obrázek (URL)" value={page.image} onChange={v=>update("image",v)} placeholder="https://..." />
                  <WysiwygEditor key={editorKey} initialHtml={editorInitialHtml} onSave={html=>update("text",html)} onOpenHtml={()=>setHtmlEditorOpen(true)} userId={user?.uid} />
                  <div style={{ ...S.row, marginTop:"8px" }}>
                    <input placeholder="AI: zkrať text a přidej urgenci..." value={aiEditInput} onChange={e=>setAiEditInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAIEdit()} style={{ ...S.input, flex:1 }} />
                    <button style={{ ...S.btnPrim, display:"flex", alignItems:"center", gap:"4px", whiteSpace:"nowrap" }} onClick={handleAIEdit} disabled={aiEditLoading}>{aiEditLoading?"⏳":"✨"} Použít</button>
                  </div>
                  <MediaUploader userId={user?.uid} onInsert={({type,url})=>setMediaBlocks(b=>[...b,{type,url}])} />
                  {mediaBlocks.map((m,i) => (
                    <div key={i} style={{ marginTop:"6px" }}>
                      <div style={{ ...S.card, display:"flex", alignItems:"center", gap:"8px", marginBottom:0, borderRadius:expandedMedia===i?"9px 9px 0 0":"9px", cursor:"pointer" }}
                        onClick={()=>setExpandedMedia(expandedMedia===i?null:i)}>
                        <span>{m.type==="img"?"🖼":m.type==="video"?"▶":"🔊"}</span>
                        <span style={{ flex:1, fontSize:".8rem", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{m.url.split("/").pop().slice(0,30)}</span>
                        <span style={{ fontSize:".75rem", color:"var(--text-muted)" }}>{expandedMedia===i?"▲":"▼"}</span>
                        <span onClick={e=>{e.stopPropagation();setMediaBlocks(b=>b.filter((_,idx)=>idx!==i));}} style={{ cursor:"pointer", color:"var(--text-muted)", padding:"0 2px" }}>✕</span>
                      </div>
                      {expandedMedia===i && (
                        <div style={{ background:"var(--bg)", border:"1px solid var(--border)", borderTop:"none", borderRadius:"0 0 9px 9px", padding:"10px 12px" }}>
                          <div style={{ marginBottom:"8px" }}>
                            <span style={S.lbl}>Zarovnání</span>
                            <div style={{ display:"flex", gap:"4px" }}>
                              {[{v:"left",icon:"⇤"},{v:"center",icon:"⇔"},{v:"right",icon:"⇥"},{v:"full",icon:"↔"}].map(opt => (
                                <button key={opt.v} onClick={()=>updateMedia(i,{align:opt.v})}
                                  style={{ flex:1, padding:"5px 4px", fontSize:"11px", border:`1px solid ${(m.align||"full")===opt.v?"#7c3aed":"var(--border)"}`, borderRadius:"6px", background:(m.align||"full")===opt.v?"#ede9fe":"transparent", color:(m.align||"full")===opt.v?"#7c3aed":"var(--text-muted)", cursor:"pointer" }}>
                                  {opt.icon}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div style={{ marginBottom:"8px" }}>
                            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"4px" }}>
                              <span style={S.lbl}>Velikost</span>
                              <span style={{ fontSize:".75rem", color:"var(--text-muted)" }}>{m.width||100}%</span>
                            </div>
                            <input type="range" min={10} max={100} step={5} value={m.width||100} onChange={e=>updateMedia(i,{width:Number(e.target.value)})} style={{ width:"100%" }} />
                          </div>
                          <div style={{ marginBottom:"8px" }}>
                            <span style={S.lbl}>Obtékání</span>
                            <div style={{ display:"flex", gap:"4px" }}>
                              {[{v:"none",label:"Žádné"},{v:"left",label:"Vlevo"},{v:"right",label:"Vpravo"}].map(opt => (
                                <button key={opt.v} onClick={()=>updateMedia(i,{float:opt.v})}
                                  style={{ flex:1, padding:"5px 4px", fontSize:"11px", border:`1px solid ${(m.float||"none")===opt.v?"#7c3aed":"var(--border)"}`, borderRadius:"6px", background:(m.float||"none")===opt.v?"#ede9fe":"transparent", color:(m.float||"none")===opt.v?"#7c3aed":"var(--text-muted)", cursor:"pointer" }}>
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          {(m.type==="video"||m.type==="audio") && (
                            <div>
                              <span style={S.lbl}>Přehrávač</span>
                              {[{k:"controls",label:"Ovládací prvky"},{k:"autoplay",label:"Autoplay"},{k:"loop",label:"Loop"},{k:"muted",label:"Ztlumit"}].map(opt => (
                                <label key={opt.k} style={{ display:"flex", alignItems:"center", gap:"6px", fontSize:".82rem", cursor:"pointer", marginBottom:"4px" }}>
                                  <input type="checkbox" checked={!!m[opt.k]} onChange={e=>updateMedia(i,{[opt.k]:e.target.checked})} />{opt.label}
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  <hr style={S.divider} />
                  <FieldInput label="Video (YouTube URL)" value={page.video} onChange={v=>update("video",v)} placeholder="https://youtube.com/..." />
                </div>
              )}

              {/* ZÁLOŽKA 2: Akce */}
              {activeTab===2 && (
                <PageActions
                  page={page}
                  update={update}
                  formFields={formFields}
                  setFormFields={setFormFields}
                  userId={user?.uid}
                />
              )}
            </div>
          )}
        </div>

        {/* ══ PRAVÝ NÁHLED ══ */}
        <div style={{ flex:1, overflowY:"auto", background:isMockup?"#1a1a2e":"#f0f0f5", display:isMobile&&mobileView!=="preview"?"none":"flex", flexDirection:"column", alignItems:"center" }}>

          <div style={{ display:"flex", gap:"5px", padding:"8px 12px", background:isMockup?"#16162a":"#ffffff", justifyContent:"center", borderBottom:`1px solid ${isMockup?"#2e2e4e":"#e5e5f0"}`, flexWrap:"wrap", flexShrink:0, width:"100%" }}>
            {DEVICES.map(d => (
              <button key={d.key} onClick={()=>switchDevice(d.key)}
                style={{ padding:"5px 10px", fontSize:".78rem", border:`1px solid ${devMode===d.key?"#7c3aed":isMockup?"rgba(255,255,255,.2)":"#d1d5db"}`, borderRadius:"7px", background:devMode===d.key?"#7c3aed":isMockup?"transparent":"#f9fafb", color:devMode===d.key?"#fff":isMockup?"rgba(255,255,255,.6)":"#374151", cursor:"pointer", position:"relative", fontWeight:devMode===d.key?600:400 }}>
                {d.label}
                {heroes[d.key]&&d.key!=="full" && <span style={{ position:"absolute", top:"2px", right:"2px", width:"6px", height:"6px", background:devMode===d.key?"#fff":"#7c3aed", borderRadius:"50%" }} />}
              </button>
            ))}
          </div>

          {/* ── MOCKUP ZOBRAZENÍ ── */}
          {isMockup && (
            <div style={{ flex:1, display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"30px 20px", overflowY:"auto", width:"100%" }}>

              {/* 📱 MOBIL */}
              {devMode==="mockup-mobile" && (
                <div style={{ position:"relative", flexShrink:0 }}>
                  <div style={{ background:"#111", borderRadius:"48px", padding:"14px", boxShadow:"0 40px 100px rgba(0,0,0,.7), inset 0 0 0 2px #333, inset 0 0 0 3px #111", position:"relative", width:"300px" }}>
                    <div style={{ position:"absolute", top:"14px", left:"50%", transform:"translateX(-50%)", width:"90px", height:"26px", background:"#111", borderRadius:"0 0 18px 18px", zIndex:10, display:"flex", alignItems:"center", justifyContent:"center", gap:"6px" }}>
                      <div style={{ width:"8px", height:"8px", background:"#222", borderRadius:"50%" }} />
                      <div style={{ width:"4px", height:"4px", background:"#333", borderRadius:"50%" }} />
                    </div>
                    <div style={{ position:"absolute", right:"-4px", top:"90px", width:"4px", height:"50px", background:"#222", borderRadius:"0 3px 3px 0" }} />
                    <div style={{ position:"absolute", left:"-4px", top:"80px", width:"4px", height:"35px", background:"#222", borderRadius:"3px 0 0 3px" }} />
                    <div style={{ position:"absolute", left:"-4px", top:"125px", width:"4px", height:"35px", background:"#222", borderRadius:"3px 0 0 3px" }} />
                    <div style={{ borderRadius:"38px", overflow:"hidden", height:"580px", background:"#fff", position:"relative" }}>
                      <div style={{ position:"absolute", inset:0, overflowY:"auto" }}>
                        <EditablePageContent {...editableProps} />
                      </div>
                    </div>
                  </div>
                  <div style={{ width:"100px", height:"4px", background:"rgba(255,255,255,.25)", borderRadius:"2px", margin:"12px auto 0" }} />
                  <div style={{ textAlign:"center", marginTop:"8px", fontSize:"11px", color:"rgba(255,255,255,.3)", fontWeight:600 }}>iPhone 14 Pro • 390×844</div>
                </div>
              )}

              {/* 🖥 TABLET */}
              {devMode==="mockup-tablet" && (
                <div style={{ position:"relative", flexShrink:0 }}>
                  <div style={{ background:"#1a1a1a", borderRadius:"20px", padding:"16px 12px", boxShadow:"0 40px 100px rgba(0,0,0,.7), inset 0 0 0 2px #333", position:"relative", width:"620px" }}>
                    <div style={{ display:"flex", justifyContent:"center", marginBottom:"10px" }}><div style={{ width:"8px", height:"8px", background:"#333", borderRadius:"50%", boxShadow:"0 0 0 2px #222" }} /></div>
                    <div style={{ position:"absolute", right:"-4px", top:"50%", transform:"translateY(-50%)", width:"4px", height:"70px", background:"#222", borderRadius:"0 3px 3px 0" }} />
                    <div style={{ position:"absolute", left:"-4px", top:"30%", width:"4px", height:"40px", background:"#222", borderRadius:"3px 0 0 3px" }} />
                    <div style={{ borderRadius:"10px", overflow:"hidden", height:"760px", background:"#fff" }}>
                      <div style={{ height:"100%", overflowY:"auto" }}>
                        <EditablePageContent {...editableProps} />
                      </div>
                    </div>
                    <div style={{ width:"80px", height:"3px", background:"rgba(255,255,255,.2)", borderRadius:"2px", margin:"10px auto 0" }} />
                  </div>
                  <div style={{ textAlign:"center", marginTop:"8px", fontSize:"11px", color:"rgba(255,255,255,.3)", fontWeight:600 }}>iPad Pro • 834×1194</div>
                </div>
              )}

              {/* 💻 LAPTOP */}
              {devMode==="mockup-laptop" && (
                <div style={{ position:"relative", flexShrink:0, width:"min(860px, 90vw)" }}>
                  <div style={{ background:"linear-gradient(180deg,#2a2a2a,#222)", borderRadius:"14px 14px 0 0", padding:"14px 14px 0", boxShadow:"0 -2px 20px rgba(0,0,0,.5)" }}>
                    <div style={{ display:"flex", justifyContent:"center", marginBottom:"10px" }}><div style={{ width:"6px", height:"6px", background:"#444", borderRadius:"50%", boxShadow:"0 0 0 2px #333" }} /></div>
                    <div style={{ borderRadius:"6px 6px 0 0", overflow:"hidden", height:"480px", background:"#fff", border:"2px solid #333", borderBottom:"none" }}>
                      <div style={{ height:"100%", overflowY:"auto" }}>
                        <EditablePageContent {...editableProps} />
                      </div>
                    </div>
                  </div>
                  <div style={{ background:"linear-gradient(180deg,#252525,#1e1e1e)", height:"18px", borderRadius:"0 0 2px 2px", boxShadow:"0 4px 20px rgba(0,0,0,.5)" }} />
                  <div style={{ background:"#1a1a1a", height:"10px", borderRadius:"0 0 10px 10px", margin:"0 -24px", boxShadow:"0 8px 30px rgba(0,0,0,.6)" }} />
                  <div style={{ width:"140px", height:"80px", background:"linear-gradient(180deg,#252525,#222)", borderRadius:"8px", margin:"6px auto 0", border:"1px solid #333" }} />
                  <div style={{ textAlign:"center", marginTop:"10px", fontSize:"11px", color:"rgba(255,255,255,.3)", fontWeight:600 }}>MacBook Pro • 1440×900</div>
                </div>
              )}
            </div>
          )}

          {/* ── DESKTOP NÁHLED (bez mockupu) ── */}
          {!isMockup && (
            <div style={{ width:"100%", maxWidth:"720px", margin:"0 auto", background:"#fff", flex:1 }}>
              {currentHero && (
                <div style={{ overflow:"hidden", position:"relative" }} ref={heroOverlayRef}>
                  <iframe key={`${devMode}-${currentHero.height}`} srcDoc={buildHeroHtml(currentHero)} sandbox="allow-scripts" scrolling="no"
                    onLoad={e=>{try{const d=e.target.contentDocument;const h=d?.documentElement?.scrollHeight||d?.body?.scrollHeight;if(h)e.target.style.height=h+"px";}catch{}}}
                    style={{ border:"none", width:"100%", minHeight:currentHero.height==="100vh"?"100vh":(currentHero.height||"500px"), display:"block", overflow:"hidden" }} />
                  <style>{`.hero-zone{position:absolute;cursor:pointer;border:2px solid transparent;border-radius:6px;transition:border-color .15s,background .15s}.hero-zone:hover{border-color:#7c3aed88;background:rgba(124,58,237,.08)}.hero-zone:hover .hero-zone-tip{display:flex}.hero-zone-tip{display:none;position:absolute;top:-26px;left:0;background:#7c3aed;color:#fff;font-size:10px;font-weight:700;padding:3px 8px;border-radius:4px;white-space:nowrap;z-index:10;align-items:center;gap:4px;pointer-events:none}`}</style>
                  {currentHero.showBadge && <div className="hero-zone" style={{top:"14%",left:"4%",width:"30%",height:"7%"}} onClick={()=>{setActiveTab(0);setTimeout(()=>{const el=panelRef.current?.querySelector('[data-hero-field="badgeText"]');el?.focus();el?.scrollIntoView({behavior:"smooth",block:"center"});},100)}}><span className="hero-zone-tip">✏️ Badge text</span></div>}
                  {currentHero.showH1 && <div className="hero-zone" style={{top:"22%",left:"3%",width:"55%",height:"28%"}} onClick={()=>{setActiveTab(0);setTimeout(()=>{const el=panelRef.current?.querySelector('[data-hero-field="h1Line1"]');el?.focus();el?.scrollIntoView({behavior:"smooth",block:"center"});},100)}}><span className="hero-zone-tip">✏️ Hlavní nadpis</span></div>}
                  {currentHero.showSub && <div className="hero-zone" style={{top:"51%",left:"3%",width:"50%",height:"10%"}} onClick={()=>{setActiveTab(0);setTimeout(()=>{const el=panelRef.current?.querySelector('[data-hero-field="subText"]');el?.focus();el?.scrollIntoView({behavior:"smooth",block:"center"});},100)}}><span className="hero-zone-tip">✏️ Podnadpis</span></div>}
                  <div className="hero-zone" style={{top:"68%",left:"3%",width:"45%",height:"14%"}} onClick={()=>{setActiveTab(0);setTimeout(()=>{const el=panelRef.current?.querySelector('[data-hero-field="btn1Text"]');el?.focus();el?.scrollIntoView({behavior:"smooth",block:"center"});},100)}}><span className="hero-zone-tip">✏️ Tlačítka</span></div>
                  {currentHero.showMedia && <div className="hero-zone" style={{top:"8%",right:"2%",width:"38%",height:"80%"}} onClick={()=>{setActiveTab(0);setTimeout(()=>{const el=panelRef.current?.querySelector('[data-hero-field="mediaUpload"]');el?.scrollIntoView({behavior:"smooth",block:"center"});},100)}}><span className="hero-zone-tip">🖼 Media</span></div>}
                </div>
              )}
              <style>{INLINE_STYLES}</style>
              <div className="inline-section" style={{ padding:"32px 40px 24px", borderBottom:"1px solid #f0f0f0" }}>
                <span className="inline-section-label">✏️ Hero text</span>
                {page.image && <img src={page.image} alt="" style={{ width:"100%", maxHeight:"300px", objectFit:"cover", borderRadius:"10px", marginBottom:"20px" }} onError={e=>e.target.style.display="none"} />}
                <div className="inline-field">
                  <h1 className="inline-editable" contentEditable suppressContentEditableWarning data-placeholder="Klikni a napiš nadpis..."
                    onBlur={e=>update("headline",e.currentTarget.innerText)}
                    style={{ fontSize:"1.9rem", fontWeight:800, color:"#1e1b4b", marginBottom:"10px", lineHeight:1.2, outline:"none" }}
                    dangerouslySetInnerHTML={{ __html:page.headline||"" }} />
                </div>
                <div className="inline-field">
                  <p className="inline-editable" contentEditable suppressContentEditableWarning data-placeholder="Klikni a napiš podnadpis..."
                    onBlur={e=>update("subline",e.currentTarget.innerText)}
                    style={{ fontSize:"1.05rem", color:"#6b7280", outline:"none" }}
                    dangerouslySetInnerHTML={{ __html:page.subline||"" }} />
                </div>
              </div>
              <div className="inline-section" style={{ padding:"24px 40px", borderBottom:"1px solid #f0f0f0" }}>
                <span className="inline-section-label">✏️ Tělo stránky</span>
                {mediaBlocks.filter(m=>(m.position||"below")==="above").map((m,i)=>renderMediaBlock(m,i))}
                <div className="inline-editable page-content" contentEditable suppressContentEditableWarning data-placeholder="Klikni a začni psát obsah stránky..."
                  onBlur={e=>{update("text",e.currentTarget.innerHTML);setEditorInitialHtml(e.currentTarget.innerHTML);setEditorKey(k=>k+1);}}
                  style={{ fontSize:".95rem", color:"#374151", lineHeight:1.75, outline:"none", minHeight:"60px" }}
                  dangerouslySetInnerHTML={{ __html:page.text||"" }} />
                {mediaBlocks.filter(m=>(m.position||"below")==="below").map((m,i)=>renderMediaBlock(m,i))}
                <div style={{ clear:"both" }} />
                {page.video && <div style={{ marginTop:"16px", borderRadius:"10px", overflow:"hidden", aspectRatio:"16/9" }}><iframe src={page.video.replace("watch?v=","embed/")} style={{ width:"100%", height:"100%", border:"none" }} allowFullScreen /></div>}
              </div>
              <div className="inline-section" style={{ padding:"24px 40px 32px" }}>
                <span className="inline-section-label">✏️ CTA & Formulář</span>
                <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                  {formFields.map((f,i) => {
                    if (f==="Zpráva") return <textarea key={i} placeholder="Zpráva" style={{ border:"1px solid #e5e7eb", borderRadius:"7px", padding:"9px 12px", fontSize:".9rem", minHeight:"60px", resize:"none", fontFamily:"inherit", background:"#f9fafb", outline:"none" }} />;
                    if (f==="Souhlas GDPR") return <label key={i} style={{ display:"flex", gap:"7px", alignItems:"flex-start", fontSize:".82rem", color:"#6b7280" }}><input type="checkbox" style={{marginTop:"2px"}} /> Souhlasím se zpracováním osobních údajů</label>;
                    return <input key={i} placeholder={f} style={{ border:"1px solid #e5e7eb", borderRadius:"7px", padding:"9px 12px", fontSize:".9rem", background:"#f9fafb", outline:"none" }} />;
                  })}
                  <div style={{ background:"#f9fafb", border:"1px solid #e5e7eb", borderRadius:"7px", padding:"9px 12px", fontSize:".82rem", color:"#6b7280", display:"flex", alignItems:"center", gap:"6px" }}>💳 Platební brána (Stripe / GoPay)</div>
                  <div className="inline-editable" contentEditable suppressContentEditableWarning data-placeholder="Klikni a napiš cenu..."
                    onBlur={e=>update("price",e.currentTarget.innerText)}
                    style={{ fontSize:"1.9rem", fontWeight:800, color:"#7c3aed", outline:"none", minHeight:"1em" }}
                    dangerouslySetInnerHTML={{ __html:page.price||"" }} />
                  <div className="inline-editable" contentEditable suppressContentEditableWarning data-placeholder="Text tlačítka..."
                    onBlur={e=>update("btnText",e.currentTarget.innerText)}
                    style={{ display:"block", padding:"13px", background:"#7c3aed", color:"#fff", borderRadius:"9px", fontWeight:700, fontSize:"1rem", textAlign:"center", outline:"none", cursor:"text" }}
                    dangerouslySetInnerHTML={{ __html:page.btnText||"" }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}