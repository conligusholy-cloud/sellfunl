import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { httpsCallable, getFunctions } from "firebase/functions";
import { auth } from "../../firebase/config";

const functions = getFunctions();

/**
 * Callback stránka pro Facebook OAuth.
 * Facebook přesměruje sem s ?code=...&state=...
 * Počká na Firebase Auth init, vyměni code za token a zavře okno.
 */
export default function FacebookCallback() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Propojuji s Facebookem…");

  useEffect(() => {
    async function run() {
      // Počkej až Firebase Auth obnoví session z IndexedDB
      await auth.authStateReady();

      if (!auth.currentUser) {
        setStatus("error");
        setMessage("Nejsi přihlášen. Zavři toto okno a zkus to znovu.");
        setTimeout(() => window.close(), 3000);
        return;
      }

      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const error = searchParams.get("error");

      if (error) {
        setStatus("error");
        setMessage("Propojení bylo zrušeno.");
        setTimeout(() => window.close(), 2000);
        return;
      }

      if (!code || !state) {
        setStatus("error");
        setMessage("Chybí autorizační kód.");
        setTimeout(() => window.close(), 2000);
        return;
      }

      try {
        const exchange = httpsCallable(functions, "facebookExchangeToken");
        const { data } = await exchange({ code, state });

        setStatus("success");
        setMessage(`Propojeno jako ${data.name || "Facebook účet"}`);
        setTimeout(() => window.close(), 1500);
      } catch (err) {
        console.error("FB token exchange error:", err);
        setStatus("error");
        setMessage("Nepodařilo se propojit účet. Zkus to znovu.");
        setTimeout(() => window.close(), 3000);
      }
    }

    run();
  }, [searchParams]);

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", background: "#f9fafb",
    }}>
      <div style={{
        padding: "40px", borderRadius: "16px", textAlign: "center",
        background: "#fff", boxShadow: "0 4px 24px rgba(0,0,0,.08)",
        maxWidth: "360px", width: "100%",
      }}>
        {status === "loading" && (
          <>
            <div style={{ fontSize: "2rem", marginBottom: "16px" }}>⏳</div>
            <p style={{ color: "#6b7280", fontSize: ".95rem" }}>{message}</p>
          </>
        )}

        {status === "success" && (
          <>
            <div style={{ fontSize: "2rem", marginBottom: "16px" }}>✅</div>
            <p style={{ color: "#16a34a", fontWeight: 600, fontSize: ".95rem" }}>{message}</p>
            <p style={{ color: "#9ca3af", fontSize: ".82rem", marginTop: "8px" }}>
              Toto okno se automaticky zavře…
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <div style={{ fontSize: "2rem", marginBottom: "16px" }}>❌</div>
            <p style={{ color: "#ef4444", fontWeight: 600, fontSize: ".95rem" }}>{message}</p>
            <p style={{ color: "#9ca3af", fontSize: ".82rem", marginTop: "8px" }}>
              Toto okno se automaticky zavře…
            </p>
          </>
        )}
      </div>
    </div>
  );
}
