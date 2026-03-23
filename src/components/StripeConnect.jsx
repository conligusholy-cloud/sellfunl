import { useState, useEffect } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";

export default function StripeConnect() {
  const [status,  setStatus]  = useState(null);
  const [loading, setLoading] = useState(false);
  const functions = getFunctions();

  useEffect(() => {
    const getStatus = httpsCallable(functions, "getConnectStatus");
    getStatus()
      .then(res => setStatus(res.data))
      .catch(() => setStatus({ connected: false }));
  }, []);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const createOnboarding = httpsCallable(functions, "createConnectOnboarding");
      const res = await createOnboarding();
      window.location.href = res.data.url;
    } catch (err) {
      console.error(err);
      alert("Nepodařilo se spustit onboarding. Zkus to znovu.");
    } finally {
      setLoading(false);
    }
  };

  if (status === null) {
    return (
      <div style={s.card}>
        <span style={{ color:"var(--text-muted)", fontSize:".9rem" }}>Načítám stav platebního účtu...</span>
      </div>
    );
  }

  if (status.connected) {
    return (
      <div style={s.card}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"8px" }}>
          <span style={s.badgeGreen}>Platby aktivní</span>
        </div>
        <p style={s.text}>Tvůj Stripe účet je připojen a připraven přijímat platby od zákazníků.</p>
      </div>
    );
  }

  return (
    <div style={s.card}>
      <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"8px" }}>
        <span style={s.badgeOrange}>
          {status.detailsSubmitted ? "Čeká na ověření" : "Nepřipojeno"}
        </span>
      </div>
      <p style={s.text}>
        {status.detailsSubmitted
          ? "Tvůj účet čeká na ověření od Stripe. Může to trvat pár hodin."
          : "Připoj svůj bankovní účet a začni přijímat platby přímo přes sellfunl."}
      </p>
      {!status.detailsSubmitted && (
        <button onClick={handleConnect} disabled={loading} style={s.btn}>
          {loading ? "Přesměrovávám..." : "Připojit Stripe účet"}
        </button>
      )}
    </div>
  );
}

const s = {
  card: {
    padding: "20px",
    borderRadius: "12px",
    border: "1px solid var(--border)",
    background: "var(--bg-card)",
  },
  badgeGreen: {
    padding: "3px 10px",
    borderRadius: "20px",
    background: "#d1fae5",
    color: "#065f46",
    fontSize: "12px",
    fontWeight: 600,
  },
  badgeOrange: {
    padding: "3px 10px",
    borderRadius: "20px",
    background: "#fef3c7",
    color: "#92400e",
    fontSize: "12px",
    fontWeight: 600,
  },
  text: {
    fontSize: ".88rem",
    color: "var(--text-muted)",
    marginBottom: "14px",
    marginTop: "4px",
  },
  btn: {
    padding: "9px 18px",
    borderRadius: "8px",
    background: "#7c3aed",
    color: "#fff",
    border: "none",
    fontSize: ".88rem",
    fontWeight: 600,
    cursor: "pointer",
  },
};