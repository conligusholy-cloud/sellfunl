import { useState, useEffect } from "react";
import { doc, deleteDoc, onSnapshot } from "firebase/firestore";
import { httpsCallable, getFunctions } from "firebase/functions";
import { db, auth } from "../firebase/config";

const functions = getFunctions();

const ALLOWED_ORIGINS = [
  "https://sellfunl.web.app",
  "https://sellfunl.firebaseapp.com",
  "https://sellfunl.cz",
  "https://www.sellfunl.cz",
  "https://sellfunl.com",
  "https://www.sellfunl.com",
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
    console.log("[FB Auth] Setting up listener, uid:", uid);

    if (!uid) {
      console.log("[FB Auth] No uid, skipping listener");
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(
      doc(db, "facebookAccounts", uid),
      (snap) => {
        const exists = snap.exists();
        console.log("[FB Auth] Snapshot received, exists:", exists);
        if (exists) {
          console.log("[FB Auth] Account data:", snap.data().accountName);
        }
        setFbAccount(exists ? { id: snap.id, ...snap.data() } : null);
        setLoading(false);
      },
      (err) => {
        console.error("[FB Auth] onSnapshot error:", err.code, err.message);
        setLoading(false);
      }
    );

    return unsub;
  }, [auth.currentUser?.uid]);

  // Poslouchej postMessage z popup callback okna
  useEffect(() => {
    function handleMessage(event) {
      console.log("[FB Auth] postMessage received from:", event.origin, event.data?.type);

      if (!ALLOWED_ORIGINS.includes(event.origin)) {
        console.log("[FB Auth] Origin not allowed:", event.origin);
        return;
      }
      if (event.data?.type !== "FB_OAUTH_CALLBACK") return;

      const { code, state } = event.data;
      if (!code || !state) return;

      console.log("[FB Auth] Calling exchangeToken...");
      exchangeToken(code, state);
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  async function exchangeToken(code, state) {
    setExchanging(true);
    try {
      const exchange = httpsCallable(functions, "facebookExchangeToken");
      const result = await exchange({ code, state });
      console.log("[FB Auth] Token exchange success:", result.data);
    } catch (err) {
      console.error("[FB Auth] Token exchange error:", err.code, err.message);
      alert("Nepodařilo se propojit účet s Facebookem. Zkus to znovu.");
    } finally {
      setExchanging(false);
    }
  }

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
