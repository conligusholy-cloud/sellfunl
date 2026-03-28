import { useState, useEffect, useRef, useCallback } from "react";
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const db = getFirestore();

// ─── Block type definitions ──────────────────────────────────────────────────
const PAGE_OUTPUTS = ["yes", "no", "left"];  // Ano, Ne, Odešel ze stránky
const PAGE_TYPES = [
  { type: "landing",  label: "Landing page",     icon: "📄", color: "#3b82f6", outputs: PAGE_OUTPUTS },
  { type: "optin",    label: "Opt-in",           icon: "✉️", color: "#8b5cf6", outputs: PAGE_OUTPUTS },
  { type: "sales",    label: "Prodejní stránka", icon: "💰", color: "#f59e0b", outputs: PAGE_OUTPUTS },
  { type: "checkout", label: "Checkout",         icon: "🛒", color: "#10b981", outputs: PAGE_OUTPUTS },
  { type: "upsell",   label: "Upsell",           icon: "⬆️", color: "#ef4444", outputs: PAGE_OUTPUTS },
  { type: "downsell", label: "Downsell",         icon: "⬇️", color: "#6366f1", outputs: PAGE_OUTPUTS },
  { type: "thankyou", label: "Děkovná stránka",  icon: "🎉", color: "#ec4899", outputs: PAGE_OUTPUTS },
  { type: "webinar",  label: "Webinář",          icon: "🎥", color: "#14b8a6", outputs: PAGE_OUTPUTS },
];

const ACTION_TYPES = [
  { type: "email",     label: "Odeslat e-mail",  icon: "📧", color: "#0ea5e9",  outputs: ["out"] },
  { type: "delay",     label: "Čekání",          icon: "⏳", color: "#78716c",  outputs: ["out"] },
  { type: "condition", label: "Podmínka",        icon: "🔀", color: "#d946ef",  outputs: ["yes", "no"] },
  { type: "redirect",  label: "Přesměrování",    icon: "↗️", color: "#f97316",  outputs: ["out"] },
  { type: "tag",       label: "Přidat tag",      icon: "🏷️", color: "#84cc16",  outputs: ["out"] },
  { type: "webhook",   label: "Webhook",         icon: "🔗", color: "#64748b",  outputs: ["out"] },
];

const ALL_TYPES = [...PAGE_TYPES, ...ACTION_TYPES];

function isPageType(type) { return PAGE_TYPES.some(t => t.type === type); }
function isActionType(type) { return ACTION_TYPES.some(t => t.type === type); }
function getTypeDef(type) { return ALL_TYPES.find(t => t.type === type); }
function getBlockOutputs(type) {
  const def = ALL_TYPES.find(t => t.type === type);
  return def?.outputs || ["out"];
}

const BLOCK_W = 170;
const BLOCK_H = 120;

// Port label config
const PORT_LABELS = {
  yes:  { label: "Ano",    color: "#16a34a" },
  no:   { label: "Ne",     color: "#ef4444" },
  left: { label: "Odešel", color: "#78716c" },
  out:  { label: "",       color: "#94a3b8" },
};
const PORT_R = 7;
const START_ID = "__start__";

function uid4() { return Math.random().toString(36).slice(2, 6); }

function makeBlock(typeDef, x, y) {
  return {
    id: `b_${Date.now()}_${uid4()}`,
    type: typeDef.type, label: typeDef.label, icon: typeDef.icon, color: typeDef.color,
    x, y, pageId: null, folderId: null, pageName: null, config: {},
  };
}

// ─── Main component (list view) ─────────────────────────────────────────────
export default function Funnels() {
  const [funnels, setFunnels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingFunnel, setEditingFunnel] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const authUid = getAuth()?.currentUser?.uid;

  useEffect(() => { if (authUid) loadFunnels(); }, [authUid]);

  async function loadFunnels() {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "funnels"), where("uid", "==", authUid)));
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      items.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setFunnels(items);
    } catch (err) { console.error("Chyba načítání funelů:", err); }
    setLoading(false);
  }

  async function createFunnel() {
    if (!newName.trim() || !authUid) return;
    setCreating(true);
    try {
      const docRef = await addDoc(collection(db, "funnels"), {
        uid: authUid, name: newName.trim(), blocks: [], connections: [], status: "draft",
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      setNewName(""); setShowCreate(false);
      await loadFunnels();
      setEditingFunnel({ id: docRef.id, name: newName.trim(), blocks: [], connections: [], status: "draft" });
    } catch (err) {
      console.error("Chyba vytváření funnelu:", err);
      alert("Nepodařilo se vytvořit funnel: " + err.message);
    }
    setCreating(false);
  }

  async function deleteFunnel(id) {
    try { await deleteDoc(doc(db, "funnels", id)); setDeleteConfirm(null); await loadFunnels(); }
    catch (err) { console.error("Chyba mazání:", err); }
  }

  if (editingFunnel) {
    return <FunnelEditor
      funnel={editingFunnel}
      onBack={() => { setEditingFunnel(null); loadFunnels(); }}
      onSave={async (data) => {
        await updateDoc(doc(db, "funnels", editingFunnel.id), { ...data, updatedAt: serverTimestamp() });
        setEditingFunnel(prev => ({ ...prev, ...data }));
      }}
    />;
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--text)", margin: 0 }}>🔀 Funely</h2>
          <p style={{ fontSize: ".88rem", color: "var(--text-muted)", margin: "4px 0 0" }}>Vytváření prodejních cest z tvých stránek.</p>
        </div>
        <button onClick={() => setShowCreate(true)} style={btnPrimary}>+ Nový funnel</button>
      </div>

      {showCreate && (
        <Modal onClose={() => setShowCreate(false)}>
          <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text)", marginBottom: "16px" }}>Nový funnel</h3>
          <label style={lbl}>Název funnelu</label>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="např. Prodej online kurzu" autoFocus style={inp}
            onKeyDown={e => e.key === "Enter" && createFunnel()} />
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "20px" }}>
            <button onClick={() => setShowCreate(false)} style={btnSecondary}>Zrušit</button>
            <button onClick={createFunnel} disabled={!newName.trim() || creating}
              style={{ ...btnPrimary, opacity: !newName.trim() ? 0.5 : 1, cursor: !newName.trim() ? "not-allowed" : "pointer" }}>
              {creating ? "Vytvářím..." : "Vytvořit"}
            </button>
          </div>
        </Modal>
      )}

      {deleteConfirm && (
        <Modal onClose={() => setDeleteConfirm(null)}>
          <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text)", marginBottom: "8px" }}>Smazat funnel?</h3>
          <p style={{ fontSize: ".85rem", color: "var(--text-muted)", marginBottom: "20px" }}>
            Opravdu chceš smazat „{deleteConfirm.name}"? Tato akce je nevratná.
          </p>
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
            <button onClick={() => setDeleteConfirm(null)} style={btnSecondary}>Zrušit</button>
            <button onClick={() => deleteFunnel(deleteConfirm.id)} style={{ ...btnPrimary, background: "#ef4444" }}>Smazat</button>
          </div>
        </Modal>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)" }}>Načítám funely...</div>
      ) : funnels.length === 0 ? (
        <EmptyState onClick={() => setShowCreate(true)} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
          {funnels.map(f => (
            <FunnelCard key={f.id} funnel={f} onEdit={() => setEditingFunnel(f)} onDelete={() => setDeleteConfirm(f)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── FunnelCard ──────────────────────────────────────────────────────────────
function FunnelCard({ funnel: f, onEdit, onDelete }) {
  const bc = f.blocks?.length || 0;
  const date = f.updatedAt?.toDate?.()?.toLocaleDateString("cs-CZ") || f.createdAt?.toDate?.()?.toLocaleDateString("cs-CZ") || "—";
  return (
    <div onClick={onEdit} style={{ padding: "20px", borderRadius: "12px", background: "var(--bg-card)", border: "1px solid var(--border)", cursor: "pointer", transition: "box-shadow .15s" }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,.08)"}
      onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
        <div>
          <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text)", margin: 0 }}>{f.name}</h3>
          <span style={{ display: "inline-block", marginTop: "6px", padding: "2px 10px", borderRadius: "12px", fontSize: ".7rem", fontWeight: 600,
            background: f.status === "active" ? "#dcfce7" : "#f3f4f6", color: f.status === "active" ? "#16a34a" : "#6b7280",
          }}>{f.status === "active" ? "Aktivní" : "Koncept"}</span>
        </div>
        <button onClick={e => { e.stopPropagation(); onDelete(); }} style={btnIcon}
          onMouseEnter={e => { e.currentTarget.style.background = "#fef2f2"; e.currentTarget.style.color = "#ef4444"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-muted)"; }}>🗑</button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap", marginBottom: "12px" }}>
        {(f.blocks || []).slice(0, 6).map((b, i, arr) => (
          <span key={b.id || i} style={{ display: "flex", alignItems: "center", gap: "3px" }}>
            <span style={{ padding: "3px 8px", borderRadius: "5px", fontSize: ".68rem", background: `${b.color}18`, color: b.color, fontWeight: 500 }}>{b.icon} {b.label}</span>
            {i < arr.length - 1 && <span style={{ color: "#d1d5db", fontSize: ".65rem" }}>→</span>}
          </span>
        ))}
        {bc > 6 && <span style={{ fontSize: ".68rem", color: "var(--text-muted)" }}>+{bc - 6}</span>}
        {bc === 0 && <span style={{ fontSize: ".75rem", color: "var(--text-muted)" }}>Prázdný — klikni pro editaci</span>}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".72rem", color: "var(--text-muted)" }}>
        <span>{bc} {bc === 1 ? "blok" : bc < 5 ? "bloky" : "bloků"}</span>
        <span>{date}</span>
      </div>
    </div>
  );
}

// ─── FREE-FORM FLOW EDITOR ──────────────────────────────────────────────────
function FunnelEditor({ funnel, onBack, onSave }) {
  const [blocks, setBlocks] = useState(() => (funnel.blocks || []).map(b => ({ ...b, x: b.x ?? 0, y: b.y ?? 0 })));
  const [connections, setConnections] = useState(funnel.connections || []);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState(null);       // block id
  const [connecting, setConnecting] = useState(null);    // {fromId, fromPort, mouseX, mouseY}
  const [editBlock, setEditBlock] = useState(null);      // block id for settings panel
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef(null);
  const canvasRef = useRef(null);
  const draggingBlock = useRef(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  const ZOOM_MIN = 0.2;
  const ZOOM_MAX = 2;
  const ZOOM_STEP = 0.1;

  // Load user's SellFunl pages
  const [folders, setFolders] = useState([]);
  const [pages, setPages] = useState([]);
  const authUid = getAuth()?.currentUser?.uid;

  useEffect(() => {
    if (!authUid) return;
    (async () => {
      try {
        const [fSnap, pSnap] = await Promise.all([
          getDocs(query(collection(db, "folders"), where("uid", "==", authUid))),
          getDocs(query(collection(db, "pages"), where("uid", "==", authUid))),
        ]);
        setFolders(fSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setPages(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) { console.error("Chyba načítání stránek:", err); }
    })();
  }, [authUid]);

  // ── Helpers ──
  const markDirty = useCallback(() => setDirty(true), []);

  function updateBlock(id, patch) {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b));
    markDirty();
  }

  function removeBlock(id) {
    setBlocks(prev => prev.filter(b => b.id !== id));
    setConnections(prev => prev.filter(c => c.from !== id && c.to !== id));
    if (selected === id) setSelected(null);
    if (editBlock === id) setEditBlock(null);
    markDirty();
  }

  function addConnection(from, fromPort, to, toPort) {
    // prevent duplicates & self-connections
    if (from === to) return;
    setConnections(prev => {
      if (prev.some(c => c.from === from && c.fromPort === fromPort && c.to === to)) return prev;
      return [...prev, { id: `c_${Date.now()}_${uid4()}`, from, fromPort: fromPort || "out", to, toPort: toPort || "in" }];
    });
    markDirty();
  }

  function removeConnection(id) {
    setConnections(prev => prev.filter(c => c.id !== id));
    markDirty();
  }

  async function save() {
    setSaving(true);
    await onSave({ blocks, connections });
    setDirty(false);
    setSaving(false);
  }

  // ── Port positions ──
  function getBlockRect(block) {
    return { x: block.x, y: block.y, w: BLOCK_W, h: BLOCK_H };
  }

  function getInputPort(block) {
    return { x: block.x, y: block.y + BLOCK_H / 2 };
  }

  function getOutputPort(block, portName) {
    const outputs = getBlockOutputs(block.type);
    if (outputs.length > 1) {
      const idx = outputs.indexOf(portName);
      const count = outputs.length;
      const spacing = BLOCK_H / (count + 1);
      return { x: block.x + BLOCK_W, y: block.y + spacing * (idx + 1) };
    }
    return { x: block.x + BLOCK_W, y: block.y + BLOCK_H / 2 };
  }

  // Start node: circle is 48px wide at left=56, so center is 80, right edge is 56+48=104
  function getStartOutputPort() {
    return { x: 104 + PORT_R, y: 80 + 24 };
  }

  // ── Canvas coordinate conversion (accounts for pan + zoom) ──
  function screenToCanvas(clientX, clientY) {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: clientX, y: clientY };
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  }

  // ── Zoom helpers ──
  function zoomTo(newZoom, centerX, centerY) {
    const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, newZoom));
    if (centerX !== undefined && centerY !== undefined) {
      // Zoom toward point (mouse position)
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const mx = centerX - rect.left;
        const my = centerY - rect.top;
        // Adjust pan so the point under cursor stays fixed
        const scale = clamped / zoom;
        setPan(prev => ({
          x: mx - scale * (mx - prev.x),
          y: my - scale * (my - prev.y),
        }));
      }
    }
    setZoom(clamped);
  }

  function handleWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    zoomTo(zoom + delta, e.clientX, e.clientY);
  }

  // Attach wheel with { passive: false } so preventDefault works
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  });

  function fitAll() {
    if (blocks.length === 0) { setPan({ x: 40, y: 40 }); setZoom(1); return; }
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    // Bounding box of all blocks + start node
    let minX = 56, minY = 80, maxX = 104, maxY = 128;
    for (const b of blocks) {
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + BLOCK_W);
      maxY = Math.max(maxY, b.y + BLOCK_H);
    }
    const contentW = maxX - minX + 80; // padding
    const contentH = maxY - minY + 80;
    const scaleX = rect.width / contentW;
    const scaleY = rect.height / contentH;
    const newZoom = Math.min(Math.max(Math.min(scaleX, scaleY), ZOOM_MIN), ZOOM_MAX);
    const newPanX = (rect.width - contentW * newZoom) / 2 - minX * newZoom + 40 * newZoom;
    const newPanY = (rect.height - contentH * newZoom) / 2 - minY * newZoom + 40 * newZoom;
    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  }

  // ── Palette drag ──
  function handlePaletteDragStart(e, typeDef) {
    e.dataTransfer.setData("application/funnel-block", JSON.stringify(typeDef));
    e.dataTransfer.effectAllowed = "copy";
  }

  function handleCanvasDrop(e) {
    e.preventDefault();
    const data = e.dataTransfer.getData("application/funnel-block");
    if (!data) return;
    try {
      const typeDef = JSON.parse(data);
      const pos = screenToCanvas(e.clientX, e.clientY);
      const block = makeBlock(typeDef, pos.x - BLOCK_W / 2, pos.y - BLOCK_H / 2);
      setBlocks(prev => [...prev, block]);
      markDirty();
    } catch {}
  }

  function handleCanvasDragOver(e) { e.preventDefault(); }

  // ── Block dragging on canvas ──
  function handleBlockMouseDown(e, blockId) {
    if (e.button !== 0) return;
    e.stopPropagation();
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    draggingBlock.current = blockId;
    const pos = screenToCanvas(e.clientX, e.clientY);
    dragOffset.current = { x: pos.x - block.x, y: pos.y - block.y };
    setSelected(blockId);
  }

  function handleCanvasMouseMove(e) {
    // Block dragging
    if (draggingBlock.current) {
      const pos = screenToCanvas(e.clientX, e.clientY);
      const nx = pos.x - dragOffset.current.x;
      const ny = pos.y - dragOffset.current.y;
      setBlocks(prev => prev.map(b => b.id === draggingBlock.current ? { ...b, x: nx, y: ny } : b));
      markDirty();
      return;
    }
    // Connection drawing
    if (connecting) {
      const pos = screenToCanvas(e.clientX, e.clientY);
      setConnecting(prev => prev ? { ...prev, mouseX: pos.x, mouseY: pos.y } : null);
      return;
    }
    // Panning
    if (isPanning && panStart.current) {
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setPan({ x: panStart.current.panX + dx, y: panStart.current.panY + dy });
    }
  }

  function handleCanvasMouseUp(e) {
    if (draggingBlock.current) {
      draggingBlock.current = null;
      return;
    }
    // Finish connection
    if (connecting) {
      const pos = screenToCanvas(e.clientX, e.clientY);
      // Find block under mouse (input port)
      const target = blocks.find(b => {
        const ip = getInputPort(b);
        return Math.hypot(pos.x - ip.x, pos.y - ip.y) < 20;
      });
      if (target) {
        addConnection(connecting.fromId, connecting.fromPort, target.id, "in");
      }
      setConnecting(null);
      return;
    }
    if (isPanning) {
      setIsPanning(false);
      panStart.current = null;
    }
  }

  function handleCanvasMouseDown(e) {
    // Middle or right click, or left click on empty space = pan
    if (e.target === canvasRef.current || e.target.tagName === "svg" || e.target.classList?.contains("canvas-bg")) {
      if (e.button === 0) {
        setSelected(null);
        setIsPanning(true);
        panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
      }
    }
  }

  // ── Port interactions (start connection) ──
  function handleOutputPortMouseDown(e, blockId, portName) {
    e.stopPropagation();
    e.preventDefault();
    const pos = screenToCanvas(e.clientX, e.clientY);
    setConnecting({ fromId: blockId, fromPort: portName || "out", mouseX: pos.x, mouseY: pos.y });
  }

  // Start node output
  function handleStartPortMouseDown(e) {
    e.stopPropagation();
    e.preventDefault();
    const pos = screenToCanvas(e.clientX, e.clientY);
    setConnecting({ fromId: START_ID, fromPort: "out", mouseX: pos.x, mouseY: pos.y });
  }

  // ── SVG bezier path ──
  function bezierPath(x1, y1, x2, y2) {
    const dx = Math.abs(x2 - x1) * 0.5;
    return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
  }

  // ── Render connections ──
  function renderConnections() {
    const paths = [];
    for (const conn of connections) {
      let start;
      if (conn.from === START_ID) {
        start = getStartOutputPort();
      } else {
        const fromBlock = blocks.find(b => b.id === conn.from);
        if (!fromBlock) continue;
        start = getOutputPort(fromBlock, conn.fromPort);
      }
      const toBlock = blocks.find(b => b.id === conn.to);
      if (!toBlock) continue;
      const end = getInputPort(toBlock);

      // Label for output ports
      const portCfg = PORT_LABELS[conn.fromPort];
      const label = portCfg?.label || null;
      const labelColor = portCfg?.color || "#64748b";

      paths.push(
        <g key={conn.id}>
          <path d={bezierPath(start.x, start.y, end.x, end.y)}
            fill="none" stroke="#94a3b8" strokeWidth={2.5} style={{ cursor: "pointer" }}
            onClick={(e) => { e.stopPropagation(); removeConnection(conn.id); }}
            onMouseEnter={e => e.currentTarget.setAttribute("stroke", "#ef4444")}
            onMouseLeave={e => e.currentTarget.setAttribute("stroke", "#94a3b8")}
          />
          {/* Arrow head */}
          <circle cx={end.x} cy={end.y} r={4} fill="#94a3b8" />
          {/* Label */}
          {label && (
            <text x={(start.x + end.x) / 2} y={(start.y + end.y) / 2 - 8}
              textAnchor="middle" fill={labelColor} fontSize="11" fontWeight="700">{label}</text>
          )}
        </g>
      );
    }

    // Drawing connection (temp line)
    if (connecting) {
      let start;
      if (connecting.fromId === START_ID) {
        start = getStartOutputPort();
      } else {
        const fromBlock = blocks.find(b => b.id === connecting.fromId);
        if (fromBlock) start = getOutputPort(fromBlock, connecting.fromPort);
      }
      if (start) {
        paths.push(
          <path key="__temp__" d={bezierPath(start.x, start.y, connecting.mouseX, connecting.mouseY)}
            fill="none" stroke="#7c3aed" strokeWidth={2.5} strokeDasharray="6 3" opacity={0.7} />
        );
      }
    }

    return paths;
  }

  // ── Render port circles ──
  function renderInputPort(block) {
    const p = getInputPort(block);
    const isTarget = connecting && connecting.fromId !== block.id;
    return (
      <circle cx={p.x} cy={p.y} r={isTarget ? 10 : PORT_R}
        fill={isTarget ? "#7c3aed" : "#fff"} stroke={isTarget ? "#7c3aed" : block.color}
        strokeWidth={2} style={{ cursor: "crosshair", transition: "r .15s" }}
        onMouseUp={connecting ? (e) => {
          e.stopPropagation();
          addConnection(connecting.fromId, connecting.fromPort, block.id, "in");
          setConnecting(null);
        } : undefined}
      />
    );
  }

  function renderOutputPorts(block) {
    const ports = getBlockOutputs(block.type);
    return ports.map(portName => {
      const p = getOutputPort(block, portName);
      const cfg = PORT_LABELS[portName] || PORT_LABELS.out;
      return (
        <g key={portName}>
          <circle cx={p.x} cy={p.y} r={PORT_R}
            fill="#fff" stroke={cfg.color} strokeWidth={2.5}
            style={{ cursor: "crosshair" }}
            onMouseDown={e => handleOutputPortMouseDown(e, block.id, portName)}
          />
          {ports.length > 1 && cfg.label && (
            <text x={p.x + 12} y={p.y + 4} fill={cfg.color} fontSize="9" fontWeight="700">
              {cfg.label}
            </text>
          )}
        </g>
      );
    });
  }

  // ── Edit block (page selector) ──
  const editingBlockData = editBlock ? blocks.find(b => b.id === editBlock) : null;

  return (
    <div style={{ display: "flex", height: "calc(100vh - 120px)", margin: "-32px -24px", background: "var(--bg)" }}>
      {/* LEFT SIDEBAR - Palette */}
      <div style={{
        width: "210px", flexShrink: 0, background: "var(--bg-card)", borderRight: "1px solid var(--border)",
        overflowY: "auto", padding: "12px 10px", display: "flex", flexDirection: "column",
      }}>
        <button onClick={onBack} style={{ ...btnSecondary, width: "100%", marginBottom: "14px", fontSize: ".78rem", padding: "8px 12px" }}>
          ← Zpět na seznam
        </button>

        <div style={sectionLabel}>Stránky</div>
        {PAGE_TYPES.map(t => (
          <div key={t.type} draggable onDragStart={e => handlePaletteDragStart(e, t)} style={paletteItem}
            onMouseEnter={e => e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,.08)"}
            onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}>
            <span style={{ fontSize: ".95rem" }}>{t.icon}</span>
            <span style={{ fontSize: ".78rem" }}>{t.label}</span>
          </div>
        ))}

        <div style={{ ...sectionLabel, marginTop: "14px" }}>Akce</div>
        {ACTION_TYPES.map(t => (
          <div key={t.type} draggable onDragStart={e => handlePaletteDragStart(e, t)} style={paletteItem}
            onMouseEnter={e => e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,.08)"}
            onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}>
            <span style={{ fontSize: ".95rem" }}>{t.icon}</span>
            <span style={{ fontSize: ".78rem" }}>{t.label}</span>
          </div>
        ))}

        <div style={{ flex: 1 }} />
        <div style={{ fontSize: ".68rem", color: "var(--text-muted)", padding: "8px 4px", borderTop: "1px solid var(--border)", marginTop: "8px" }}>
          Přetáhni blok na plátno. Propoj tažením z výstupního portu na vstupní port.
        </div>
      </div>

      {/* CANVAS */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Toolbar */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 20px", borderBottom: "1px solid var(--border)", background: "var(--bg-card)", flexShrink: 0,
        }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text)", margin: 0 }}>{funnel.name}</h3>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {dirty && <span style={{ fontSize: ".75rem", color: "#d97706" }}>Neuloženo</span>}
            <button onClick={save} disabled={!dirty || saving}
              style={{ ...btnPrimary, padding: "8px 20px", fontSize: ".82rem", opacity: !dirty ? 0.5 : 1 }}>
              {saving ? "Ukládám..." : "💾 Uložit"}
            </button>
          </div>
        </div>

        {/* Canvas area */}
        <div ref={canvasRef} className="canvas-bg"
          onDrop={handleCanvasDrop} onDragOver={handleCanvasDragOver}
          onMouseDown={handleCanvasMouseDown} onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp} onMouseLeave={() => { draggingBlock.current = null; setConnecting(null); setIsPanning(false); }}
          style={{
            flex: 1, position: "relative", overflow: "hidden", cursor: isPanning ? "grabbing" : connecting ? "crosshair" : "default",
            background: "var(--bg)",
          }}>
          {/* Grid background */}
          {(() => {
            const gridSize = 20 * zoom;
            return <div className="canvas-bg" style={{
              position: "absolute", inset: 0, pointerEvents: "none",
              backgroundImage: `radial-gradient(circle, var(--border) ${Math.max(0.5, zoom)}px, transparent ${Math.max(0.5, zoom)}px)`,
              backgroundSize: `${gridSize}px ${gridSize}px`,
              backgroundPosition: `${pan.x % gridSize}px ${pan.y % gridSize}px`,
              opacity: 0.6,
            }} />;
          })()}

          {/* Zoom controls (bottom-left) */}
          <div style={{
            position: "absolute", bottom: "16px", left: "16px", zIndex: 50,
            display: "flex", gap: "4px", alignItems: "center",
            background: "var(--bg-card)", borderRadius: "10px", padding: "4px",
            border: "1px solid var(--border)", boxShadow: "0 2px 12px rgba(0,0,0,.1)",
          }}>
            <button onClick={() => zoomTo(zoom + ZOOM_STEP)} style={zoomBtn} title="Přiblížit">+</button>
            <button onClick={() => zoomTo(zoom - ZOOM_STEP)} style={zoomBtn} title="Oddálit">−</button>
            <span style={{ fontSize: ".72rem", fontWeight: 600, color: "var(--text-muted)", minWidth: "38px", textAlign: "center" }}>
              {Math.round(zoom * 100)}%
            </span>
            <button onClick={fitAll} style={{ ...zoomBtn, fontSize: ".65rem", width: "auto", padding: "0 8px" }} title="Zobrazit vše">
              Vše
            </button>
            <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} style={{ ...zoomBtn, fontSize: ".65rem", width: "auto", padding: "0 8px" }} title="Reset">
              1:1
            </button>
          </div>

          {/* Transformed layer (pan + zoom) */}
          <div style={{ position: "absolute", left: 0, top: 0, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0", pointerEvents: "none" }}>

            {/* SVG connections layer */}
            <svg style={{ position: "absolute", left: 0, top: 0, width: "5000px", height: "5000px", pointerEvents: "none", overflow: "visible" }}>
              <g style={{ pointerEvents: "auto" }}>
                {renderConnections()}
                {/* Block ports */}
                {blocks.map(block => (
                  <g key={block.id}>
                    {renderInputPort(block)}
                    {renderOutputPorts(block)}
                  </g>
                ))}
              </g>
            </svg>

            {/* Start node */}
            <div style={{
              position: "absolute", left: 56, top: 80,
              width: "48px", height: "48px", borderRadius: "50%", background: "#16a34a",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: "1.2rem", fontWeight: 700, boxShadow: "0 2px 8px rgba(22,163,106,.3)",
              pointerEvents: "auto", cursor: "default", zIndex: 2,
            }}>▶</div>

            {/* Start node output port (DOM element so it's above the circle) */}
            <div
              onMouseDown={handleStartPortMouseDown}
              style={{
                position: "absolute",
                left: 104 + PORT_R - 8, top: 80 + 24 - 8,
                width: "16px", height: "16px", borderRadius: "50%",
                background: "#fff", border: "2.5px solid #16a34a",
                cursor: "crosshair", pointerEvents: "auto", zIndex: 3,
              }}
            />

            {/* Blocks */}
            {blocks.map(block => (
              <CanvasBlock key={block.id} block={block}
                isSelected={selected === block.id}
                onMouseDown={e => handleBlockMouseDown(e, block.id)}
                onRemove={() => removeBlock(block.id)}
                onEdit={() => setEditBlock(block.id)}
                pages={pages}
              />
            ))}

            {/* Empty hint */}
            {blocks.length === 0 && (
              <div style={{
                position: "absolute", left: 180, top: 60,
                padding: "30px 50px", borderRadius: "12px",
                border: "2px dashed var(--border)", background: "var(--bg-card)",
                display: "flex", flexDirection: "column", alignItems: "center", gap: "8px",
                color: "var(--text-muted)", fontSize: ".85rem", pointerEvents: "auto",
              }}>
                <span style={{ fontSize: "2rem" }}>📥</span>
                Přetáhni bloky z levého panelu sem
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT PANEL - Block settings */}
      {editingBlockData && (
        <BlockSettings
          block={editingBlockData}
          folders={folders}
          pages={pages}
          onUpdate={(patch) => updateBlock(editingBlockData.id, patch)}
          onClose={() => setEditBlock(null)}
        />
      )}
    </div>
  );
}

// ─── Canvas Block (absolutely positioned) ───────────────────────────────────
function CanvasBlock({ block, isSelected, onMouseDown, onRemove, onEdit, pages }) {
  const [hover, setHover] = useState(false);
  const linkedPage = block.pageId ? pages.find(p => p.id === block.pageId) : null;

  return (
    <div
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onDoubleClick={(e) => { e.stopPropagation(); onEdit(); }}
      style={{
        position: "absolute", left: block.x, top: block.y,
        width: BLOCK_W + "px", height: BLOCK_H + "px",
        borderRadius: "12px", background: "var(--bg-card)",
        border: `2px solid ${isSelected ? block.color : block.color + "40"}`,
        boxShadow: isSelected ? `0 0 0 3px ${block.color}25, 0 4px 16px rgba(0,0,0,.1)` : "0 2px 12px rgba(0,0,0,.06)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px",
        cursor: "grab", pointerEvents: "auto",
        transition: "box-shadow .1s",
        zIndex: isSelected ? 10 : 1,
      }}>
      {/* Delete button */}
      {hover && (
        <button onClick={e => { e.stopPropagation(); onRemove(); }}
          style={{
            position: "absolute", top: "-8px", right: "-8px",
            width: "22px", height: "22px", borderRadius: "50%",
            background: "#ef4444", color: "#fff", border: "2px solid var(--bg-card)",
            cursor: "pointer", fontSize: ".6rem", display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 20,
          }}>✕</button>
      )}

      {/* Edit/settings button */}
      {hover && (
        <button onClick={e => { e.stopPropagation(); onEdit(); }}
          style={{
            position: "absolute", top: "-8px", left: "-8px",
            width: "22px", height: "22px", borderRadius: "50%",
            background: "#3b82f6", color: "#fff", border: "2px solid var(--bg-card)",
            cursor: "pointer", fontSize: ".6rem", display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 20,
          }}>⚙</button>
      )}

      <div style={{
        width: "32px", height: "32px", borderRadius: "8px",
        background: `${block.color}15`, display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "1.1rem",
      }}>{block.icon}</div>
      <span style={{ fontSize: ".72rem", fontWeight: 600, color: "var(--text)", textAlign: "center", lineHeight: 1.2, maxWidth: "130px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {block.label}
      </span>
      {linkedPage && (
        <span style={{ fontSize: ".6rem", color: "#64748b", maxWidth: "130px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          title={linkedPage.name || linkedPage.title}>
          🔗 {linkedPage.name || linkedPage.title}
        </span>
      )}
      {!linkedPage && isPageType(block.type) && (
        <span style={{ fontSize: ".58rem", color: "#d97706" }}>Dvoj-klik = nastavit</span>
      )}

      {/* Output port labels on right side */}
      {(() => {
        const outputs = getBlockOutputs(block.type);
        if (outputs.length <= 1) return null;
        return outputs.map((portName, idx) => {
          const count = outputs.length;
          const spacing = BLOCK_H / (count + 1);
          const topPos = spacing * (idx + 1) - 6;
          const cfg = PORT_LABELS[portName] || PORT_LABELS.out;
          return cfg.label ? (
            <span key={portName} style={{
              position: "absolute", right: "18px", top: topPos + "px",
              fontSize: ".55rem", fontWeight: 700, color: cfg.color, pointerEvents: "none",
            }}>{cfg.label}</span>
          ) : null;
        });
      })()}
    </div>
  );
}

// ─── Block Settings Panel (right sidebar) ───────────────────────────────────
function BlockSettings({ block, folders, pages, onUpdate, onClose }) {
  const [selFolder, setSelFolder] = useState(block.folderId || "");
  const [selPage, setSelPage] = useState(block.pageId || "");
  const [label, setLabel] = useState(block.label || "");

  const filteredPages = selFolder
    ? pages.filter(p => p.folderId === selFolder)
    : pages;

  function applyPage(pageId) {
    const page = pages.find(p => p.id === pageId);
    setSelPage(pageId);
    onUpdate({
      pageId: pageId || null,
      folderId: selFolder || null,
      pageName: page ? (page.name || page.title || null) : null,
    });
  }

  function applyLabel(newLabel) {
    setLabel(newLabel);
    onUpdate({ label: newLabel });
  }

  return (
    <div style={{
      width: "280px", flexShrink: 0, background: "var(--bg-card)", borderLeft: "1px solid var(--border)",
      overflowY: "auto", padding: "16px 14px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h4 style={{ fontSize: ".9rem", fontWeight: 700, color: "var(--text)", margin: 0 }}>⚙️ Nastavení bloku</h4>
        <button onClick={onClose} style={{ ...btnIcon, fontSize: "1rem" }}>✕</button>
      </div>

      {/* Block type indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px", borderRadius: "8px", background: `${block.color}10`, marginBottom: "16px" }}>
        <span style={{ fontSize: "1.3rem" }}>{block.icon}</span>
        <div>
          <div style={{ fontSize: ".8rem", fontWeight: 600, color: block.color }}>{block.type.toUpperCase()}</div>
          <div style={{ fontSize: ".68rem", color: "var(--text-muted)" }}>
            {isPageType(block.type) ? "Stránka" : "Akce"}
          </div>
        </div>
      </div>

      {/* Label */}
      <label style={lbl}>Název bloku</label>
      <input value={label} onChange={e => applyLabel(e.target.value)} style={{ ...inp, marginBottom: "14px" }} />

      {/* Page selector (only for page types) */}
      {isPageType(block.type) && (
        <>
          <label style={lbl}>Složka</label>
          <select value={selFolder} onChange={e => { setSelFolder(e.target.value); setSelPage(""); onUpdate({ folderId: e.target.value || null, pageId: null, pageName: null }); }}
            style={{ ...inp, marginBottom: "10px" }}>
            <option value="">— Všechny složky —</option>
            {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>

          <label style={lbl}>Stránka</label>
          <select value={selPage} onChange={e => applyPage(e.target.value)}
            style={{ ...inp, marginBottom: "14px" }}>
            <option value="">— Vyber stránku —</option>
            {filteredPages.map(p => {
              const domain = p.customDomain || null;
              const url = domain ? `https://${domain}` : `sellfunl.com/p/${p.id}`;
              return <option key={p.id} value={p.id}>{p.name || p.title || "Bez názvu"} ({url})</option>;
            })}
          </select>

          {selPage && (() => {
            const page = pages.find(p => p.id === selPage);
            if (!page) return null;
            const domain = page.customDomain || null;
            const url = domain ? `https://${domain}` : `https://sellfunl.com/p/${page.id}`;
            return (
              <div style={{ padding: "10px", borderRadius: "8px", background: "var(--bg)", border: "1px solid var(--border)", fontSize: ".75rem" }}>
                <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: "4px" }}>🔗 {page.name || page.title}</div>
                <a href={url} target="_blank" rel="noopener" style={{ color: "#7c3aed", wordBreak: "break-all" }}>{url}</a>
              </div>
            );
          })()}
        </>
      )}

      {/* Action config */}
      {isActionType(block.type) && (
        <>
          {block.type === "delay" && (
            <>
              <label style={lbl}>Čekání (minuty)</label>
              <input type="number" value={block.config?.delayMinutes || ""} min={1}
                onChange={e => onUpdate({ config: { ...block.config, delayMinutes: parseInt(e.target.value) || 0 } })}
                style={{ ...inp, marginBottom: "14px" }} placeholder="např. 60" />
            </>
          )}
          {block.type === "email" && (
            <>
              <label style={lbl}>Předmět e-mailu</label>
              <input value={block.config?.subject || ""} onChange={e => onUpdate({ config: { ...block.config, subject: e.target.value } })}
                style={{ ...inp, marginBottom: "14px" }} placeholder="Předmět" />
            </>
          )}
          {block.type === "condition" && (
            <>
              <label style={lbl}>Podmínka</label>
              <input value={block.config?.condition || ""} onChange={e => onUpdate({ config: { ...block.config, condition: e.target.value } })}
                style={{ ...inp, marginBottom: "6px" }} placeholder="např. koupil produkt" />
              <div style={{ fontSize: ".68rem", color: "var(--text-muted)", marginBottom: "14px" }}>
                Blok má 2 výstupy: Ano (splněno) a Ne (nesplněno)
              </div>
            </>
          )}
          {block.type === "redirect" && (
            <>
              <label style={lbl}>URL přesměrování</label>
              <input value={block.config?.url || ""} onChange={e => onUpdate({ config: { ...block.config, url: e.target.value } })}
                style={{ ...inp, marginBottom: "14px" }} placeholder="https://..." />
            </>
          )}
          {block.type === "tag" && (
            <>
              <label style={lbl}>Název tagu</label>
              <input value={block.config?.tag || ""} onChange={e => onUpdate({ config: { ...block.config, tag: e.target.value } })}
                style={{ ...inp, marginBottom: "14px" }} placeholder="např. buyer" />
            </>
          )}
          {block.type === "webhook" && (
            <>
              <label style={lbl}>Webhook URL</label>
              <input value={block.config?.webhookUrl || ""} onChange={e => onUpdate({ config: { ...block.config, webhookUrl: e.target.value } })}
                style={{ ...inp, marginBottom: "14px" }} placeholder="https://..." />
            </>
          )}
        </>
      )}
    </div>
  );
}

// ─── Shared components ───────────────────────────────────────────────────────
function Modal({ onClose, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "var(--bg-card)", borderRadius: "16px", padding: "28px", width: "95%", maxWidth: "440px", boxShadow: "0 8px 32px rgba(0,0,0,.15)" }}>
        {children}
      </div>
    </div>
  );
}

function EmptyState({ onClick }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 24px", borderRadius: "12px", background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div style={{ fontSize: "3rem", marginBottom: "16px" }}>🔀</div>
      <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--text)", marginBottom: "8px" }}>Zatím nemáš žádné funely</h3>
      <p style={{ fontSize: ".88rem", color: "var(--text-muted)", marginBottom: "20px" }}>Vytvoř svůj první prodejní funnel a propoj ho se svými stránkami.</p>
      <button onClick={onClick} style={btnPrimary}>+ Vytvořit první funnel</button>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const lbl = { display: "block", fontSize: ".78rem", fontWeight: 500, color: "var(--text-muted)", marginBottom: "4px" };
const inp = { width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: ".85rem", outline: "none", boxSizing: "border-box" };
const btnPrimary = { padding: "10px 20px", borderRadius: "8px", border: "none", background: "#7c3aed", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: ".9rem" };
const btnSecondary = { padding: "10px 20px", borderRadius: "8px", border: "1px solid var(--border)", background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: ".85rem" };
const btnIcon = { padding: "4px 8px", borderRadius: "6px", border: "none", background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: ".85rem" };
const sectionLabel = { fontSize: ".68rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: "6px" };
const paletteItem = {
  display: "flex", alignItems: "center", gap: "8px",
  padding: "7px 9px", borderRadius: "8px", marginBottom: "3px",
  border: "1px solid var(--border)", background: "var(--bg)",
  cursor: "grab", color: "var(--text)", transition: "box-shadow .1s",
};
const zoomBtn = {
  width: "30px", height: "30px", borderRadius: "8px",
  border: "1px solid var(--border)", background: "var(--bg)",
  color: "var(--text)", cursor: "pointer",
  fontSize: "1rem", fontWeight: 700,
  display: "flex", alignItems: "center", justifyContent: "center",
};
