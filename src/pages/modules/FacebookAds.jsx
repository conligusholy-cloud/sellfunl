import { useState } from "react";
import { useAuthState } from "../../hooks/useAuthState";
import { useFacebookAuth } from "../../hooks/useFacebookAuth";
import AdCopyGenerator from "../../components/modules/AdCopyGenerator";

// ─── Sekce modulu ──────────────────────────────────────────────────────────
const TABS = [
  { id: "connect",   icon: "🔗", label: "Propojení účtu" },
  { id: "creatives", icon: "🎨", label: "Kreativy" },
  { id: "copy",      icon: "✍️", label: "Texty reklam" },
  { id: "campaigns", icon: "📊", label: "Kampaně" },
];

export default function FacebookAds() {
  const { user } = useAuthState();
  const { fbAccount, loading: fbLoading, connect, disconnect } = useFacebookAuth();
  const [activeTab, setActiveTab] = useState("connect");

  return (
    <div>
      <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "8px", color: "var(--text)" }}>
        📣 Facebook reklamy
      </h2>
      <p style={{ fontSize: ".88rem", color: "var(--text-muted)", marginBottom: "24px" }}>
        Generuj kreativy, texty a spravuj kampaně přímo ze SellFunl.
      </p>

      {/* Záložky */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "24px", borderBottom: "1px solid var(--border)", paddingBottom: "0" }}>
        {TABS.map(tab => {
          const active = activeTab === tab.id;
          const disabled = tab.id !== "connect" && !fbAccount;
          return (
            <button
              key={tab.id}
              onClick={() => !disabled && setActiveTab(tab.id)}
              disabled={disabled}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "10px 16px", border: "none", cursor: disabled ? "not-allowed" : "pointer",
                background: "transparent",
                borderBottom: active ? "2px solid #7c3aed" : "2px solid transparent",
                color: disabled ? "var(--text-muted)" : active ? "#7c3aed" : "var(--text)",
                fontWeight: active ? 600 : 400,
                fontSize: ".88rem", opacity: disabled ? 0.5 : 1,
                transition: "all .15s",
              }}
            >
              <span>{tab.icon}</span> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Obsah záložek */}
      {activeTab === "connect" && (
        <FacebookConnectTab
          fbAccount={fbAccount}
          loading={fbLoading}
          onConnect={connect}
          onDisconnect={disconnect}
        />
      )}

      {activeTab === "creatives" && fbAccount && (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
          🎨 Generátor kreativ — připravuje se
        </div>
      )}

      {activeTab === "copy" && fbAccount && (
        <AdCopyGenerator />
      )}

      {activeTab === "campaigns" && fbAccount && (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
          📊 Správa kampaní — připravuje se
        </div>
      )}
    </div>
  );
}

// ─── Tab: Propojení FB účtu ────────────────────────────────────────────────
function FacebookConnectTab({ fbAccount, loading, onConnect, onDisconnect }) {
  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
        Načítám stav účtu…
      </div>
    );
  }

  if (fbAccount) {
    return (
      <div style={{
        padding: "24px", borderRadius: "12px",
        background: "var(--bg-card)", border: "1px solid var(--border)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
          <div style={{
            width: "40px", height: "40px", borderRadius: "50%",
            background: "#e8f5e9", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.2rem",
          }}>
            ✅
          </div>
          <div>
            <p style={{ fontWeight: 600, color: "var(--text)", margin: 0 }}>
              Facebook účet propojen
            </p>
            <p style={{ fontSize: ".85rem", color: "var(--text-muted)", margin: 0 }}>
              {fbAccount.accountName || fbAccount.fbPageId || "Připojeno"}
            </p>
          </div>
        </div>

        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px",
          padding: "16px", borderRadius: "8px", background: "var(--bg)", marginBottom: "16px",
        }}>
          <div>
            <p style={{ fontSize: ".75rem", color: "var(--text-muted)", margin: "0 0 4px" }}>Stav</p>
            <p style={{ fontSize: ".88rem", fontWeight: 600, color: "#16a34a", margin: 0 }}>Aktivní</p>
          </div>
          <div>
            <p style={{ fontSize: ".75rem", color: "var(--text-muted)", margin: "0 0 4px" }}>Propojeno</p>
            <p style={{ fontSize: ".88rem", fontWeight: 500, color: "var(--text)", margin: 0 }}>
              {fbAccount.connectedAt?.toDate?.()?.toLocaleDateString("cs-CZ") || "—"}
            </p>
          </div>
        </div>

        <button
          onClick={onDisconnect}
          style={{
            padding: "8px 16px", borderRadius: "8px",
            border: "1px solid #ef4444", background: "transparent",
            color: "#ef4444", cursor: "pointer", fontSize: ".85rem",
          }}
        >
          Odpojit účet
        </button>
      </div>
    );
  }

  // Nepřipojený stav
  return (
    <div style={{
      padding: "40px 24px", borderRadius: "12px", textAlign: "center",
      background: "var(--bg-card)", border: "1px solid var(--border)",
    }}>
      <div style={{ fontSize: "3rem", marginBottom: "16px" }}>📣</div>
      <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--text)", marginBottom: "8px" }}>
        Propoj svůj Facebook reklamní účet
      </h3>
      <p style={{ fontSize: ".88rem", color: "var(--text-muted)", marginBottom: "24px", maxWidth: "400px", margin: "0 auto 24px" }}>
        Pro vytváření kampaní a správu reklam potřebuješ propojit svůj Facebook Business účet se SellFunl.
      </p>

      <button
        onClick={onConnect}
        style={{
          display: "inline-flex", alignItems: "center", gap: "8px",
          padding: "12px 24px", borderRadius: "8px", border: "none",
          background: "#1877f2", color: "#fff", cursor: "pointer",
          fontWeight: 600, fontSize: ".95rem",
          transition: "background .15s",
        }}
        onMouseEnter={e => e.currentTarget.style.background = "#1565c0"}
        onMouseLeave={e => e.currentTarget.style.background = "#1877f2"}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
        Propojit s Facebookem
      </button>

      <div style={{ marginTop: "24px", padding: "16px", borderRadius: "8px", background: "var(--bg)", textAlign: "left" }}>
        <p style={{ fontSize: ".82rem", fontWeight: 600, color: "var(--text)", marginBottom: "8px" }}>
          Co budeš potřebovat:
        </p>
        <ul style={{ fontSize: ".82rem", color: "var(--text-muted)", margin: 0, paddingLeft: "16px", lineHeight: 1.8 }}>
          <li>Facebook Business účet s reklamním účtem</li>
          <li>Oprávnění spravovat reklamy</li>
          <li>Aktivní platební metodu na FB</li>
        </ul>
      </div>
    </div>
  );
}
