import { useState, useEffect } from "react";
import { useOrganization, ROLES, MODULES, PERMISSIONS } from "../../hooks/useOrganization.jsx";
import { getAuth } from "firebase/auth";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";

const db = getFirestore();

export default function Organization() {
  const {
    orgs, currentOrg, currentOrgId, setCurrentOrgId,
    members, myRole, invitations,
    createOrg, inviteMember, acceptInvitation, declineInvitation,
    cancelInvitation, resendInvitation,
    updateMember, removeMember, deleteOrg, reload,
  } = useOrganization();

  const [tab, setTab] = useState("members");   // members | invite | settings
  const [showCreate, setShowCreate] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [creating, setCreating] = useState(false);

  const uid = getAuth()?.currentUser?.uid;
  const isOwner = myRole === "owner";
  const isAdmin = myRole === "owner" || myRole === "admin";

  // If no org exists, show creation prompt
  if (orgs.length === 0 && invitations.length === 0) {
    return (
      <div>
        <h2 style={h2}>🏢 Organizace</h2>
        <EmptyOrg onCreate={() => setShowCreate(true)} />
        {showCreate && (
          <CreateOrgModal
            name={newOrgName} setName={setNewOrgName}
            creating={creating}
            onClose={() => setShowCreate(false)}
            onSubmit={async () => {
              setCreating(true);
              await createOrg(newOrgName.trim());
              setNewOrgName(""); setShowCreate(false); setCreating(false);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: "160px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ ...h2, marginBottom: "4px" }}>🏢 Organizace</h2>
          <p style={{ fontSize: ".85rem", color: "var(--text-muted)", margin: 0 }}>Správa týmu, členů a oprávnění.</p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {/* Org selector */}
          {orgs.length > 1 && (
            <select value={currentOrgId || ""} onChange={e => setCurrentOrgId(e.target.value)} style={inp}>
              {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          )}
          <button onClick={() => setShowCreate(true)} style={btnPrimary}>+ Nová organizace</button>
        </div>
      </div>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <div style={{ marginBottom: "20px" }}>
          <h3 style={h3}>📨 Pozvánky</h3>
          {invitations.map(inv => (
            <InvitationCard key={inv.id} invitation={inv}
              onAccept={() => acceptInvitation(inv.id)}
              onDecline={() => declineInvitation(inv.id)} />
          ))}
        </div>
      )}

      {currentOrg && (
        <>
          {/* Org header */}
          <div style={{ padding: "16px 20px", borderRadius: "12px", background: "var(--bg-card)", border: "1px solid var(--border)", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text)", margin: 0 }}>{currentOrg.name}</h3>
              <span style={{ fontSize: ".75rem", color: "var(--text-muted)" }}>
                {members.length + 1} {members.length === 0 ? "člen" : members.length < 4 ? "členové" : "členů"} · Tvoje role: <strong style={{ color: ROLES[myRole]?.label ? "var(--text)" : "#94a3b8" }}>{ROLES[myRole]?.label || "—"}</strong>
              </span>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: "4px", marginBottom: "20px", borderBottom: "1px solid var(--border)", paddingBottom: "0" }}>
            {[
              { key: "members", label: "👥 Členové" },
              ...(isAdmin ? [{ key: "invite", label: "📧 Pozvat" }] : []),
              ...(isOwner ? [{ key: "settings", label: "⚙️ Nastavení" }] : []),
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{
                  padding: "10px 16px", border: "none", cursor: "pointer", fontSize: ".85rem", fontWeight: 600,
                  background: "transparent", borderBottom: tab === t.key ? "2px solid #7c3aed" : "2px solid transparent",
                  color: tab === t.key ? "#7c3aed" : "var(--text-muted)",
                  transition: "color .15s, border-color .15s",
                }}>{t.label}</button>
            ))}
          </div>

          {/* Tab content */}
          {tab === "members" && (
            <MembersTab members={members} isAdmin={isAdmin} isOwner={isOwner}
              orgOwnerId={currentOrg.ownerId} uid={uid}
              onUpdate={updateMember} onRemove={removeMember} />
          )}
          {tab === "invite" && isAdmin && (
            <InviteTab orgId={currentOrgId} onInvite={inviteMember}
              onCancel={cancelInvitation} onResend={resendInvitation} onDone={reload} />
          )}
          {tab === "settings" && isOwner && (
            <SettingsTab org={currentOrg} onDelete={() => deleteOrg(currentOrgId)} />
          )}
        </>
      )}

      {showCreate && (
        <CreateOrgModal
          name={newOrgName} setName={setNewOrgName}
          creating={creating}
          onClose={() => setShowCreate(false)}
          onSubmit={async () => {
            setCreating(true);
            await createOrg(newOrgName.trim());
            setNewOrgName(""); setShowCreate(false); setCreating(false);
          }}
        />
      )}
    </div>
  );
}

// ─── Members Tab ─────────────────────────────────────────────────────────────
function MembersTab({ members, isAdmin, isOwner, orgOwnerId, uid, onUpdate, onRemove }) {
  const ownerEmail = getAuth()?.currentUser?.email;

  return (
    <div>
      {/* Owner row (always first) */}
      <div style={memberRow}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: ".9rem", fontWeight: 600, color: "var(--text)" }}>
            {ownerEmail} {orgOwnerId === uid && <span style={badge("owner")}>Vlastník (ty)</span>}
            {orgOwnerId !== uid && <span style={badge("owner")}>Vlastník</span>}
          </div>
          <div style={{ fontSize: ".72rem", color: "var(--text-muted)", marginTop: "2px" }}>
            Plný přístup ke všem modulům
          </div>
        </div>
      </div>

      {members.map(m => (
        <MemberRow key={m.id} member={m} isAdmin={isAdmin} isOwner={isOwner}
          isSelf={m.uid === uid} onUpdate={onUpdate} onRemove={onRemove} />
      ))}

      {members.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)", fontSize: ".88rem" }}>
          Zatím žádní další členové. Pozvi kolegy přes záložku „Pozvat".
        </div>
      )}
    </div>
  );
}

function MemberRow({ member: m, isAdmin, isOwner, isSelf, onUpdate, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [role, setRole] = useState(m.role);
  const [perms, setPerms] = useState(m.permissions || {});

  function saveChanges() {
    onUpdate(m.id, { role, permissions: perms });
    setEditing(false);
  }

  return (
    <div style={memberRow}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: ".9rem", fontWeight: 600, color: "var(--text)", display: "flex", alignItems: "center", gap: "8px" }}>
          {m.email}
          <span style={badge(m.role)}>{ROLES[m.role]?.label || m.role}</span>
          {isSelf && <span style={{ fontSize: ".65rem", color: "var(--text-muted)" }}>(ty)</span>}
        </div>

        {!editing && (
          <div style={{ display: "flex", gap: "6px", marginTop: "6px", flexWrap: "wrap" }}>
            {MODULES.map(mod => {
              const perm = (m.permissions || {})[mod.key] || "none";
              const cfg = PERMISSIONS[perm];
              return (
                <span key={mod.key} style={{
                  fontSize: ".65rem", padding: "2px 8px", borderRadius: "6px",
                  background: perm === "none" ? "var(--bg)" : `${cfg.color}15`,
                  color: perm === "none" ? "var(--text-muted)" : cfg.color,
                  fontWeight: 500, border: `1px solid ${perm === "none" ? "var(--border)" : cfg.color + "30"}`,
                }}>
                  {mod.icon} {mod.label}: {cfg.label}
                </span>
              );
            })}
          </div>
        )}

        {editing && (
          <div style={{ marginTop: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
              <label style={{ fontSize: ".78rem", fontWeight: 500, color: "var(--text-muted)" }}>Role:</label>
              <select value={role} onChange={e => setRole(e.target.value)} style={{ ...inp, width: "auto" }}>
                <option value="admin">Administrátor</option>
                <option value="editor">Editor</option>
                <option value="viewer">Prohlížeč</option>
              </select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px" }}>
              {MODULES.map(mod => (
                <div key={mod.key} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: ".78rem" }}>{mod.icon} {mod.label}:</span>
                  <select value={perms[mod.key] || "none"} onChange={e => setPerms(p => ({ ...p, [mod.key]: e.target.value }))}
                    style={{ ...inp, width: "auto", fontSize: ".78rem", padding: "4px 8px" }}>
                    <option value="none">Bez přístupu</option>
                    <option value="read">Číst</option>
                    <option value="write">Editovat</option>
                  </select>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: "6px", marginTop: "10px" }}>
              <button onClick={saveChanges} style={{ ...btnPrimary, padding: "6px 14px", fontSize: ".78rem" }}>Uložit</button>
              <button onClick={() => setEditing(false)} style={{ ...btnSecondary, padding: "6px 14px", fontSize: ".78rem" }}>Zrušit</button>
            </div>
          </div>
        )}
      </div>

      {isAdmin && !isSelf && (
        <div style={{ display: "flex", gap: "4px" }}>
          <button onClick={() => setEditing(e => !e)} style={btnSmall} title="Upravit oprávnění">⚙️</button>
          {isOwner && <button onClick={() => { if (confirm(`Odebrat ${m.email}?`)) onRemove(m.id); }} style={{ ...btnSmall, color: "#ef4444" }} title="Odebrat">🗑</button>}
        </div>
      )}
    </div>
  );
}

// ─── Invite Tab ──────────────────────────────────────────────────────────────
function InviteTab({ orgId, onInvite, onCancel, onResend, onDone }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [perms, setPerms] = useState({ pages: "write", domains: "read", funnels: "write", fbAds: "read" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    (async () => {
      const snap = await getDocs(query(collection(db, "orgInvitations"), where("orgId", "==", orgId), where("status", "==", "pending")));
      setPendingInvites(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    })();
  }, [orgId, sent, refreshKey]);

  async function handleInvite() {
    if (!email.trim()) return;
    setSending(true);
    try {
      await onInvite(orgId, email.trim(), role, perms);
      setSent(true);
      setEmail("");
      setTimeout(() => setSent(false), 3000);
      onDone();
    } catch (err) {
      alert("Chyba při odesílání pozvánky: " + err.message);
    }
    setSending(false);
  }

  return (
    <div>
      <div style={{ padding: "20px", borderRadius: "12px", background: "var(--bg-card)", border: "1px solid var(--border)", marginBottom: "20px" }}>
        <h4 style={{ fontSize: ".95rem", fontWeight: 700, color: "var(--text)", marginBottom: "16px" }}>Pozvat nového člena</h4>

        <label style={lbl}>E-mail kolegy</label>
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="kolega@firma.cz" style={{ ...inp, marginBottom: "12px" }} />

        <label style={lbl}>Role</label>
        <select value={role} onChange={e => setRole(e.target.value)} style={{ ...inp, marginBottom: "12px" }}>
          <option value="admin">Administrátor — může zvát a spravovat členy</option>
          <option value="editor">Editor — může upravovat obsah</option>
          <option value="viewer">Prohlížeč — jen čtení</option>
        </select>

        <label style={lbl}>Oprávnění k modulům</label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px", marginBottom: "16px" }}>
          {MODULES.map(mod => (
            <div key={mod.key} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: ".82rem" }}>{mod.icon} {mod.label}:</span>
              <select value={perms[mod.key] || "none"} onChange={e => setPerms(p => ({ ...p, [mod.key]: e.target.value }))}
                style={{ ...inp, width: "auto", fontSize: ".8rem", padding: "6px 8px" }}>
                <option value="none">Žádný</option>
                <option value="read">Číst</option>
                <option value="write">Editovat</option>
              </select>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <button onClick={handleInvite} disabled={!email.trim() || sending}
            style={{ ...btnPrimary, opacity: !email.trim() ? 0.5 : 1 }}>
            {sending ? "Odesílám..." : "📧 Odeslat pozvánku"}
          </button>
          <button onClick={() => {
            const link = window.location.origin + "/login";
            navigator.clipboard.writeText(link);
            setCopied(true); setTimeout(() => setCopied(false), 2000);
          }} style={{ ...btnSecondary, fontSize: ".82rem", padding: "10px 14px" }}>
            {copied ? "✓ Zkopírováno" : "🔗 Zkopírovat odkaz"}
          </button>
          {sent && <span style={{ fontSize: ".82rem", color: "#16a34a", fontWeight: 600 }}>✓ Pozvánka odeslána!</span>}
        </div>
      </div>

      {/* Pending invitations list */}
      {pendingInvites.length > 0 && (
        <div>
          <h4 style={{ fontSize: ".85rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "10px" }}>Čekající pozvánky</h4>
          {pendingInvites.map(inv => (
            <PendingInviteRow key={inv.id} inv={inv}
              onCancel={async () => { await onCancel(inv.id); setRefreshKey(k => k + 1); }}
              onResend={async () => { await onResend(inv.id); setRefreshKey(k => k + 1); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Pending Invite Row ──────────────────────────────────────────────────────
function PendingInviteRow({ inv, onCancel, onResend }) {
  const [resent, setResent] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const date = inv.createdAt?.toDate?.()?.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) || "";

  return (
    <div style={{ ...memberRow, background: "#fef9c320" }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: ".85rem", fontWeight: 600, color: "var(--text)" }}>{inv.email}</div>
        <div style={{ fontSize: ".72rem", color: "var(--text-muted)", marginTop: "2px" }}>
          Role: {ROLES[inv.role]?.label} · Odesláno: {date}
        </div>
        <div style={{ display: "flex", gap: "6px", marginTop: "6px", flexWrap: "wrap" }}>
          {MODULES.map(mod => {
            const perm = (inv.permissions || {})[mod.key] || "none";
            const cfg = PERMISSIONS[perm];
            if (perm === "none") return null;
            return (
              <span key={mod.key} style={{
                fontSize: ".6rem", padding: "1px 6px", borderRadius: "5px",
                background: `${cfg.color}15`, color: cfg.color, fontWeight: 500,
              }}>
                {mod.icon} {cfg.label}
              </span>
            );
          })}
        </div>
      </div>
      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
        <span style={{ fontSize: ".65rem", padding: "3px 10px", borderRadius: "8px", background: "#fef3c7", color: "#d97706", fontWeight: 600 }}>Čeká</span>
        <button onClick={async () => { await onResend(); setResent(true); setTimeout(() => setResent(false), 2000); }}
          style={{ ...btnSmall, color: "#3b82f6" }} title="Znovu odeslat pozvánku">
          {resent ? "✓" : "📧"}
        </button>
        <button onClick={async () => { setCancelling(true); await onCancel(); }}
          disabled={cancelling}
          style={{ ...btnSmall, color: "#ef4444" }} title="Zrušit pozvánku">
          {cancelling ? "..." : "✕"}
        </button>
      </div>
    </div>
  );
}

// ─── Settings Tab ────────────────────────────────────────────────────────────
function SettingsTab({ org, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div>
      <div style={{ padding: "20px", borderRadius: "12px", background: "var(--bg-card)", border: "1px solid var(--border)", marginBottom: "20px" }}>
        <h4 style={{ fontSize: ".95rem", fontWeight: 700, color: "var(--text)", marginBottom: "12px" }}>Informace o organizaci</h4>
        <div style={{ fontSize: ".85rem", color: "var(--text-muted)" }}>
          <strong>Název:</strong> {org.name}
        </div>
        <div style={{ fontSize: ".85rem", color: "var(--text-muted)", marginTop: "4px" }}>
          <strong>Vytvořeno:</strong> {org.createdAt?.toDate?.()?.toLocaleDateString("cs-CZ") || "—"}
        </div>
      </div>

      <div style={{ padding: "20px", borderRadius: "12px", background: "#fef2f2", border: "1px solid #fecaca" }}>
        <h4 style={{ fontSize: ".95rem", fontWeight: 700, color: "#dc2626", marginBottom: "8px" }}>Nebezpečná zóna</h4>
        <p style={{ fontSize: ".82rem", color: "#7f1d1d", marginBottom: "12px" }}>Smazání organizace odebere přístup všem členům. Tuto akci nelze vrátit.</p>
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)} style={{ ...btnPrimary, background: "#ef4444" }}>🗑 Smazat organizaci</button>
        ) : (
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span style={{ fontSize: ".82rem", color: "#dc2626", fontWeight: 600 }}>Opravdu smazat?</span>
            <button onClick={onDelete} style={{ ...btnPrimary, background: "#dc2626" }}>Ano, smazat</button>
            <button onClick={() => setConfirmDelete(false)} style={btnSecondary}>Zrušit</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Shared Components ───────────────────────────────────────────────────────
function EmptyOrg({ onCreate }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 24px", borderRadius: "12px", background: "var(--bg-card)", border: "1px solid var(--border)" }}>
      <div style={{ fontSize: "3rem", marginBottom: "16px" }}>🏢</div>
      <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--text)", marginBottom: "8px" }}>Zatím nemáš organizaci</h3>
      <p style={{ fontSize: ".88rem", color: "var(--text-muted)", marginBottom: "20px" }}>
        Vytvoř organizaci, pozvi kolegy a sdílej s nimi stránky, reklamy a funely.
      </p>
      <button onClick={onCreate} style={btnPrimary}>+ Vytvořit organizaci</button>
    </div>
  );
}

function CreateOrgModal({ name, setName, creating, onClose, onSubmit }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "var(--bg-card)", borderRadius: "16px", padding: "28px", width: "95%", maxWidth: "440px", boxShadow: "0 8px 32px rgba(0,0,0,.15)" }}>
        <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text)", marginBottom: "16px" }}>Nová organizace</h3>
        <label style={lbl}>Název organizace</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="např. Moje firma s.r.o." autoFocus style={inp}
          onKeyDown={e => e.key === "Enter" && name.trim() && onSubmit()} />
        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "20px" }}>
          <button onClick={onClose} style={btnSecondary}>Zrušit</button>
          <button onClick={onSubmit} disabled={!name.trim() || creating}
            style={{ ...btnPrimary, opacity: !name.trim() ? 0.5 : 1 }}>
            {creating ? "Vytvářím..." : "Vytvořit"}
          </button>
        </div>
      </div>
    </div>
  );
}

function InvitationCard({ invitation: inv, onAccept, onDecline }) {
  return (
    <div style={{ ...memberRow, background: "#ede9fe40", borderColor: "#7c3aed40" }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: ".9rem", fontWeight: 600, color: "var(--text)" }}>
          Pozvánka do organizace
        </div>
        <div style={{ fontSize: ".78rem", color: "var(--text-muted)", marginTop: "2px" }}>
          Role: {ROLES[inv.role]?.label || inv.role}
        </div>
      </div>
      <div style={{ display: "flex", gap: "6px" }}>
        <button onClick={onAccept} style={{ ...btnPrimary, padding: "6px 14px", fontSize: ".78rem" }}>Přijmout</button>
        <button onClick={onDecline} style={{ ...btnSecondary, padding: "6px 14px", fontSize: ".78rem" }}>Odmítnout</button>
      </div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const h2 = { fontSize: "1.3rem", fontWeight: 700, color: "var(--text)", margin: 0 };
const h3 = { fontSize: ".95rem", fontWeight: 600, color: "var(--text)", marginBottom: "10px" };
const lbl = { display: "block", fontSize: ".78rem", fontWeight: 500, color: "var(--text-muted)", marginBottom: "4px" };
const inp = { width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontSize: ".85rem", outline: "none", boxSizing: "border-box" };
const btnPrimary = { padding: "10px 20px", borderRadius: "8px", border: "none", background: "#7c3aed", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: ".9rem" };
const btnSecondary = { padding: "10px 20px", borderRadius: "8px", border: "1px solid var(--border)", background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: ".85rem" };
const btnSmall = { padding: "4px 8px", borderRadius: "6px", border: "none", background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: ".8rem" };
const memberRow = {
  display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
  padding: "14px 16px", borderRadius: "10px", background: "var(--bg-card)", border: "1px solid var(--border)",
  marginBottom: "8px",
};

function badge(role) {
  const colors = {
    owner: { bg: "#fef3c7", text: "#d97706" },
    admin: { bg: "#ede9fe", text: "#7c3aed" },
    editor: { bg: "#dcfce7", text: "#16a34a" },
    viewer: { bg: "#f3f4f6", text: "#6b7280" },
  };
  const c = colors[role] || colors.viewer;
  return {
    display: "inline-block", padding: "1px 8px", borderRadius: "8px", fontSize: ".62rem", fontWeight: 700,
    background: c.bg, color: c.text, marginLeft: "4px",
  };
}
