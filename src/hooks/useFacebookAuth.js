import { useState, useEffect } from "react";
import { doc, getDoc, deleteDoc, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, auth } from "../firebase/config";
import { getFunctions } from "firebase/functions";

const functions = getFunctions();

/**
 * Hook pro správu Facebook OAuth propojení.
 *
 * Vrací:
 * - fbAccount: objekt s daty propojeného účtu (nebo null)
 * - loading: načítání stavu
 * - connect(): spustí OAuth flow (otevře FB login popup)
 * - disconnect(): odpojí FB účet
 */
export function useFacebookAuth() {
  const [fbAccount, setFbAccount] = useState(null);
  const [loading, setLoading] = useState(true);

  // Poslouchej změny na facebookAccounts/{uid}
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setLoading(false); return; }

    const unsub = onSnapshot(
      doc(db, "facebookAccounts", uid),
      (snap) => {
        setFbAccount(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return unsub;
  }, [auth.currentUser?.uid]);

  // Spustí Facebook OAuth flow
  async function connect() {
    try {
      const createLink = httpsCallable(functions, "facebookCreateConnectLink");
      const { data } = await createLink();

      if (data?.url) {
        // Otevři Facebook login v novém okně
        const width = 600, height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        window.open(
          data.url,
          "fb-oauth",
          `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
        );
      }
    } catch (err) {
      console.error("Facebook connect error:", err);
      alert("Nepodařilo se propojit s Facebookem. Zkus to znovu.");
    }
  }

  // Odpojí Facebook účet
  async function disconnect() {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    if (!window.confirm("Opravdu chceš odpojit Facebook účet?")) return;

    try {
      await deleteDoc(doc(db, "facebookAccounts", uid));
      setFbAccount(null);
    } catch (err) {
      console.error("Facebook disconnect error:", err);
      alert("Nepodařilo se odpojit účet.");
    }
  }

  return { fbAccount, loading, connect, disconnect };
}
