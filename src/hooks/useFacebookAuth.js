import { useState, useEffect } from "react";
import { doc, deleteDoc, onSnapshot } from "firebase/firestore";
import { httpsCallable, getFunctions } from "firebase/functions";
import { db, auth } from "../firebase/config";

const functions = getFunctions();

// Povolené originy pro postMessage (hlavní okno i callback popup)
const ALLOWED_ORIGINS = [
  "https://sellfunl.web.app",
  "https://sellfunl.firebaseapp.com",
  "https://sellfunl.cz",
  "https://sellfunl.com",
  "http://localhost:5173",
];

/**
 * Hook pro správu Facebook OAuth propojení.
 */
export function useFacebookAuth() {
  const [fbAccount, setFbAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exchanging, setExchanging] = useState(false);

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

  // Poslouchej postMessage z popup callback okna
  useEffect(() => {
    function handleMessage(event) {
      // Ověř origin — povolit vlastní doménu i Firebase hosting
      if (!ALLOWED_ORIGINS.includes(event.origin)) return;
      if (event.data?.type !== "FB_OAUTH_CALLBACK") return;

      const { code, state } = event.data;
      if (!code || !state) return;

      exchangeToken(code, state);
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Vyměň code za access token přes Cloud Function
  async function exchangeToken(code, state) {
    setExchanging(true);
    try {
      const exchange = httpsCallable(functions, "facebookExchangeToken");
      await exchange({ code, state });
      // Firestore onSnapshot automaticky aktualizuje fbAccount
    } catch (err) {
      console.error("FB token exchange error:", err);
      alert("Nepodařilo se propojit účet s Facebookem. Zkus to znovu.");
    } finally {
      setExchanging(false);
    }
  }

  // Spustí Facebook OAuth flow
  async function connect() {
    try {
      const createLink = httpsCallable(functions, "facebookCreateConnectLink");
      const { data } = await createLink();

      if (data?.url) {
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

  return { fbAccount, loading, exchanging, connect, disconnect };
}
