import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Callback stránka pro Facebook OAuth (popup okno).
 * Nepotřebuje Firebase Auth — jen předá code/state zpět do hlavního okna.
 */
export default function FacebookCallback() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Propojuji s Facebookem…");

  useEffect(() => {
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

    // Pošli code a state do hlavního okna
    // Použijeme "*" protože hlavní okno může být na jiné doméně
    // (sellfunl.com vs sellfunl.web.app)
    if (window.opener) {
      window.opener.postMessage(
        { type: "FB_OAUTH_CALLBACK", code, state },
        "*"
      );
      setStatus("success");
      setMessage("Propojení dokončeno!");
      setTimeout(() => window.close(), 1000);
    } else {
      setStatus("error");
      setMessage("Nelze komunikovat s hlavním oknem. Zavři a zkus znovu.");
      setTimeout(() => window.close(), 3000);
    }
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
