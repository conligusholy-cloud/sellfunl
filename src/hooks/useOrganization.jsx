import { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  getFirestore, collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  doc, query, where, serverTimestamp, onSnapshot,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

const db = getFirestore();

// ─── Roles & Permissions ────────────────────────────────────────────────────
export const ROLES = {
  owner:  { label: "Vlastník",     level: 3 },
  admin:  { label: "Administrátor", level: 2 },
  editor: { label: "Editor",       level: 1 },
  viewer: { label: "Prohlížeč",    level: 0 },
};

export const MODULES = [
  { key: "pages",   label: "Stránky",    icon: "📄" },
  { key: "domains", label: "Domény",     icon: "🌐" },
  { key: "funnels", label: "Funely",     icon: "🔀" },
  { key: "fbAds",   label: "FB reklamy", icon: "📣" },
];

export const PERMISSIONS = {
  none:  { label: "Bez přístupu", color: "#94a3b8" },
  read:  { label: "Číst",        color: "#3b82f6" },
  write: { label: "Editovat",    color: "#16a34a" },
};

// ─── Context ────────────────────────────────────────────────────────────────
const OrgContext = createContext(null);

export function OrgProvider({ children }) {
  const [orgs, setOrgs] = useState([]);           // orgs the user belongs to
  const [currentOrgId, setCurrentOrgId] = useState(null);
  const [members, setMembers] = useState([]);
  const [myRole, setMyRole] = useState(null);      // my role in current org
  const [myPermissions, setMyPermissions] = useState({}); // {pages:"write", ...}
  const [loading, setLoading] = useState(true);
  const [invitations, setInvitations] = useState([]);

  const uid = getAuth()?.currentUser?.uid;
  const email = getAuth()?.currentUser?.email;

  // Load orgs I belong to
  const loadOrgs = useCallback(async () => {
    if (!uid) { setLoading(false); return; }
    try {
      // 1. Orgs I own
      const ownedSnap = await getDocs(query(collection(db, "organizations"), where("ownerId", "==", uid)));
      const owned = ownedSnap.docs.map(d => ({ id: d.id, ...d.data(), _myRole: "owner" }));

      // 2. Orgs where I'm a member (by uid or email)
      const memberSnap = await getDocs(query(collection(db, "orgMembers"), where("uid", "==", uid)));
      const memberOrgIds = memberSnap.docs.map(d => d.data().orgId).filter(id => !owned.some(o => o.id === id));

      const memberOrgs = [];
      for (const orgId of memberOrgIds) {
        const orgDoc = await getDoc(doc(db, "organizations", orgId));
        if (orgDoc.exists()) {
          const memberDoc = memberSnap.docs.find(d => d.data().orgId === orgId);
          memberOrgs.push({ id: orgDoc.id, ...orgDoc.data(), _myRole: memberDoc?.data()?.role || "viewer" });
        }
      }

      const all = [...owned, ...memberOrgs];
      setOrgs(all);

      // Auto-select first org if none selected
      if (!currentOrgId && all.length > 0) {
        setCurrentOrgId(all[0].id);
      }

      // Load pending invitations for my email
      if (email) {
        const invSnap = await getDocs(query(collection(db, "orgInvitations"),
          where("email", "==", email.toLowerCase()), where("status", "==", "pending")));
        setInvitations(invSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    } catch (err) {
      console.error("Error loading orgs:", err);
    }
    setLoading(false);
  }, [uid, email, currentOrgId]);

  useEffect(() => { loadOrgs(); }, [loadOrgs]);

  // Load members of current org
  useEffect(() => {
    if (!currentOrgId) { setMembers([]); setMyRole(null); setMyPermissions({}); return; }
    const q = query(collection(db, "orgMembers"), where("orgId", "==", currentOrgId));
    const unsub = onSnapshot(q, (snap) => {
      const mems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMembers(mems);

      // Find my role + perms
      const me = mems.find(m => m.uid === uid);
      const org = orgs.find(o => o.id === currentOrgId);
      if (org?.ownerId === uid) {
        setMyRole("owner");
        setMyPermissions({ pages: "write", domains: "write", funnels: "write", fbAds: "write" });
      } else if (me) {
        setMyRole(me.role);
        setMyPermissions(me.permissions || {});
      } else {
        setMyRole(null);
        setMyPermissions({});
      }
    });
    return unsub;
  }, [currentOrgId, uid, orgs]);

  // ── Actions ──
  async function createOrg(name) {
    if (!uid) return;
    const docRef = await addDoc(collection(db, "organizations"), {
      name, ownerId: uid, createdAt: serverTimestamp(),
    });
    await loadOrgs();
    setCurrentOrgId(docRef.id);
    return docRef.id;
  }

  async function inviteMember(orgId, email, role, permissions) {
    await addDoc(collection(db, "orgInvitations"), {
      orgId, email: email.toLowerCase(), role, permissions,
      invitedBy: uid, status: "pending", createdAt: serverTimestamp(),
    });
  }

  async function acceptInvitation(invitationId) {
    const invDoc = await getDoc(doc(db, "orgInvitations", invitationId));
    if (!invDoc.exists()) return;
    const inv = invDoc.data();

    // Create member record
    await addDoc(collection(db, "orgMembers"), {
      orgId: inv.orgId, uid, email: email?.toLowerCase(),
      role: inv.role, permissions: inv.permissions || {},
      joinedAt: serverTimestamp(),
    });

    // Mark invitation as accepted
    await updateDoc(doc(db, "orgInvitations", invitationId), { status: "accepted" });
    await loadOrgs();
  }

  async function declineInvitation(invitationId) {
    await updateDoc(doc(db, "orgInvitations", invitationId), { status: "declined" });
    setInvitations(prev => prev.filter(i => i.id !== invitationId));
  }

  async function updateMember(memberId, patch) {
    await updateDoc(doc(db, "orgMembers", memberId), patch);
  }

  async function removeMember(memberId) {
    await deleteDoc(doc(db, "orgMembers", memberId));
  }

  async function deleteOrg(orgId) {
    // Remove all members
    const mSnap = await getDocs(query(collection(db, "orgMembers"), where("orgId", "==", orgId)));
    for (const d of mSnap.docs) await deleteDoc(d.ref);
    // Remove all invitations
    const iSnap = await getDocs(query(collection(db, "orgInvitations"), where("orgId", "==", orgId)));
    for (const d of iSnap.docs) await deleteDoc(d.ref);
    // Remove org
    await deleteDoc(doc(db, "organizations", orgId));
    setCurrentOrgId(null);
    await loadOrgs();
  }

  // Permission check helper
  function canAccess(module, level = "read") {
    if (myRole === "owner" || myRole === "admin") return true;
    const perm = myPermissions[module];
    if (level === "read") return perm === "read" || perm === "write";
    if (level === "write") return perm === "write";
    return false;
  }

  const currentOrg = orgs.find(o => o.id === currentOrgId) || null;

  return (
    <OrgContext.Provider value={{
      orgs, currentOrg, currentOrgId, setCurrentOrgId,
      members, myRole, myPermissions, loading,
      invitations, createOrg, inviteMember,
      acceptInvitation, declineInvitation,
      updateMember, removeMember, deleteOrg,
      canAccess, reload: loadOrgs,
    }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrganization() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrganization must be used within OrgProvider");
  return ctx;
}
